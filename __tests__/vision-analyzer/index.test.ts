import type { ClaudeVisionResponse } from "@/lib/agents/vision-analyzer/types";

// Mock Anthropic SDK
const mockCreate = jest.fn();
jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

// Mock USDA client
jest.mock("@/lib/usda/client", () => ({
  estimateMacros: jest.fn(),
}));

// Mock Prisma
jest.mock("@/lib/db/client", () => ({
  prisma: {
    dish: { update: jest.fn().mockResolvedValue({}) },
    dishPhoto: { create: jest.fn().mockResolvedValue({}) },
  },
}));

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

import { estimateMacros } from "@/lib/usda/client";
import {
  analyzeFoodPhoto,
  analyzeMultiplePhotos,
  batchAnalyzePhotos,
} from "@/lib/agents/vision-analyzer";
import { prisma } from "@/lib/db/client";

const mockEstimateMacros = estimateMacros as jest.MockedFunction<
  typeof estimateMacros
>;

function makeClaude(response: ClaudeVisionResponse) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(response) }],
  });
}

const basePadThai: ClaudeVisionResponse = {
  dish_name: "Pad Thai with shrimp",
  cuisine_type: "Thai",
  ingredients: [
    { name: "rice noodles", estimated_grams: 200, is_primary: true },
    { name: "shrimp", estimated_grams: 100, is_primary: true },
    { name: "peanuts", estimated_grams: 20, is_primary: false },
  ],
  total_portion_grams: 350,
  preparation_method: "stir-fried",
  confidence: 0.9,
};

