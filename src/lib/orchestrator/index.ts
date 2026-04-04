import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/utils/logger";
import {
  getCachedQuery,
  setCachedQuery,
  type QueryCacheParams,
} from "@/lib/cache";
import { verify } from "@/lib/evaluator";
import { fullTextSearchDishes, getRestaurantIdsWithinRadius } from "@/lib/db/geo";
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
  const start = Date.now();
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  // 1. Check semantic cache
  const cacheParams: QueryCacheParams = {
    searchText: query.query ?? null,
    dietaryFilters: extractDietaryFilters(query.dietary_restrictions),
    nutritionalGoal: query.nutritional_goal ?? null,
    latitude: query.latitude,
    longitude: query.longitude,
    radiusMiles: query.radius_miles,
    categories: query.categories ?? [],
    sortBy: query.sort_by ?? null,
    calorieLimit: query.calorie_limit ?? null,
    proteinMin: query.protein_min_g ?? null,
    allergens: query.allergens ?? [],
    maxWaitMinutes: query.max_wait_minutes ?? null,
  };

  const cached = await getCachedQuery<SearchResults>(cacheParams);
  if (cached) {
    logger.debug("Search cache hit", { query: query.query, durationMs: Date.now() - start });
    return {
      ...cached,
      dishes: cached.dishes.slice(offset, offset + limit),
      cached: true,
    };
  }

  logger.debug("Search cache miss", { query: query.query, durationMs: Date.now() - start });

  // 2. Build and execute database query
  const dietaryWhere = buildDietaryWhere(query.dietary_restrictions);

  const macroWhere: Record<string, unknown> = {};
  if (query.calorie_limit) {
    // Use caloriesMax to ensure the dish is truly under the cap
    // (caloriesMin could be under while caloriesMax is over)
    macroWhere.caloriesMax = { lte: query.calorie_limit };
  }
  if (query.protein_min_g) {
    // Use proteinMinG to ensure even the low estimate meets the minimum
    // (proteinMaxG could meet it while proteinMinG doesn't)
    macroWhere.proteinMinG = { gte: query.protein_min_g };
  }
  // GLP-1 friendly: high protein (≥25g), controlled calories (≤500)
  // Maps to clinical priorities for GLP-1 medication users (Ozempic, Wegovy)
  if (query.nutritional_goal === "glp1_friendly") {
    macroWhere.proteinMinG = { gte: 25 };
    macroWhere.caloriesMax = { lte: 500 };
  }

  // Full-text search: use tsvector when available, fallback to ILIKE
  let textWhere: Record<string, unknown> = {};
  let textSearchDishIds: string[] | null = null;
  let ftsRankMap: Map<string, number> | null = null;
  if (query.query) {
    try {
      const ftsResults = await fullTextSearchDishes(query.query, 200);
      if (ftsResults.length > 0) {
        textSearchDishIds = ftsResults.map((r) => r.id);
        // Preserve FTS rank scores for relevance scoring
        ftsRankMap = new Map(ftsResults.map((r) => [r.id, r.rank]));
      } else {
        // tsvector returned nothing — fallback to ILIKE on name AND description
        textWhere = {
          OR: [
            { name: { contains: query.query, mode: "insensitive" } },
            { description: { contains: query.query, mode: "insensitive" } },
          ],
        };
      }
    } catch {
      // Full-text search not available (tsvector column missing) — fallback
      textWhere = {
        OR: [
          { name: { contains: query.query, mode: "insensitive" } },
          { description: { contains: query.query, mode: "insensitive" } },
        ],
      };
    }
  }

  // Build cuisine filter from categories (cuisine-type categories map to restaurant cuisineType)
  const cuisineCategories = (query.categories || []).filter((c) =>
    CUISINE_IDS.has(c)
  );
  // Capitalize cuisine names to match DB format ("thai" → "Thai")
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const allCuisines = [
    ...(query.cuisine_preferences || []),
    ...cuisineCategories,
  ].map(capitalize);

  // Build meal category filter (non-cuisine categories map to dish category)
  const mealCategories = (query.categories || []).filter(
    (c) => !CUISINE_IDS.has(c)
  );

  // 2b. Geo pre-filter: get nearby restaurant IDs at the DB level (earthdistance)
  let nearbyRestaurantIds: string[] | null = null;
  const hasGeoParams =
    query.latitude != null && query.longitude != null && query.radius_miles != null;

  if (hasGeoParams) {
    const geoResults = await getRestaurantIdsWithinRadius(
      query.latitude,
      query.longitude,
      query.radius_miles
    );

    if (geoResults.length === 0) {
      // No restaurants within radius — return empty results immediately
      logger.debug("Search: no restaurants within radius", {
        lat: query.latitude,
        lng: query.longitude,
        radiusMiles: query.radius_miles,
        durationMs: Date.now() - start,
      });
      const emptyResult: SearchResults = {
        dishes: [],
        total_count: 0,
        cached: false,
      };
      await setCachedQuery(cacheParams, emptyResult);
      return emptyResult;
    }

    nearbyRestaurantIds = geoResults.map((r) => r.id);
  }

  // Fetch a larger window for caching (top 100), then paginate from cache on subsequent requests
  const fetchLimit = Math.max(limit, 100);

  // Query dishes with restaurant join
  const dishes = await prisma.dish.findMany({
    where: {
      isAvailable: true,
      ...dietaryWhere,
      ...macroWhere,
      ...textWhere,
      // If full-text search returned IDs, filter to those
      ...(textSearchDishIds ? { id: { in: textSearchDishIds } } : {}),
      ...(mealCategories.length
        ? { category: { in: mealCategories, mode: "insensitive" } }
        : {}),
      // If geo pre-filter returned IDs, restrict to those restaurants
      ...(nearbyRestaurantIds ? { restaurantId: { in: nearbyRestaurantIds } } : {}),
      restaurant: {
        isActive: true,
        ...(allCuisines.length
          ? { cuisineType: { hasSome: allCuisines } }
          : {}),
        ...(query.include_delivery
          ? { deliveryPlatforms: { some: { isAvailable: true } } }
          : {}),
      },
    },
    include: {
      restaurant: true,
      reviewSummary: true,
      photos: { take: 1, orderBy: { createdAt: "desc" } },
    },
    take: fetchLimit,
    skip: 0, // Always fetch from 0 for cache; paginate from cache
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

  // Use DB-calculated distances from geo pre-filter when available (earthdistance is
  // more accurate than haversine for short distances). Fall back to haversine for
  // dishes from restaurants not in the geo pre-filter.
  const distanceMap = new Map<string, number>();
  if (hasGeoParams) {
    const geoResults = await getRestaurantIdsWithinRadius(
      query.latitude, query.longitude, query.radius_miles
    );
    for (const r of geoResults) {
      distanceMap.set(r.id, Math.round(r.distance_miles * 100) / 100);
    }
  }
  // Fallback: calculate haversine for any restaurants not in the geo map
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
      photo_url: dish.photos?.[0]?.sourceUrl ?? null,
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

  // 4c. Filter by max wait time if specified
  const waitFiltered = query.max_wait_minutes
    ? radiusFiltered.filter((d) => {
        const wait = d.logistics?.estimated_wait_minutes;
        // Inclusive <= : "max 15 min" means 15 min is acceptable, 16 is not
        return wait == null || wait <= query.max_wait_minutes!;
      })
    : radiusFiltered;

  // 5. Run Apollo evaluator for dietary safety
  const verified = verify(waitFiltered, query.dietary_restrictions, query.allergens);

  // 5b. In-memory sorts for fields that can't be sorted at DB level
  if (query.sort_by === "rating") {
    verified.sort((a, b) => {
      const ra = a.review_summary?.average_rating ?? -1;
      const rb = b.review_summary?.average_rating ?? -1;
      // Dishes with reviews sort by rating desc; dishes without reviews go last
      return rb - ra;
    });
  } else if (query.sort_by === "distance") {
    verified.sort((a, b) => {
      const da = a.restaurant.distance_miles ?? Infinity;
      const db = b.restaurant.distance_miles ?? Infinity;
      return da - db;
    });
  } else if (query.sort_by === "wait_time") {
    verified.sort((a, b) => {
      const wa = a.logistics?.estimated_wait_minutes ?? Infinity;
      const wb = b.logistics?.estimated_wait_minutes ?? Infinity;
      return wa - wb;
    });
  } else if (query.sort_by === "macro_match" && query.nutritional_goal) {
    verified.sort((a, b) => {
      return macroMatchScore(b, query.nutritional_goal!) - macroMatchScore(a, query.nutritional_goal!);
    });
  } else if (!query.sort_by || (query.sort_by === "macro_match" && !query.nutritional_goal)) {
    // Default "Best Match" — multi-factor relevance scoring with FTS rank
    verified.sort((a, b) => relevanceScore(b, ftsRankMap) - relevanceScore(a, ftsRankMap));
  }

  // 5c. Restaurant diversity cap: max 3 dishes per restaurant
  const diversified = applyRestaurantDiversityCap(verified, 3);

  // 5d. Re-sort after diversity cap so order stays monotonic
  // (the cap removes items which can break sort order)
  if (query.sort_by === "rating") {
    diversified.sort((a, b) => (b.review_summary?.average_rating ?? -1) - (a.review_summary?.average_rating ?? -1));
  } else if (query.sort_by === "distance") {
    diversified.sort((a, b) => (a.restaurant.distance_miles ?? Infinity) - (b.restaurant.distance_miles ?? Infinity));
  } else if (query.sort_by === "wait_time") {
    diversified.sort((a, b) => (a.logistics?.estimated_wait_minutes ?? Infinity) - (b.logistics?.estimated_wait_minutes ?? Infinity));
  } else if (query.sort_by === "macro_match" && query.nutritional_goal) {
    diversified.sort((a, b) => macroMatchScore(b, query.nutritional_goal!) - macroMatchScore(a, query.nutritional_goal!));
  } else {
    // Default relevance — re-sort after cap to maintain best-match ordering
    diversified.sort((a, b) => relevanceScore(b, ftsRankMap) - relevanceScore(a, ftsRankMap));
  }

  // 6. Cache full result set, then return paginated slice
  const fullResult: SearchResults = {
    dishes: diversified,
    total_count: diversified.length,
    cached: false,
  };

  await setCachedQuery(cacheParams, fullResult);

  logger.debug("Search completed", {
    query: query.query,
    results: diversified.length,
    durationMs: Date.now() - start,
  });

  return {
    dishes: diversified.slice(offset, offset + limit),
    total_count: diversified.length,
    cached: false,
  };
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
        // Rating sort is handled in-memory after query to properly place
        // dishes without reviews (NULLs) at the end. Use createdAt as DB fallback.
      case "wait_time":
      case "distance":
      case "macro_match":
        // These are sorted in-memory after query; use reasonable DB ordering
        return { createdAt: "desc" };
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
    case "glp1_friendly":
      // GLP-1: prioritize high protein first, then low calories
      return { proteinMaxG: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

/**
 * Score a dish's match to a nutritional goal (higher is better).
 * Used for macro_match sorting.
 */
function macroMatchScore(dish: DishResult, goal: string): number {
  switch (goal) {
    case "max_protein":
      return dish.protein_max_g ?? 0;
    case "min_calories":
      // Invert: lower calories = higher score
      return dish.calories_min != null ? 2000 - dish.calories_min : 0;
    case "min_fat":
      return dish.fat_min_g != null ? 100 - dish.fat_min_g : 0;
    case "min_carbs":
      return dish.carbs_min_g != null ? 200 - dish.carbs_min_g : 0;
    case "glp1_friendly": {
      // Score: 60% protein density, 40% calorie control
      // Best GLP-1 dishes are high protein AND low calorie — both matter
      const protein = dish.protein_min_g ?? 0;
      const calories = dish.calories_max ?? 800;
      const proteinScore = Math.min(protein / 50, 1); // normalize: 50g protein = max score
      const calScore = Math.max(0, 1 - (calories - 200) / 600); // 200 kcal = 1.0, 800 kcal = 0.0
      return proteinScore * 0.6 + calScore * 0.4;
    }
    case "balanced": {
      // Balanced: favor dishes near 30% protein, 40% carbs, 30% fat by calorie
      const cal = dish.calories_min ?? 500;
      const pCal = (dish.protein_max_g ?? 25) * 4;
      const cCal = (dish.carbs_max_g ?? 45) * 4;
      const fCal = (dish.fat_max_g ?? 20) * 9;
      const total = pCal + cCal + fCal || 1;
      const pRatio = pCal / total;
      const cRatio = cCal / total;
      const fRatio = fCal / total;
      // Lower deviation from ideal = higher score
      const deviation = Math.abs(pRatio - 0.3) + Math.abs(cRatio - 0.4) + Math.abs(fRatio - 0.3);
      return (1 - deviation) * cal;
    }
    default:
      return 0;
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

/**
 * Multi-factor relevance score for default "Best Match" sorting.
 * Combines rating, proximity, data completeness, and review coverage.
 */
function relevanceScore(dish: DishResult, ftsRankMap?: Map<string, number> | null): number {
  const rating = dish.review_summary?.average_rating ?? 0;
  const dist = dish.restaurant.distance_miles ?? 10;
  const hasPhoto = dish.photo_url ? 1 : 0;
  const hasReview = dish.review_summary ? 1 : 0;
  const confidence = dish.macro_confidence ?? 0;

  // When a text query was used, incorporate FTS rank as a primary signal
  const ftsRank = ftsRankMap?.get(dish.id) ?? 0;
  if (ftsRank > 0) {
    // Normalize rank (ts_rank_cd typically 0-1, clamp to be safe)
    const normalizedRank = Math.min(ftsRank, 1);
    return (
      normalizedRank * 0.30 +                // 30% weight: text relevance
      (rating / 5) * 0.25 +                  // 25% weight: dish quality
      (1 / (1 + dist)) * 0.20 +             // 20% weight: proximity
      hasReview * 0.10 +                     // 10% weight: has review data
      confidence * 0.10 +                    // 10% weight: macro confidence
      hasPhoto * 0.05                        //  5% weight: has photo
    );
  }

  // Browsing mode (no text query) — original weights
  return (
    (rating / 5) * 0.35 +           // 35% weight: dish quality
    (1 / (1 + dist)) * 0.25 +       // 25% weight: proximity (closer = higher)
    hasReview * 0.15 +               // 15% weight: has review data
    confidence * 0.15 +              // 15% weight: macro data confidence
    hasPhoto * 0.10                  // 10% weight: has photo
  );
}

/**
 * Restaurant + cuisine diversity cap: limits dishes per restaurant AND per cuisine.
 *
 * Without cuisine cap, searching "pasta" returns 20 dishes from 5 Italian restaurants
 * even though there might be a great penne at a Mediterranean spot. The cuisine cap
 * ensures broader coverage when sorting by relevance.
 *
 * maxPerRestaurant: 3 (prevents any single restaurant dominating)
 * maxPerCuisine: 6 (prevents any single cuisine dominating for broad searches)
 *
 * Algorithm: preserves primary sort order (no interleaving — that would break
 * protein/rating/distance sorts). Filter pass only.
 */
function applyRestaurantDiversityCap(
  dishes: DishResult[],
  maxPerRestaurant: number,
  maxPerCuisine = 6
): DishResult[] {
  const restaurantCounts = new Map<string, number>();
  const cuisineCounts = new Map<string, number>();

  return dishes.filter((dish) => {
    const rid = dish.restaurant.id;
    const restaurantCount = restaurantCounts.get(rid) ?? 0;
    if (restaurantCount >= maxPerRestaurant) return false;

    // Track cuisine counts — use first cuisine type if array, or "unknown"
    const cuisines = dish.restaurant.cuisine_type;
    const primaryCuisine = (Array.isArray(cuisines) && cuisines.length > 0)
      ? cuisines[0].toLowerCase()
      : "unknown";
    const cuisineCount = cuisineCounts.get(primaryCuisine) ?? 0;
    if (cuisineCount >= maxPerCuisine) return false;

    restaurantCounts.set(rid, restaurantCount + 1);
    cuisineCounts.set(primaryCuisine, cuisineCount + 1);
    return true;
  });
}

export type { UserSearchQuery, DishResult, SearchResults } from "./types";
