import { redis } from "./redis";

// TTL constants in seconds
export const TTL = {
  USDA: 30 * 24 * 60 * 60,       // 30 days
  RESTAURANT: 7 * 24 * 60 * 60,   // 7 days
  MENU: 7 * 24 * 60 * 60,         // 7 days
  MACROS: 7 * 24 * 60 * 60,       // 7 days
  REVIEWS: 3 * 24 * 60 * 60,      // 3 days
  TRAFFIC: 15 * 60,                // 15 minutes
  DELIVERY: 15 * 60,               // 15 minutes
  QUERY: 5 * 60,                   // 5 minutes
} as const;

type CacheDomain = keyof typeof TTL;

/**
 * Get a cached value by key. Returns null on miss.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

/**
 * Set a cached value with the TTL for the given domain.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  domain: CacheDomain
): Promise<void> {
  await redis.set(key, JSON.stringify(value), "EX", TTL[domain]);
}

/**
 * Delete a cached key.
 */
export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

// ─── Semantic Query Cache ────────────────────────────────

export interface QueryCacheParams {
  searchText: string | null;
  dietaryFilters: string[];
  nutritionalGoal: string | null;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  categories: string[];
  sortBy: string | null;
}

/**
 * Normalize a user query into a canonical cache key.
 * This captures ~80% of duplicate query patterns with zero extra infrastructure.
 *
 * Format: query:<dietary_filters_sorted>:<goal>:<lat3>,<lng3>:r<radius>
 */
export function buildQueryCacheKey(params: QueryCacheParams): string {
  const text = params.searchText?.toLowerCase().trim() || "all";
  const filters = [...params.dietaryFilters].sort().join("|") || "none";
  const goal = params.nutritionalGoal || "none";
  // Round to 3 decimal places (~100m precision)
  const lat = params.latitude.toFixed(3);
  const lng = params.longitude.toFixed(3);
  const radius = params.radiusMiles.toFixed(1);
  const cats = [...params.categories].sort().join("|") || "none";
  const sort = params.sortBy || "default";

  return `query:${text}:${filters}:${goal}:${cats}:${sort}:${lat},${lng}:r${radius}`;
}

/**
 * Get cached query results.
 */
export async function getCachedQuery<T>(
  params: QueryCacheParams
): Promise<T | null> {
  const key = buildQueryCacheKey(params);
  return cacheGet<T>(key);
}

/**
 * Cache query results.
 */
export async function setCachedQuery(
  params: QueryCacheParams,
  value: unknown
): Promise<void> {
  const key = buildQueryCacheKey(params);
  await cacheSet(key, value, "QUERY");
}

// ─── Cache Invalidation ─────────────────────────────────

/**
 * Invalidate all cached data for a specific restaurant.
 * Uses prefix-based scan (restaurant:<id>:*) instead of full wildcard (*<id>*)
 * which is much faster as it narrows the keyspace.
 * Also invalidates all query caches since they may reference this restaurant.
 */
export async function invalidateRestaurant(
  restaurantId: string
): Promise<number> {
  let deleted = 0;
  let cursor = "0";

  // Scan only keys with the restaurant prefix pattern
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      `restaurant:${restaurantId}:*`,
      "COUNT",
      200
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== "0");

  // Also invalidate query cache since search results may include this restaurant
  deleted += await invalidateAllQueries();

  return deleted;
}

/**
 * Invalidate all query cache entries (e.g., after a bulk data refresh).
 */
export async function invalidateAllQueries(): Promise<number> {
  let deleted = 0;
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      "query:*",
      "COUNT",
      100
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== "0");

  return deleted;
}

export { redis } from "./redis";
