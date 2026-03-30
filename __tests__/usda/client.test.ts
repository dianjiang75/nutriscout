import { searchFood, getFoodDetails, estimateMacros } from "@/lib/usda/client";
import { NUTRIENT_IDS } from "@/lib/usda/types";

// Mock Redis
jest.mock("@/lib/cache/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    zremrangebyscore: jest.fn().mockResolvedValue(0),
    zcard: jest.fn().mockResolvedValue(0),
    zadd: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  },
}));

// Set up env
process.env.USDA_API_KEY = "test-key";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const chickenSearchResponse = {
  totalHits: 1,
  currentPage: 1,
  totalPages: 1,
  foods: [
    {
      fdcId: 171077,
      description: "Chicken, broilers or fryers, breast, skinless, boneless, meat only, grilled",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientId: NUTRIENT_IDS.ENERGY, nutrientName: "Energy", nutrientNumber: "208", unitName: "KCAL", value: 165 },
        { nutrientId: NUTRIENT_IDS.PROTEIN, nutrientName: "Protein", nutrientNumber: "203", unitName: "G", value: 31.02 },
        { nutrientId: NUTRIENT_IDS.CARBS, nutrientName: "Carbohydrate, by difference", nutrientNumber: "205", unitName: "G", value: 0 },
        { nutrientId: NUTRIENT_IDS.FAT, nutrientName: "Total lipid (fat)", nutrientNumber: "204", unitName: "G", value: 3.57 },
        { nutrientId: NUTRIENT_IDS.FIBER, nutrientName: "Fiber, total dietary", nutrientNumber: "291", unitName: "G", value: 0 },
      ],
    },
  ],
};

const padThaiSearchResponse = {
  totalHits: 1,
  currentPage: 1,
  totalPages: 1,
  foods: [
    {
      fdcId: 168900,
      description: "Pad thai",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientId: NUTRIENT_IDS.ENERGY, nutrientName: "Energy", nutrientNumber: "208", unitName: "KCAL", value: 120 },
        { nutrientId: NUTRIENT_IDS.PROTEIN, nutrientName: "Protein", nutrientNumber: "203", unitName: "G", value: 5.5 },
        { nutrientId: NUTRIENT_IDS.CARBS, nutrientName: "Carbohydrate, by difference", nutrientNumber: "205", unitName: "G", value: 15 },
        { nutrientId: NUTRIENT_IDS.FAT, nutrientName: "Total lipid (fat)", nutrientNumber: "204", unitName: "G", value: 4.2 },
        { nutrientId: NUTRIENT_IDS.FIBER, nutrientName: "Fiber, total dietary", nutrientNumber: "291", unitName: "G", value: 1.0 },
      ],
    },
  ],
};

const chickenDetailResponse = {
  fdcId: 171077,
  description: "Chicken, broilers or fryers, breast, skinless, boneless, meat only, grilled",
  dataType: "Foundation",
  foodNutrients: [
    { nutrient: { id: NUTRIENT_IDS.ENERGY, number: "208", name: "Energy", unitName: "KCAL" }, amount: 165 },
    { nutrient: { id: NUTRIENT_IDS.PROTEIN, number: "203", name: "Protein", unitName: "G" }, amount: 31.02 },
    { nutrient: { id: NUTRIENT_IDS.CARBS, number: "205", name: "Carbohydrate, by difference", unitName: "G" }, amount: 0 },
    { nutrient: { id: NUTRIENT_IDS.FAT, number: "204", name: "Total lipid (fat)", unitName: "G" }, amount: 3.57 },
    { nutrient: { id: NUTRIENT_IDS.FIBER, number: "291", name: "Fiber, total dietary", unitName: "G" }, amount: 0 },
  ],
  foodPortions: [],
};

describe("USDA Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Redis cache mock to return null (cache miss)
    const { redis } = require("@/lib/cache/redis");
    (redis.get as jest.Mock).mockResolvedValue(null);
  });

  describe("searchFood", () => {
    it("searches for grilled chicken breast and returns results with protein > 25g per 100g", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(chickenSearchResponse),
      });

      const results = await searchFood("grilled chicken breast");

      expect(results).toHaveLength(1);
      const protein = results[0].foodNutrients.find(
        (n) => n.nutrientId === NUTRIENT_IDS.PROTEIN
      );
      expect(protein).toBeDefined();
      expect(protein!.value).toBeGreaterThan(25);
    });

    it("searches for pad thai and returns results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(padThaiSearchResponse),
      });

      const results = await searchFood("pad thai");

      expect(results).toHaveLength(1);
      expect(results[0].description.toLowerCase()).toContain("pad thai");
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(searchFood("test")).rejects.toThrow("USDA search failed");
    });
  });

  describe("getFoodDetails", () => {
    it("returns detailed nutrient info for a food", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(chickenDetailResponse),
      });

      const detail = await getFoodDetails(171077);

      expect(detail.fdcId).toBe(171077);
      expect(detail.foodNutrients.length).toBeGreaterThan(0);

      const protein = detail.foodNutrients.find(
        (n) => n.nutrient.id === NUTRIENT_IDS.PROTEIN
      );
      expect(protein).toBeDefined();
      expect(protein!.amount).toBeGreaterThan(25);
    });
  });

  describe("estimateMacros", () => {
    it("scales 200g chicken breast to ~2x the macros of 100g", async () => {
      // First call for 100g
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(chickenSearchResponse),
      });
      const macros100 = await estimateMacros("grilled chicken breast", 100);

      // Second call for 200g
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(chickenSearchResponse),
      });
      const macros200 = await estimateMacros("grilled chicken breast", 200);

      expect(macros200.calories).toBeCloseTo(macros100.calories * 2, 0);
      expect(macros200.protein_g).toBeCloseTo(macros100.protein_g * 2, 0);
      expect(macros200.fat_g).toBeCloseTo(macros100.fat_g * 2, 0);
      expect(macros200.carbs_g).toBeCloseTo(macros100.carbs_g * 2, 0);
    });

    it("returns confidence > 0 for a matching food", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(chickenSearchResponse),
      });

      const macros = await estimateMacros("chicken breast", 100);

      expect(macros.confidence).toBeGreaterThan(0);
      expect(macros.confidence).toBeLessThanOrEqual(1);
      expect(macros.usda_fdc_id).toBe(171077);
    });

    it("throws when no results are found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalHits: 0, foods: [] }),
      });

      await expect(estimateMacros("zzz_nonexistent_food_zzz", 100)).rejects.toThrow(
        "No USDA results"
      );
    });
  });

  describe("Redis caching", () => {
    it("returns cached results on cache hit", async () => {
      const { redis } = require("@/lib/cache/redis");
      (redis.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(chickenSearchResponse.foods)
      );

      const results = await searchFood("grilled chicken breast");

      expect(results).toHaveLength(1);
      // fetch should NOT have been called since we got a cache hit
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
