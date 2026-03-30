-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "cube" WITH SCHEMA "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "earthdistance" WITH SCHEMA "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "MenuSource" AS ENUM ('website', 'google_photos', 'ubereats', 'doordash', 'manual');

-- CreateEnum
CREATE TYPE "PhotoSource" AS ENUM ('google_maps', 'yelp', 'ubereats', 'doordash', 'user_submitted');

-- CreateEnum
CREATE TYPE "MacroSource" AS ENUM ('vision_ai', 'usda_match', 'restaurant_published', 'community_verified');

-- CreateEnum
CREATE TYPE "DeliveryPlatform" AS ENUM ('ubereats', 'doordash', 'grubhub', 'seamless');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('portion_bigger', 'portion_smaller', 'portion_accurate', 'ingredient_correction', 'dish_unavailable', 'photo_submission');

-- CreateTable
CREATE TABLE "restaurants" (
    "id" UUID NOT NULL,
    "google_place_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "cuisine_type" TEXT[],
    "price_level" INTEGER,
    "phone" TEXT,
    "website_url" TEXT,
    "google_rating" DECIMAL(2,1),
    "yelp_rating" DECIMAL(2,1),
    "yelp_business_id" TEXT,
    "accepts_reservations" BOOLEAN,
    "last_menu_crawl" TIMESTAMP(3),
    "last_review_crawl" TIMESTAMP(3),
    "last_traffic_update" TIMESTAMP(3),
    "menu_source" "MenuSource",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dishes" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(8,2),
    "category" TEXT,
    "ingredients_raw" TEXT,
    "ingredients_parsed" JSONB,
    "dietary_flags" JSONB,
    "dietary_confidence" DECIMAL(3,2),
    "calories_min" INTEGER,
    "calories_max" INTEGER,
    "protein_min_g" DECIMAL(6,1),
    "protein_max_g" DECIMAL(6,1),
    "carbs_min_g" DECIMAL(6,1),
    "carbs_max_g" DECIMAL(6,1),
    "fat_min_g" DECIMAL(6,1),
    "fat_max_g" DECIMAL(6,1),
    "macro_confidence" DECIMAL(3,2),
    "macro_source" "MacroSource",
    "photo_count_analyzed" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "last_verified" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_photos" (
    "id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_platform" "PhotoSource" NOT NULL,
    "macro_estimate" JSONB,
    "volume_estimate_ml" DECIMAL(8,1),
    "analyzed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dish_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_summaries" (
    "id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "total_reviews_analyzed" INTEGER NOT NULL DEFAULT 0,
    "google_review_count" INTEGER NOT NULL DEFAULT 0,
    "yelp_review_count" INTEGER NOT NULL DEFAULT 0,
    "average_dish_rating" DECIMAL(3,2),
    "summary_text" TEXT,
    "sentiment_positive_pct" DECIMAL(5,2),
    "sentiment_negative_pct" DECIMAL(5,2),
    "common_praises" TEXT[],
    "common_complaints" TEXT[],
    "dietary_warnings" TEXT[],
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_logistics" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "typical_busyness_pct" INTEGER,
    "estimated_wait_minutes" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_logistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_delivery" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "platform" "DeliveryPlatform" NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "delivery_fee_min" DECIMAL(6,2),
    "delivery_fee_max" DECIMAL(6,2),
    "estimated_delivery_minutes_min" INTEGER,
    "estimated_delivery_minutes_max" INTEGER,
    "platform_url" TEXT,
    "last_checked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dietary_restrictions" JSONB,
    "nutritional_goals" JSONB,
    "max_wait_minutes" INTEGER NOT NULL DEFAULT 30,
    "search_radius_miles" DECIMAL(4,1) NOT NULL DEFAULT 2.0,
    "preferred_cuisines" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_feedback" (
    "id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "feedback_type" "FeedbackType" NOT NULL,
    "details" JSONB,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_google_place_id_key" ON "restaurants"("google_place_id");

-- CreateIndex
CREATE INDEX "idx_dishes_restaurant" ON "dishes"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_dishes_calories" ON "dishes"("calories_min", "calories_max");

-- CreateIndex
CREATE UNIQUE INDEX "review_summaries_dish_id_key" ON "review_summaries"("dish_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_logistics_restaurant_id_day_of_week_hour_key" ON "restaurant_logistics"("restaurant_id", "day_of_week", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_delivery_restaurant_id_platform_key" ON "restaurant_delivery"("restaurant_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_email_key" ON "user_profiles"("email");

-- AddForeignKey
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_photos" ADD CONSTRAINT "dish_photos_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_summaries" ADD CONSTRAINT "review_summaries_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_logistics" ADD CONSTRAINT "restaurant_logistics_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_delivery" ADD CONSTRAINT "restaurant_delivery_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_feedback" ADD CONSTRAINT "community_feedback_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_feedback" ADD CONSTRAINT "community_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
