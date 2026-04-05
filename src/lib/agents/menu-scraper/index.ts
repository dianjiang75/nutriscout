/**
 * Menu Scraper Agent — fetch + parse + store in MenuItem. That's it.
 *
 * Extracted from crawlRestaurant() steps 1-2. This agent is responsible for:
 *   1. Fetching restaurant details from Google Places API
 *   2. Upserting the restaurant record
 *   3. Trying menu sources in priority order (website > google_photos > delivery)
 *   4. Extracting allergens/annotations from raw HTML BEFORE cleaning
 *   5. Cleaning names, filtering non-food junk only
 *   6. Pre-tagging wines/spirits/desserts/combos/kids
 *   7. Deduplicating by normalized name
 *   8. Upserting all items into the MenuItem table
 *
 * Does NOT classify, promote to Dish, or archive stale items — those are
 * separate agents (menu-classifier, stale-archiver).
 */

import { prisma } from "@/lib/db/client";
import { menuSources, extractRawAnnotations } from "../menu-crawler/sources";
import {
  cleanDishName,
  cleanCategoryName,
  cleanDescription,
  isLikelyFoodItem,
  isWineOrSpirit,
  isComboOrMealDeal,
  isKidsMenuItem,
  isDessertItem,
  isCocktailOrSpecialDrink,
} from "../menu-crawler/clean-dish-name";
import { normalizeName } from "@/lib/menu/archive";
import type { RawMenuItem, RestaurantInfo } from "../menu-crawler/types";
import type { MenuItemType } from "@/generated/prisma/client";

// ─── Types ──────────────────────────────────────────────

export interface ScrapeResult {
  restaurantId: string;
  restaurantName: string;
  menuSource: string;
  itemsScraped: number;
  itemsStored: number;
  /** ISO timestamp of when the crawl started — used by downstream agents */
  crawlTimestamp: string;
}

// ─── Source enum mapping ────────────────────────────────

type MenuItemSourceEnum =
  | "website"
  | "google_photos"
  | "delivery_platform"
  | "compliance_page"
  | "manual"
  | "backfill";

const SOURCE_MAP: Record<string, MenuItemSourceEnum> = {
  website: "website",
  google_photos: "google_photos",
  delivery_platform: "delivery_platform",
  compliance_page: "compliance_page",
  manual: "manual",
};

function mapSourceToEnum(source: string): MenuItemSourceEnum {
  return SOURCE_MAP[source] || "website";
}

// ─── Price parsing (reused from menu-crawler/index.ts) ──

/**
 * Parse a price string robustly. Handles "$12.99", "$10 - $15" (takes lower bound),
 * "Market Price" (returns null), "$$$" (returns null).
 */
function parsePriceString(raw: string): number | null {
  if (
    /^[\s$]*$/.test(raw) ||
    /market\s*price/i.test(raw) ||
    /^\$+$/.test(raw.trim())
  ) {
    return null;
  }
  const numbers = raw.match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length === 0) return null;
  const value = parseFloat(numbers[0]);
  return isNaN(value) || value <= 0 ? null : value;
}

// ─── Cuisine extraction (reused from menu-crawler/index.ts) ──

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

// ─── Main scrape function ───────────────────────────────

/**
 * Scrape a restaurant's menu and store all items in the MenuItem table.
 *
 * This is the first agent in the refactored pipeline. It handles:
 * - Google Places API fetch + restaurant upsert
 * - Menu source iteration (website → google_photos → delivery)
 * - Raw annotation extraction, name cleaning, junk filtering
 * - Pre-tagging (wine/spirit/dessert/combo/kids)
 * - Deduplication by normalized name
 * - Upserting into MenuItem
 *
 * Returns a ScrapeResult with the restaurantId and crawlTimestamp that
 * downstream agents (classifier, archiver) need.
 */
