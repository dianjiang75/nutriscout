/**
 * Seeds initial discovery areas for nightly clawing.
 * Manhattan only for now.
 *
 * Usage: npx tsx scripts/seed-discovery-areas.ts
 */
import "dotenv/config";

const AREAS = [
  // ── Manhattan ──────────────────────────────────────────────────────
  { name: "Midtown Manhattan", latitude: 40.7549, longitude: -73.9840, radiusMiles: 0.5, priority: 1 },
  { name: "Lower East Side", latitude: 40.7150, longitude: -73.9843, radiusMiles: 0.4, priority: 2 },
  { name: "East Village", latitude: 40.7265, longitude: -73.9815, radiusMiles: 0.3, priority: 2 },
  { name: "West Village / Greenwich", latitude: 40.7336, longitude: -74.0027, radiusMiles: 0.3, priority: 2 },
  { name: "Chelsea / Flatiron", latitude: 40.7432, longitude: -73.9960, radiusMiles: 0.4, priority: 2 },
  { name: "Upper West Side", latitude: 40.7870, longitude: -73.9754, radiusMiles: 0.5, priority: 3 },
  { name: "Upper East Side", latitude: 40.7736, longitude: -73.9566, radiusMiles: 0.5, priority: 3 },
  { name: "Harlem", latitude: 40.8116, longitude: -73.9465, radiusMiles: 0.5, priority: 3 },
  { name: "Chinatown / Little Italy", latitude: 40.7158, longitude: -73.9970, radiusMiles: 0.25, priority: 1 },
  { name: "SoHo / NoLita", latitude: 40.7233, longitude: -73.9985, radiusMiles: 0.3, priority: 2 },
  { name: "Financial District", latitude: 40.7075, longitude: -74.0089, radiusMiles: 0.4, priority: 3 },
  { name: "Hell's Kitchen", latitude: 40.7638, longitude: -73.9918, radiusMiles: 0.4, priority: 2 },
  { name: "Koreatown / Herald Square", latitude: 40.7481, longitude: -73.9872, radiusMiles: 0.25, priority: 1 },
  { name: "Washington Heights", latitude: 40.8417, longitude: -73.9393, radiusMiles: 0.5, priority: 3 },
  { name: "NoHo / Bowery", latitude: 40.7260, longitude: -73.9929, radiusMiles: 0.25, priority: 2 },

  // ── Brooklyn ───────────────────────────────────────────────────────
  { name: "Williamsburg", latitude: 40.7081, longitude: -73.9571, radiusMiles: 0.4, priority: 1 },
  { name: "Park Slope / Gowanus", latitude: 40.6710, longitude: -73.9814, radiusMiles: 0.4, priority: 2 },
  { name: "Bushwick", latitude: 40.6944, longitude: -73.9213, radiusMiles: 0.4, priority: 3 },
  { name: "Carroll Gardens / Cobble Hill", latitude: 40.6795, longitude: -73.9991, radiusMiles: 0.3, priority: 2 },
  { name: "DUMBO / Brooklyn Heights", latitude: 40.7033, longitude: -73.9903, radiusMiles: 0.3, priority: 2 },
  { name: "Fort Greene / Clinton Hill", latitude: 40.6882, longitude: -73.9718, radiusMiles: 0.35, priority: 3 },
  { name: "Prospect Heights / Crown Heights", latitude: 40.6775, longitude: -73.9619, radiusMiles: 0.4, priority: 3 },

  // ── Queens ─────────────────────────────────────────────────────────
  { name: "Flushing", latitude: 40.7580, longitude: -73.8306, radiusMiles: 0.4, priority: 1 },
  { name: "Astoria", latitude: 40.7724, longitude: -73.9301, radiusMiles: 0.4, priority: 2 },
  { name: "Jackson Heights", latitude: 40.7468, longitude: -73.8831, radiusMiles: 0.35, priority: 2 },
  { name: "Long Island City", latitude: 40.7425, longitude: -73.9566, radiusMiles: 0.35, priority: 3 },

  // ── Denver ─────────────────────────────────────────────────────────
  { name: "RiNo Denver", latitude: 39.7713, longitude: -104.9812, radiusMiles: 0.4, priority: 2 },
  { name: "LoHi Denver", latitude: 39.7585, longitude: -105.0072, radiusMiles: 0.35, priority: 2 },
  { name: "LoDo Denver", latitude: 39.7530, longitude: -104.9990, radiusMiles: 0.35, priority: 3 },
  { name: "Capitol Hill Denver", latitude: 39.7314, longitude: -104.9788, radiusMiles: 0.35, priority: 3 },
];

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  let created = 0;
  let skipped = 0;

  for (const area of AREAS) {
    // Check if already exists (by name)
    const existing = await prisma.discoveryArea.findFirst({
      where: { name: { equals: area.name, mode: "insensitive" } },
    });

    if (existing) {
      console.log(`  Skip (exists): ${area.name}`);
      skipped++;
      continue;
    }

    await prisma.discoveryArea.create({
      data: {
        name: area.name,
        latitude: area.latitude,
        longitude: area.longitude,
        radiusMiles: area.radiusMiles,
        priority: area.priority,
        discoveryIntervalDays: 7,
      },
    });
    console.log(`  Created: ${area.name} (priority ${area.priority})`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`);
  await prisma.$disconnect();
}

main();
