/**
 * BullMQ Worker for the Menu Scraper agent.
 *
 * Processes "menu-scrape" queue jobs. On completion, chains:
 *   1. menu-classify job (classify + promote to Dish)
 *   2. stale-archive job (archive items not seen this crawl)
 *   3. delivery-scrape → review-aggregation flow (via FlowProducer)
 *
 * Pattern follows crawl-worker.ts: IORedis connection, singleton PrismaClient
 * with PrismaPg adapter, graceful shutdown.
 */

import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);

// Singleton Prisma client for the worker process
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: 5,
  idleTimeoutMillis: 30000,
});
const prisma = new PrismaClient({ adapter });

// ─── Job types ──────────────────────────────────────────

interface ScrapeJobData {
  googlePlaceId: string;
}

interface ScrapeJobReturn {
  restaurantId: string;
  restaurantName: string;
  menuSource: string;
  itemsScraped: number;
  itemsStored: number;
  crawlTimestamp: string;
}

// ─── Job processor ──────────────────────────────────────

async function processScrapeJob(
  job: Job<ScrapeJobData>
): Promise<ScrapeJobReturn> {
  const { googlePlaceId } = job.data;

  console.log(
    `[menu-scrape-worker] Processing: ${googlePlaceId} (job ${job.id}, attempt ${job.attemptsMade + 1})`
  );

  const { scrapeRestaurantMenu } = await import(
    "../src/lib/agents/menu-scraper"
  );

  const result = await scrapeRestaurantMenu(googlePlaceId);

  console.log(
    `[menu-scrape-worker] Done: ${result.restaurantName} — ${result.itemsStored} items stored (source: ${result.menuSource})`
  );

  return result;
}

// ─── Worker setup ───────────────────────────────────────

const worker = new Worker<ScrapeJobData>("menu-scrape", processScrapeJob, {
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
      return base + jitter;
    },
  },
});

// ─── Completion handler — chain downstream agents ───────

worker.on("completed", async (job) => {
  console.log(`[menu-scrape-worker] Job ${job.id} completed`);

  try {
    const result = job.returnvalue as ScrapeJobReturn;
    if (!result?.restaurantId || result.itemsStored === 0) return;

    const { menuClassifyQueue, staleArchiveQueue } = await import("./queues");

    // Chain 1: Classify + promote to Dish
    await menuClassifyQueue.add(
      `classify-${result.restaurantId}`,
      { restaurantId: result.restaurantId },
      {
        jobId: `classify-${result.restaurantId}`,
        priority: 5,
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
      }
    );

    // Chain 2: Archive stale items
    await staleArchiveQueue.add(
      `archive-${result.restaurantId}`,
      {
        restaurantId: result.restaurantId,
        crawlTimestamp: result.crawlTimestamp,
        source: result.menuSource,
      },
      {
        jobId: `archive-${result.restaurantId}`,
        priority: 5,
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
      }
    );

    console.log(
      `[menu-scrape-worker] Queued classify + archive for ${result.restaurantName}`
    );

    // Chain 3: Photo analysis for dishes that have photos but no macro data
    try {
      const { photoAnalysisQueue } = await import("./queues");

      const dishes = await prisma.dish.findMany({
        where: {
          restaurantId: result.restaurantId,
          macroSource: null,
        },
        include: {
          photos: { take: 5, orderBy: { createdAt: "desc" } },
        },
      });

      const MAX_PHOTOS_PER_CRAWL = 20;
      let queued = 0;
      for (const dish of dishes) {
        if (queued >= MAX_PHOTOS_PER_CRAWL) break;
        const photo = dish.photos[0];
        if (photo?.sourceUrl) {
          const allPhotoUrls = dish.photos
            .map((p) => p.sourceUrl)
            .filter((url): url is string => !!url);

          const confidence = dish.macroConfidence
            ? Number(dish.macroConfidence)
            : 0;
          const priority =
            confidence === 0 ? 2 : confidence < 0.7 ? 1 : 3;

          await photoAnalysisQueue.add(
            `analyze-${dish.id}`,
            {
              dishId: dish.id,
              photoUrl: photo.sourceUrl,
              photoUrls:
                allPhotoUrls.length > 1 ? allPhotoUrls : undefined,
              restaurantName: result.restaurantName,
            },
            {
              jobId: `photo-${dish.id}`,
              priority,
              attempts: 2,
              backoff: { type: "exponential", delay: 5000 },
            }
          );
          queued++;
        }
      }

      if (queued > 0) {
        console.log(
          `[menu-scrape-worker] Queued ${queued} photo analysis jobs for ${result.restaurantName}`
        );
      }
    } catch (photoErr) {
      console.error(
        "[menu-scrape-worker] Failed to queue photo analysis:",
        (photoErr as Error).message
      );
    }

    // Chain 4: Delivery scrape → review aggregation (FlowProducer)
    try {
      const { flowProducer } = await import("./queues");
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: result.restaurantId },
        select: { googlePlaceId: true, yelpBusinessId: true },
      });

      if (restaurant) {
        await flowProducer.add({
          name: `review-after-delivery-${result.restaurantId}`,
          queueName: "review-aggregation",
          data: {
            restaurantId: result.restaurantId,
            googlePlaceId: restaurant.googlePlaceId,
            yelpBusinessId: restaurant.yelpBusinessId,
          },
          opts: { priority: 10 },
          children: [
            {
              name: `delivery-scrape-${result.restaurantId}`,
              queueName: "delivery-scrape",
              data: {
                restaurantId: result.restaurantId,
                skipFreshPlatforms: true,
              },
              opts: {
                jobId: `delivery-${result.restaurantId}`,
                priority: 5,
                attempts: 2,
                backoff: { type: "exponential", delay: 30000 },
              },
            },
          ],
        });
        console.log(
          `[menu-scrape-worker] Queued delivery -> review chain for ${result.restaurantName}`
        );
      }
    } catch (chainErr) {
      console.error(
        "[menu-scrape-worker] Failed to queue delivery/review chain:",
        (chainErr as Error).message
      );
    }
  } catch (err) {
    console.error(
      "[menu-scrape-worker] Failed to queue post-scrape jobs:",
      (err as Error).message
    );
  }
});

// ─── Failure handler ────────────────────────────────────

worker.on("failed", async (job, err) => {
  console.error(
    `[menu-scrape-worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
    err.message
  );

  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    try {
      const { deadLetterQueue } = await import("./queues");
      await deadLetterQueue.add("scrape-failed", {
        originalQueue: "menu-scrape",
        jobId: job.id,
        data: job.data,
        error: err.message,
        attempts: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
      console.warn(
        `[menu-scrape-worker] Job ${job.id} moved to dead letter queue`
      );
    } catch {
      // DLQ add failed — just log
    }
  }
});

// ─── Graceful shutdown ──────────────────────────────────

async function shutdown() {
  console.log("[menu-scrape-worker] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { worker };
