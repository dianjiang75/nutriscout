import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Singleton Prisma client for the worker process
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: 5,
  idleTimeoutMillis: 30000,
});
const prisma = new PrismaClient({ adapter });

interface CrawlJobData {
  googlePlaceId: string;
}

/**
 * To add a crawl job with deduplication, use:
 *   menuCrawlQueue.add('crawl', { googlePlaceId }, {
 *     jobId: `crawl-${googlePlaceId}`,
 *     ...
 *   })
 * BullMQ will silently ignore duplicates with the same jobId.
 */
async function processCrawlJob(job: Job<CrawlJobData>) {
  const { googlePlaceId } = job.data;

  console.log(`[crawl-worker] Processing: ${googlePlaceId} (job ${job.id}, attempt ${job.attemptsMade + 1})`);

  // Dynamic import to allow path alias resolution at runtime
  const { crawlRestaurant } = await import("../src/lib/agents/menu-crawler");

  const result = await crawlRestaurant(googlePlaceId);

  console.log(
    `[crawl-worker] Done: ${result.restaurantName} — ${result.dishesFound} dishes, source: ${result.menuSource}`
  );

  return result;
}

const worker = new Worker<CrawlJobData>("menu-crawl", processCrawlJob, {
  connection,
  concurrency: 3,
  limiter: {
    max: 10,
    duration: 60000, // 10 jobs per minute to respect API rate limits
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      const base = Math.pow(5, attemptsMade) * 1000; // 5s, 25s, 125s
      const jitter = Math.random() * 1000;
      return base + jitter; // + jitter to prevent thundering herd
    },
  },
});

worker.on("completed", async (job) => {
  console.log(`[crawl-worker] Job ${job.id} completed`);

  // Chain: queue photo analysis for dishes that have photos but no macro estimates
  try {
    const result = job.returnvalue;
    if (result?.restaurantId && result?.dishesFound > 0) {
      const { photoAnalysisQueue } = await import("./queues");

      // Find dishes from this restaurant that have photos but no macro data
      const dishes = await prisma.dish.findMany({
        where: {
          restaurantId: result.restaurantId,
          macroSource: null,
        },
        include: {
          photos: { take: 5, orderBy: { createdAt: "desc" } },
        },
      });

      // Cap photo batch to prevent queue flooding — 20 dishes max per crawl
      const MAX_PHOTOS_PER_CRAWL = 20;
      let queued = 0;
      for (const dish of dishes) {
        if (queued >= MAX_PHOTOS_PER_CRAWL) break;
        const photo = dish.photos[0];
        if (photo?.sourceUrl) {
          const allPhotoUrls = dish.photos
            .map((p) => p.sourceUrl)
            .filter((url): url is string => !!url);
          // Priority: lower number = higher priority
          // Re-analysis of low-confidence dishes (< 0.7) gets priority 1
          // New dishes without analysis get priority 2
          // High-confidence dishes (re-crawl refresh) get priority 3
          const confidence = dish.macroConfidence ? Number(dish.macroConfidence) : 0;
          const priority = confidence === 0 ? 2 : confidence < 0.7 ? 1 : 3;

          await photoAnalysisQueue.add(
            `analyze-${dish.id}`,
            {
              dishId: dish.id,
              photoUrl: photo.sourceUrl,
              photoUrls: allPhotoUrls.length > 1 ? allPhotoUrls : undefined,
              restaurantName: result.restaurantName,
            },
            {
              jobId: `photo-${dish.id}`, // Deduplication: same dish won't be analyzed twice
              priority,
              attempts: 2,
              backoff: { type: "exponential", delay: 5000 },
            }
          );
          queued++;
        }
      }

      if (queued > 0) {
        console.log(`[crawl-worker] Queued ${queued} photo analysis jobs for ${result.restaurantName}`);
      }
    }
  } catch (err) {
    console.error("[crawl-worker] Failed to queue photo analysis:", (err as Error).message);
  }
});

worker.on("failed", async (job, err) => {
  console.error(`[crawl-worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);

  // Move to dead letter queue after all retries exhausted
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    try {
      const { deadLetterQueue } = await import("./queues");
      await deadLetterQueue.add("crawl-failed", {
        originalQueue: "menu-crawl",
        jobId: job.id,
        data: job.data,
        error: err.message,
        attempts: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
      console.warn(`[crawl-worker] Job ${job.id} moved to dead letter queue`);
    } catch {
      // DLQ add failed — just log
    }
  }
});

async function shutdown() {
  console.log("[crawl-worker] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { worker };
