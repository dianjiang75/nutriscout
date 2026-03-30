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
  if (cached && offset === 0) {
    return { ...cached, cached: true };
  }

  // 2. Build and execute database query
  const radiusMeters = query.radius_miles * 1609.34;

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

  // Query dishes with restaurant join
  const dishes = await prisma.dish.findMany({
    where: {
      isAvailable: true,
      ...dietaryWhere,
      ...macroWhere,
      restaurant: {
        isActive: true,
        ...(query.cuisine_preferences?.length
          ? { cuisineType: { hasSome: query.cuisine_preferences } }
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

  // 3. Fetch logistics for the restaurants in this result set
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
        distance_miles: null, // Would require PostGIS earth_distance calculation
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

  // 5. Run Apollo evaluator for dietary safety
  const verified = verify(dishResults, query.dietary_restrictions);

  const result: SearchResults = {
    dishes: verified,
    total_count: verified.length,
    cached: false,
  };

  // 6. Cache results
  if (offset === 0) {
    await setCachedQuery(cacheParams, result);
  }

  return result;
}

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
): Record<string, string> | Record<string, string>[] {
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

export type { UserSearchQuery, DishResult, SearchResults } from "./types";
