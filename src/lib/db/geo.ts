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
export async function fullTextSearchDishes(
  query: string,
  limit: number = 50
): Promise<{ id: string; rank: number }[]> {
  // Convert user query to tsquery: "spicy chicken" → "spicy & chicken"
  const tsquery = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .join(" & ");

  if (!tsquery) return [];

  const results = await prisma.$queryRaw<{ id: string; rank: number }[]>`
    SELECT
      id,
      ts_rank(search_vector, to_tsquery('english', ${tsquery})) AS rank
    FROM dishes
    WHERE search_vector @@ to_tsquery('english', ${tsquery})
      AND is_available = true
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  return results;
}
