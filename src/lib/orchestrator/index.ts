import { prisma } from "@/lib/db/client";
import {
  getCachedQuery,
  setCachedQuery,
  type QueryCacheParams,
} from "@/lib/cache";
import { verify } from "@/lib/evaluator";
import type {
  DishResult,
  SearchResults,
  UserSearchQuery,
} from "./types";

/**
 * Atlas Orchestrator — main search function.
 * Queries for dishes matching dietary, nutritional, and geographic criteria.
 */
export async function search(query: UserSearchQuery): Promise<SearchResults> {
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  // 1. Check semantic cache
  const cacheParams: QueryCacheParams = {
    dietaryFilters: extractDietaryFilters(query.dietary_restrictions),
    nutritionalGoal: query.nutritional_goal ?? null,
    latitude: query.latitude,
    longitude: query.longitude,
    radiusMiles: query.radius_miles,
  };

  const cached = await getCachedQuery<SearchResults>(cacheParams);
  if (cached) {
    // Serve paginated slice from cache
    return {
      ...cached,
      dishes: cached.dishes.slice(offset, offset + limit),
      cached: true,
    };
  }

  // 2. Build and execute database query
  // Build dietary filter conditions
  const dietaryWhere = buildDietaryWhere(query.dietary_restrictions);

  // Build macro conditions
  const macroWhere: Record<string, unknown> = {};
  if (query.calorie_limit) {
    macroWhere.caloriesMin = { lte: query.calorie_limit };
  }
  if (query.protein_min_g) {
    macroWhere.proteinMaxG = { gte: query.protein_min_g };
  }

  // Build text search condition
  const textWhere: Record<string, unknown> = {};
  if (query.query) {
    textWhere.name = { contains: query.query, mode: "insensitive" };
  }

  // Build cuisine filter from categories (cuisine-type categories map to restaurant cuisineType)
  const cuisineCategories = (query.categories || []).filter((c) =>
    CUISINE_IDS.has(c)
  );
  const allCuisines = [
    ...(query.cuisine_preferences || []),
    ...cuisineCategories,
  ];

  // Build meal category filter (non-cuisine categories map to dish category)
  const mealCategories = (query.categories || []).filter(
    (c) => !CUISINE_IDS.has(c)
  );

  // Query dishes with restaurant join
  const dishes = await prisma.dish.findMany({
    where: {
      isAvailable: true,
      ...dietaryWhere,
      ...macroWhere,
      ...textWhere,
      ...(mealCategories.length
        ? { category: { in: mealCategories, mode: "insensitive" } }
        : {}),
      restaurant: {
        isActive: true,
        ...(allCuisines.length
          ? { cuisineType: { hasSome: allCuisines } }
          : {}),
      },
    },
    include: {
      restaurant: true,
      reviewSummary: true,
    },
    take: limit,
    skip: offset,
    orderBy: buildOrderBy(query),
  });

  // 3. Fetch logistics and distances for the restaurants in this result set
  const now = new Date();
  const restaurantIds = [...new Set(dishes.map((d) => d.restaurantId))];

  const logisticsRows = await prisma.restaurantLogistics.findMany({
    where: {
      restaurantId: { in: restaurantIds },
      dayOfWeek: now.getDay(),
      hour: now.getHours(),
    },
  });
  const logisticsMap = new Map(
    logisticsRows.map((l) => [l.restaurantId, l])
  );

  // Calculate distances using haversine formula
  const distanceMap = new Map<string, number>();
  for (const dish of dishes) {
    if (!distanceMap.has(dish.restaurantId)) {
      const rLat = Number(dish.restaurant.latitude);
      const rLng = Number(dish.restaurant.longitude);
      distanceMap.set(dish.restaurantId, haversine(query.latitude, query.longitude, rLat, rLng));
    }
  }

  // 4. Build result set with enriched data
  const dishResults: DishResult[] = dishes.map((dish) => {
    const logistics = logisticsMap.get(dish.restaurantId);
    return {
      id: dish.id,
      name: dish.name,
      description: dish.description,
      price: dish.price ? Number(dish.price) : null,
      category: dish.category,
      calories_min: dish.caloriesMin,
      calories_max: dish.caloriesMax,
      protein_min_g: dish.proteinMinG ? Number(dish.proteinMinG) : null,
      protein_max_g: dish.proteinMaxG ? Number(dish.proteinMaxG) : null,
      carbs_min_g: dish.carbsMinG ? Number(dish.carbsMinG) : null,
      carbs_max_g: dish.carbsMaxG ? Number(dish.carbsMaxG) : null,
      fat_min_g: dish.fatMinG ? Number(dish.fatMinG) : null,
      fat_max_g: dish.fatMaxG ? Number(dish.fatMaxG) : null,
      macro_confidence: dish.macroConfidence
        ? Number(dish.macroConfidence)
        : null,
      dietary_flags: dish.dietaryFlags as DishResult["dietary_flags"],
      dietary_confidence: dish.dietaryConfidence
        ? Number(dish.dietaryConfidence)
        : null,
      restaurant: {
        id: dish.restaurant.id,
        name: dish.restaurant.name,
        address: dish.restaurant.address,
        distance_miles: distanceMap.get(dish.restaurantId) ?? null,
        google_rating: dish.restaurant.googleRating
          ? Number(dish.restaurant.googleRating)
          : null,
        cuisine_type: dish.restaurant.cuisineType,
      },
      review_summary: dish.reviewSummary
        ? {
            average_rating: dish.reviewSummary.averageDishRating
              ? Number(dish.reviewSummary.averageDishRating)
              : null,
            summary_text: dish.reviewSummary.summaryText,
            review_count: dish.reviewSummary.totalReviewsAnalyzed,
          }
        : null,
      logistics: logistics
        ? {
            current_busyness_pct: logistics.typicalBusynessPct ?? null,
            estimated_wait_minutes: logistics.estimatedWaitMinutes ?? null,
          }
        : null,
      delivery: null,
      warnings: [],
    };
  });

  // 4b. Filter by radius
  const radiusFiltered = query.radius_miles
    ? dishResults.filter((d) => {
        const dist = d.restaurant.distance_miles;
        return dist == null || dist <= query.radius_miles;
      })
    : dishResults;

  // 5. Run Apollo evaluator for dietary safety
  const verified = verify(radiusFiltered, query.dietary_restrictions);

  const result: SearchResults = {
    dishes: verified,
    total_count: verified.length,
    cached: false,
  };

  // 5b. Sort by distance if requested (DB can't sort by computed distance)
  if (query.sort_by === "distance") {
    verified.sort((a, b) => {
      const da = a.restaurant.distance_miles ?? Infinity;
      const db = b.restaurant.distance_miles ?? Infinity;
      return da - db;
    });
  }

  // 6. Cache results
  if (offset === 0) {
    await setCachedQuery(cacheParams, result);
  }

  return result;
}

