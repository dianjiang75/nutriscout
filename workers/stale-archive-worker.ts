/**
 * BullMQ Worker for the Stale Archiver agent.
 *
 * Processes "stale-archive" queue jobs. Each job archives MenuItems that
 * weren't seen in the most recent crawl for a restaurant.
 *
 * Concurrency: 5 (pure DB operations, fast — no LLM or external API calls)
 */

import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);

// ─── Job types ──────────────────────────────────────────

interface ArchiveJobData {
  restaurantId: string;
  /** ISO 8601 timestamp string from the scrape agent */
  crawlTimestamp: string;
  /** Menu source to scope archival to (e.g., "website") */
  source: string;
}

interface ArchiveJobReturn {
  restaurantId: string;
  itemsArchived: number;
  circuitBreakerTripped: boolean;
}

// ─── Job processor ──────────────────────────────────────

async function processArchiveJob(
  job: Job<ArchiveJobData>
): Promise<ArchiveJobReturn> {
  const { restaurantId, crawlTimestamp, source } = job.data;

  console.log(
    `[stale-archive-worker] Processing: ${restaurantId} (job ${job.id}, source: ${source})`
  );

  const { archiveStaleItems } = await import(
    "../src/lib/agents/stale-archiver"
  );

  const result = await archiveStaleItems(
    restaurantId,
    new Date(crawlTimestamp),
    source
  );

  if (result.circuitBreakerTripped) {
    console.warn(
      `[stale-archive-worker] Circuit breaker tripped for ${restaurantId} — no items archived`
    );
  } else if (result.itemsArchived > 0) {
    console.log(
      `[stale-archive-worker] Done: archived ${result.itemsArchived} stale items for ${restaurantId}`
    );
  } else {
    console.log(
      `[stale-archive-worker] Done: no stale items for ${restaurantId}`
    );
  }

  return result;
}

// ─── Worker setup ───────────────────────────────────────

const worker = new Worker<ArchiveJobData>(
  "stale-archive",
  processArchiveJob,
  {
    connection,
    concurrency: 5, // Pure DB, fast
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        const base = Math.pow(3, attemptsMade) * 1000; // 3s, 9s, 27s
        const jitter = Math.random() * 500;
        return base + jitter;
      },
    },
  }
);

// ─── Event handlers ─────────────────────────────────────

worker.on("completed", async (job) => {
  console.log(`[stale-archive-worker] Job ${job.id} completed`);
});

worker.on("failed", async (job, err) => {
  console.error(
    `[stale-archive-worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
    err.message
  );

  // No DLQ for archive failures — they're idempotent and non-critical.
  // The next crawl cycle will try again.
});

// ─── Graceful shutdown ──────────────────────────────────

async function shutdown() {
  console.log("[stale-archive-worker] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { worker };
