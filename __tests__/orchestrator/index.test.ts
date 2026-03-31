import { verify } from "@/lib/evaluator";
import { cosineSimilarity, normalizeMacros } from "@/lib/similarity";
import type { DishResult } from "@/lib/orchestrator/types";
import type { DietaryFlags } from "@/types";

// Mock external deps
jest.mock("@/lib/cache/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    scan: jest.fn().mockResolvedValue(["0", []]),
  },
}));

jest.mock("@/lib/db/client", () => ({
  prisma: {
    dish: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    restaurant: { findUnique: jest.fn() },
    restaurantLogistics: { findUnique: jest.fn() },
  },
}));

function makeDish(overrides: Partial<DishResult> = {}): DishResult {
  return {
    id: `dish-${Math.random().toString(36).slice(2)}`,
    name: "Test Dish",
    description: "A test dish",
    photo_url: null,
    price: 12.99,
    category: "Mains",
    calories_min: 400,
    calories_max: 500,
    protein_min_g: 25,
    protein_max_g: 35,
    carbs_min_g: 30,
    carbs_max_g: 40,
    fat_min_g: 10,
    fat_max_g: 15,
    macro_confidence: 0.85,
    dietary_flags: {
      vegan: false,
      vegetarian: false,
      gluten_free: true,
      halal: null,
      kosher: null,
      dairy_free: true,
      nut_free: true,
    },
    dietary_confidence: 0.9,
    restaurant: {
      id: "rest-1",
      name: "Test Restaurant",
      address: "123 Test St",
      distance_miles: 0.5,
      google_rating: 4.2,
      cuisine_type: ["American"],
    },
    review_summary: null,
    logistics: null,
    delivery: null,
    warnings: [],
    ...overrides,
  };
}

describe("Apollo Evaluator", () => {
  it("returns all dishes when no dietary restrictions are set", () => {
    const dishes = [makeDish(), makeDish()];
    const noRestrictions: DietaryFlags = {
      vegan: null,
      vegetarian: null,
      gluten_free: null,
      halal: null,
      kosher: null,
      dairy_free: null,
      nut_free: null,
    };

    const result = verify(dishes, noRestrictions);
    expect(result).toHaveLength(2);
  });

  it("filters only vegan dishes for vegan user, sorted by inclusion", () => {
    const veganDish = makeDish({
      name: "Tofu Stir Fry",
      dietary_flags: {
        vegan: true, vegetarian: true, gluten_free: true,
        halal: true, kosher: true, dairy_free: true, nut_free: true,
      },
      dietary_confidence: 0.95,
      protein_max_g: 28,
    });
    const nonVeganDish = makeDish({
      name: "Grilled Chicken",
      dietary_flags: {
        vegan: false, vegetarian: false, gluten_free: true,
        halal: null, kosher: null, dairy_free: true, nut_free: true,
      },
      dietary_confidence: 0.9,
      protein_max_g: 45,
    });

    const restrictions: DietaryFlags = {
      vegan: true,
      vegetarian: null,
      gluten_free: null,
      halal: null,
      kosher: null,
      dairy_free: null,
      nut_free: null,
    };

    const result = verify([veganDish, nonVeganDish], restrictions);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Tofu Stir Fry");
  });

  it("excludes dish with dietary_confidence < 0.7 and vegan: null for vegan user", () => {
    const uncertainDish = makeDish({
      name: "Mystery Noodles",
      dietary_flags: {
        vegan: null, vegetarian: null, gluten_free: null,
        halal: null, kosher: null, dairy_free: null, nut_free: null,
      },
      dietary_confidence: 0.5,
    });

    const restrictions: DietaryFlags = {
      vegan: true,
      vegetarian: null,
      gluten_free: null,
      halal: null,
      kosher: null,
      dairy_free: null,
      nut_free: null,
    };

    const result = verify([uncertainDish], restrictions);
    expect(result).toHaveLength(0);
  });

  it("adds warning for vegan dish with confidence < 0.9", () => {
    const lowConfVegan = makeDish({
      name: "Likely Vegan Bowl",
      dietary_flags: {
        vegan: true, vegetarian: true, gluten_free: true,
        halal: true, kosher: true, dairy_free: true, nut_free: true,
      },
      dietary_confidence: 0.8,
    });

    const restrictions: DietaryFlags = {
      vegan: true,
      vegetarian: null,
      gluten_free: null,
      halal: null,
      kosher: null,
      dairy_free: null,
      nut_free: null,
    };

    const result = verify([lowConfVegan], restrictions);
    expect(result).toHaveLength(1);
    expect(result[0].warnings.length).toBeGreaterThan(0);
    expect(result[0].warnings[0]).toContain("not verified");
  });

  it("applies strict filtering for allergy-critical restrictions (nut_free)", () => {
    // Dish marked nut_free but low confidence → should be excluded
    const lowConfNutFree = makeDish({
      name: "Granola Bowl",
      dietary_flags: {
        vegan: true, vegetarian: true, gluten_free: false,
        halal: true, kosher: true, dairy_free: true, nut_free: true,
      },
      dietary_confidence: 0.7, // Below 0.85 threshold
    });

    // Dish marked nut_free with high confidence → should pass
    const highConfNutFree = makeDish({
      name: "Rice Bowl",
      dietary_flags: {
        vegan: true, vegetarian: true, gluten_free: true,
        halal: true, kosher: true, dairy_free: true, nut_free: true,
      },
      dietary_confidence: 0.92,
    });

    const restrictions: DietaryFlags = {
      vegan: null,
      vegetarian: null,
      gluten_free: null,
      halal: null,
      kosher: null,
      dairy_free: null,
      nut_free: true,
    };

    const result = verify([lowConfNutFree, highConfNutFree], restrictions);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Rice Bowl");
  });
});

describe("Similarity Engine", () => {
  describe("cosineSimilarity", () => {
    it("returns 1.0 for identical vectors", () => {
      const v = [0.5, 0.3, 0.7, 0.2];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
    });

    it("returns ~0 for orthogonal vectors", () => {
      const a = [1, 0, 0, 0];
      const b = [0, 1, 0, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0);
    });

    it("returns high similarity for proportional vectors", () => {
      const a = [1, 2, 3, 4];
      const b = [2, 4, 6, 8];
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
    });
  });

  describe("normalizeMacros", () => {
    it("returns null for null calories", () => {
      expect(normalizeMacros(null, 30, 50, 15)).toBeNull();
    });

    it("returns a unit vector", () => {
      const vec = normalizeMacros(500, 30, 60, 20);
      expect(vec).not.toBeNull();
      if (vec) {
        const magnitude = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
        expect(magnitude).toBeCloseTo(1.0);
      }
    });

    it("produces similar vectors for similar macros", () => {
      const a = normalizeMacros(450, 30, 50, 15);
      const b = normalizeMacros(480, 32, 52, 16);
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      if (a && b) {
        expect(cosineSimilarity(a, b)).toBeGreaterThan(0.99);
      }
    });

    it("produces different vectors for different macro profiles", () => {
      const highProtein = normalizeMacros(400, 50, 10, 10);
      const highCarb = normalizeMacros(400, 10, 80, 10);
      expect(highProtein).not.toBeNull();
      expect(highCarb).not.toBeNull();
      if (highProtein && highCarb) {
        expect(cosineSimilarity(highProtein, highCarb)).toBeLessThan(0.95);
      }
    });
  });
});
