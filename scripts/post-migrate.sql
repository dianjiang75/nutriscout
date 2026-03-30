-- Post-migration script: adds pgvector column and custom indexes
-- that Prisma cannot manage natively.
-- Run after `npx prisma migrate dev`:
--   psql $DATABASE_URL -f scripts/post-migrate.sql

ALTER TABLE dishes ADD COLUMN IF NOT EXISTS macro_embedding vector(4);

CREATE INDEX IF NOT EXISTS idx_dishes_dietary ON dishes USING GIN(dietary_flags);
CREATE INDEX IF NOT EXISTS idx_dishes_protein ON dishes(protein_max_g DESC);
CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants USING GIST(
  ll_to_earth(latitude::float, longitude::float)
);

-- IVFFlat index for cosine similarity on macro embeddings
-- Note: requires at least some rows before creation, so skip if table is empty
DO $$
BEGIN
  IF (SELECT count(*) FROM dishes WHERE macro_embedding IS NOT NULL) > 0 THEN
    CREATE INDEX IF NOT EXISTS idx_dish_macro_embedding ON dishes
      USING ivfflat(macro_embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END $$;
