/**
 * Add placeholder food photos to all dishes using Unsplash source API.
 * Usage: npx tsx scripts/seed-photos.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Map common dish keywords to good Unsplash search terms
const PHOTO_TERMS: Record<string, string> = {
  pad_thai: "pad+thai+food",
  curry: "curry+food",
  burrito: "burrito+food",
  taco: "tacos+mexican+food",
  pizza: "pizza+food",
  sushi: "sushi+japanese+food",
  ramen: "ramen+noodle+food",
  salad: "salad+food",
  burger: "burger+food",
  pasta: "pasta+italian+food",
  soup: "soup+food",
  steak: "steak+food",
  chicken: "chicken+dish+food",
  rice: "rice+bowl+food",
  noodle: "noodles+food",
  poke: "poke+bowl+food",
  sandwich: "sandwich+food",
  ice_cream: "ice+cream+dessert",
  tiramisu: "tiramisu+dessert",
  churros: "churros+dessert",
  falafel: "falafel+food",
  gyoza: "dumplings+food",
  pho: "pho+vietnamese+food",
  bibimbap: "bibimbap+korean+food",
  default: "food+dish+restaurant",
};

function getPhotoUrl(dishName: string, index: number): string {
  const nameLower = dishName.toLowerCase();
  let term = PHOTO_TERMS.default;

  for (const [key, value] of Object.entries(PHOTO_TERMS)) {
    if (nameLower.includes(key.replace(/_/g, " ")) || nameLower.includes(key)) {
      term = value;
      break;
    }
  }

  // Use Unsplash source API with a unique sig per dish for variety
  return `https://images.unsplash.com/photo-food?w=800&h=500&fit=crop&q=80&sig=${index}&fm=jpg`;
}

// Curated food photo IDs from Unsplash (free to use)
const FOOD_PHOTOS = [
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=500&fit=crop", // pizza
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=500&fit=crop", // salad
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=500&fit=crop", // pancakes
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=500&fit=crop", // colorful dish
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&h=500&fit=crop", // pasta
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop", // grilled meat
  "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&h=500&fit=crop", // pasta overhead
  "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&h=500&fit=crop", // thai food
  "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&h=500&fit=crop", // curry
  "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&h=500&fit=crop", // noodles
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=500&fit=crop", // healthy bowl
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop", // fine dining
  "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=800&h=500&fit=crop", // sushi
  "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&h=500&fit=crop", // burger
  "https://images.unsplash.com/photo-1569058242567-93de6f36f8e6?w=800&h=500&fit=crop", // tacos
  "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&h=500&fit=crop", // ramen
  "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&h=500&fit=crop", // pho
  "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&h=500&fit=crop", // dumpling
  "https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&h=500&fit=crop", // ice cream
  "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&h=500&fit=crop", // burger close
];

async function main() {
  console.log("Adding photos to dishes...");

  const dishes = await prisma.dish.findMany({
    select: { id: true, name: true },
    where: { isAvailable: true },
  });

  let added = 0;

  for (let i = 0; i < dishes.length; i++) {
    const dish = dishes[i];
    const photoUrl = FOOD_PHOTOS[i % FOOD_PHOTOS.length];

    // Check if photo already exists
    const existing = await prisma.dishPhoto.findFirst({
      where: { dishId: dish.id },
    });

    if (!existing) {
      await prisma.dishPhoto.create({
        data: {
          dishId: dish.id,
          sourceUrl: photoUrl,
          sourcePlatform: "google_maps",
          analyzedAt: new Date(),
        },
      });
      added++;
    }
  }

  console.log(`Done! Added photos to ${added} dishes (${dishes.length} total).`);
  await prisma.$disconnect();
}

main().catch(console.error);
