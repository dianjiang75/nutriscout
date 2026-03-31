-- Add new enum values to MacroSource
ALTER TYPE "MacroSource" ADD VALUE IF NOT EXISTS 'third_party_db';

-- Add macro source detail columns to dishes
ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "macro_source_name" TEXT;
ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "macro_source_url" TEXT;
ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "macro_source_log_count" INTEGER;
ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "cross_validated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "cross_validation_source" TEXT;
ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "cross_validation_deviation" DECIMAL(5,2);
