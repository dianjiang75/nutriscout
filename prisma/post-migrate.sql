-- post-migrate.sql — Run AFTER prisma migrate deploy
-- These indexes use features Prisma can't express natively (JSONB GIN, GiST, tsvector, trgm).
-- All use CONCURRENTLY to avoid locking tables during creation.

-- ─── Extensions ──────────────────────────────────────────────
-- pgvector, earthdistance, cube are declared in schema.prisma but need pg_trgm separately
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Dietary Flags GIN Index ─────────────────────────────────
-- jsonb_path_ops gives 36x smaller index and faster @> containment queries
-- Critical for dietary filter queries: WHERE dietary_flags @> '{"nut_free": true}'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dishes_dietary_flags
  ON dishes USING GIN (dietary_flags jsonb_path_ops);

-- ─── Full-Text Search ────────────────────────────────────────
-- Generated tsvector column + GIN index for fast dish name search
-- Uses 'english' dictionary for stemming (matches existing search_vector column if present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dishes' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE dishes ADD COLUMN search_vector tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))) STORED;
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dishes_search_vector
  ON dishes USING GIN (search_vector);

-- Simple dictionary fallback for non-English dish names (ramen, pho, bibimbap)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dishes' AND column_name = 'search_vector_simple'
  ) THEN
    ALTER TABLE dishes ADD COLUMN search_vector_simple tsvector
      GENERATED ALWAYS AS (to_tsvector('simple', coalesce(name, ''))) STORED;
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dishes_search_vector_simple
  ON dishes USING GIN (search_vector_simple);

-- ─── Trigram Index for Fuzzy Name Matching ───────────────────
-- Speeds up similarity() > 0.2 threshold checks in findDishesByNameSimilarity()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dishes_name_trgm
  ON dishes USING GIN (name gin_trgm_ops);

-- ─── Geo (earthdistance) GiST Index ─────────────────────────
-- Required for earth_box @> containment queries to use index scan
-- Without this, geo pre-filter in getRestaurantIdsWithinRadius() does seq scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_restaurants_geo
  ON restaurants USING gist(ll_to_earth(latitude::float, longitude::float));

-- ─── Macro Quality Indexes ───────────────────────────────────
-- For sorting by macro confidence and targeting low-confidence dishes for re-analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dishes_low_confidence
  ON dishes (macro_confidence) WHERE macro_confidence IS NOT NULL AND macro_confidence < 0.5;

-- Delivery scrape staleness check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_delivery_last_checked
  ON restaurants (last_delivery_scrape) WHERE last_delivery_scrape IS NOT NULL;

-- ─── pgvector HNSW Index ─────────────────────────────────────
-- Build with ef_construction=128 for better recall (default 64 is too low)
-- Only create if embedding column exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dishes' AND column_name = 'embedding'
  ) THEN
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dishes_embedding_hnsw
      ON dishes USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 128);
  END IF;
END $$;
