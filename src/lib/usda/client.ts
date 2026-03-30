import { redis } from "@/lib/cache/redis";
import { checkRateLimit } from "./rate-limiter";
import {
  NUTRIENT_IDS,
  type USDAFoodDetail,
  type USDAFoodItem,
  type USDAMacroEstimate,
  type USDASearchResponse,
} from "./types";

const BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getApiKey(): string {
  const key = process.env.USDA_API_KEY;
  if (!key || key === "placeholder") {
    throw new Error("USDA_API_KEY is not configured");
  }
  return key;
}

async function cachedFetch<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as T;
  }

  const result = await fetcher();
  await redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);
  return result;
}

/**
 * Search USDA FoodData Central for foods matching a query.
 */
export async function searchFood(query: string, pageSize = 5): Promise<USDAFoodItem[]> {
  const cacheKey = `usda:search:${query.toLowerCase().trim()}:${pageSize}`;

  return cachedFetch(cacheKey, async () => {
    await checkRateLimit();

    const params = new URLSearchParams({
      api_key: getApiKey(),
      query,
      pageSize: String(pageSize),
      dataType: "Foundation,SR Legacy",
    });

    const res = await fetch(`${BASE_URL}/foods/search?${params}`);
    if (!res.ok) {
      throw new Error(`USDA search failed: ${res.status} ${res.statusText}`);
    }

    const data: USDASearchResponse = await res.json();
    return data.foods;
  });
}

/**
 * Get detailed nutrient information for a specific food by FDC ID.
 */
export async function getFoodDetails(fdcId: number): Promise<USDAFoodDetail> {
  const cacheKey = `usda:detail:${fdcId}`;

  return cachedFetch(cacheKey, async () => {
    await checkRateLimit();

    const params = new URLSearchParams({ api_key: getApiKey() });
    const res = await fetch(`${BASE_URL}/food/${fdcId}?${params}`);
    if (!res.ok) {
      throw new Error(`USDA detail fetch failed: ${res.status} ${res.statusText}`);
    }

    return res.json();
  });
}

/**
 * Extract a specific nutrient value (per 100g) from a search result item.
 */
function getNutrientFromSearchItem(food: USDAFoodItem, nutrientId: number): number {
  const nutrient = food.foodNutrients.find((n) => n.nutrientId === nutrientId);
  return nutrient?.value ?? 0;
}

/**
 * Compute a confidence score (0-1) based on how well the search result
 * matches the query. Uses the USDA search score if available.
 */
function computeConfidence(food: USDAFoodItem, query: string): number {
  const descLower = food.description.toLowerCase();
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/);

  // All query words appear in description → high base confidence
  const wordMatches = queryWords.filter((w) => descLower.includes(w)).length;
  const wordMatchRatio = wordMatches / queryWords.length;

  // Foundation data is higher quality than SR Legacy or Branded
  const dataTypeBonus = food.dataType === "Foundation" ? 0.1 : 0;

  // Exact substring match bonus
  const exactMatchBonus = descLower.includes(queryLower) ? 0.15 : 0;

  return Math.min(1, wordMatchRatio * 0.75 + dataTypeBonus + exactMatchBonus);
}

/**
 * Search for a food, pick the best match, and return macros scaled
 * to the specified portion size in grams.
 */
export async function estimateMacros(
  foodName: string,
  portionGrams: number
): Promise<USDAMacroEstimate> {
  const foods = await searchFood(foodName, 5);

  if (foods.length === 0) {
    throw new Error(`No USDA results for "${foodName}"`);
  }

  // Pick the best match (first result is typically best by USDA relevance)
  const best = foods[0];
  const scale = portionGrams / 100; // USDA values are per 100g

  const calories = getNutrientFromSearchItem(best, NUTRIENT_IDS.ENERGY) * scale;
  const protein = getNutrientFromSearchItem(best, NUTRIENT_IDS.PROTEIN) * scale;
  const carbs = getNutrientFromSearchItem(best, NUTRIENT_IDS.CARBS) * scale;
  const fat = getNutrientFromSearchItem(best, NUTRIENT_IDS.FAT) * scale;
  const fiber = getNutrientFromSearchItem(best, NUTRIENT_IDS.FIBER) * scale;

  return {
    calories: Math.round(calories * 10) / 10,
    protein_g: Math.round(protein * 10) / 10,
    carbs_g: Math.round(carbs * 10) / 10,
    fat_g: Math.round(fat * 10) / 10,
    fiber_g: Math.round(fiber * 10) / 10,
    serving_description: `${portionGrams}g of ${best.description}`,
    confidence: computeConfidence(best, foodName),
    usda_fdc_id: best.fdcId,
  };
}
