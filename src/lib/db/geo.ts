/**
 * Geospatial query helpers using PostgreSQL earthdistance extension.
 *
 * The earthdistance extension is declared in the Prisma schema and
 * the GIST index on restaurants.location is created in post-migrate.sql.
 *
 * Usage: call getRestaurantIdsWithinRadius() to pre-filter restaurants
 * by distance at the DB level, then pass the IDs to Prisma queries.
 * This avoids fetching all restaurants and filtering in JS.
 */
import { prisma } from "./client";

/**
 * Get restaurant IDs within a radius using PostgreSQL earthdistance.
 * This is significantly faster than app-level haversine for large datasets.
 *
 * @param lat - User latitude
 * @param lng - User longitude
 * @param radiusMiles - Search radius in miles
 * @returns Array of { id, distance_miles } sorted by distance
 */
export async function getRestaurantIdsWithinRadius(
  lat: number,
  lng: number,
  radiusMiles: number
): Promise<{ id: string; distance_miles: number }[]> {
  const radiusMeters = radiusMiles * 1609.34;

  const results = await prisma.$queryRaw<{ id: string; distance_miles: number }[]>`
    SELECT
      id,
      (earth_distance(
        ll_to_earth(${lat}, ${lng}),
        ll_to_earth(latitude::float, longitude::float)
      ) / 1609.34) AS distance_miles
    FROM restaurants
    WHERE is_active = true
      AND earth_box(ll_to_earth(${lat}, ${lng}), ${radiusMeters})
        @> ll_to_earth(latitude::float, longitude::float)
    ORDER BY distance_miles ASC
  `;

  return results;
}

/**
 * Full-text search for dishes using PostgreSQL tsvector.
 * Requires the search_vector generated column and GIN index from post-migrate.sql.
 *
 * @param query - User search text (e.g., "spicy chicken")
 * @param limit - Max results
 * @returns Array of dish IDs ranked by relevance
 */
/**
 * Find dishes by name similarity using pg_trgm, optionally filtered by geo radius.
 * Used by the dish recognition feature to match AI-identified dish names to the database.
 */
export async function findDishesByNameSimilarity(
  name: string,
  lat?: number,
  lng?: number,
  radiusMiles: number = 2,
  limit: number = 10
): Promise<{
  id: string;
  name: string;
  similarity_score: number;
  restaurant_name: string;
  restaurant_id: string;
  distance_miles: number | null;
  calories_min: number | null;
  calories_max: number | null;
  macro_confidence: number | null;
  photo_url: string | null;
}[]> {
  if (!name || name.length < 2) return [];

  const hasGeo = lat != null && lng != null;
  const radiusMeters = radiusMiles * 1609.34;

  if (hasGeo) {
    return prisma.$queryRaw`
      SELECT
        d.id,
        d.name,
        similarity(d.name, ${name}) AS similarity_score,
        r.name AS restaurant_name,
        r.id AS restaurant_id,
        (earth_distance(
          ll_to_earth(${lat}, ${lng}),
          ll_to_earth(r.latitude::float, r.longitude::float)
        ) / 1609.34) AS distance_miles,
        d.calories_min,
        d.calories_max,
        d.macro_confidence::float AS macro_confidence,
        (SELECT source_url FROM dish_photos WHERE dish_id = d.id ORDER BY created_at DESC LIMIT 1) AS photo_url
      FROM dishes d
      JOIN restaurants r ON d.restaurant_id = r.id
      WHERE d.is_available = true
        AND r.is_active = true
        AND similarity(d.name, ${name}) > 0.2
        AND earth_box(ll_to_earth(${lat!}, ${lng!}), ${radiusMeters})
          @> ll_to_earth(r.latitude::float, r.longitude::float)
      ORDER BY similarity_score DESC
      LIMIT ${limit}
    `;
  }

  return prisma.$queryRaw`
    SELECT
      d.id,
      d.name,
      similarity(d.name, ${name}) AS similarity_score,
      r.name AS restaurant_name,
      r.id AS restaurant_id,
      NULL::float AS distance_miles,
      d.calories_min,
      d.calories_max,
      d.macro_confidence::float AS macro_confidence,
      (SELECT source_url FROM dish_photos WHERE dish_id = d.id ORDER BY created_at DESC LIMIT 1) AS photo_url
    FROM dishes d
    JOIN restaurants r ON d.restaurant_id = r.id
    WHERE d.is_available = true
      AND r.is_active = true
      AND similarity(d.name, ${name}) > 0.2
    ORDER BY similarity_score DESC
    LIMIT ${limit}
  `;
}

export async function fullTextSearchDishes(
  query: string,
  limit: number = 50
): Promise<{ id: string; rank: number }[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // websearch_to_tsquery handles: quoted phrases ("pad thai"), optional words,
  // single-word queries, and foreign food names — more robust than manual & join.
  // Try English dictionary first (handles stemming: "chicken" matches "chickens")
  const results = await prisma.$queryRaw<{ id: string; rank: number }[]>`
    SELECT
      id,
      ts_rank_cd(search_vector, websearch_to_tsquery('english', ${trimmed}), 2) AS rank
    FROM dishes
    WHERE search_vector @@ websearch_to_tsquery('english', ${trimmed})
      AND is_available = true
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  if (results.length > 0) return results;

  // Fallback: 'simple' dictionary (no stemming — exact token match)
  // Catches foreign food terms the English stemmer discards (sushi, ramen, nori)
  // Uses the search_vector_simple generated column + GIN index from post-migrate.sql
  // (avoids on-the-fly to_tsvector() which caused seq scans)
  const simpleResults = await prisma.$queryRaw<{ id: string; rank: number }[]>`
    SELECT
      id,
      ts_rank_cd(search_vector_simple, websearch_to_tsquery('simple', ${trimmed}), 2) AS rank
    FROM dishes
    WHERE search_vector_simple @@ websearch_to_tsquery('simple', ${trimmed})
      AND is_available = true
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  return simpleResults;
}
