/**
 * Backfill script: Create MenuItem records from existing Dish records.
 *
 * Run: npx tsx scripts/backfill-menu-items.ts [--dry-run]
 *
 * This migrates the existing Dish table data into the new MenuItem archive.
 * - Each Dish becomes a MenuItem linked via dishId
 * - Items with isAvailable=true → menuItemType 'dish'
 * - Items with isAvailable=false → menuItemType 'unknown' (needs re-classification)
 * - Source is 'backfill' (distinguishes from live crawls)
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(`[backfill] ${dryRun ? "DRY RUN — no writes" : "LIVE RUN"}`);

  // Count existing MenuItems to avoid double-backfill
  const existingMenuItems = await prisma.menuItem.count();
  if (existingMenuItems > 0) {
    console.log(`[backfill] MenuItem table already has ${existingMenuItems} records.`);
    console.log(`[backfill] Skipping backfill to avoid duplicates. Delete MenuItems first if you want to re-run.`);
    return;
  }

  const dishes = await prisma.dish.findMany({
    include: { restaurant: { select: { id: true, name: true, menuSource: true } } },
  });

  console.log(`[backfill] Found ${dishes.length} Dish records to migrate`);

  let created = 0;
  let skipped = 0;

  for (const dish of dishes) {
    const nameNormalized = normalizeName(dish.name);

    if (dryRun) {
      const type = dish.isAvailable ? "dish" : "unknown";
      console.log(`  [dry] "${dish.name}" → MenuItem (${type}) at ${dish.restaurant.name}`);
      created++;
      continue;
    }

    try {
      await prisma.menuItem.create({
        data: {
          restaurantId: dish.restaurantId,
          name: dish.name,
          nameNormalized,
          description: dish.description,
          price: dish.price,
          category: dish.category,
          menuItemType: dish.isAvailable ? "dish" : "unknown",
          source: "backfill",
          dishId: dish.id,
          firstSeenAt: dish.createdAt,
          lastSeenAt: dish.updatedAt,
        },
      });
      created++;
    } catch (err) {
      // Unique constraint violation = duplicate (same restaurant+name+source)
      skipped++;
      if (skipped <= 5) {
        console.warn(`  [skip] "${dish.name}" — ${(err as Error).message.slice(0, 80)}`);
      }
    }
  }

  console.log(`[backfill] Done: ${created} created, ${skipped} skipped`);
}

/** Simple name normalization for dedup key */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\((?:v|vg|gf|df|nf|spicy|new|hot)\)/gi, "")
    .replace(/[-–]\s*(?:small|medium|large|regular|xl)/gi, "")
    .replace(/\((?:small|medium|large|regular|xl)\)/gi, "")
    .replace(/[*†‡]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

main()
  .catch((err) => {
    console.error("[backfill] Fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
