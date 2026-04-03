/**
 * Batch generate AI dish images from approved reference photos.
 *
 * Usage: npx tsx scripts/generate-dish-images.ts
 *
 * Reads approved-photos.json (reference URLs from Google Images),
 * generates original AI images via NanoBanana 2 (Gemini Flash Image),
 * and saves them to public/dishes/ + generated-photos.json.
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { generateDishImage } from "../src/lib/agents/image-generator";

const APPROVED_FILE = path.join(__dirname, "approved-photos.json");
const GENERATED_FILE = path.join(__dirname, "generated-photos.json");
const DISHES_FILE = "/tmp/dishes-final.json";

interface Dish {
  name: string;
  description: string;
  restaurant: string;
  cuisine: string;
}

async function main() {
  // Load approved reference photos
  if (!fs.existsSync(APPROVED_FILE)) {
    console.error("No approved-photos.json found. Run the approval tool first.");
    process.exit(1);
  }

  const approved: Record<string, string> = JSON.parse(fs.readFileSync(APPROVED_FILE, "utf8"));
  console.log(`Loaded ${Object.keys(approved).length} approved reference photos`);

  // Load dish metadata for cuisine/description
  let dishMeta: Record<string, Dish> = {};
  if (fs.existsSync(DISHES_FILE)) {
    const dishes: Dish[] = JSON.parse(fs.readFileSync(DISHES_FILE, "utf8"));
    for (const d of dishes) {
      dishMeta[d.name] = d;
    }
  }

  // Load existing generated photos (to skip already-done ones)
  let generated: Record<string, string> = {};
  if (fs.existsSync(GENERATED_FILE)) {
    generated = JSON.parse(fs.readFileSync(GENERATED_FILE, "utf8"));
  }

  // Find dishes that need generation (approved but not yet generated)
  const pending = Object.entries(approved).filter(([name]) => !generated[name]);
  console.log(`${pending.length} dishes need image generation (${Object.keys(generated).length} already done)\n`);

  if (pending.length === 0) {
    console.log("All dishes already have generated images!");
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const [name, refUrl] = pending[i];
    const meta = dishMeta[name];
    const cuisine = meta?.cuisine || "International";
    const description = meta?.description;
    const dishId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");

    process.stdout.write(`[${i + 1}/${pending.length}] ${name} → `);

    try {
      const { localPath } = await generateDishImage(refUrl, name, cuisine, description, dishId);
      generated[name] = localPath;
      success++;
      console.log(`${localPath}`);

      // Save progress after each image
      fs.writeFileSync(GENERATED_FILE, JSON.stringify(generated, null, 2));
    } catch (err) {
      failed++;
      console.log(`FAILED: ${(err as Error).message}`);
    }

    // Rate limit
    if (i < pending.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\nDone! ${success} generated, ${failed} failed.`);
  console.log(`Generated photos saved to ${GENERATED_FILE}`);
  console.log(`\nNext: run 'npx tsx scripts/apply-generated-photos.ts' to push to DB`);
}

main().catch(console.error);