export async function scrapeRestaurantMenu(
  googlePlaceId: string
): Promise<ScrapeResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  }

  const crawlStart = new Date();

  // ── Fetch restaurant details from Google Places API v2 (New) ──
  const { getPlaceDetails, priceLevelToNumber } = await import(
    "@/lib/google-places/client"
  );
  const place = await getPlaceDetails(googlePlaceId, "core");

  if (!place) {
    throw new Error(`No result for place ID: ${googlePlaceId}`);
  }

  const priceLevelNum = priceLevelToNumber(place.priceLevel);

  const restaurantInfo: RestaurantInfo = {
    googlePlaceId,
    name: place.displayName?.text ?? "",
    address: place.formattedAddress ?? "",
    websiteUrl: place.websiteUri || null,
    latitude: place.location?.latitude ?? 0,
    longitude: place.location?.longitude ?? 0,
  };

  // ── Upsert restaurant ──
  const restaurant = await prisma.restaurant.upsert({
    where: { googlePlaceId },
    update: {
      name: restaurantInfo.name,
      address: restaurantInfo.address,
      latitude: restaurantInfo.latitude,
      longitude: restaurantInfo.longitude,
      websiteUrl: restaurantInfo.websiteUrl,
      priceLevel: priceLevelNum ?? null,
      googleRating: place.rating ?? null,
      phone: place.nationalPhoneNumber ?? null,
      lastMenuCrawl: crawlStart,
    },
    create: {
      googlePlaceId,
      name: restaurantInfo.name,
      address: restaurantInfo.address,
      latitude: restaurantInfo.latitude,
      longitude: restaurantInfo.longitude,
      websiteUrl: restaurantInfo.websiteUrl,
      priceLevel: priceLevelNum ?? null,
      googleRating: place.rating ?? null,
      phone: place.nationalPhoneNumber ?? null,
      cuisineType: extractCuisineTypes(place.types || []),
      lastMenuCrawl: crawlStart,
    },
  });

  // ═══════════════════════════════════════════════════════════
  // STEP 1: SCRAPE — fetch raw items from menu sources
  // ═══════════════════════════════════════════════════════════
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
      itemsScraped: 0,
      itemsStored: 0,
      crawlTimestamp: crawlStart.toISOString(),
    };
  }

  // Extract raw annotations (dietary tags, footnote markers) BEFORE cleaning
  const annotatedItems: RawMenuItem[] = rawItems.map((item) => {
    const annotations = extractRawAnnotations(item.name, item.description);
    return {
      ...item,
      menuDietaryTags: [
        ...(item.menuDietaryTags || []),
        ...annotations.dietaryTags,
      ],
      menuAllergens: item.menuAllergens || [],
    };
  });

  // Clean names, filter only non-food junk. Everything real passes through:
  // sides, drinks, wine, add-ons, condiments — all stored in MenuItem.
  // Classification happens in the Classifier agent, NOT here.
  const cleanedItems = annotatedItems.reduce<RawMenuItem[]>((acc, item) => {
    const cleaned = cleanDishName(item.name);
    if (!cleaned) return acc;
    if (!isLikelyFoodItem(cleaned, item.description || "")) return acc;

    const cleanedCategory = item.category
      ? cleanCategoryName(item.category)
      : null;
    const cleanedDescription = item.description
      ? cleanDescription(item.description, cleaned)
      : null;

    acc.push({
      ...item,
      name: cleaned,
      nameOriginal: cleaned !== item.name ? item.name : undefined,
      category: cleanedCategory,
      description: cleanedDescription ?? "",
    });
    return acc;
  }, []);

  // Deduplicate by normalized name within same crawl
  const seen = new Set<string>();
  const dedupedItems = cleanedItems.filter((item) => {
    const key = normalizeName(item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (dedupedItems.length === 0) {
    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      menuSource: usedSource,
      itemsScraped: rawItems.length,
      itemsStored: 0,
      crawlTimestamp: crawlStart.toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: STORE IN MENUITEM — upsert every item into archive
  // ═══════════════════════════════════════════════════════════
  const sourceEnum = mapSourceToEnum(usedSource);

  // Pre-tag items at scrape time (skip LLM for obvious categories)
  const preTagged = dedupedItems.map((item) => {
    let preType: MenuItemType = "unknown";
    if (isWineOrSpirit(item.name, item.category)) preType = "drink";
    else if (isCocktailOrSpecialDrink(item.name, item.category))
      preType = "drink";
    else if (isDessertItem(item.name, item.category)) preType = "dessert";
    else if (isComboOrMealDeal(item.name)) preType = "combo";
    else if (isKidsMenuItem(item.name)) preType = "kids";
    return { item, preType };
  });

  // Upsert all items into MenuItem
  let itemsStored = 0;
  for (const { item, preType } of preTagged) {
    const nameNorm = normalizeName(item.name);
    try {
      await prisma.menuItem.upsert({
        where: {
          restaurantId_nameNormalized_source: {
            restaurantId: restaurant.id,
            nameNormalized: nameNorm,
            source: sourceEnum,
          },
        },
        create: {
          restaurantId: restaurant.id,
          name: item.name,
          nameNormalized: nameNorm,
          nameOriginal: item.nameOriginal || null,
          description: item.description || null,
          price: item.price ? parsePriceString(item.price) : null,
          category: item.category || null,
          menuItemType: preType,
          source: sourceEnum,
          photoUrl: item.photoUrl || null,
          menuCalories: item.menuCalories || null,
          menuProteinG: item.menuProteinG || null,
          menuCarbsG: item.menuCarbsG || null,
          menuFatG: item.menuFatG || null,
          menuAllergens: item.menuAllergens || [],
          menuDietaryTags: item.menuDietaryTags || [],
          menuIngredients: item.menuIngredients || null,
          lastSeenAt: crawlStart,
        },
        update: {
          name: item.name,
          description: item.description || null,
          price: item.price ? parsePriceString(item.price) : null,
          category: item.category || null,
          photoUrl: item.photoUrl || null,
          menuCalories: item.menuCalories || null,
          menuProteinG: item.menuProteinG || null,
          menuCarbsG: item.menuCarbsG || null,
          menuFatG: item.menuFatG || null,
          menuAllergens: item.menuAllergens || [],
          menuDietaryTags: item.menuDietaryTags || [],
          menuIngredients: item.menuIngredients || null,
          lastSeenAt: crawlStart,
          // Un-archive items that reappear on the menu
          archivedAt: null,
          archivedReason: null,
        },
      });
      itemsStored++;
    } catch (err) {
      console.warn(
        `[menu-scraper] Failed to upsert MenuItem "${item.name}":`,
        (err as Error).message
      );
    }
  }

  console.log(
    `[menu-scraper] Stored ${itemsStored} MenuItems for ${restaurant.name} (source: ${usedSource})`
  );

  // Update restaurant menu source
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      menuSource:
        usedSource === "none"
          ? undefined
          : (usedSource as "website" | "google_photos" | "manual"),
      lastMenuCrawl: crawlStart,
    },
  });

  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    menuSource: usedSource,
    itemsScraped: rawItems.length,
    itemsStored,
    crawlTimestamp: crawlStart.toISOString(),
  };
}
