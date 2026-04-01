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
  restaurantName: string;
}

async function processPhotoJob(job: Job<PhotoJobData>) {
  const { dishId, photoUrl, restaurantName } = job.data;

  console.log(`[photo-worker] Analyzing photo for dish ${dishId} at ${restaurantName}`);

  const { analyzeFoodPhoto } = await import("../src/lib/agents/vision-analyzer");

  // Use Haiku for cost efficiency on batch analysis
  const analysis = await analyzeFoodPhoto(photoUrl, "claude-haiku-4-5-20251001");

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
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      return Math.pow(5, attemptsMade) * 1000; // 5s, 25s
    },
  },
});

worker.on("completed", (job) => {
  console.log(`[photo-worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[photo-worker] Job ${job?.id} failed:`, err.message);
});

export { worker };
