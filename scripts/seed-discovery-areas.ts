/**
 * Seeds initial discovery areas for nightly clawing.
 * Covers key NYC neighborhoods + Denver (test market).
 *
 * Usage: npx tsx scripts/seed-discovery-areas.ts
 */
import "dotenv/config";

const AREAS = [
  // NYC — Manhattan
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

  // NYC — Brooklyn
  { name: "Williamsburg", latitude: 40.7081, longitude: -73.9571, radiusMiles: 0.5, priority: 2 },
  { name: "Park Slope", latitude: 40.6710, longitude: -73.9799, radiusMiles: 0.4, priority: 3 },
  { name: "DUMBO / Brooklyn Heights", latitude: 40.7033, longitude: -73.9903, radiusMiles: 0.3, priority: 3 },
  { name: "Bushwick", latitude: 40.6944, longitude: -73.9213, radiusMiles: 0.4, priority: 4 },

  // NYC — Queens
  { name: "Astoria", latitude: 40.7720, longitude: -73.9301, radiusMiles: 0.4, priority: 2 },
  { name: "Flushing", latitude: 40.7614, longitude: -73.8301, radiusMiles: 0.5, priority: 1 },
  { name: "Jackson Heights", latitude: 40.7476, longitude: -73.8831, radiusMiles: 0.4, priority: 2 },

  // Denver (test market)
  { name: "Downtown Denver", latitude: 39.7392, longitude: -104.9903, radiusMiles: 0.5, priority: 3 },
  { name: "RiNo / Five Points", latitude: 39.7625, longitude: -104.9811, radiusMiles: 0.4, priority: 4 },
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
