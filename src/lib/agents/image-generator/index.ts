/**
 * AI Image Generator Agent — generates copyright-free dish photos.
 *
 * Uses NanoBanana 2 (Gemini 3.1 Flash Image) to create original food photos
 * from reference images. The generated images are visually faithful to the
 * reference but legally distinct (AI-generated, not copied).
 *
 * Pipeline:
 * 1. Download reference photo (from user-approved Google Images search)
 * 2. Send to NanoBanana 2 with dish-specific prompt
 * 3. Save generated image locally to public/dishes/
 * 4. Return local path for DB storage
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

const DISHES_DIR = path.join(process.cwd(), "public/dishes");

// Ensure output directory exists
if (!fs.existsSync(DISHES_DIR)) {
  fs.mkdirSync(DISHES_DIR, { recursive: true });
}

function getGeminiClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY required for image generation");
  return new GoogleGenerativeAI(key);
}

/**
 * Build the generation prompt. This is critical for preventing hallucination.
 *
 * Key principles:
 * - Reference the input image explicitly
 * - Constrain composition: same ingredients, same plating
 * - Forbid changes: don't add/remove ingredients
 * - Set aesthetic context: professional food photography
 * - Include dish name + cuisine for grounding
 */
function buildPrompt(dishName: string, cuisine: string, description?: string): string {
  const descPart = description ? ` The dish contains: ${description.split(",").slice(0, 3).join(",")}.` : "";

  return [
    `Generate a professional food photograph of "${dishName}" (${cuisine} cuisine).`,
    `Use the reference image as your guide — recreate this EXACT dish faithfully.`,
    `Keep the same ingredients, same plating style, same color palette.`,
    `Do NOT add or remove any ingredients. Do NOT change the dish composition.`,
    descPart,
    ``,
    `Photography style: overhead angle, warm natural studio lighting,`,
    `clean background, shallow depth of field, appetizing presentation.`,
    `The image should look like it belongs in a premium food delivery app.`,
    `High resolution, sharp focus on the food, editorial quality.`,
  ].join("\n");
}

/**
 * Download a reference image and convert to base64 for the API.
 */
async function downloadReference(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "FoodClaw/1.0" },
  });

  if (!res.ok) throw new Error(`Failed to download reference: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());

  // Resize to max 1024px and convert to JPEG for consistent input
  const processed = await sharp(buffer)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();

  return {
    base64: processed.toString("base64"),
    mimeType: "image/jpeg",
  };
}

/**
 * Generate an AI image from a reference photo using NanoBanana 2.
 *
 * @param referenceUrl - URL of the approved reference photo
 * @param dishName - Name of the dish
 * @param cuisine - Cuisine type (Thai, Italian, etc.)
 * @param description - Dish description for grounding
 * @param dishId - Unique ID for the output filename
 * @returns Local path to the generated image (e.g., /dishes/abc123.jpg)
 */
export async function generateDishImage(
  referenceUrl: string,
  dishName: string,
  cuisine: string,
  description?: string,
  dishId?: string,
): Promise<{ localPath: string; absolutePath: string }> {
  const gemini = getGeminiClient();

  // Use the image generation model (NanoBanana 2 = Gemini Flash Image)
  // NanoBanana 2 (Gemini Flash Image) with image output enabled
  const model = gemini.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] } as Record<string, unknown>,
  } as Parameters<GoogleGenerativeAI["getGenerativeModel"]>[0]);

  // Download and prepare the reference image
  const ref = await downloadReference(referenceUrl);

  // Build the prompt
  const prompt = buildPrompt(dishName, cuisine, description);

  // Generate using the reference image + prompt
  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        data: ref.base64,
        mimeType: ref.mimeType,
      },
    },
  ]);

  const response = result.response;

  // Extract the generated image from the response
  let imageData: Buffer | null = null;

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData?.data) {
      imageData = Buffer.from(part.inlineData.data, "base64");
      break;
    }
  }

  if (!imageData) {
    throw new Error(`No image generated for ${dishName}. Response: ${response.text()}`);
  }

  // Process the generated image: resize for consistency, optimize
  const optimized = await sharp(imageData)
    .resize(800, 600, { fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Save to public/dishes/
  const filename = `${dishId || dishName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.jpg`;
  const absolutePath = path.join(DISHES_DIR, filename);
  fs.writeFileSync(absolutePath, optimized);

  const localPath = `/dishes/${filename}`;

  return { localPath, absolutePath };
}

/**
 * Generate images for multiple dishes in batch.
 * Processes sequentially with delay to respect API rate limits.
 */
export async function batchGenerateImages(
  dishes: Array<{
    id: string;
    name: string;
    cuisine: string;
    description?: string;
    referenceUrl: string;
  }>,
  onProgress?: (completed: number, total: number, dishName: string) => void,
): Promise<Map<string, string>> {
  const results = new Map<string, string>(); // dish name → local path

  for (let i = 0; i < dishes.length; i++) {
    const dish = dishes[i];
    onProgress?.(i + 1, dishes.length, dish.name);

    try {
      const { localPath } = await generateDishImage(
        dish.referenceUrl,
        dish.name,
        dish.cuisine,
        dish.description,
        dish.id,
      );
      results.set(dish.name, localPath);
    } catch (err) {
      console.error(`Failed to generate image for ${dish.name}:`, (err as Error).message);
    }

    // Rate limit: wait between requests
    if (i < dishes.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return results;
}
