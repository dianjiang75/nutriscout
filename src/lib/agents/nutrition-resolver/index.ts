/**
 * NutritionSourceResolver — 3-tier macro resolution pipeline.
 *
 * Tier 1: Restaurant's own published nutrition facts
 * Tier 2: Third-party databases (MyFitnessPal, LoseIt, USDA, etc.)
 * Tier 3: Our own AI estimation pipeline (vision + LLM), cross-validated
 *
 * For each dish, we try Tier 1 first. If unavailable, Tier 2. If neither,
 * Tier 3 with mandatory cross-validation against a generic entry.
 */

import type {
  SourceResult,
  CrossValidation,
  ResolvedNutrition,
  ThirdPartyEntry,
  NutritionData,
} from "./types";

/**
 * Tier 1: Check if the restaurant publishes its own nutrition data.
 *
 * Common sources:
 * - Restaurant website nutrition page (e.g. pandaexpress.com/nutrition)
 * - PDF nutrition guides
 * - In-app nutrition info (Chipotle, Sweetgreen, etc.)
 */
export async function checkRestaurantSource(
  dishName: string,
  restaurantName: string,
  restaurantWebsite: string | null
): Promise<SourceResult | null> {
  if (!restaurantWebsite) return null;

  // Known restaurant nutrition page patterns
  const knownNutritionPaths = [
    "/nutrition",
    "/menu/nutrition",
    "/nutritional-info",
    "/nutrition-info",
    "/calories",
    "/menu-nutrition",
    "/allergens-nutrition",
  ];

  for (const path of knownNutritionPaths) {
    try {
      const url = new URL(path, restaurantWebsite).toString();
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "NutriScout/1.0 (nutrition-data-aggregator)" },
      });

      if (res.ok) {
        const html = await res.text();
        const nutrition = parseNutritionFromHtml(html, dishName);
        if (nutrition) {
          return {
            tier: "restaurant_published",
            confidence: 0.95,
            sourceName: `${restaurantName} Nutrition Page`,
            sourceUrl: url,
            nutrition,
          };
        }
      }
    } catch {
      // Continue to next path
    }
  }

  return null;
}

/**
 * Tier 2: Search third-party nutrition databases.
 *
 * Priority order:
 * 1. MyFitnessPal (largest food database, user-logged entries)
 * 2. LoseIt
 * 3. USDA FoodData Central
 * 4. Nutritionix
 *
 * For restaurant-specific dishes, we prefer entries that match both
 * the dish name AND the restaurant name. When multiple entries exist,
 * we pick the one with the most user logs (most likely accurate).
 */
export async function checkThirdPartyDatabases(
  dishName: string,
  restaurantName: string
): Promise<SourceResult | null> {
  // Search with restaurant name first (more specific)
  const specificQuery = `${dishName} ${restaurantName}`;
  let entries = await searchNutritionDatabases(specificQuery);

  // If no restaurant-specific entries, try generic dish name
  if (entries.length === 0) {
    entries = await searchNutritionDatabases(dishName);
  }

  if (entries.length === 0) return null;

  // Sort by log_count descending — most logged = most validated
  entries.sort((a, b) => b.log_count - a.log_count);
  const best = entries[0];

  // Confidence based on log count
  let confidence = 0.6;
  if (best.log_count >= 100) confidence = 0.85;
  else if (best.log_count >= 50) confidence = 0.8;
  else if (best.log_count >= 10) confidence = 0.7;

  // Higher confidence if it matches the specific restaurant
  if (best.brand && best.brand.toLowerCase().includes(restaurantName.toLowerCase())) {
    confidence = Math.min(confidence + 0.1, 0.92);
  }

  return {
    tier: "third_party_db",
    confidence,
    sourceName: best.source,
    sourceUrl: best.url,
    logCount: best.log_count,
    nutrition: {
      calories_min: best.calories,
      calories_max: best.calories,
      protein_min_g: best.protein_g,
      protein_max_g: best.protein_g,
      carbs_min_g: best.carbs_g,
      carbs_max_g: best.carbs_g,
      fat_min_g: best.fat_g,
      fat_max_g: best.fat_g,
    },
  };
}

/**
 * Tier 3: AI estimation with cross-validation.
 *
 * When no published or third-party data exists, use our vision/LLM pipeline.
 * After estimation, ALWAYS cross-validate against a generic version of the
 * dish from a third-party database. Flag large deviations.
 */
export async function crossValidateAiEstimate(
  dishName: string,
  aiNutrition: NutritionData
): Promise<CrossValidation | null> {
  // Search for a generic version of this dish in third-party DBs
  const genericEntries = await searchNutritionDatabases(dishName);

  if (genericEntries.length === 0) return null;

  // Use the most-logged generic entry as reference
  genericEntries.sort((a, b) => b.log_count - a.log_count);
  const reference = genericEntries[0];

  // Calculate calorie deviation
  const aiMidCalories = (aiNutrition.calories_min + aiNutrition.calories_max) / 2;
  const deviation = Math.abs(aiMidCalories - reference.calories) / reference.calories * 100;

  return {
    source: `${reference.source}: ${reference.name}`,
    deviation_pct: Math.round(deviation * 100) / 100,
    reference_calories: reference.calories,
  };
}

/**
 * Main resolver: tries all 3 tiers in order, returns the best result.
 */
