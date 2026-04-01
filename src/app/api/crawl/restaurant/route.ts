import { z } from "zod";
import { checkApiRateLimit } from "@/lib/middleware/rate-limiter";
import { apiSuccess, apiError, apiBadRequest, apiRateLimited } from "@/lib/utils/api-response";

const crawlBodySchema = z.object({
  google_place_id: z.string().min(1, "google_place_id is required").max(200),
});

export async function POST(request: Request) {
  try {
    // Rate limit: 5 req/min per IP (crawling is expensive)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const rl = await checkApiRateLimit(ip, "crawl");
    if (!rl.allowed) {
      return apiRateLimited(rl.retryAfterSeconds);
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return apiBadRequest("Invalid JSON body");
    }

    const parsed = crawlBodySchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest("Validation failed", parsed.error.flatten().fieldErrors as Record<string, unknown>);
    }

    const { google_place_id } = parsed.data;

    // Dynamic import to avoid loading heavy deps on cold start
    const { menuCrawlQueue } = await import("@/../workers/queues");

    const job = await menuCrawlQueue.add(
      "on-demand-crawl",
      { googlePlaceId: google_place_id },
      {
        jobId: `crawl-${google_place_id}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        // Prevent duplicate crawls of the same restaurant within 10 minutes
        deduplication: { id: `crawl:${google_place_id}`, ttl: 600000 },
      }
    );

    return apiSuccess({ job_id: job.id, status: "queued" }, 202);
  } catch {
    return apiError("Failed to queue crawl");
  }
}
