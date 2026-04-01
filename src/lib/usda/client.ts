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
export async function searchFood(query: string, pageSize = 5, requireAllWords = true): Promise<USDAFoodItem[]> {
  const cacheKey = `usda:search:${query.toLowerCase().trim()}:${pageSize}:${requireAllWords}`;

  return cachedFetch(cacheKey, async () => {
    await checkRateLimit();

    const params = new URLSearchParams({
      api_key: getApiKey(),
      query,
      pageSize: String(pageSize),
      dataType: "Foundation,SR Legacy",
      requireAllWords: String(requireAllWords),
    });

    const res = await fetch(`${BASE_URL}/foods/search?${params}`);
    if (!res.ok) {
      throw new Error(`USDA search failed: ${res.status} ${res.statusText}`);
    }

    const data: USDASearchResponse = await res.json();

    // If requireAllWords returned no results, retry without it
    if (data.foods.length === 0 && requireAllWords) {
      return searchFood(query, pageSize, false);
    }

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

  // Word boundary matching — prevents "pad" matching "iPad"
  const wordMatches = queryWords.filter((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(descLower);
  }).length;
  const wordMatchRatio = wordMatches / queryWords.length;

  // Foundation data is higher quality than SR Legacy or Branded
  const dataTypeBonus = food.dataType === "Foundation" ? 0.1 : 0;

  // Exact phrase match bonus (with word boundaries)
  const escapedQuery = queryLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exactMatchBonus = new RegExp(`\\b${escapedQuery}\\b`).test(descLower) ? 0.15 : 0;

  // Penalize if description is much longer than query (less specific match)
  const descWords = descLower.split(/[\s,]+/).filter(Boolean);
  const specificityPenalty = queryWords.length < descWords.length * 0.3 ? -0.1 : 0;

  return Math.min(1, Math.max(0, wordMatchRatio * 0.75 + dataTypeBonus + exactMatchBonus + specificityPenalty));
}

/**
 * Map common ingredient names to USDA-friendly search terms.
 * USDA describes foods in a specific way — this bridges the gap.
 */
const USDA_SYNONYMS: Record<string, string> = {
  "shrimp": "shrimp, cooked",
  "chicken": "chicken breast, cooked",
  "beef": "beef, ground, cooked",
  "pork": "pork, cooked",
  "salmon": "salmon, cooked",
  "tuna": "tuna, cooked",
  "tofu": "tofu, firm",
  "rice": "rice, white, cooked",
  "brown rice": "rice, brown, cooked",
  "pasta": "pasta, cooked",
  "noodles": "noodles, cooked",
  "egg": "egg, whole, cooked",
  "cheese": "cheese, cheddar",
  "butter": "butter, salted",
  "cream": "cream, heavy",
  "olive oil": "oil, olive",
  "vegetable oil": "oil, vegetable",
  "avocado": "avocado, raw",
  "potato": "potato, cooked",
  "sweet potato": "sweet potato, cooked",
  "broccoli": "broccoli, cooked",
  "spinach": "spinach, raw",
  "kale": "kale, raw",
  "tomato": "tomato, raw",
  "onion": "onion, raw",
  "garlic": "garlic, raw",
  "ginger": "ginger root, raw",
  "peanuts": "peanuts, dry-roasted",
  "almonds": "almonds",
  "coconut milk": "coconut milk, canned",
  "soy sauce": "soy sauce",
  "fish sauce": "fish sauce",
};

/**
 * Decompose compound food names into simpler search terms.
 * "Pad Thai shrimp with peanuts" → ["shrimp, cooked", "pad thai", "peanuts"]
 * Uses USDA synonym mapping to improve match quality.
 */
function decomposeIngredientName(name: string): string[] {
  const normalized = name.toLowerCase().trim();

  // Check synonym map first for exact matches
  if (USDA_SYNONYMS[normalized]) {
    return [USDA_SYNONYMS[normalized]];
  }

  // Common cooking modifiers to strip for cleaner USDA searches
  const modifiers = /\b(grilled|fried|baked|roasted|steamed|sauteed|sautéed|raw|fresh|organic|homemade|crispy|spicy|smoked|braised|poached|blanched)\b/gi;
  const cleaned = normalized.replace(modifiers, "").replace(/\s+/g, " ").trim();

  // If short enough, try the full name first then individual words
  if (cleaned.split(/\s+/).length <= 3) {
    return [cleaned];
  }

  // For compound names, try the full name first, then meaningful sub-phrases
  const words = cleaned.split(/\s+/).filter(
    (w) => w.length > 2 && !["with", "and", "the", "in", "on", "over", "served"].includes(w)
  );

  const queries = [cleaned];
  // Add 2-word sub-phrases (often match USDA entries better)
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    queries.push(USDA_SYNONYMS[phrase] || phrase);
  }
  // Add individual significant words as fallback (with synonym mapping)
  for (const word of words) {
    if (word.length > 4) queries.push(USDA_SYNONYMS[word] || word);
  }

  return [...new Set(queries)];
}

/**
 * Pick the best matching food from search results using confidence scoring.
 */
function pickBestMatch(
  allResults: { food: USDAFoodItem; query: string }[]
): { food: USDAFoodItem; query: string } | null {
  if (allResults.length === 0) return null;

  let bestScore = -1;
  let bestResult = allResults[0];

  for (const result of allResults) {
    const score = computeConfidence(result.food, result.query);
    // Prefer Foundation data even with slightly lower text match
    const typeBonus = result.food.dataType === "Foundation" ? 0.05 : 0;
    const finalScore = score + typeBonus;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestResult = result;
    }
  }

  return bestResult;
}