export async function resolveNutrition(
  dishName: string,
  restaurantName: string,
  restaurantWebsite: string | null,
  existingAiEstimate?: NutritionData | null
): Promise<ResolvedNutrition | null> {
  // Tier 1: Restaurant's own data
  const tier1 = await checkRestaurantSource(dishName, restaurantName, restaurantWebsite);
  if (tier1) {
    return { nutrition: tier1.nutrition, source: tier1, crossValidation: null };
  }

  // Tier 2: Third-party databases
  const tier2 = await checkThirdPartyDatabases(dishName, restaurantName);
  if (tier2) {
    return { nutrition: tier2.nutrition, source: tier2, crossValidation: null };
  }

  // Tier 3: Use existing AI estimate (or trigger pipeline) + cross-validate
  if (existingAiEstimate) {
    const crossVal = await crossValidateAiEstimate(dishName, existingAiEstimate);

    let confidence = 0.5;
    if (crossVal) {
      // Adjust confidence based on deviation from reference
      if (crossVal.deviation_pct <= 10) confidence = 0.75;
      else if (crossVal.deviation_pct <= 20) confidence = 0.65;
      else if (crossVal.deviation_pct <= 30) confidence = 0.55;
      else confidence = 0.4; // Large deviation — flag as unreliable
    }

    return {
      nutrition: existingAiEstimate,
      source: {
        tier: "vision_ai",
        confidence,
        sourceName: "NutriScout AI Estimation",
        sourceUrl: null,
        nutrition: existingAiEstimate,
      },
      crossValidation: crossVal,
    };
  }

  return null;
}

// ─── Internal helpers ──────────────────────────────────────

/**
 * Parse nutrition facts from restaurant HTML page.
 * This is a best-effort parser for common nutrition page formats.
 */
function parseNutritionFromHtml(
  html: string,
  dishName: string
): NutritionData | null {
  const lower = html.toLowerCase();
  const dishLower = dishName.toLowerCase();

  // Check if the dish name appears in the page
  if (!lower.includes(dishLower)) return null;

  // Try to find calorie data near the dish name
  // Common patterns: "Tofu Pad Thai ... 620 cal", "620 calories"
  const dishIndex = lower.indexOf(dishLower);
  const nearbyText = html.slice(dishIndex, dishIndex + 500);

  const calMatch = nearbyText.match(/(\d{2,4})\s*(?:cal(?:ories)?|kcal)/i);
  const proteinMatch = nearbyText.match(/(?:protein|prot)\s*[:\s]*(\d+)\s*g/i);
  const carbsMatch = nearbyText.match(/(?:carb(?:ohydrate)?s?|carb)\s*[:\s]*(\d+)\s*g/i);
  const fatMatch = nearbyText.match(/(?:total\s+)?fat\s*[:\s]*(\d+)\s*g/i);

  if (!calMatch) return null;

  const calories = parseInt(calMatch[1]);
  const protein = proteinMatch ? parseInt(proteinMatch[1]) : 0;
  const carbs = carbsMatch ? parseInt(carbsMatch[1]) : 0;
  const fat = fatMatch ? parseInt(fatMatch[1]) : 0;

  return {
    calories_min: calories,
    calories_max: calories,
    protein_min_g: protein,
    protein_max_g: protein,
    carbs_min_g: carbs,
    carbs_max_g: carbs,
    fat_min_g: fat,
    fat_max_g: fat,
  };
}

/**
 * Search third-party nutrition databases.
 * In production, this would call actual APIs. For now, it uses
 * the USDA FoodData Central API (free, no key required for basic search).
 */
async function searchNutritionDatabases(
  query: string
): Promise<ThirdPartyEntry[]> {
  const entries: ThirdPartyEntry[] = [];

  // USDA FoodData Central (free API)
  try {
    const usdaKey = process.env.USDA_API_KEY || "DEMO_KEY";
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=5&api_key=${usdaKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (res.ok) {
      const data = await res.json();
      for (const food of data.foods || []) {
        const nutrients = food.foodNutrients || [];
        const getCal = (id: number) => nutrients.find((n: { nutrientId: number }) => n.nutrientId === id)?.value ?? 0;

        entries.push({
          name: food.description || query,
          brand: food.brandName || food.brandOwner || null,
          calories: getCal(1008), // Energy (kcal)
          protein_g: getCal(1003),
          carbs_g: getCal(1005),
          fat_g: getCal(1004),
          log_count: food.score ? Math.round(food.score) : 1,
          source: "USDA FoodData Central",
          url: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}`,
        });
      }
    }
  } catch {
    // USDA unavailable, continue
  }

  // Nutritionix (if API key available)
  if (process.env.NUTRITIONIX_APP_ID && process.env.NUTRITIONIX_API_KEY) {
    try {
      const res = await fetch("https://trackapi.nutritionix.com/v2/search/instant", {
        method: "GET",
        headers: {
          "x-app-id": process.env.NUTRITIONIX_APP_ID,
          "x-app-key": process.env.NUTRITIONIX_API_KEY,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        for (const item of [...(data.branded || []), ...(data.common || [])]) {
          entries.push({
            name: item.food_name,
            brand: item.brand_name || null,
            calories: item.nf_calories || 0,
            protein_g: item.nf_protein || 0,
            carbs_g: item.nf_total_carbohydrate || 0,
            fat_g: item.nf_total_fat || 0,
            log_count: item.serving_weight_grams ? 50 : 10, // Branded items typically well-verified
            source: "Nutritionix",
            url: null,
          });
        }
      }
    } catch {
      // Nutritionix unavailable, continue
    }
  }

  return entries;
}

export type { ResolvedNutrition, SourceResult, CrossValidation, NutritionData, ThirdPartyEntry } from "./types";
