/**
 * Apply photo matches: link existing AI-generated dish images to dishes in the DB.
 *
 * Usage: npx tsx scripts/apply-photo-matches.ts [--dry-run] [--threshold 0.7]
 *
 * Finds all dishes without DishPhoto records, runs photo matching against
 * the 1,371 AI-generated images in public/dishes/, and creates DishPhoto
 * records for matches.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { matchPhotoForDish, clearCaches } from "../src/lib/photos/match-photo";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const thresholdArg = process.argv.indexOf("--threshold");
  const threshold =
    thresholdArg !== -1 ? parseFloat(process.argv[thresholdArg + 1]) : 0.7;

  console.log(
    `[photo-match] ${dryRun ? "DRY RUN" : "LIVE RUN"} | threshold: ${threshold}`
  );

  // Clear caches to ensure fresh data
  clearCaches();

  // Find dishes that have zero DishPhoto records
  const dishesWithoutPhotos = await prisma.dish.findMany({
    where: {
      photos: {
        none: {},
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  console.log(
    `[photo-match] Found ${dishesWithoutPhotos.length} dishes without photos`
  );

  let matched = 0;
  let unmatched = 0;
  const matches: Array<{ dishName: string; photoPath: string }> = [];

  for (const dish of dishesWithoutPhotos) {
    const photoPath = matchPhotoForDish(dish.name);

    if (photoPath) {
      matched++;
      matches.push({ dishName: dish.name, photoPath });

      if (!dryRun) {
        await prisma.dishPhoto.create({
          data: {
            dishId: dish.id,
            sourceUrl: photoPath,
            sourcePlatform: "user_submitted",
          },
        });
      }

      if (matched <= 20) {
        console.log(`  [MATCH] "${dish.name}" -> ${photoPath}`);
      }
    } else {
      unmatched++;
    }
  }

  if (matched > 20) {
    console.log(`  ... and ${matched - 20} more matches`);
  }

  console.log(`\n[photo-match] Results:`);
  console.log(`  Photos matched: ${matched}`);
  console.log(`  Dishes still without photos: ${unmatched}`);
  console.log(
    `  Total dishes checked: ${dishesWithoutPhotos.length}`
  );

  if (dryRun && matched > 0) {
    console.log(`\n[photo-match] Re-run without --dry-run to apply changes.`);
  }
}

main()
  .catch((err) => {
    console.error("[photo-match] Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
