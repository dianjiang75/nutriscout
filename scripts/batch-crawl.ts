/**
 * Batch crawl uncrawled restaurants using the new agent pipeline.
 *
 * Runs: Menu Scraper → Menu Classifier → Stale Archiver sequentially per restaurant.
 * No BullMQ/Redis required — calls agents directly.
 *
 * Usage:
 *   npx tsx scripts/batch-crawl.ts [--max N] [--dry-run] [--skip-classify]
 *
 * Options:
 *   --max N          Crawl at most N restaurants (default: all)
 *   --dry-run        List restaurants without crawling
 *   --skip-classify  Scrape only, skip classification (faster, no LLM cost)
 *   --recrawl        Include already-crawled restaurants
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5 });
const prisma = new PrismaClient({ adapter });

// Register tsconfig paths
import { resolve } from "path";
const tsconfigPaths = require("tsconfig-paths");
const tsconfig = require(resolve(__dirname, "../tsconfig.json"));
tsconfigPaths.register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions?.paths || {},
});

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipClassify = args.includes("--skip-classify");
  const recrawl = args.includes("--recrawl");
  const maxIdx = args.indexOf("--max");
  const maxRestaurants = maxIdx >= 0 ? parseInt(args[maxIdx + 1]) : Infinity;

  // Find restaurants to crawl
  const where: Record<string, unknown> = {
    isActive: true,
    websiteUrl: { not: null },
  };
  if (!recrawl) {
    where.lastMenuCrawl = null;
  }

  const restaurants = await prisma.restaurant.findMany({
    where: where as any,
    select: { googlePlaceId: true, name: true, websiteUrl: true },
    orderBy: { name: "asc" },
    take: maxRestaurants === Infinity ? undefined : maxRestaurants,
  });

  console.log(`\n[batch-crawl] Found ${restaurants.length} restaurants to crawl`);
  if (dryRun) {
    restaurants.forEach((r, i) => console.log(`  ${i + 1}. ${r.name} (${r.googlePlaceId})`));
    console.log(`\n[batch-crawl] DRY RUN — no crawling performed`);
    return;
  }

  const { scrapeRestaurantMenu } = require("@/lib/agents/menu-scraper");
  const { classifyAndPromote } = require("@/lib/agents/menu-classifier");
  const { archiveStaleItems } = require("@/lib/agents/stale-archiver");

  let scraped = 0;
  let classified = 0;
  let failed = 0;
  let totalItems = 0;
  let totalPromoted = 0;

  const startTime = Date.now();

  for (let i = 0; i < restaurants.length; i++) {
    const r = restaurants[i];
    const progress = `[${i + 1}/${restaurants.length}]`;

    try {
      // Step 1: Scrape
      const scrapeResult = await scrapeRestaurantMenu(r.googlePlaceId);
      totalItems += scrapeResult.itemsStored;
      scraped++;

      if (scrapeResult.itemsStored === 0) {
        console.log(`${progress} ${r.name}: no menu found (source: ${scrapeResult.menuSource})`);
        continue;
      }

      console.log(
        `${progress} ${r.name}: ${scrapeResult.itemsStored} items scraped (${scrapeResult.menuSource})`
      );

      // Step 2: Classify + Promote (unless skipped)
      if (!skipClassify) {
        try {
          const classifyResult = await classifyAndPromote(scrapeResult.restaurantId);
          totalPromoted += classifyResult.itemsPromoted;
          classified++;
          console.log(
            `  → ${classifyResult.itemsClassified} classified, ${classifyResult.itemsPromoted} promoted, ${classifyResult.dishesAnalyzed} analyzed`
          );
        } catch (classErr) {
          console.warn(`  → classify failed: ${(classErr as Error).message?.substring(0, 80)}`);
        }
      }

      // Step 3: Archive stale
      try {
        const archiveResult = await archiveStaleItems(
          scrapeResult.restaurantId,
          scrapeResult.crawlTimestamp,
          scrapeResult.menuSource
        );
        if (archiveResult.itemsArchived > 0) {
          console.log(`  → ${archiveResult.itemsArchived} stale items archived`);
        }
        if (archiveResult.circuitBreakerTripped) {
          console.warn(`  → CIRCUIT BREAKER tripped — skipped stale archival`);
        }
      } catch {
        // Archive failure is non-critical
      }
    } catch (err) {
      failed++;
      console.error(`${progress} ${r.name}: FAILED — ${(err as Error).message?.substring(0, 100)}`);
    }

    // Rate limit: 1 second between restaurants to be polite to APIs
    if (i < restaurants.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n[batch-crawl] DONE in ${elapsed}s`);
  console.log(`  Scraped: ${scraped}/${restaurants.length}`);
  console.log(`  Classified: ${classified}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total items: ${totalItems}`);
  console.log(`  Total promoted: ${totalPromoted}`);
}

main()
  .catch((err) => {
    console.error("[batch-crawl] Fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