const CUISINE_IDS = new Set([
  "thai", "japanese", "italian", "mexican", "indian",
  "chinese", "korean", "mediterranean", "american", "vietnamese",
]);

function extractDietaryFilters(flags: UserSearchQuery["dietary_restrictions"]): string[] {
  const filters: string[] = [];
  for (const [key, value] of Object.entries(flags)) {
    if (value === true) filters.push(key);
  }
  return filters;
}

function buildDietaryWhere(
  restrictions: UserSearchQuery["dietary_restrictions"]
): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  for (const [key, value] of Object.entries(restrictions)) {
    if (value === true) {
      // Hard filter: the flag must be explicitly true in the JSONB
      conditions.push({
        dietaryFlags: { path: [key], equals: true },
      });
    }
  }

  if (conditions.length === 0) return {};
  return { AND: conditions };
}

function buildOrderBy(
  query: UserSearchQuery
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // sort_by takes precedence if set
  if (query.sort_by) {
    switch (query.sort_by) {
      case "rating":
        return { reviewSummary: { averageDishRating: "desc" } };
      case "wait_time":
        return { createdAt: "asc" };
      case "distance":
        return { createdAt: "desc" }; // distance sorted in-memory after query
      case "macro_match":
        // Fall through to nutritional goal ordering
        break;
    }
  }

  switch (query.nutritional_goal) {
    case "max_protein":
      return { proteinMaxG: "desc" };
    case "min_calories":
      return { caloriesMin: "asc" };
    case "min_fat":
      return { fatMinG: "asc" };
    case "min_carbs":
      return { carbsMinG: "asc" };
    default:
      return { createdAt: "desc" };
  }
}

/** Haversine distance in miles between two lat/lng points. */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}

export type { UserSearchQuery, DishResult, SearchResults } from "./types";
