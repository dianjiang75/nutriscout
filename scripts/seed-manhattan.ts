/**
 * Seed script for FoodClaw — Real Manhattan NYC restaurants.
 * 28 restaurants across 10 cuisine types with real addresses, menus, and nutrition.
 *
 * Usage: npx tsx scripts/seed-manhattan.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedRestaurants } from "./seed-manhattan-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Photo matching from seed-photos.ts
const PHOTOS_BY_TYPE: Record<string, string[]> = {
  pizza: ["https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=500&fit=crop"],
  salad: ["https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=500&fit=crop"],
  pasta: ["https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&h=500&fit=crop"],
  burger: ["https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&h=500&fit=crop"],
  sushi: ["https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=500&fit=crop"],
  taco: ["https://images.unsplash.com/photo-1569058242567-93de6f36f8e6?w=800&h=500&fit=crop"],
  ramen: ["https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&h=500&fit=crop"],
  pho: ["https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&h=500&fit=crop"],
  noodle: ["https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&h=500&fit=crop"],
  curry: ["https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&h=500&fit=crop"],
  soup: ["https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&h=500&fit=crop"],
  steak: ["https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop"],
  chicken: ["https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&h=500&fit=crop"],
  rice: ["https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=500&fit=crop"],
  dumpling: ["https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&h=500&fit=crop"],
  sandwich: ["https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&h=500&fit=crop"],
  pancake: ["https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=500&fit=crop"],
  fish: ["https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=500&fit=crop"],
  shrimp: ["https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&h=500&fit=crop"],
  roll: ["https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=500&fit=crop"],
  lamb: ["https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop"],
  pork: ["https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop"],
  katsu: ["https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&h=500&fit=crop"],
  falafel: ["https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=800&h=500&fit=crop"],
  hummus: ["https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=800&h=500&fit=crop"],
  bibimbap: ["https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800&h=500&fit=crop"],
  bbq: ["https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop"],
};

const FALLBACK_PHOTOS = [
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=500&fit=crop",
];

function matchPhoto(dishName: string, index: number): string {
  const lower = dishName.toLowerCase();
  for (const [keyword, photos] of Object.entries(PHOTOS_BY_TYPE)) {
    if (lower.includes(keyword)) return photos[index % photos.length];
  }
  return FALLBACK_PHOTOS[index % FALLBACK_PHOTOS.length];
}

// Generate dietary flags from dish description
function inferDietaryFlags(name: string, desc: string) {
  const text = `${name} ${desc}`.toLowerCase();
  const hasMeat = /chicken|pork|beef|lamb|steak|brisket|duck|sausage|bacon|prosciutto|meatball|meatloaf|short rib|oxtail/.test(text);
  const hasFish = /shrimp|fish|salmon|tuna|crab|lobster|anchov|oyster|branzino|calamari|squid|scallop/.test(text);
  const hasDairy = /cheese|cream|butter|milk|yogurt|ricotta|mozzarella|parmesan|burrata/.test(text);
  const hasGluten = /bread|noodle|pasta|flour|baguette|biscuit|dumpling|wonton|gyoza|crust|tortilla|bun|roll|panko/.test(text);
  const hasNuts = /peanut|almond|cashew|walnut|pistachio|pine nut/.test(text);
  const hasPork = /pork|bacon|ham|prosciutto|sausage|lard/.test(text);

  return {
    vegan: !hasMeat && !hasFish && !hasDairy && !text.includes("egg") ? true : false,
    vegetarian: !hasMeat && !hasFish ? true : false,
    gluten_free: !hasGluten ? true : null,
    dairy_free: !hasDairy ? true : null,
    nut_free: !hasNuts ? true : null,
    halal: !hasPork && !text.includes("alcohol") ? true : null,
    kosher: !hasPork && !hasFish ? null : null,
  };
}

async function main() {
  console.log("Seeding FoodClaw with real Manhattan restaurants...\n");

  // Clear existing data
  console.log("Clearing existing data...");
  await prisma.communityFeedback.deleteMany();
  await prisma.userFavorite.deleteMany();
  await prisma.dishPhoto.deleteMany();
  await prisma.reviewSummary.deleteMany();
  await prisma.restaurantLogistics.deleteMany();
  await prisma.restaurantDelivery.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.restaurant.deleteMany();

  let totalDishes = 0;

  for (const r of seedRestaurants) {
    // Create restaurant
    const placeId = `ChIJ_${r.name.replace(/[^a-zA-Z]/g, "").slice(0, 20)}_${Math.random().toString(36).slice(2, 8)}`;
    const restaurant = await prisma.restaurant.create({
      data: {
        googlePlaceId: placeId,
        name: r.name,
        address: r.address,
        latitude: r.lat,
        longitude: r.lng,
        cuisineType: r.cuisine,
        priceLevel: r.price,
        googleRating: r.rating,
        phone: r.phone,
        websiteUrl: r.website,
        menuSource: "website",
        isActive: true,
        lastMenuCrawl: new Date(),
      },
    });

    // Add logistics (current time window)
    const now = new Date();
    const busyness = 20 + Math.floor(Math.random() * 60);
    for (let h = Math.max(0, now.getHours() - 2); h <= Math.min(23, now.getHours() + 2); h++) {
      const b = Math.max(10, Math.min(100, busyness + (h - now.getHours()) * 8 + Math.floor(Math.random() * 15 - 7)));
      await prisma.restaurantLogistics.create({
        data: {
          restaurantId: restaurant.id,
          dayOfWeek: now.getDay(),
          hour: h,
          typicalBusynessPct: b,
          estimatedWaitMinutes: Math.round(b * 0.35),
        },
      });
    }

    // Create dishes
    for (let i = 0; i < r.dishes.length; i++) {
      const d = r.dishes[i];
      const flags = inferDietaryFlags(d.name, d.description);
      const variance = 0.12; // ±12% for min/max range

      const dish = await prisma.dish.create({
        data: {
          restaurantId: restaurant.id,
          name: d.name,
          description: d.description,
          price: d.price,
          category: d.category,
          ingredientsRaw: d.description,
          dietaryFlags: flags,
          dietaryConfidence: 0.75 + Math.random() * 0.2,
          caloriesMin: Math.round(d.calories * (1 - variance)),
          caloriesMax: Math.round(d.calories * (1 + variance)),
          proteinMinG: Math.round(d.protein * (1 - variance) * 10) / 10,
          proteinMaxG: Math.round(d.protein * (1 + variance) * 10) / 10,
          carbsMinG: Math.round(d.carbs * (1 - variance) * 10) / 10,
          carbsMaxG: Math.round(d.carbs * (1 + variance) * 10) / 10,
          fatMinG: Math.round(d.fat * (1 - variance) * 10) / 10,
          fatMaxG: Math.round(d.fat * (1 + variance) * 10) / 10,
          macroConfidence: 0.78 + Math.random() * 0.17,
          macroSource: "third_party_db",
          macroSourceName: "USDA / MyFitnessPal estimate",
          isAvailable: true,
        },
      });

      // Add photo
      await prisma.dishPhoto.create({
        data: {
          dishId: dish.id,
          sourceUrl: matchPhoto(d.name, totalDishes + i),
          sourcePlatform: "google_maps",
          analyzedAt: new Date(),
        },
      });

      // Add review summary (~70% of dishes)
      if (Math.random() < 0.7) {
        const rating = 3.5 + Math.random() * 1.5;
        await prisma.reviewSummary.create({
          data: {
            dishId: dish.id,
            averageDishRating: Math.round(rating * 10) / 10,
            totalReviewsAnalyzed: 5 + Math.floor(Math.random() * 40),
            summaryText: `Popular dish at ${r.name}. Customers praise the flavors and portion size.`,
            commonPraises: ["Great flavor", "Good portion", "Fresh ingredients"],
            commonComplaints: Math.random() < 0.3 ? ["Can be spicy", "Wait time"] : [],
            lastUpdated: new Date(),
          },
        });
      }
    }

    totalDishes += r.dishes.length;
    console.log(`  ${r.name}: ${r.dishes.length} dishes created`);
  }

  console.log(`\nDone! Created ${seedRestaurants.length} restaurants with ${totalDishes} total dishes.`);
  await prisma.$disconnect();
}

main().catch(console.error);
