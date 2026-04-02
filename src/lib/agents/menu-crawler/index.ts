import { prisma } from "@/lib/db/client";
import { menuSources } from "./sources";
import { getAnthropicClient, CLAUDE_SONNET } from "@/lib/ai/clients";
import { extractJson } from "@/lib/utils/parse-json";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { batchAnalyzePhotos } from "@/lib/agents/vision-analyzer";
import type { BatchJob } from "@/lib/agents/vision-analyzer/types";
import type {
  AnalyzedDish,
  CrawlResult,
  RawMenuItem,
  RestaurantInfo,
} from "./types";

const INGREDIENT_ANALYSIS_PROMPT = `You are a food ingredient analyst specializing in dietary restriction detection.

For each dish below, analyze the name and description to:
1. List the likely ingredients (include cooking oils, garnishes, sauces)
2. Flag dietary compliance. Be CONSERVATIVE — if unsure, mark as null (unknown), not true.
   - vegan: no animal products whatsoever (check for butter, cream, cheese, honey, fish sauce, oyster sauce, egg)
   - vegetarian: no meat/fish (dairy and eggs OK)
   - gluten_free: no wheat, barley, rye, or likely cross-contamination
   - dairy_free: no milk, butter, cream, cheese, whey
   - nut_free: no tree nuts or peanuts
   - halal: no pork, no alcohol in cooking
   - kosher: no pork/shellfish, no meat-dairy mixing
3. Note any hidden ingredients that are commonly missed (e.g., Worcestershire sauce contains anchovies, many Asian dishes use fish sauce, Caesar dressing contains anchovies)

CRITICAL: Err on the side of caution. A false "safe" flag for someone with allergies is dangerous. If you cannot determine compliance with reasonable confidence, set the flag to null.

Dishes to analyze:
{dishes_json}

Return as JSON array:
[{
  "dish_name": "string",
  "ingredients_parsed": [{"name": "string", "is_primary": boolean}],
  "dietary_flags": {"vegan": true|false|null, "vegetarian": true|false|null, "gluten_free": true|false|null, "dairy_free": true|false|null, "nut_free": true|false|null, "halal": true|false|null, "kosher": true|false|null},
  "dietary_confidence": 0.0-1.0,
  "dietary_warnings": ["string"]
}]

Return ONLY valid JSON, no markdown fences or extra text.`;

// Uses Claude Sonnet 4.6 for dietary flag analysis (safety-critical)

/**
 * Analyze raw menu items for ingredients and dietary flags using an LLM.
 */
