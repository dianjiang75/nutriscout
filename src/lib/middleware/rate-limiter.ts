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

// Monotonic counter for rate limit member uniqueness (avoids Math.random() collisions)
let memberCounter = 0;

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

/**
 * Lua script for atomic sliding-window rate limiting.
 *
 * KEYS[1] = sorted set key
 * ARGV[1] = window start timestamp (ms)
 * ARGV[2] = now timestamp (ms)
 * ARGV[3] = max requests allowed in window
 * ARGV[4] = unique member value for ZADD
 * ARGV[5] = TTL in seconds for EXPIRE
 *
 * Returns: [currentCount, allowed (1/0), oldestScore or 0]
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local windowStart = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local member = ARGV[4]
local ttl = tonumber(ARGV[5])

-- 1. Remove expired entries
redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)

-- 2. Count remaining entries
local count = redis.call('ZCARD', key)

-- 3. If under limit, add the new entry and set TTL
if count < maxRequests then
  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, ttl)
  return {count + 1, 1, 0}
end

-- 4. Over limit — return oldest score for retry-after calculation
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = 0
if #oldest >= 2 then
  oldestScore = tonumber(oldest[2])
end

return {count, 0, oldestScore}
`;

export async function checkApiRateLimit(
  ip: string,
  category: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[category];
  if (!config) return { allowed: true, remaining: Infinity, retryAfterSeconds: null };

  const key = `ratelimit:${category}:${ip}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;
  const member = `${now}:${++memberCounter}`;

  try {
    const result = (await redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      windowStart.toString(),
      now.toString(),
      config.maxRequests.toString(),
      member,
      config.windowSeconds.toString()
    )) as [number, number, number];

    const [count, allowed, oldestScore] = result;

    if (allowed === 1) {
      return {
        allowed: true,
        remaining: config.maxRequests - count,
        retryAfterSeconds: null,
      };
    }

    // Over limit — compute retry-after from the oldest entry in the window
    const retryAfterMs =
      oldestScore > 0
        ? oldestScore + config.windowSeconds * 1000 - now
        : config.windowSeconds * 1000;

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  } catch {
    // If Redis is down, allow the request (fail open)
    return { allowed: true, remaining: -1, retryAfterSeconds: null };
  }
}