/**
 * Search for a food, pick the best match, and return macros scaled
 * to the specified portion size in grams. Uses query decomposition
 * for compound ingredient names that don't match USDA directly.
 */
export async function estimateMacros(
  foodName: string,
  portionGrams: number
): Promise<USDAMacroEstimate> {
  const queries = decomposeIngredientName(foodName);

  // Try each decomposed query, collect all results
  const allResults: { food: USDAFoodItem; query: string }[] = [];

  for (const query of queries) {
    try {
      const foods = await searchFood(query, 3);
      for (const food of foods) {
        allResults.push({ food, query });
      }
    } catch {
      // Skip failed queries, try next decomposition
      continue;
    }
    // If we got good results from full name, don't bother with sub-phrases
    if (allResults.length > 0 && query === queries[0]) {
      const topConf = computeConfidence(allResults[0].food, query);
      if (topConf >= 0.7) break;
    }
  }

  if (allResults.length === 0) {
    throw new Error(`No USDA results for "${foodName}"`);
  }

  const best = pickBestMatch(allResults)!;
  const scale = portionGrams / 100; // USDA values are per 100g

  const calories = getNutrientFromSearchItem(best.food, NUTRIENT_IDS.ENERGY) * scale;
  const protein = getNutrientFromSearchItem(best.food, NUTRIENT_IDS.PROTEIN) * scale;
  const carbs = getNutrientFromSearchItem(best.food, NUTRIENT_IDS.CARBS) * scale;
  const fat = getNutrientFromSearchItem(best.food, NUTRIENT_IDS.FAT) * scale;
  const fiber = getNutrientFromSearchItem(best.food, NUTRIENT_IDS.FIBER) * scale;

  return {
    calories: Math.round(calories * 10) / 10,
    protein_g: Math.round(protein * 10) / 10,
    carbs_g: Math.round(carbs * 10) / 10,
    fat_g: Math.round(fat * 10) / 10,
    fiber_g: Math.round(fiber * 10) / 10,
    serving_description: `${portionGrams}g of ${best.food.description}`,
    confidence: computeConfidence(best.food, best.query),
    usda_fdc_id: best.food.fdcId,
  };
}
