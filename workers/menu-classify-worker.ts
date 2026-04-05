/**
 * BullMQ Worker for the Menu Classifier agent.
 *
 * Processes "menu-classify" queue jobs. Each job classifies unclassified
 * MenuItems for a restaurant and promotes eligible ones to Dish records.
 *
 * Concurrency: 2 (LLM rate limited — both auditor and dietary analysis use LLMs)
 * No rate limiter — the LLM clients handle their own rate limiting.
 */

import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);

// ─── Job types ──────────────────────────────────────────

interface ClassifyJobData {
  restaurantId: string;
}

interface ClassifyJobReturn {
  restaurantId: string;
  itemsClassified: number;
  itemsPromoted: number;
  dishesAnalyzed: number;
}

// ─── Job processor ──────────────────────────────────────

async function processClassifyJob(
  job: Job<ClassifyJobData>
): Promise<ClassifyJobReturn> {
  const { restaurantId } = job.data;

  console.log(
    `[menu-classify-worker] Processing: ${restaurantId} (job ${job.id}, attempt ${job.attemptsMade + 1})`
  );

  const { classifyAndPromote } = await import(
    "../src/lib/agents/menu-classifier"
  );

  const result = await classifyAndPromote(restaurantId);

  console.log(
    `[menu-classify-worker] Done: ${result.itemsClassified} classified, ${result.itemsPromoted} promoted, ${result.dishesAnalyzed} analyzed`
  );

  return result;
}

// ─── Worker setup ───────────────────────────────────────

const worker = new Worker<ClassifyJobData>(
  "menu-classify",
  processClassifyJob,
  {
    connection,
    concurrency: 2, // LLM rate limited — auditor + dietary analysis
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        const base = Math.pow(5, attemptsMade) * 1000;
        const jitter = Math.random() * 1000;
        return base + jitter;
      },
    },
  }
);

// ─── Event handlers ─────────────────────────────────────

worker.on("completed", async (job) => {
  console.log(`[menu-classify-worker] Job ${job.id} completed`);
});

worker.on("failed", async (job, err) => {
  console.error(
    `[menu-classify-worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
    err.message
  );

  if (job && job.attemptsMade >= (job.opts.attempts ?? 2)) {
    try {
      const { deadLetterQueue } = await import("./queues");
      await deadLetterQueue.add("classify-failed", {
        originalQueue: "menu-classify",
        jobId: job.id,
        data: job.data,
        error: err.message,
        attempts: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
      console.warn(
        `[menu-classify-worker] Job ${job.id} moved to dead letter queue`
      );
    } catch {
      // DLQ add failed — just log
    }
  }
});

// ─── Graceful shutdown ──────────────────────────────────

async function shutdown() {
  console.log("[menu-classify-worker] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { worker };
