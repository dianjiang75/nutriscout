/**
 * Generic sliding-window rate limiter using Redis sorted sets.
 * Reuses the same pattern as the USDA rate limiter but parameterized.
 */
import { redis } from "@/lib/cache/redis";

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number | null;
}

/** Route-category rate limits. */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth: { maxRequests: 5, windowSeconds: 60 },
  search: { maxRequests: 60, windowSeconds: 60 },
  read: { maxRequests: 100, windowSeconds: 60 },
  write: { maxRequests: 20, windowSeconds: 60 },
  crawl: { maxRequests: 5, windowSeconds: 60 },
};

/** Map URL path prefixes to rate limit categories. */
export function getRouteCategory(pathname: string): string | null {
  if (pathname.startsWith("/api/auth")) return "auth";
  if (pathname.startsWith("/api/search")) return "search";
  if (pathname.startsWith("/api/crawl")) return "crawl";
  if (pathname.startsWith("/api/feedback")) return "write";
  if (pathname.startsWith("/api/health")) return null; // no limit
  if (pathname.startsWith("/api/")) return "read";
  return null;
}

export async function checkApiRateLimit(
  ip: string,
  category: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[category];
  if (!config) return { allowed: true, remaining: Infinity, retryAfterSeconds: null };

  const key = `ratelimit:${category}:${ip}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  try {
    await redis.zremrangebyscore(key, 0, windowStart);
    const count = await redis.zcard(key);

    if (count >= config.maxRequests) {
      const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
      const retryAfterMs =
        oldest.length >= 2
          ? Number(oldest[1]) + config.windowSeconds * 1000 - now
          : config.windowSeconds * 1000;

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    await redis.zadd(key, now, `${now}:${Math.random()}`);
    await redis.expire(key, config.windowSeconds);

    return {
      allowed: true,
      remaining: config.maxRequests - count - 1,
      retryAfterSeconds: null,
    };
  } catch {
    // If Redis is down, allow the request (fail open)
    return { allowed: true, remaining: -1, retryAfterSeconds: null };
  }
}
