/**
 * Test the new 5-step menu crawl pipeline on a single restaurant.
 * Usage: npx tsx scripts/test-crawl.ts <googlePlaceId>
 */
import "dotenv/config";

// Register tsconfig paths so @/ aliases work in scripts
import { resolve } from "path";
const tsconfigPaths = require("tsconfig-paths");
const tsconfig = require(resolve(__dirname, "../tsconfig.json"));
tsconfigPaths.register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions?.paths || {},
});

async function main() {
  const placeId = process.argv[2];
  if (!placeId) {
    console.error("Usage: npx tsx scripts/test-crawl.ts <googlePlaceId>");
    process.exit(1);
  }

  const { crawlRestaurant } = require("@/lib/agents/menu-crawler");
  const { prisma } = require("@/lib/db/client");

  console.log(`\nCrawling ${placeId}...\n`);
  const result = await crawlRestaurant(placeId);
  console.log("\n=== CRAWL RESULT ===");
  console.log(JSON.stringify(result, null, 2));

  // Show MenuItem breakdown (exclude backfill to see only fresh crawl)
  const menuItems = await prisma.menuItem.findMany({
    where: { restaurantId: result.restaurantId, source: { not: "backfill" } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  console.log(`\n=== MENUITEM BREAKDOWN (${menuItems.length} new items) ===`);
  const byType: Record<string, string[]> = {};
  for (const mi of menuItems) {
    const type = mi.menuItemType;
    if (!byType[type]) byType[type] = [];
    const tags = [
      mi.dishId ? "-> DISH" : "",
      mi.menuAllergens?.length ? `allergens: ${mi.menuAllergens.join(",")}` : "",
      mi.menuDietaryTags?.length ? `tags: ${mi.menuDietaryTags.join(",")}` : "",
    ].filter(Boolean).join(" | ");
    byType[type].push(`${mi.name} [${mi.category || "?"}] $${mi.price || "?"}${tags ? ` (${tags})` : ""}`);
  }
  for (const [type, items] of Object.entries(byType).sort()) {
    console.log(`\n[${type.toUpperCase()}] (${items.length}):`);
    items.forEach((i) => console.log(`  ${i}`));
  }

  // Summary
  const promoted = menuItems.filter((m: { dishId: string | null }) => m.dishId).length;
  const archived = await prisma.menuItem.count({
    where: { restaurantId: result.restaurantId, archivedAt: { not: null } },
  });
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total new MenuItems: ${menuItems.length}`);
  console.log(`Promoted to Dish: ${promoted}`);
  console.log(`Archived: ${archived}`);
  console.log(`Dishes analyzed: ${result.dishesAnalyzed}`);
  console.log(`Photos queued: ${result.photosQueued}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
