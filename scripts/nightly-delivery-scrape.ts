/**
 * Nightly Delivery Platform Scrape
 *
 * Finds restaurants due for delivery scraping (lastDeliveryScrape > 7 days or null)
 * and queues them on the delivery-scrape BullMQ queue.
 *
 * Uses FlowProducer to chain: delivery-scrape → review-aggregation per restaurant,
 * so review summaries are regenerated with delivery data included.
 *
 * Usage: npx tsx scripts/nightly-delivery-scrape.ts [--dry-run] [--max N]
 */
import "dotenv/config";

const MAX_RESTAURANTS_DEFAULT = 50;
const STALE_DAYS = 7;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const maxRestaurants =
    parseInt(args[args.indexOf("--max") + 1]) || MAX_RESTAURANTS_DEFAULT;

  console.log(`\n🦞 FoodClaw Nightly Delivery Scrape`);
  console.log(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`   Max restaurants: ${maxRestaurants}`);
  console.log(`   Stale threshold: ${STALE_DAYS} days`);
  console.log(`   Started: ${new Date().toISOString()}\n`);

  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

    // Find restaurants that need delivery scraping
    const restaurants = await prisma.restaurant.findMany({
      where: {
        isActive: true,
        OR: [
          { lastDeliveryScrape: null },
          { lastDeliveryScrape: { lt: cutoff } },
        ],
      },
      select: {
        id: true,
        name: true,
        googlePlaceId: true,
        yelpBusinessId: true,
        lastDeliveryScrape: true,
        _count: { select: { dishes: true } },
      },
      orderBy: [
        { lastDeliveryScrape: { sort: "asc", nulls: "first" } },
      ],
      take: maxRestaurants,
    });

    // Filter to restaurants with dishes
    const eligible = restaurants.filter((r) => r._count.dishes > 0);

    console.log(
      `Found ${eligible.length} restaurants due for delivery scraping ` +
      `(${restaurants.length - eligible.length} skipped — no dishes)\n`
    );

    if (dryRun) {
      for (const r of eligible) {
        const lastScrape = r.lastDeliveryScrape
          ? `last: ${r.lastDeliveryScrape.toISOString().split("T")[0]}`
          : "never scraped";
        console.log(
          `  [DRY] ${r.name} (${r._count.dishes} dishes, ${lastScrape})`
        );
      }
      console.log(`\n(Dry run — no jobs queued)`);
      return;
    }

    // Queue jobs using FlowProducer: delivery → review aggregation
    const { flowProducer } = await import("../workers/queues");
    let queued = 0;

    for (const r of eligible) {
      try {
        await flowProducer.add({
          name: `review-after-delivery-${r.id}`,
          queueName: "review-aggregation",
          data: {
            restaurantId: r.id,
            googlePlaceId: r.googlePlaceId,
            yelpBusinessId: r.yelpBusinessId,
          },
          opts: { priority: 10 }, // review aggregation tier
          children: [
            {
              name: `delivery-scrape-${r.id}`,
              queueName: "delivery-scrape",
              data: {
                restaurantId: r.id,
                skipFreshPlatforms: true,
              },
              opts: {
                jobId: `delivery-${r.id}`,
                priority: 5, // nightly scheduled tier
                attempts: 2,
                backoff: { type: "exponential", delay: 30000 },
              },
            },
          ],
        });
        queued++;
        console.log(
          `  [${queued}/${eligible.length}] Queued: ${r.name} (${r._count.dishes} dishes)`
        );
      } catch (err) {
        console.error(
          `  ERROR queuing ${r.name}: ${(err as Error).message}`
        );
      }
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`  Done: ${queued} restaurants queued for delivery scraping`);
    console.log(`  At 2/min rate limit, estimated time: ~${Math.ceil(queued / 2)} minutes`);
    console.log(`${"=".repeat(50)}\n`);
  } catch (err) {
    console.error("Fatal:", (err as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
