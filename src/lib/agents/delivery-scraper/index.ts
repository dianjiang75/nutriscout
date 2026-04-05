/**
 * Delivery Platform Scraper — Main Orchestrator
 *
 * Scrapes DoorDash and Uber Eats for per-item ratings (thumbs up %, "Most Liked")
 * and matches them to existing dishes in the database. Also discovers new dishes
 * not found by the website/Google Photos crawl.
 *
 * Pipeline position: runs AFTER menu crawl, BEFORE review aggregation.
 */
import { prisma } from "@/lib/db/client";
import { scrapeDoorDash } from "./doordash";
import { scrapeUberEats } from "./ubereats";
import { matchItemToDish } from "./match-restaurant";
import { cleanDishName, cleanCategoryName, isDishWorthRecommending, isWineOrSpirit } from "@/lib/agents/menu-crawler/clean-dish-name";
import { normalizeName } from "@/lib/menu/archive";
import type { DeliveryScrapeResult, DeliveryScrapedItem, PlatformScrapeResult } from "./types";

/**
 * Scrape delivery platforms for a restaurant and write ratings to the database.
 *
 * 1. Fetch restaurant from DB
 * 2. Check which platforms need scraping (skip if fresh data exists)
 * 3. Scrape DoorDash and Uber Eats
 * 4. Match items to existing dishes
 * 5. Upsert delivery ratings into ReviewSummary
 * 6. Create new dishes for unmatched items (bonus menu discovery)
 * 7. Update RestaurantDelivery records with platform URLs
 */
export async function scrapeDeliveryPlatforms(
  restaurantId: string,
  skipFreshPlatforms: boolean = true
): Promise<DeliveryScrapeResult> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      deliveryOptions: true,
      dishes: { select: { id: true, name: true } },
    },
  });

  if (!restaurant) {
    throw new Error(`Restaurant not found: ${restaurantId}`);
  }

  const result: DeliveryScrapeResult = {
    restaurantId,
    restaurantName: restaurant.name,
    platforms: [],
    totalItemsScraped: 0,
    itemsMatchedToDishes: 0,
    newDishesCreated: 0,
  };

  const lat = Number(restaurant.latitude);
  const lng = Number(restaurant.longitude);

  // Find existing platform URLs
  const ddDelivery = restaurant.deliveryOptions.find((d) => d.platform === "doordash");
  const ueDelivery = restaurant.deliveryOptions.find((d) => d.platform === "ubereats");

  // Check freshness (skip if scraped within 7 days)
  const FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // ── Scrape DoorDash ──
  const ddSkip = skipFreshPlatforms
    && ddDelivery?.lastChecked
    && now - ddDelivery.lastChecked.getTime() < FRESHNESS_MS;

  if (!ddSkip) {
    const ddResult = await scrapeDoorDash(
      restaurant.name,
      restaurant.address,
      ddDelivery?.platformUrl
    );
    result.platforms.push(ddResult);

    if (ddResult.match) {
      await upsertDeliveryOption(restaurantId, "doordash", ddResult);
    }
  }

  // ── Scrape Uber Eats ──
  const ueSkip = skipFreshPlatforms
    && ueDelivery?.lastChecked
    && now - ueDelivery.lastChecked.getTime() < FRESHNESS_MS;

  if (!ueSkip) {
    const ueResult = await scrapeUberEats(
      restaurant.name,
      restaurant.address,
      lat,
      lng,
      ueDelivery?.platformUrl
    );
    result.platforms.push(ueResult);

    if (ueResult.match) {
      await upsertDeliveryOption(restaurantId, "ubereats", ueResult);
    }
  }

  // ── Process scraped items ──
  const allItems = result.platforms.flatMap((p) => p.items);
  result.totalItemsScraped = allItems.length;

  if (allItems.length > 0) {
    const { matched, created } = await processScrapedItems(
      restaurantId,
      restaurant.dishes,
      result.platforms
    );
    result.itemsMatchedToDishes = matched;
    result.newDishesCreated = created;
  }

  // Update restaurant timestamp
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { lastDeliveryScrape: new Date() },
  });

  return result;
}

/**
 * Upsert RestaurantDelivery record with platform URL and availability.
 */
async function upsertDeliveryOption(
  restaurantId: string,
  platform: "doordash" | "ubereats",
  scrapeResult: PlatformScrapeResult
): Promise<void> {
  const isAvailable = !!scrapeResult.match && scrapeResult.items.length > 0;
  const platformUrl = scrapeResult.match?.platformUrl || null;

  await prisma.restaurantDelivery.upsert({
    where: {
      restaurantId_platform: { restaurantId, platform },
    },
    update: {
      isAvailable,
      platformUrl,
      lastChecked: new Date(),
    },
    create: {
      restaurantId,
      platform,
      isAvailable,
      platformUrl,
      lastChecked: new Date(),
    },
  });
}

/**
 * Match scraped items to existing dishes and upsert ratings.
 * Creates new dishes for unmatched items that pass quality filters.
 */
