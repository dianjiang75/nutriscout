import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/client";
import { menuSources } from "./sources";
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

function getAnthropicClient(): Anthropic {
  return new Anthropic();
}

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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        const parsed = JSON.parse(textBlock.text);
        if (Array.isArray(parsed)) {
          results.push(...parsed);
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
  const detailsRes = await fetch(detailsUrl);

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

    const price = raw.price ? parseFloat(raw.price.replace(/[^0-9.]/g, "")) : null;

    const dish = await prisma.dish.create({
      data: {
        restaurantId: restaurant.id,
        name: raw.name,
        description: raw.description || null,
        price: price && !isNaN(price) ? price : null,
        category: raw.category || null,
        ingredientsRaw: raw.description || null,
        ingredientsParsed: analysis?.ingredients_parsed ?? undefined,
        dietaryFlags: analysis?.dietary_flags ?? undefined,
        dietaryConfidence: analysis?.dietary_confidence ?? null,
        macroSource: null,
        isAvailable: true,
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
