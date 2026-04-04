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
export async function searchFood(
  query: string,
  pageSize = 5,
  requireAllWords = true,
  includeBranded = false
): Promise<USDAFoodItem[]> {
  const cacheKey = `usda:search:${query.toLowerCase().trim()}:${pageSize}:${requireAllWords}:${includeBranded}`;

  return cachedFetch(cacheKey, async () => {
    await checkRateLimit();

    // Include Branded data type for chain restaurant lookups — 1M+ products including
    // major chain restaurant items (McDonald's, Chipotle, Sweetgreen). Foundation and
    // SR Legacy are higher quality for generic ingredients; Branded is better for chains.
    const dataType = includeBranded
      ? "Foundation,SR Legacy,Branded"
      : "Foundation,SR Legacy";

    const params = new URLSearchParams({
      api_key: getApiKey(),
      query,
      pageSize: String(pageSize),
      dataType,
      requireAllWords: String(requireAllWords),
    });

    const res = await fetch(`${BASE_URL}/foods/search?${params}`);
    if (!res.ok) {
      throw new Error(`USDA search failed: ${res.status} ${res.statusText}`);
    }

    const data: USDASearchResponse = await res.json();

    // If requireAllWords returned no results, retry with relaxed matching (one time only)
    if (data.foods.length === 0 && requireAllWords) {
      return searchFood(query, pageSize, false, includeBranded); // base case: requireAllWords=false won't recurse again
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
  // Peppers (added March 2026 — USDA v14.3)
  "jalapeno": "peppers, jalapeno, raw",
  "jalapeño": "peppers, jalapeno, raw",
  "poblano": "peppers, poblano, raw",
  "serrano": "peppers, serrano, raw",
  "habanero": "peppers, hot chili, raw",
  // Seafood
  "squid": "squid, cooked",
  "octopus": "octopus, cooked",
  "crab": "crab, cooked",
  "lobster": "lobster, cooked",
  "scallop": "scallops, cooked",
  "clam": "clams, cooked",
  "mussel": "mussels, cooked",
  // Common Asian ingredients
  "paneer": "cheese, paneer",
  "naan": "bread, naan",
  "lentils": "lentils, cooked",
  "chickpeas": "chickpeas, cooked",
  "edamame": "edamame, cooked",
  "sesame oil": "oil, sesame",
  "miso": "miso",
  "tempeh": "tempeh",
  "kimchi": "kimchi",
  // Common cooking ingredients
  "flour": "wheat flour, white, all-purpose",
  "sugar": "sugar, granulated",
  "honey": "honey",
  "maple syrup": "maple syrup",
  "bacon": "bacon, cooked",
  "ham": "ham, cooked",
  "lamb": "lamb, cooked",
  "duck": "duck, cooked",
  // Common Latin/Mediterranean
  "plantain": "plantain, cooked",
  "black beans": "black beans, cooked",
  "quinoa": "quinoa, cooked",
  "feta": "cheese, feta",
  "mozzarella": "cheese, mozzarella",
  "parmesan": "cheese, parmesan",
  "ricotta": "cheese, ricotta",
  "prosciutto": "ham, prosciutto",
  "pancetta": "bacon, pork, cooked",
  // Common baking/dessert
  "cream cheese": "cream cheese",
  "whipped cream": "cream, whipped",
  "chocolate": "chocolate, dark",
  "cocoa": "cocoa, dry powder",
  "cornstarch": "cornstarch",
  // Common grains
  "couscous": "couscous, cooked",
  "bulgur": "bulgur, cooked",
  "barley": "barley, cooked",
  "oats": "oats, regular, cooked",
  "polenta": "cornmeal, cooked",
  "tortilla": "tortilla, flour",
  // More proteins
  "turkey": "turkey breast, cooked",
  "venison": "deer, cooked",
  "bison": "bison, cooked",
  "anchovies": "anchovy, canned",
  "sardines": "sardines, canned",
  "prawns": "shrimp, cooked",
  "calamari": "squid, cooked",
  // Vegetables
  "zucchini": "zucchini, raw",
  "eggplant": "eggplant, cooked",
  "bell pepper": "peppers, sweet, raw",
  "mushrooms": "mushrooms, cooked",
  "cabbage": "cabbage, raw",
  "cauliflower": "cauliflower, cooked",
  "corn": "corn, sweet, cooked",
  "peas": "peas, green, cooked",
  "asparagus": "asparagus, cooked",
  "artichoke": "artichoke, cooked",
  "celery": "celery, raw",
  "cucumber": "cucumber, raw",
  "lettuce": "lettuce, raw",
  "arugula": "arugula, raw",
  "watercress": "cress, raw",
  "bean sprouts": "mung beans, sprouted, raw",
  "bamboo shoots": "bamboo shoots, canned",
  // Fruits
  "mango": "mango, raw",
  "pineapple": "pineapple, raw",
  "papaya": "papaya, raw",
  "banana": "banana, raw",
  "lime": "lime juice, raw",
  "lemon": "lemon juice, raw",
  "coconut": "coconut meat, raw",
  // Nuts/seeds
  "cashews": "cashews, raw",
  "walnuts": "walnuts",
  "pistachios": "pistachios, raw",
  "pine nuts": "pine nuts",
  "sesame seeds": "sesame seeds",
  "chia seeds": "chia seeds",
  "flaxseed": "flaxseed",
  // Seafood (USDA FDC October 2025 release — Foundation Foods additions)
  "mahi mahi": "fish, mahimahi, cooked",
  "mahi-mahi": "fish, mahimahi, cooked",
  "dolphinfish": "fish, mahimahi, cooked",
  "swordfish": "fish, swordfish, cooked",
  "halibut": "fish, halibut, cooked",
  "cod": "fish, cod, cooked",
  "tilapia": "fish, tilapia, cooked",
  "trout": "fish, trout, cooked",
  "snapper": "fish, snapper, cooked",
  "sea bass": "fish, sea bass, cooked",
  "striped bass": "fish, striped bass, cooked",
  "flounder": "fish, flounder, cooked",
  "sole": "fish, flounder or sole, cooked",
  // Sauces/condiments
  "tahini": "tahini",
  "sriracha": "hot sauce",
  "mayo": "mayonnaise",
  "mayonnaise": "mayonnaise",
  "ketchup": "ketchup",
  "mustard": "mustard, prepared",
  "vinegar": "vinegar",
  "coconut cream": "coconut cream, canned",
  // Ancient/specialty grains (trending 2025-2026, increasingly on menus)
  "farro": "farro, cooked",
  "freekeh": "wheat, freekeh, cooked",
  "teff": "teff grain, cooked",
  "amaranth": "amaranth grain, cooked",
  "forbidden rice": "rice, black, cooked",
  "black rice": "rice, black, cooked",
  "jasmine rice": "rice, white, jasmine, cooked",
  "wild rice": "wild rice, cooked",
  "basmati rice": "rice, white, basmati, cooked",
  "sushi rice": "rice, white, short-grain, cooked",
  "sticky rice": "rice, white, glutinous, cooked",
  "millet": "millet, cooked",
  "sorghum": "sorghum grain, cooked",
  "spelt": "spelt, cooked",
  // Japanese/SE Asian pantry staples
  "galangal": "ginger root, raw",  // USDA has no galangal entry; ginger is closest
  "lemongrass": "lemongrass, raw",
  "kaffir lime": "lime peel, raw",
  "yuzu": "lemon juice, raw",  // yuzu not in USDA; lemon juice is closest substitute
  "dashi": "fish broth",
  "bonito": "tuna, cooked",  // bonito flakes are dried tuna
  "katsuobushi": "tuna, cooked",
  "nori": "seaweed, dried",
  "wakame": "seaweed, dried",
  "kombu": "seaweed, dried",
  "hijiki": "seaweed, dried",
  "matcha": "tea, green, brewed",
  "ponzu": "lemon juice, raw",
  "furikake": "seaweed, dried",
  // Middle Eastern / Mediterranean additions
  "za'atar": "thyme, dried",
  "zaatar": "thyme, dried",
  "sumac": "spices, sumac",
  "pomegranate molasses": "pomegranate juice",
  "harissa": "hot sauce",
  "ras el hanout": "spices, mixed",
  "preserved lemon": "lemon juice, raw",
  "labneh": "yogurt, whole milk",
  "halloumi": "cheese, mozzarella",  // no USDA entry; similar protein/fat to mozzarella
  // Latin American additions
  "achiote": "spices, annatto",
  "epazote": "spices, mixed",
  "chipotle": "peppers, hot chili, raw",
  "ancho": "peppers, hot chili, raw",
  "guajillo": "peppers, hot chili, raw",
  "tomatillo": "tomato, green, raw",
  "jicama": "jicama, raw",
  "chayote": "chayote, raw",
  "nopal": "cactus, pads, raw",
  // Plant-based protein alternatives (growing menu presence 2026)
  "impossible meat": "beef, ground, cooked",  // macro proxy
  "beyond meat": "beef, ground, cooked",  // macro proxy
  "seitan": "wheat gluten, vital",
  "jackfruit": "jackfruit, raw",
  "cauliflower steak": "cauliflower, cooked",
  // Salad dressings / hidden calorie sources (USDA FDC Foundation Foods April 2026)
  // High-frequency items in restaurant salads — critical for accurate calorie estimates
  "ranch": "salad dressing, ranch",
  "ranch dressing": "salad dressing, ranch",
  "caesar dressing": "salad dressing, caesar",
  "vinaigrette": "salad dressing, vinaigrette",
  "balsamic vinaigrette": "salad dressing, balsamic vinaigrette",
  "blue cheese dressing": "salad dressing, blue or roquefort cheese",
  "italian dressing": "salad dressing, italian",
  "balsamic": "vinegar, balsamic",
  "honey mustard": "salad dressing, honey mustard",
  "thousand island": "salad dressing, thousand island",
  "peanut butter": "peanut butter, smooth",
  "almond butter": "nut butter, almond",
  "condensed milk": "milk, condensed, sweetened, canned",
  "evaporated milk": "milk, evaporated, canned",
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
 * Preparation method calorie multipliers.
 * USDA data is typically for "cooked" items, but the cooking method
 * affects absorbed oil and water loss. These factors adjust the
 * USDA base values. Research (NYU 2025) shows deep-frying adds
 * ~15-25% calories from oil absorption; steaming/boiling retains
 * moisture and adds nothing.
 */
const PREPARATION_MULTIPLIERS: Record<string, { calories: number; fat: number }> = {
  "deep-fried": { calories: 1.20, fat: 1.40 },
  "fried": { calories: 1.15, fat: 1.30 },
  "pan-fried": { calories: 1.12, fat: 1.25 },
  "stir-fried": { calories: 1.10, fat: 1.20 },
  "sauteed": { calories: 1.08, fat: 1.15 },
  "sautéed": { calories: 1.08, fat: 1.15 },
  "roasted": { calories: 1.03, fat: 1.05 },
  "grilled": { calories: 1.0, fat: 1.0 },
  "baked": { calories: 1.0, fat: 1.0 },
  "broiled": { calories: 1.0, fat: 1.0 },
  "steamed": { calories: 0.98, fat: 1.0 },
  "boiled": { calories: 0.97, fat: 1.0 },
  "poached": { calories: 0.97, fat: 1.0 },
  "braised": { calories: 1.02, fat: 1.05 },
  "smoked": { calories: 1.0, fat: 1.0 },
  "raw": { calories: 1.0, fat: 1.0 },
};

function getPreparationMultiplier(method?: string): { calories: number; fat: number } {
  if (!method) return { calories: 1.0, fat: 1.0 };
  const normalized = method.toLowerCase().trim();
  return PREPARATION_MULTIPLIERS[normalized] ?? { calories: 1.0, fat: 1.0 };
}

/**
 * Search for a food, pick the best match, and return macros scaled
 * to the specified portion size in grams. Uses query decomposition
 * for compound ingredient names that don't match USDA directly.
 * Optionally adjusts for cooking method (frying adds oil absorption, etc.).
 */
export async function estimateMacros(
  foodName: string,
  portionGrams: number,
  preparationMethod?: string,
): Promise<USDAMacroEstimate> {
  // Clamp portion to sane bounds — prevents nonsensical macro values from
  // vision analyzer errors (e.g., 0g or 50000g portions)
  const clampedPortion = Math.max(1, Math.min(portionGrams, 5000));
  if (portionGrams !== clampedPortion) {
    console.warn(`[usda] Clamped portion for "${foodName}": ${portionGrams}g → ${clampedPortion}g`);
  }

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
    // LLM-assisted fallback: ask GPT-4.1 nano to suggest a USDA search term
    try {
      const { getOpenAIClient, GPT_NANO } = await import("@/lib/ai/clients");
      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: GPT_NANO,
        max_tokens: 50,
        messages: [{
          role: "user",
          content: `What is the closest USDA FoodData Central search term for "${foodName}"? Reply with ONLY the search term, nothing else. Example: "chicken breast, cooked, roasted"`,
        }],
      });
      const suggestion = completion.choices[0]?.message?.content?.trim();
      if (suggestion) {
        const foods = await searchFood(suggestion, 3);
        for (const food of foods) {
          allResults.push({ food, query: suggestion });
        }
      }
    } catch {
      // OpenAI not configured or failed — skip LLM fallback
    }
  }

  if (allResults.length === 0) {
    throw new Error(`No USDA results for "${foodName}"`);
  }

  const best = pickBestMatch(allResults);
  if (!best) {
    throw new Error(`No suitable USDA match for "${foodName}"`);
  }
  const scale = clampedPortion / 100; // USDA values are per 100g
  const prepMultiplier = getPreparationMultiplier(preparationMethod);

  const calories = getNutrientFromSearchItem(best.food, NUTRIENT_IDS.ENERGY) * scale * prepMultiplier.calories;
  const protein = getNutrientFromSearchItem(best.food, NUTRIENT_IDS.PROTEIN) * scale;
  const carbs = getNutrientFromSearchItem(best.food, NUTRIENT_IDS.CARBS) * scale;
  const fat = getNutrientFromSearchItem(best.food, NUTRIENT_IDS.FAT) * scale * prepMultiplier.fat;
  const fiber = getNutrientFromSearchItem(best.food, NUTRIENT_IDS.FIBER) * scale;

  return {
    calories: Math.round(calories * 10) / 10,
    protein_g: Math.round(protein * 10) / 10,
    carbs_g: Math.round(carbs * 10) / 10,
    fat_g: Math.round(fat * 10) / 10,
    fiber_g: Math.round(fiber * 10) / 10,
    serving_description: `${clampedPortion}g of ${best.food.description}`,
    confidence: computeConfidence(best.food, best.query),
    usda_fdc_id: best.food.fdcId,
  };
}
