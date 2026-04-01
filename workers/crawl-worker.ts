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
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      // Exponential backoff: 5s, 25s, 125s
      return Math.pow(5, attemptsMade) * 1000;
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
          photos: { take: 1, orderBy: { createdAt: "desc" } },
        },
      });

      let queued = 0;
      for (const dish of dishes) {
        const photo = dish.photos[0];
        if (photo?.sourceUrl) {
          await photoAnalysisQueue.add(
            `analyze-${dish.id}`,
            { dishId: dish.id, photoUrl: photo.sourceUrl, restaurantName: result.restaurantName },
            {
              jobId: `photo-${dish.id}`, // Deduplication: same dish won't be analyzed twice
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

worker.on("failed", (job, err) => {
  console.error(`[crawl-worker] Job ${job?.id} failed:`, err.message);
});

export { worker };
