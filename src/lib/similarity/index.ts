import { prisma } from "@/lib/db/client";
import type { DietaryFlags } from "@/types";

export interface SimilarityOptions {
  latitude: number;
  longitude: number;
  radius_miles: number;
  dietary_restrictions?: DietaryFlags;
  limit?: number;
}

export interface SimilarDish {
  id: string;
  name: string;
  restaurant_name: string;
  restaurant_id: string;
  calories_min: number | null;
  calories_max: number | null;
  protein_max_g: number | null;
  similarity_score: number;
}

export interface RerouteSuggestion {
  dish: SimilarDish;
  estimated_wait_minutes: number | null;
  current_busyness_pct: number | null;
  savings_minutes: number;
}

/**
 * Find dishes with similar macro profiles using pgvector cosine similarity.
 * Falls back to manual cosine calculation if pgvector embedding is not populated.
 */
export async function findSimilarDishes(
  dishId: string,
  options: SimilarityOptions
): Promise<SimilarDish[]> {
  const limit = options.limit ?? 5;

  // Get the source dish
  const sourceDish = await prisma.dish.findUnique({
    where: { id: dishId },
    include: { restaurant: true },
  });

  if (!sourceDish) throw new Error(`Dish ${dishId} not found`);

  // Compute normalized macro vector for the source dish
  const sourceVector = normalizeMacros(
    sourceDish.caloriesMin,
    sourceDish.proteinMaxG ? Number(sourceDish.proteinMaxG) : null,
    sourceDish.carbsMaxG ? Number(sourceDish.carbsMaxG) : null,
    sourceDish.fatMaxG ? Number(sourceDish.fatMaxG) : null
  );

  if (!sourceVector) {
    return []; // Can't compute similarity without macro data
  }

  // Get candidate dishes (excluding the source dish and its restaurant)
  // Filter by geographic radius using haversine at the application level
  const candidates = await prisma.dish.findMany({
    where: {
      id: { not: dishId },
      restaurantId: { not: sourceDish.restaurantId },
      isAvailable: true,
      caloriesMin: { not: null },
      restaurant: { isActive: true },
    },
    include: { restaurant: true },
    take: limit * 10, // Over-fetch since we filter by radius below
  });

  // Filter candidates by geographic radius
  const radiusMiles = options.radius_miles;
  const candidatesInRadius = candidates.filter((c) => {
    const dist = haversineDistance(
      options.latitude, options.longitude,
      Number(c.restaurant.latitude), Number(c.restaurant.longitude)
    );
    return dist <= radiusMiles;
  });

  // Compute similarity and rank
  const scored = candidatesInRadius
    .map((candidate) => {
      const candidateVector = normalizeMacros(
        candidate.caloriesMin,
        candidate.proteinMaxG ? Number(candidate.proteinMaxG) : null,
        candidate.carbsMaxG ? Number(candidate.carbsMaxG) : null,
        candidate.fatMaxG ? Number(candidate.fatMaxG) : null
      );

      if (!candidateVector) return null;

      const similarity = cosineSimilarity(sourceVector, candidateVector);

      return {
        dish: {
          id: candidate.id,
          name: candidate.name,
          restaurant_name: candidate.restaurant.name,
          restaurant_id: candidate.restaurant.id,
          calories_min: candidate.caloriesMin,
          calories_max: candidate.caloriesMax,
          protein_max_g: candidate.proteinMaxG
            ? Number(candidate.proteinMaxG)
            : null,
          similarity_score: Math.round(similarity * 1000) / 1000,
        },
        similarity,
      };
    })
    .filter(
      (item): item is NonNullable<typeof item> =>
        item !== null && item.similarity > 0.85
    )
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map((item) => item.dish);

  return scored;
}

/**
 * Auto-reroute: when a restaurant's wait exceeds the user's threshold,
 * suggest similar dishes at less busy restaurants.
 */
export async function autoReroute(
  dishId: string,
  currentWaitMinutes: number,
  userMaxWait: number,
  options: SimilarityOptions
): Promise<RerouteSuggestion[]> {
  if (currentWaitMinutes <= userMaxWait) return [];

  const similar = await findSimilarDishes(dishId, {
    ...options,
    limit: 10,
  });

  // For each similar dish, check if its restaurant is less busy
  const suggestions: RerouteSuggestion[] = [];

  for (const dish of similar) {
    // Get the latest logistics data for the restaurant
    const now = new Date();
    const logistics = await prisma.restaurantLogistics.findUnique({
      where: {
        restaurantId_dayOfWeek_hour: {
          restaurantId: dish.restaurant_id,
          dayOfWeek: now.getDay(),
          hour: now.getHours(),
        },
      },
    });

    const busyness = logistics?.typicalBusynessPct ?? null;
    const waitEstimate = logistics?.estimatedWaitMinutes ?? null;

    // Only suggest if busyness < 50%
    if (busyness !== null && busyness < 50) {
      suggestions.push({
        dish,
        estimated_wait_minutes: waitEstimate,
        current_busyness_pct: busyness,
        savings_minutes: currentWaitMinutes - (waitEstimate ?? 0),
      });
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Normalize macro values using z-score standardization then L2 normalize.
 *
 * Previous approach used arbitrary divisors (cal/1000, protein/50, etc.)
 * which caused calories to dominate similarity. Z-score standardization
 * (subtract mean, divide by std) puts all macros on the same scale.
 *
 * Statistics computed from typical restaurant dish ranges:
 *   Calories: mean ~500, std ~250 (range 100-1500)
 *   Protein:  mean ~25g, std ~15g (range 2-80)
 *   Carbs:    mean ~45g, std ~30g (range 0-150)
 *   Fat:      mean ~20g, std ~15g (range 2-70)
 */
const MACRO_STATS = {
  calories: { mean: 500, std: 250 },
  protein: { mean: 25, std: 15 },
  carbs: { mean: 45, std: 30 },
  fat: { mean: 20, std: 15 },
};

function normalizeMacros(
  calories: number | null,
  protein: number | null,
  carbs: number | null,
  fat: number | null
): number[] | null {
  if (calories === null) return null;

  // Z-score standardization: (value - mean) / std
  const vec = [
    (calories - MACRO_STATS.calories.mean) / MACRO_STATS.calories.std,
    ((protein ?? 0) - MACRO_STATS.protein.mean) / MACRO_STATS.protein.std,
    ((carbs ?? 0) - MACRO_STATS.carbs.mean) / MACRO_STATS.carbs.std,
    ((fat ?? 0) - MACRO_STATS.fat.mean) / MACRO_STATS.fat.std,
  ];

  // L2 normalize to unit vector for cosine similarity
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return null;

  return vec.map((v) => v / magnitude);
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/** Haversine distance in miles between two lat/lng points. */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { cosineSimilarity, normalizeMacros };