async function processScrapedItems(
  restaurantId: string,
  existingDishes: { id: string; name: string }[],
  platforms: PlatformScrapeResult[]
): Promise<{ matched: number; created: number }> {
  let matched = 0;
  let created = 0;

  // Aggregate items per dish name (a dish may appear on multiple platforms)
  const itemsByDish = new Map<
    string,
    { dishId: string | null; ratings: { platform: string; pct: number | null; count: number | null; isMostLiked: boolean }[] }
  >();

  for (const platformResult of platforms) {
    for (const item of platformResult.items) {
      // Clean the scraped name
      const cleanedName = cleanDishName(item.name);
      if (!cleanedName) continue;
      if (!isDishWorthRecommending(cleanedName, item.category)) continue;
      if (isWineOrSpirit(cleanedName, item.category)) continue;

      // Try to match to existing dish
      const dishMatch = matchItemToDish(cleanedName, existingDishes);
      const key = dishMatch ? dishMatch.id : `new:${cleanedName.toLowerCase()}`;

      const existing = itemsByDish.get(key) || {
        dishId: dishMatch?.id || null,
        ratings: [],
      };
      existing.ratings.push({
        platform: platformResult.platform,
        pct: item.thumbsUpPct,
        count: item.ratingCount,
        isMostLiked: item.isMostLiked,
      });
      itemsByDish.set(key, existing);
    }
  }

  // Process each unique dish
  for (const [key, data] of itemsByDish) {
    let dishId = data.dishId;

    // Create new dish if not matched and key starts with "new:"
    if (!dishId && key.startsWith("new:")) {
      const name = key.slice(4); // strip "new:" prefix
      const cleanedName = cleanDishName(name);
      if (!cleanedName) continue;

      // Find the richest item data across platforms
      const richestItem = findRichestItem(name, platforms);

      try {
        const newDish = await prisma.dish.create({
          data: {
            restaurantId,
            name: cleanedName,
            description: richestItem?.description || null,
            price: richestItem?.price || null,
            category: richestItem?.category ? cleanCategoryName(richestItem.category) : null,
            isAvailable: true,
            macroSource: null,
          },
        });
        dishId = newDish.id;
        created++;
        existingDishes.push({ id: newDish.id, name: cleanedName });

        // Also create MenuItem archive record for delivery-discovered dishes
        const platform = data.ratings[0]?.platform || "ubereats";
        await prisma.menuItem.upsert({
          where: {
            restaurantId_nameNormalized_source: {
              restaurantId,
              nameNormalized: normalizeName(cleanedName),
              source: "delivery_platform",
            },
          },
          create: {
            restaurantId,
            name: cleanedName,
            nameNormalized: normalizeName(cleanedName),
            description: richestItem?.description || null,
            price: richestItem?.price || null,
            category: richestItem?.category ? cleanCategoryName(richestItem.category) : null,
            menuItemType: "dish",
            source: "delivery_platform",
            dishId: newDish.id,
            lastSeenAt: new Date(),
          },
          update: {
            description: richestItem?.description || null,
            price: richestItem?.price || null,
            lastSeenAt: new Date(),
            dishId: newDish.id,
            archivedAt: null,
            archivedReason: null,
          },
        }).catch(() => {}); // Non-blocking — MenuItem is supplementary
      } catch {
        continue; // Skip if creation fails (duplicate, etc.)
      }
    }

    if (!dishId) continue;
    matched++;

    // Aggregate ratings across platforms
    const ddRating = data.ratings.find((r) => r.platform === "doordash");
    const ueRating = data.ratings.find((r) => r.platform === "ubereats");
    const isMostLiked = data.ratings.some((r) => r.isMostLiked);

    // Upsert into ReviewSummary
    await prisma.reviewSummary.upsert({
      where: { dishId },
      update: {
        doordashThumbsUpPct: ddRating?.pct ?? undefined,
        doordashReviewCount: ddRating?.count ?? undefined,
        ubereatsThumbsUpPct: ueRating?.pct ?? undefined,
        ubereatsReviewCount: ueRating?.count ?? undefined,
        isMostLiked,
        lastDeliveryRatingUpdate: new Date(),
      },
      create: {
        dishId,
        doordashThumbsUpPct: ddRating?.pct ?? null,
        doordashReviewCount: ddRating?.count ?? 0,
        ubereatsThumbsUpPct: ueRating?.pct ?? null,
        ubereatsReviewCount: ueRating?.count ?? 0,
        isMostLiked,
        lastDeliveryRatingUpdate: new Date(),
        totalReviewsAnalyzed: (ddRating?.count ?? 0) + (ueRating?.count ?? 0),
      },
    });
  }

  return { matched, created };
}

/** Find the richest item data for a given name across all platform results. */
function findRichestItem(
  name: string,
  platforms: PlatformScrapeResult[]
): DeliveryScrapedItem | null {
  const lower = name.toLowerCase();
  let best: DeliveryScrapedItem | null = null;
  let bestScore = 0;

  for (const p of platforms) {
    for (const item of p.items) {
      if (item.name.toLowerCase() !== lower) continue;
      // Score by data richness
      let score = 0;
      if (item.description) score += 2;
      if (item.price) score += 1;
      if (item.photoUrl) score += 1;
      if (item.category) score += 1;
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
  }
  return best;
}

export type { DeliveryScrapeResult, DeliveryScrapeJobData } from "./types";
