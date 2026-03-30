/**
 * CLI script to crawl a single restaurant.
 * Usage: npx tsx -r tsconfig-paths/register scripts/crawl-restaurant.ts <google_place_id>
 */
import "dotenv/config";

async function main() {
  const placeId = process.argv[2];

  if (!placeId) {
    console.error(
      "Usage: npx tsx -r tsconfig-paths/register scripts/crawl-restaurant.ts <google_place_id>"
    );
    process.exit(1);
  }

  const { crawlRestaurant } = await import(
    "../src/lib/agents/menu-crawler"
  );

  console.log(`\nCrawling restaurant: ${placeId}\n`);

  try {
    const result = await crawlRestaurant(placeId);

    console.log(`Restaurant: ${result.restaurantName}`);
    console.log(`ID:         ${result.restaurantId}`);
    console.log(`Source:     ${result.menuSource}`);
    console.log(`Dishes:     ${result.dishesFound} found, ${result.dishesAnalyzed} analyzed`);
    console.log(`Photos:     ${result.photosQueued} queued for vision analysis`);
  } catch (err) {
    console.error("Error:", (err as Error).message);
    process.exit(1);
  }

  process.exit(0);
}

main();
