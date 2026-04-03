/**
 * Nightly Discovery Script
 *
 * Discovers NEW restaurants not yet in the database by scanning active
 * DiscoveryArea records via Google Places Nearby Search. New restaurants
 * are queued for the full crawl → vision → USDA pipeline via BullMQ.
 *
 * Usage: npx tsx scripts/nightly-discovery.ts [--dry-run] [--max-areas N] [--max-restaurants N]
 */
import "dotenv/config";

const MAX_AREAS_DEFAULT = 10;
const MAX_RESTAURANTS_DEFAULT = 50;

interface DiscoveryStats {
  areasScanned: number;
  totalPlacesFound: number;
  newRestaurants: number;
  jobsQueued: number;
  skippedExisting: number;
  errors: string[];
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const maxAreas = parseInt(args[args.indexOf("--max-areas") + 1]) || MAX_AREAS_DEFAULT;
  const maxRestaurants = parseInt(args[args.indexOf("--max-restaurants") + 1]) || MAX_RESTAURANTS_DEFAULT;

  console.log(`\n🦞 FoodClaw Nightly Discovery`);
  console.log(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`   Max areas: ${maxAreas}, Max new restaurants: ${maxRestaurants}`);
  console.log(`   Started: ${new Date().toISOString()}\n`);

  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    console.error("ERROR: GOOGLE_PLACES_API_KEY not configured. Exiting.");
    await prisma.$disconnect();
    process.exit(1);
  }

  const stats: DiscoveryStats = {
    areasScanned: 0,
    totalPlacesFound: 0,
    newRestaurants: 0,
    jobsQueued: 0,
    skippedExisting: 0,
    errors: [],
  };

  try {
    // Find areas due for discovery: active, past their interval or never scanned
    const areas = await prisma.discoveryArea.findMany({
      where: {
        isActive: true,
        OR: [
          { lastDiscoveredAt: null },
          {
            // lastDiscoveredAt < now - intervalDays
            // We can't use a computed column in Prisma, so we fetch all active
            // and filter in JS (area count is small, usually <100)
          },
        ],
      },
      orderBy: [
        { priority: "asc" },          // highest priority first
        { lastDiscoveredAt: "asc" },   // oldest scan first (nulls first in PG)
      ],
    });

    // Filter to areas actually due for re-scan
    const now = new Date();
    const dueAreas = areas.filter((area) => {
      if (!area.lastDiscoveredAt) return true;
      const daysSinceScan = (now.getTime() - area.lastDiscoveredAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceScan >= area.discoveryIntervalDays;
    }).slice(0, maxAreas);

    console.log(`Found ${areas.length} active areas, ${dueAreas.length} due for discovery\n`);

    if (dueAreas.length === 0) {
      console.log("No areas due for discovery. Exiting.");
      await prisma.$disconnect();
      process.exit(0);
    }

    const { searchNearby } = await import("../src/lib/google-places/client");
    const { flowProducer, menuCrawlQueue } = await import("../workers/queues");
    const { fetchWithRetry } = await import("../src/lib/utils/fetch-retry");

    const yelpKey = process.env.YELP_API_KEY;

    // Get all existing googlePlaceIds in one query for fast dedup
    const existingRestaurants = await prisma.restaurant.findMany({
      select: { googlePlaceId: true },
    });
    const existingPlaceIds = new Set(existingRestaurants.map((r) => r.googlePlaceId));
    console.log(`Existing restaurants in DB: ${existingPlaceIds.size}\n`);

    for (const area of dueAreas) {
      if (stats.newRestaurants >= maxRestaurants) {
        console.log(`\nReached max restaurant cap (${maxRestaurants}). Stopping.`);
        break;
      }

      console.log(`--- Scanning: ${area.name} (priority ${area.priority}) ---`);
      console.log(`    Center: ${area.latitude}, ${area.longitude}, radius: ${area.radiusMiles} mi`);

      try {
        const radiusMeters = Math.round(Number(area.radiusMiles) * 1609.34);
        const places = await searchNearby(
          Number(area.latitude),
          Number(area.longitude),
          radiusMeters,
          { type: "restaurant", maxResults: 20 }
        );

        stats.areasScanned++;
        stats.totalPlacesFound += places.length;
        console.log(`    Google Places returned: ${places.length} restaurants`);

        // Filter to genuinely new restaurants
        const newPlaces = places.filter((p) => !existingPlaceIds.has(p.id));
        const cappedNew = newPlaces.slice(0, maxRestaurants - stats.newRestaurants);

        console.log(`    New (not in DB): ${newPlaces.length}, queueing: ${cappedNew.length}`);
        stats.skippedExisting += places.length - newPlaces.length;

        if (cappedNew.length > 0 && !dryRun) {
          // Build FlowProducer children — same pattern as /api/crawl/area
          const children = [];
          for (const place of cappedNew) {
            let yelpBusinessId: string | null = null;

            // Yelp business match (best-effort)
            if (yelpKey && yelpKey !== "placeholder") {
              try {
                const yelpRes = await fetchWithRetry(
                  `https://api.yelp.com/v3/businesses/matches?name=${encodeURIComponent(place.displayName?.text || "")}&address1=${encodeURIComponent(place.formattedAddress || "")}&city=&state=&country=US&limit=1`,
                  { headers: { Authorization: `Bearer ${yelpKey}` } },
                  { maxRetries: 1 }
                );
                if (yelpRes.ok) {
                  const yelpData = await yelpRes.json();
                  yelpBusinessId = yelpData.businesses?.[0]?.id || null;
                }
              } catch {
                // Yelp lookup failed — continue without it
              }
            }

            children.push({
              name: "discovery-crawl",
              queueName: "menu-crawl",
              data: { googlePlaceId: place.id, yelpBusinessId },
              opts: {
                jobId: `crawl-${place.id}`,
                attempts: 3,
                backoff: { type: "exponential" as const, delay: 5000 },
                priority: 5, // nightly scheduled priority tier
              },
            });

            // Add to our in-memory set so we don't double-queue across areas
            existingPlaceIds.add(place.id);
          }

          // Atomic enqueue via FlowProducer
          await flowProducer.add({
            name: `discovery-${area.id}`,
            queueName: "menu-crawl",
            data: {
              areaId: area.id,
              areaName: area.name,
              restaurantCount: children.length,
            },
            children,
          });

          stats.newRestaurants += cappedNew.length;
          stats.jobsQueued += children.length;
        } else if (dryRun && cappedNew.length > 0) {
          console.log(`    [DRY RUN] Would queue ${cappedNew.length} restaurants:`);
          for (const p of cappedNew) {
            console.log(`      - ${p.displayName?.text} (${p.id})`);
          }
          stats.newRestaurants += cappedNew.length;
        }

        // Update area record
        if (!dryRun) {
          await prisma.discoveryArea.update({
            where: { id: area.id },
            data: {
              lastDiscoveredAt: now,
              restaurantsFoundLast: newPlaces.length,
              restaurantsFoundTotal: { increment: newPlaces.length },
            },
          });
        }

        console.log(`    Done.\n`);
      } catch (err) {
        const msg = `Error scanning ${area.name}: ${err instanceof Error ? err.message : String(err)}`;
        stats.errors.push(msg);
        console.error(`    ERROR: ${msg}\n`);
      }
    }
  } catch (err) {
    console.error("Fatal error:", err);
    stats.errors.push(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Print summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Discovery Summary`);
  console.log(`${"=".repeat(50)}`);
  console.log(`  Areas scanned:       ${stats.areasScanned}`);
  console.log(`  Places found:        ${stats.totalPlacesFound}`);
  console.log(`  Already in DB:       ${stats.skippedExisting}`);
  console.log(`  New restaurants:     ${stats.newRestaurants}`);
  console.log(`  Jobs queued:         ${stats.jobsQueued}`);
  if (stats.errors.length > 0) {
    console.log(`  Errors:              ${stats.errors.length}`);
    for (const e of stats.errors) console.log(`    - ${e}`);
  }
  console.log(`  Finished: ${new Date().toISOString()}\n`);

  try {
    const { menuCrawlQueue: q } = await import("../workers/queues");
    await q.close();
  } catch { /* queue may not have been imported */ }
  await prisma.$disconnect();
  process.exit(stats.errors.length > 0 ? 1 : 0);
}

main();
