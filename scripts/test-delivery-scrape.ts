/**
 * Test delivery scraper against a few restaurants directly (no BullMQ).
 * Usage: npx tsx -r tsconfig-paths/register scripts/test-delivery-scrape.ts
 */
import "dotenv/config";

async function main() {
  const { scrapeDeliveryPlatforms } = await import("@/lib/agents/delivery-scraper/index");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Pick 3 well-known restaurants likely on DoorDash/UberEats
  const restaurants = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      name: {
        in: [
          "Joe's Pizza",
          "Raising Cane's Chicken Fingers",
          "Magnolia Bakery",
        ],
      },
    },
    select: { id: true, name: true },
    take: 3,
  });

  if (restaurants.length === 0) {
    // Fallback: just grab first 3 with dishes
    const fallback = await prisma.restaurant.findMany({
      where: { isActive: true, dishes: { some: {} } },
      select: { id: true, name: true },
      take: 3,
    });
    restaurants.push(...fallback);
  }

  console.log(`\nTesting delivery scraper on ${restaurants.length} restaurants\n`);

  for (const r of restaurants) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Scraping: ${r.name} (${r.id})`);
    console.log("=".repeat(60));

    try {
      const result = await scrapeDeliveryPlatforms(r.id, false);

      console.log(`\nResults:`);
      console.log(`  Total items scraped: ${result.totalItemsScraped}`);
      console.log(`  Matched to dishes:   ${result.itemsMatchedToDishes}`);
      console.log(`  New dishes created:  ${result.newDishesCreated}`);

      for (const p of result.platforms) {
        console.log(`\n  ${p.platform.toUpperCase()}:`);
        console.log(`    Match: ${p.match ? `${p.match.platformName} (${(p.match.matchConfidence * 100).toFixed(0)}% confidence)` : "NO MATCH"}`);
        console.log(`    Items: ${p.items.length}`);
        console.log(`    Warnings: ${p.warnings.join("; ") || "none"}`);

        // Show first 5 items with ratings
        const withRatings = p.items.filter((i) => i.thumbsUpPct !== null || i.isMostLiked);
        if (withRatings.length > 0) {
          console.log(`    Items with ratings (${withRatings.length}):`);
          for (const item of withRatings.slice(0, 5)) {
            const badges = [];
            if (item.thumbsUpPct !== null) badges.push(`${item.thumbsUpPct}% 👍`);
            if (item.ratingCount !== null) badges.push(`(${item.ratingCount} ratings)`);
            if (item.isMostLiked) badges.push("⭐ Most Liked");
            console.log(`      "${item.name}" — ${badges.join(" ")}`);
          }
        } else {
          // Show first 3 items anyway
          for (const item of p.items.slice(0, 3)) {
            console.log(`      "${item.name}" $${item.price ?? "?"}`);
          }
        }
      }
    } catch (err) {
      console.error(`  ERROR: ${(err as Error).message}`);
    }
  }

  // Close browser pool
  const { closeBrowserPool } = await import("@/lib/agents/delivery-scraper/browser-pool");
  await closeBrowserPool();
  await prisma.$disconnect();

  console.log("\nDone.");
}

main().catch(console.error);
