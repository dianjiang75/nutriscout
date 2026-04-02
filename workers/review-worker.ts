import { Worker, type Job } from "bullmq";
import { connection, reviewQueue } from "./queues";

interface ReviewJobData {
  restaurantId: string;
  googlePlaceId?: string;
  yelpBusinessId?: string;
}

async function processReviewJob(job: Job<ReviewJobData>) {
  const { restaurantId, googlePlaceId, yelpBusinessId } = job.data;

  // Dynamic import to use the existing review aggregator
  const { aggregateReviews } = await import("../src/lib/agents/review-aggregator/index");

  job.log(`Aggregating reviews for restaurant ${restaurantId}`);

  const result = await aggregateReviews(
    restaurantId,
    googlePlaceId || "",
    yelpBusinessId || null
  );

  if (result.dishSummaries) {
    job.log(`Processed ${result.dishSummaries.length} dish review summaries`);
  }

  return { restaurantId, reviewCount: result.dishSummaries?.length || 0 };
}

export const reviewWorker = new Worker("review-aggregation", processReviewJob, {
  connection,
  concurrency: 2,
  limiter: { max: 5, duration: 60_000 }, // 5 reviews/min
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
});

reviewWorker.on("completed", (job) => {
  console.log(`[review-worker] Completed: ${job.id} — ${JSON.stringify(job.returnvalue)}`);
});

reviewWorker.on("failed", async (job, err) => {
  console.error(`[review-worker] Failed: ${job?.id} — ${err.message}`);

  // Move to dead letter queue after all retries exhausted
  if (job && job.attemptsMade >= (job.opts.attempts ?? 2)) {
    try {
      const { deadLetterQueue } = await import("./queues");
      await deadLetterQueue.add("review-failed", {
        originalQueue: "review-aggregation",
        jobId: job.id,
        data: job.data,
        error: err.message,
        attempts: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
      console.warn(`[review-worker] Job ${job.id} moved to dead letter queue`);
    } catch {
      // DLQ add failed — just log
    }
  }
});

async function shutdown() {
  console.log("[review-worker] Shutting down gracefully...");
  await reviewWorker.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { reviewQueue };
