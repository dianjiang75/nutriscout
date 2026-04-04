-- Post-migration script: adds pgvector column, full-text search, and custom indexes
-- that Prisma cannot manage natively.
-- Run after `npx prisma migrate dev`:
--   psql $DATABASE_URL -f scripts/post-migrate.sql

-- ─── Extensions ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── pgvector embedding column ──────────────────────────
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS macro_embedding vector(4);

-- ─── Full-text search (tsvector generated column) ───────
-- Weight dish name as 'A' (highest priority), description as 'B'
-- This enables proper full-text search: "spicy chicken" matches "Chicken Tikka (Spicy)"
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'C')
  ) STORED;

-- ─── Indexes ────────────────────────────────────────────

-- Dietary flags: jsonb_path_ops is 2-3x faster and 60% smaller for containment queries
DROP INDEX IF EXISTS idx_dishes_dietary;
CREATE INDEX IF NOT EXISTS idx_dishes_dietary ON dishes USING GIN(dietary_flags jsonb_path_ops);

-- Full-text search GIN index
CREATE INDEX IF NOT EXISTS idx_dishes_search ON dishes USING GIN(search_vector);

-- Protein sorting (common filter: "high protein")
CREATE INDEX IF NOT EXISTS idx_dishes_protein ON dishes(protein_max_g DESC);

-- Calorie filtering (common filter: "under 500 cal")
CREATE INDEX IF NOT EXISTS idx_dishes_calories ON dishes(calories_min, calories_max);

-- Geospatial: earthdistance for radius filtering in SQL
CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants USING GIST(
  ll_to_earth(latitude::float, longitude::float)
);

-- Restaurant active + cuisine (common join filter)
CREATE INDEX IF NOT EXISTS idx_restaurants_active_cuisine ON restaurants(is_active) WHERE is_active = true;

-- pgvector: HNSW index (better recall than IVFFlat for small-medium datasets)
-- Requires at least some rows before creation
DO $$
BEGIN
  IF (SELECT count(*) FROM dishes WHERE macro_embedding IS NOT NULL) > 0 THEN
    DROP INDEX IF EXISTS idx_dish_macro_embedding;
    CREATE INDEX IF NOT EXISTS idx_dish_macro_embedding ON dishes
      USING hnsw(macro_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
  END IF;
END $$;

-- Macro source quality: prioritize dishes with restaurant_published > usda > vision_ai
CREATE INDEX IF NOT EXISTS idx_dishes_macro_source ON dishes(macro_source, created_at DESC)
  WHERE macro_source IS NOT NULL;

-- Delivery staleness: find platforms that haven't been checked recently
CREATE INDEX IF NOT EXISTS idx_delivery_last_checked ON restaurant_deliveries(last_checked)
  WHERE is_available = true;

-- Delivery scrape staleness: find restaurants due for delivery platform re-scrape
CREATE INDEX IF NOT EXISTS idx_restaurants_delivery_scrape ON restaurants(last_delivery_scrape)
  WHERE is_active = true;

-- Macro confidence: find low-confidence dishes needing re-analysis
CREATE INDEX IF NOT EXISTS idx_dishes_low_confidence ON dishes(macro_confidence ASC)
  WHERE macro_confidence IS NOT NULL AND macro_confidence < 0.7;

-- ─── pg_trgm index for fuzzy search ────────────────────
-- GIN is 2x faster than GIST for similarity() function queries used by
-- findDishesByNameSimilarity(). GIST is better for LIKE/ILIKE patterns;
-- GIN is better for the equality/threshold queries we use (similarity() > 0.2).
DROP INDEX IF EXISTS idx_dishes_name_trgm;
CREATE INDEX IF NOT EXISTS idx_dishes_name_trgm ON dishes USING GIN(name gin_trgm_ops);