describe("Vision Analyzer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("analyzeFoodPhoto", () => {
    it("identifies dish and cross-references USDA for macros", async () => {
      makeClaude(basePadThai);

      // Mock USDA responses for each ingredient
      mockEstimateMacros
        .mockResolvedValueOnce({
          calories: 260,
          protein_g: 3,
          carbs_g: 58,
          fat_g: 0.5,
          fiber_g: 1,
          serving_description: "200g of rice noodles",
          confidence: 0.8,
          usda_fdc_id: 100001,
        })
        .mockResolvedValueOnce({
          calories: 100,
          protein_g: 24,
          carbs_g: 0,
          fat_g: 0.5,
          fiber_g: 0,
          serving_description: "100g of shrimp",
          confidence: 0.85,
          usda_fdc_id: 100002,
        })
        .mockResolvedValueOnce({
          calories: 113,
          protein_g: 5,
          carbs_g: 3,
          fat_g: 10,
          fiber_g: 1.5,
          serving_description: "20g of peanuts",
          confidence: 0.9,
          usda_fdc_id: 100003,
        });

      const result = await analyzeFoodPhoto("https://example.com/padthai.jpg");

      expect(result.dish_name).toBe("Pad Thai with shrimp");
      expect(result.cuisine_type).toBe("Thai");
      expect(result.ingredients).toHaveLength(3);

      // Total: 260+100+113 = 473 cal
      expect(result.macros.calories.best_estimate).toBe(473);
      // High confidence (0.9) → ±15% margin
      expect(result.macros.calories.min).toBeCloseTo(473 * 0.85, 0);
      expect(result.macros.calories.max).toBeCloseTo(473 * 1.15, 0);

      expect(result.usda_references).toHaveLength(3);
      expect(result.confidence).toBe(0.9);
    });

    it("handles USDA lookup failures gracefully", async () => {
      makeClaude({
        ...basePadThai,
        ingredients: [
          { name: "mystery ingredient", estimated_grams: 100, is_primary: true },
        ],
      });

      mockEstimateMacros.mockRejectedValueOnce(new Error("No USDA results"));

      const result = await analyzeFoodPhoto("https://example.com/mystery.jpg");

      expect(result.ingredients).toHaveLength(1);
      expect(result.ingredients[0].macros).toBeUndefined();
      expect(result.macros.calories.best_estimate).toBe(0);
    });

    it("uses wider range for low confidence", async () => {
      makeClaude({
        ...basePadThai,
        confidence: 0.5,
        ingredients: [
          { name: "rice noodles", estimated_grams: 200, is_primary: true },
        ],
      });

      mockEstimateMacros.mockResolvedValueOnce({
        calories: 260,
        protein_g: 3,
        carbs_g: 58,
        fat_g: 0.5,
        fiber_g: 1,
        serving_description: "200g of rice noodles",
        confidence: 0.8,
        usda_fdc_id: 100001,
      });

      const result = await analyzeFoodPhoto("https://example.com/blurry.jpg");

      // Low confidence (0.5) → ±30% margin
      expect(result.macros.calories.min).toBeCloseTo(260 * 0.7, 0);
      expect(result.macros.calories.max).toBeCloseTo(260 * 1.3, 0);
    });
  });

  describe("analyzeMultiplePhotos", () => {
    function makeAnalysis(calories: number) {
      makeClaude({
        ...basePadThai,
        ingredients: [
          { name: "rice noodles", estimated_grams: 200, is_primary: true },
        ],
      });
      mockEstimateMacros.mockResolvedValueOnce({
        calories,
        protein_g: calories * 0.08,
        carbs_g: calories * 0.5,
        fat_g: calories * 0.03,
        fiber_g: 2,
        serving_description: "200g of rice noodles",
        confidence: 0.85,
        usda_fdc_id: 100001,
      });
    }

    it("averages macros from 3 photos: [400, 450, 500] → ~450", async () => {
      makeAnalysis(400);
      makeAnalysis(450);
      makeAnalysis(500);

      const result = await analyzeMultiplePhotos([
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
      ]);

      expect(result.macros.calories.best_estimate).toBe(450);
      expect(result.num_photos_analyzed).toBe(3);
      expect(result.outlier_indices).toHaveLength(0);

      // Ensemble range should be tighter than individual ±30% (low-conf single photo)
      const singleLowConfRange = 450 * 0.6; // ±30% = 60% total span
      const ensembleRange =
        result.macros.calories.max - result.macros.calories.min;
      expect(ensembleRange).toBeLessThan(singleLowConfRange);
    });

    it("detects outlier when one photo gives wildly different calories", async () => {
      makeAnalysis(400);
      makeAnalysis(420);
      makeAnalysis(380);
      makeAnalysis(1200); // outlier

      const result = await analyzeMultiplePhotos([
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
        "https://example.com/4.jpg",
      ]);

      expect(result.outlier_indices).toContain(3);
      // Average should be close to 400, not pulled up by the outlier
      expect(result.macros.calories.best_estimate).toBeLessThan(500);
    });

    it("throws with empty image array", async () => {
      await expect(analyzeMultiplePhotos([])).rejects.toThrow(
        "At least one image URL is required"
      );
    });
  });

  describe("batchAnalyzePhotos", () => {
    it("writes results to database for each job", async () => {
      makeClaude({
        ...basePadThai,
        ingredients: [
          { name: "rice noodles", estimated_grams: 200, is_primary: true },
        ],
      });
      mockEstimateMacros.mockResolvedValueOnce({
        calories: 260,
        protein_g: 3,
        carbs_g: 58,
        fat_g: 0.5,
        fiber_g: 1,
        serving_description: "200g of rice noodles",
        confidence: 0.8,
        usda_fdc_id: 100001,
      });

      await batchAnalyzePhotos([
        { dishId: "dish-123", imageUrl: "https://example.com/photo.jpg" },
      ]);

      expect(prisma.dish.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dish-123" },
          data: expect.objectContaining({
            macroSource: "vision_ai",
          }),
        })
      );
      expect(prisma.dishPhoto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dishId: "dish-123",
            sourcePlatform: "google_maps",
          }),
        })
      );
    });

    it("continues processing on individual job failure", async () => {
      // First job fails
      mockCreate.mockRejectedValueOnce(new Error("API error"));

      // Second job succeeds
      makeClaude({
        ...basePadThai,
        ingredients: [
          { name: "rice noodles", estimated_grams: 200, is_primary: true },
        ],
      });
      mockEstimateMacros.mockResolvedValueOnce({
        calories: 260,
        protein_g: 3,
        carbs_g: 58,
        fat_g: 0.5,
        fiber_g: 1,
        serving_description: "200g of rice noodles",
        confidence: 0.8,
        usda_fdc_id: 100001,
      });

      await batchAnalyzePhotos([
        { dishId: "dish-fail", imageUrl: "https://example.com/bad.jpg" },
        { dishId: "dish-ok", imageUrl: "https://example.com/good.jpg" },
      ]);

      // Only second job should have written to DB
      expect(prisma.dish.update).toHaveBeenCalledTimes(1);
      expect(prisma.dish.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "dish-ok" } })
      );
    });
  });
});