export async function analyzeIngredients(
  rawItems: RawMenuItem[]
): Promise<AnalyzedDish[]> {
  if (rawItems.length === 0) return [];

  const client = getAnthropicClient();

  // Process in batches of 20 to avoid token limits
  const batchSize = 20;
  const results: AnalyzedDish[] = [];

  for (let i = 0; i < rawItems.length; i += batchSize) {
    const batch = rawItems.slice(i, i + batchSize);
    const dishesJson = JSON.stringify(
      batch.map((item) => ({
        name: item.name,
        description: item.description,
        category: item.category,
      }))
    );

    const prompt = INGREDIENT_ANALYSIS_PROMPT.replace(
      "{dishes_json}",
      dishesJson
    );

    try {
      const response = await client.messages.create({
        model: CLAUDE_SONNET,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        try {
          const parsed = extractJson<AnalyzedDish[]>(textBlock.text);
          if (Array.isArray(parsed)) {
            results.push(...parsed);
          }
        } catch (parseErr) {
          const batchNames = batch.map((item) => item.name).join(", ");
          console.warn(
            `Failed to parse ingredient analysis JSON for batch at index ${i} (${batchNames}):`,
            (parseErr as Error).message
          );
          // Return placeholder entries so callers know these items were attempted
          for (const item of batch) {
            results.push({
              dish_name: item.name,
              ingredients_parsed: [],
              dietary_flags: {
                vegan: null, vegetarian: null, gluten_free: null,
                dairy_free: null, nut_free: null, halal: null, kosher: null,
              },
              dietary_confidence: 0,
              dietary_warnings: ["Automated dietary analysis failed — manual review needed"],
            });
          }
        }
      }
    } catch (error) {
      console.error(
        `Ingredient analysis failed for batch starting at index ${i}:`,
        (error as Error).message
      );
    }
  }

  return results;
}

/**
 * Full crawl pipeline for a restaurant.
 */
export async function crawlRestaurant(
  googlePlaceId: string
): Promise<CrawlResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  }

  // Fetch restaurant details from Google Places
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(googlePlaceId)}&fields=name,formatted_address,geometry,website,price_level,rating,types,formatted_phone_number&key=${apiKey}`;
  const detailsRes = await fetchWithRetry(detailsUrl, undefined, { maxRetries: 2 });

  if (!detailsRes.ok) {
    throw new Error(`Google Places API failed: ${detailsRes.status}`);
  }

  const placeDetails = await detailsRes.json();
  const place = placeDetails.result;

  if (!place) {
    throw new Error(`No result for place ID: ${googlePlaceId}`);
  }

  const restaurantInfo: RestaurantInfo = {
    googlePlaceId,
    name: place.name,
    address: place.formatted_address,
    websiteUrl: place.website || null,
    latitude: place.geometry?.location?.lat ?? 0,
    longitude: place.geometry?.location?.lng ?? 0,
  };

  // Upsert restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { googlePlaceId },
    update: {
      name: restaurantInfo.name,
      address: restaurantInfo.address,
      latitude: restaurantInfo.latitude,
      longitude: restaurantInfo.longitude,
      websiteUrl: restaurantInfo.websiteUrl,
      priceLevel: place.price_level ?? null,
      googleRating: place.rating ?? null,
      phone: place.formatted_phone_number ?? null,
      lastMenuCrawl: new Date(),
    },
    create: {
      googlePlaceId,
      name: restaurantInfo.name,
      address: restaurantInfo.address,
      latitude: restaurantInfo.latitude,
      longitude: restaurantInfo.longitude,
      websiteUrl: restaurantInfo.websiteUrl,
      priceLevel: place.price_level ?? null,
      googleRating: place.rating ?? null,
      phone: place.formatted_phone_number ?? null,
      cuisineType: extractCuisineTypes(place.types || []),
      lastMenuCrawl: new Date(),
    },
  });

  // Try menu sources in priority order
  let rawItems: RawMenuItem[] = [];
  let usedSource = "none";

  for (const source of menuSources) {
    const result = await source.fetch(restaurantInfo);
    if (result && result.length > 0) {
      rawItems = result;
      usedSource = source.name;
      break;
    }
  }

  if (rawItems.length === 0) {
    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      menuSource: "none",
      dishesFound: 0,
      dishesAnalyzed: 0,
      photosQueued: 0,
    };
  }

  // Analyze ingredients and dietary flags
  const analyzed = await analyzeIngredients(rawItems);

  // Upsert dishes into database and collect photo jobs
  const photoJobs: BatchJob[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    const analysis = analyzed.find(
      (a) => a.dish_name.toLowerCase() === raw.name.toLowerCase()
    );

    const price = raw.price ? parsePriceString(raw.price) : null;

    const dishData = {
      name: raw.name,
      description: raw.description || null,
      price: price,
      category: raw.category || null,
      ingredientsRaw: raw.description || null,
      ingredientsParsed: analysis?.ingredients_parsed ?? undefined,
      dietaryFlags: analysis?.dietary_flags ?? undefined,
      dietaryConfidence: analysis?.dietary_confidence ?? null,
      isAvailable: true,
    };

    // Check if dish already exists for this restaurant to avoid duplicates on re-crawl
    const existing = await prisma.dish.findFirst({
      where: { restaurantId: restaurant.id, name: raw.name },
    });

    const dish = existing
      ? await prisma.dish.update({
          where: { id: existing.id },
          data: dishData,
        })
      : await prisma.dish.create({
          data: {
            restaurantId: restaurant.id,
            ...dishData,
            macroSource: null,
          },
        });

    // Queue photo for vision analysis if available
    if (raw.photoUrl) {
      photoJobs.push({ dishId: dish.id, imageUrl: raw.photoUrl });
    }
  }

  // Update restaurant menu source
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      menuSource: usedSource as "website" | "google_photos" | "manual",
      lastMenuCrawl: new Date(),
    },
  });

  // Queue photo analysis in background (don't await — runs async)
  if (photoJobs.length > 0) {
    batchAnalyzePhotos(photoJobs).catch((err) =>
      console.error("Photo batch analysis failed:", (err as Error).message)
    );
  }

  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    menuSource: usedSource,
    dishesFound: rawItems.length,
    dishesAnalyzed: analyzed.length,
    photosQueued: photoJobs.length,
  };
}

/**
 * Parse a price string robustly. Handles "$12.99", "$10 - $15" (takes lower bound),
 * "Market Price" (returns null), "$$$" (returns null).
 */
function parsePriceString(raw: string): number | null {
  // Skip non-numeric price indicators
  if (/^[\s$]*$/.test(raw) || /market\s*price/i.test(raw) || /^\$+$/.test(raw.trim())) {
    return null;
  }

  // For ranges like "$10 - $15" or "10.99-15.99", take the first number
  const numbers = raw.match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length === 0) return null;

  const value = parseFloat(numbers[0]);
  return isNaN(value) || value <= 0 ? null : value;
}

function extractCuisineTypes(googleTypes: string[]): string[] {
  const cuisineMap: Record<string, string> = {
    chinese_restaurant: "Chinese",
    indian_restaurant: "Indian",
    italian_restaurant: "Italian",
    japanese_restaurant: "Japanese",
    korean_restaurant: "Korean",
    mexican_restaurant: "Mexican",
    thai_restaurant: "Thai",
    vietnamese_restaurant: "Vietnamese",
    french_restaurant: "French",
    greek_restaurant: "Greek",
    mediterranean_restaurant: "Mediterranean",
    american_restaurant: "American",
  };

  return googleTypes
    .filter((t) => t in cuisineMap)
    .map((t) => cuisineMap[t]);
}

export { parseHtmlMenu } from "./sources";
export type {
  RawMenuItem,
  AnalyzedDish,
  CrawlResult,
  RestaurantInfo,
  MenuSourceStrategy,
} from "./types";
