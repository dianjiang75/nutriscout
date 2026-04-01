jest.mock("@/lib/cache/redis", () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    scan: jest.fn().mockResolvedValue(["0", []]),
  },
}));

import { redis } from "@/lib/cache/redis";
import {
  cacheGet,
  cacheSet,
  cacheDel,
  buildQueryCacheKey,
  getCachedQuery,
  setCachedQuery,
  invalidateRestaurant,
  TTL,
} from "@/lib/cache";

const mockRedis = redis as jest.Mocked<typeof redis>;

describe("Cache Layer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("cacheGet / cacheSet", () => {
    it("returns null on cache miss", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const result = await cacheGet("missing-key");
      expect(result).toBeNull();
    });

    it("returns parsed value on cache hit", async () => {
      const data = { name: "test", value: 42 };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(data));

      const result = await cacheGet<typeof data>("test-key");
      expect(result).toEqual(data);
    });

    it("sets value with correct TTL for each domain", async () => {
      await cacheSet("key1", { a: 1 }, "USDA");
      expect(mockRedis.set).toHaveBeenCalledWith(
        "key1",
        '{"a":1}',
        "EX",
        TTL.USDA
      );

      await cacheSet("key2", { b: 2 }, "TRAFFIC");
      expect(mockRedis.set).toHaveBeenCalledWith(
        "key2",
        '{"b":2}',
        "EX",
        TTL.TRAFFIC
      );
    });
  });

  describe("cacheDel", () => {
    it("deletes a key", async () => {
      await cacheDel("some-key");
      expect(mockRedis.del).toHaveBeenCalledWith("some-key");
    });
  });

  describe("buildQueryCacheKey", () => {
    it("builds canonical key with sorted dietary filters", () => {
      const key = buildQueryCacheKey({
        searchText: null,
        dietaryFilters: ["gluten_free", "vegan"],
        nutritionalGoal: "max_protein",
        latitude: 40.7357,
        longitude: -73.9911,
        radiusMiles: 2.0,
        categories: [],
        sortBy: null,
      });

      expect(key).toBe("query:all:gluten_free|vegan:max_protein:none:default:40.736,-73.991:r2.0");
    });

    it("sorts filters alphabetically regardless of input order", () => {
      const key1 = buildQueryCacheKey({
        searchText: null,
        dietaryFilters: ["vegan", "gluten_free"],
        nutritionalGoal: "max_protein",
        latitude: 40.735,
        longitude: -73.991,
        radiusMiles: 2.0,
        categories: [],
        sortBy: null,
      });
      const key2 = buildQueryCacheKey({
        searchText: null,
        dietaryFilters: ["gluten_free", "vegan"],
        nutritionalGoal: "max_protein",
        latitude: 40.735,
        longitude: -73.991,
        radiusMiles: 2.0,
        categories: [],
        sortBy: null,
      });

      expect(key1).toBe(key2);
    });

    it("handles no filters and no goal", () => {
      const key = buildQueryCacheKey({
        searchText: null,
        dietaryFilters: [],
        nutritionalGoal: null,
        latitude: 40.735,
        longitude: -73.991,
        radiusMiles: 1.5,
        categories: [],
        sortBy: null,
      });

      expect(key).toBe("query:all:none:none:none:default:40.735,-73.991:r1.5");
    });

    it("rounds lat/lng to 3 decimal places (~100m)", () => {
      const key = buildQueryCacheKey({
        searchText: null,
        dietaryFilters: ["vegan"],
        nutritionalGoal: null,
        latitude: 40.73578923,
        longitude: -73.99123456,
        radiusMiles: 2.0,
        categories: [],
        sortBy: null,
      });

      expect(key).toBe("query:all:vegan:none:none:default:40.736,-73.991:r2.0");
    });

    it("includes search text in cache key", () => {
      const key = buildQueryCacheKey({
        searchText: "pad thai",
        dietaryFilters: [],
        nutritionalGoal: null,
        latitude: 40.735,
        longitude: -73.991,
        radiusMiles: 2.0,
        categories: [],
        sortBy: null,
      });

      expect(key).toContain("pad thai");
    });
  });

  describe("getCachedQuery / setCachedQuery", () => {
    it("returns cached query results on hit", async () => {
      const params = {
        searchText: null,
        dietaryFilters: ["vegan"],
        nutritionalGoal: "max_protein" as const,
        latitude: 40.735,
        longitude: -73.991,
        radiusMiles: 2.0,
        categories: [] as string[],
        sortBy: null,
      };

      const expectedData = [{ dish: "Tofu Pad Thai", score: 0.95 }];
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(expectedData));

      const result = await getCachedQuery(params);
      expect(result).toEqual(expectedData);
    });

    it("sets query cache with QUERY TTL", async () => {
      const params = {
        searchText: null,
        dietaryFilters: ["vegan"],
        nutritionalGoal: "max_protein" as const,
        latitude: 40.735,
        longitude: -73.991,
        radiusMiles: 2.0,
        categories: [] as string[],
        sortBy: null,
      };

      await setCachedQuery(params, [{ dish: "test" }]);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining("query:all:vegan:max_protein:"),
        expect.any(String),
        "EX",
        TTL.QUERY
      );
    });
  });

  describe("invalidateRestaurant", () => {
    it("scans and deletes all keys matching restaurant ID", async () => {
      mockRedis.scan
        .mockResolvedValueOnce(["42", ["rest:abc123:menu", "rest:abc123:macros"]])
        .mockResolvedValueOnce(["0", ["rest:abc123:reviews"]]);

      const deleted = await invalidateRestaurant("abc123");

      expect(deleted).toBe(3);
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
    });

    it("returns 0 when no matching keys", async () => {
      mockRedis.scan.mockResolvedValueOnce(["0", []]);

      const deleted = await invalidateRestaurant("nonexistent");
      expect(deleted).toBe(0);
    });
  });
});
