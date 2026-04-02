import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Singleton Prisma client for the worker process — avoids creating a new connection per job
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: 5,
  idleTimeoutMillis: 30000,
});
const prisma = new PrismaClient({ adapter });

interface PhotoJobData {
  dishId: string;
  photoUrl: string;
  photoUrls?: string[]; // Multiple photos for ensemble analysis
  restaurantName: string;
}

async function processPhotoJob(job: Job<PhotoJobData>) {
  const { dishId, photoUrl, photoUrls, restaurantName } = job.data;

  const urls = photoUrls && photoUrls.length > 1 ? photoUrls : [photoUrl];
  console.log(`[photo-worker] Analyzing ${urls.length} photo(s) for dish ${dishId} at ${restaurantName}`);

  const { analyzeFoodPhoto, analyzeMultiplePhotos } = await import("../src/lib/agents/vision-analyzer");

  // Use ensemble analysis when multiple photos available
  const analysis = urls.length > 1
    ? await analyzeMultiplePhotos(urls)
    : await analyzeFoodPhoto(urls[0]);

  // Skip low-confidence results — worse than no estimate
  // Research (2025) uses 0.5 threshold; we use 0.4 to be slightly more permissive
  if (analysis.confidence < 0.4) {
    console.warn(
      `[photo-worker] Skipping ${analysis.dish_name} — confidence ${(analysis.confidence * 100).toFixed(0)}% below 40% threshold`
    );
    return { dishId, dishName: analysis.dish_name, confidence: analysis.confidence, skipped: true };
  }

  // Update dish with macro estimates from vision analysis
  await prisma.dish.update({
    where: { id: dishId },
    data: {
      caloriesMin: analysis.macros.calories.min,
      caloriesMax: analysis.macros.calories.max,
      proteinMinG: analysis.macros.protein_g.min,
      proteinMaxG: analysis.macros.protein_g.max,
      carbsMinG: analysis.macros.carbs_g.min,
      carbsMaxG: analysis.macros.carbs_g.max,
      fatMinG: analysis.macros.fat_g.min,
      fatMaxG: analysis.macros.fat_g.max,
      macroSource: "vision_ai",
      macroConfidence: analysis.confidence,
      photoCountAnalyzed: { increment: 1 },
    },
  });

  console.log(
    `[photo-worker] Done: ${analysis.dish_name} — ${analysis.macros.calories.best_estimate} cal, confidence ${(analysis.confidence * 100).toFixed(0)}%`
  );

  return { dishId, dishName: analysis.dish_name, confidence: analysis.confidence };
}

const worker = new Worker<PhotoJobData>("photo-analysis", processPhotoJob, {
  connection,
  concurrency: 2, // Limit concurrent Claude API calls
  limiter: {
    max: 5,
    duration: 60000, // 5 photos per minute to manage API costs
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      const base = Math.pow(5, attemptsMade) * 1000;
      const jitter = Math.random() * 1000;
      return base + jitter; // 5s, 25s + jitter to prevent thundering herd
    },
  },
});

worker.on("completed", (job) => {
  console.log(`[photo-worker] Job ${job.id} completed`);
});

worker.on("failed", async (job, err) => {
  console.error(`[photo-worker] Job ${job?.id} failed:`, err.message);

  // Move to dead letter queue after all retries exhausted
  if (job && job.attemptsMade >= (job.opts.attempts ?? 2)) {
    try {
      const { deadLetterQueue } = await import("./queues");
      await deadLetterQueue.add("photo-failed", {
        originalQueue: "photo-analysis",
        jobId: job.id,
        data: job.data,
        error: err.message,
        attempts: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
      console.warn(`[photo-worker] Job ${job.id} moved to dead letter queue`);
    } catch {
      // DLQ add failed — just log
    }
  }
});

async function shutdown() {
  console.log("[photo-worker] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { worker };
