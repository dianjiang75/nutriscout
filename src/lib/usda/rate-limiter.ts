/**
 * Simple sliding-window rate limiter using Redis.
 * USDA FoodData Central allows 1,000 requests/hour per IP (not 3,600).
 * https://fdc.nal.usda.gov/api-guide/
 * We use 900 as the limit to leave a buffer.
 */
import { redis } from "@/lib/cache/redis";

const RATE_LIMIT_KEY = "usda:rate_limit";
const MAX_REQUESTS = 900; // USDA actual limit: 1000/hour, using 900 for safety buffer
const WINDOW_SECONDS = 3600;

export async function checkRateLimit(): Promise<void> {
  const now = Date.now();
  const windowStart = now - WINDOW_SECONDS * 1000;

  // Remove entries outside the window
  await redis.zremrangebyscore(RATE_LIMIT_KEY, 0, windowStart);

  // Count current entries
  const count = await redis.zcard(RATE_LIMIT_KEY);

  if (count >= MAX_REQUESTS) {
    const oldestEntry = await redis.zrange(RATE_LIMIT_KEY, 0, 0, "WITHSCORES");
    const retryAfterMs = oldestEntry.length >= 2
      ? Number(oldestEntry[1]) + WINDOW_SECONDS * 1000 - now
      : WINDOW_SECONDS * 1000;

    throw new Error(
      `USDA rate limit exceeded (${MAX_REQUESTS}/hour). Retry after ${Math.ceil(retryAfterMs / 1000)}s`
    );
  }

  // Record this request
  await redis.zadd(RATE_LIMIT_KEY, now, `${now}:${Math.random()}`);
  await redis.expire(RATE_LIMIT_KEY, WINDOW_SECONDS);
}
