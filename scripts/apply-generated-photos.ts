/**
 * Push AI-generated photos to the database.
 *
 * Usage: npx tsx scripts/apply-generated-photos.ts
 *
 * Reads generated-photos.json, updates DishPhoto records with local paths,
 * and flushes Redis cache so the app shows the new images.
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import IORedis from "ioredis";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const GENERATED_FILE = path.join(__dirname, "generated-photos.json");

async function main() {
  if (!fs.existsSync(GENERATED_FILE)) {
    console.error("No generated-photos.json found. Run generate-dish-images.ts first.");
    process.exit(1);
  }

  const generated: Record<string, string> = JSON.parse(fs.readFileSync(GENERATED_FILE, "utf8"));
  console.log(`Applying ${Object.keys(generated).length} generated photos to DB...\n`);

  let updated = 0;
  let notFound = 0;

  for (const [dishName, localPath] of Object.entries(generated)) {
    // Find the dish by name
    const dishes = await prisma.dish.findMany({
      where: { name: dishName },
      select: { id: true, name: true },
    });

    if (dishes.length === 0) {
      console.log(`  SKIP: ${dishName} — not found in DB`);
      notFound++;
      continue;
    }

    for (const dish of dishes) {
      // Update the first photo's sourceUrl to the generated image path
      const photos = await prisma.dishPhoto.findMany({
        where: { dishId: dish.id },
        take: 1,
        orderBy: { createdAt: "desc" },
      });

      if (photos.length > 0) {
        await prisma.dishPhoto.update({
          where: { id: photos[0].id },
          data: {
            sourceUrl: localPath,
            sourcePlatform: "user_submitted", // AI-generated, owned by us
          },
        });
      } else {
        // No existing photo — create one
        await prisma.dishPhoto.create({
          data: {
            dishId: dish.id,
            sourceUrl: localPath,
            sourcePlatform: "user_submitted",
          },
        });
      }
      updated++;
    }

    console.log(`  ${dishName} → ${localPath}`);
  }

  // Flush Redis cache so app shows new images
  try {
    const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
    await redis.flushall();
    await redis.quit();
    console.log("\nRedis cache flushed.");
  } catch {
    console.log("\nWarning: Could not flush Redis cache.");
  }

  console.log(`\nDone! ${updated} photos updated, ${notFound} dishes not found in DB.`);

  await prisma.$disconnect();
}

main().catch(console.error);
