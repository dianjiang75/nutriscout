-- Post-migration script: adds pgvector column, full-text search, and custom indexes
-- that Prisma cannot manage natively.
-- Run after `npx prisma migrate dev`:
--   psql $DATABASE_URL -f scripts/post-migrate.sql

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
      USING hnsw(macro_embedding vector_cosine_ops) WITH (m = 8, ef_construction = 32);
  END IF;
END $$;
