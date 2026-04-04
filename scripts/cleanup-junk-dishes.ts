/**
 * Retroactive cleanup: remove wines, spirits, beers, sides, condiments, and other
 * non-dish items from the database using the isDishWorthRecommending + isWineOrSpirit filters.
 *
 * Safety: dishes with UserFavorite or CommunityFeedback records are flagged, not deleted.
 *
 * Usage: npx tsx scripts/cleanup-junk-dishes.ts [--dry-run]
 */
import "dotenv/config";
import { isDishWorthRecommending, isWineOrSpirit } from "../src/lib/agents/menu-crawler/clean-dish-name";

interface Stats {
  total: number;
  kept: number;
  deletedWineSpirit: number;
  deletedJunk: number;
  flaggedProtected: number;
  errors: number;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log(`\nJunk Dish Cleanup`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  const stats: Stats = {
    total: 0,
    kept: 0,
    deletedWineSpirit: 0,
    deletedJunk: 0,
    flaggedProtected: 0,
    errors: 0,
  };

  try {
    const dishes = await prisma.dish.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        _count: {
          select: {
            favorites: true,
            communityFeedback: true,
          },
        },
      },
    });

    stats.total = dishes.length;
    console.log(`Scanning ${dishes.length} dishes...\n`);

    const toDelete: { id: string; name: string; reason: string }[] = [];
    const toFlag: { id: string; name: string; reason: string }[] = [];

    for (const dish of dishes) {
      let reason: string | null = null;

      if (isWineOrSpirit(dish.name, dish.category)) {
        reason = "wine/spirit/beer";
      } else if (!isDishWorthRecommending(dish.name, dish.category)) {
        reason = "junk (side/condiment/non-food)";
      }

      if (!reason) {
        stats.kept++;
        continue;
      }

      // Protected: has favorites or community feedback
      const isProtected = dish._count.favorites > 0 || dish._count.communityFeedback > 0;

      if (isProtected) {
        toFlag.push({ id: dish.id, name: dish.name, reason });
        stats.flaggedProtected++;
      } else {
        toDelete.push({ id: dish.id, name: dish.name, reason });
        if (reason.startsWith("wine")) {
          stats.deletedWineSpirit++;
        } else {
          stats.deletedJunk++;
        }
      }
    }

    // Log what will be deleted
    console.log(`--- Wine/Spirit/Beer items (${stats.deletedWineSpirit}) ---`);
    for (const d of toDelete.filter((d) => d.reason.startsWith("wine"))) {
      console.log(`  DELETE: "${d.name}" [${d.reason}]`);
    }

    console.log(`\n--- Junk items (${stats.deletedJunk}) ---`);
    for (const d of toDelete.filter((d) => !d.reason.startsWith("wine"))) {
      console.log(`  DELETE: "${d.name}" [${d.reason}]`);
    }

    if (toFlag.length > 0) {
      console.log(`\n--- Protected (has favorites/feedback — needs manual review) ---`);
      for (const d of toFlag) {
        console.log(`  FLAG: "${d.name}" [${d.reason}]`);
      }
    }

    // Execute deletions
    if (!dryRun && toDelete.length > 0) {
      const ids = toDelete.map((d) => d.id);

      // Delete related records first (cascade doesn't cover all relations)
      await prisma.dishPhoto.deleteMany({ where: { dishId: { in: ids } } });
      await prisma.reviewSummary.deleteMany({ where: { dishId: { in: ids } } });
      // Then delete dishes
      const result = await prisma.dish.deleteMany({ where: { id: { in: ids } } });
      console.log(`\nDeleted ${result.count} dishes from database.`);
    }

    console.log(`\n--- Results ---`);
    console.log(`Total scanned:       ${stats.total}`);
    console.log(`Kept:                ${stats.kept}`);
    console.log(`Wine/spirit/beer:    ${stats.deletedWineSpirit}`);
    console.log(`Other junk:          ${stats.deletedJunk}`);
    console.log(`Protected (flagged): ${stats.flaggedProtected}`);
    console.log(`Total to remove:     ${stats.deletedWineSpirit + stats.deletedJunk}`);
    if (dryRun) console.log(`\n(Dry run — no changes made)`);
  } catch (err) {
    console.error("Fatal:", (err as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
