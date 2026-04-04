/**
 * BullMQ worker for delivery platform scraping (DoorDash + Uber Eats).
 *
 * Concurrency: 1 (single browser instance — headless Chromium is memory-heavy)
 * Rate: 2 restaurants/minute
 * Backoff: exponential starting at 30s
 */
import { Worker, type Job } from "bullmq";
import { connection } from "./queues";

interface DeliveryScrapeJobData {
  restaurantId: string;
  skipFreshPlatforms?: boolean;
}

async function processDeliveryScrapeJob(job: Job<DeliveryScrapeJobData>) {
  const { restaurantId, skipFreshPlatforms } = job.data;

  const { scrapeDeliveryPlatforms } = await import(
    "../src/lib/agents/delivery-scraper/index"
  );

  job.log(`Scraping delivery platforms for restaurant ${restaurantId}`);

  const result = await scrapeDeliveryPlatforms(
    restaurantId,
    skipFreshPlatforms ?? true
  );

  const platformSummary = result.platforms
    .map((p) => `${p.platform}: ${p.items.length} items, ${p.warnings.length} warnings`)
    .join("; ");

  job.log(
    `Done: ${result.totalItemsScraped} items scraped, ` +
    `${result.itemsMatchedToDishes} matched, ` +
    `${result.newDishesCreated} new dishes. ${platformSummary}`
  );

  return {
    restaurantId,
    restaurantName: result.restaurantName,
    totalItemsScraped: result.totalItemsScraped,
    itemsMatchedToDishes: result.itemsMatchedToDishes,
    newDishesCreated: result.newDishesCreated,
  };
}

export const deliveryWorker = new Worker(
  "delivery-scrape",
  processDeliveryScrapeJob,
  {
    connection,
    concurrency: 1, // Single browser instance
    limiter: { max: 2, duration: 60_000 }, // 2 restaurants/min
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  }
);

deliveryWorker.on("completed", (job) => {
  console.log(
    `[delivery-worker] Completed: ${job.id} — ${JSON.stringify(job.returnvalue)}`
  );
});

deliveryWorker.on("failed", async (job, err) => {
  console.error(
    `[delivery-worker] Failed: ${job?.id} — ${err.message}`
  );

  if (job && job.attemptsMade >= (job.opts.attempts ?? 2)) {
    try {
      const { deadLetterQueue } = await import("./queues");
      await deadLetterQueue.add("delivery-scrape-failed", {
        originalQueue: "delivery-scrape",
        jobId: job.id,
        data: job.data,
        error: err.message,
        attempts: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
      console.warn(
        `[delivery-worker] Job ${job.id} moved to dead letter queue`
      );
    } catch {
      // DLQ add failed
    }
  }
});

async function shutdown() {
  console.log("[delivery-worker] Shutting down gracefully...");
  // Close browser pool before worker
  try {
    const { closeBrowserPool } = await import(
      "../src/lib/agents/delivery-scraper/browser-pool"
    );
    await closeBrowserPool();
  } catch {
    // Ignore browser pool cleanup errors
  }
  await deliveryWorker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
