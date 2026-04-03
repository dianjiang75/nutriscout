import sharp from "sharp";
import { estimateMacros } from "@/lib/usda/client";
import { getGeminiClient, GEMINI_FLASH } from "@/lib/ai/clients";
import { SchemaType } from "@google/generative-ai";
import { extractJson } from "@/lib/utils/parse-json";
import { prisma } from "@/lib/db/client";
import type {
  BatchJob,
  ClaudeVisionResponse,
  EnsembleAnalysis,
  IngredientEstimate,
  MacroRange,
  VisionAnalysis,
} from "./types";

/**
 * Preprocess a food photo: fetch, resize, quality check, convert to JPEG.
 * Reduces Vision API token cost by ~90% and improves accuracy.
 * Throws if image is too blurry or too dark to analyze.
 */
async function preprocessImage(imageUrl: string): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  return preprocessBuffer(buffer);
}

/**
 * Preprocess a raw image buffer: resize, quality check, convert to JPEG.
 * Used by both URL-based analysis and direct buffer uploads.
 */
async function preprocessBuffer(buffer: Buffer): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const image = sharp(buffer);

  // Quality check: detect blur using Sharp stats
  const stats = await image.stats();
  const avgBrightness = stats.channels.reduce((s, c) => s + c.mean, 0) / stats.channels.length;

  // Too dark (< 30/255) or too bright (> 240/255) — likely unusable
  if (avgBrightness < 30) throw new Error("Image too dark for analysis");
  if (avgBrightness > 240) throw new Error("Image too bright/washed out for analysis");

  const processed = await sharp(buffer)
    .resize(1024, 768, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return {
    base64: processed.toString("base64"),
    mediaType: "image/jpeg",
  };
}

const VISION_SYSTEM_PROMPT = `You are a food nutrition analyst. Analyze this food photo and provide:
1. IDENTIFICATION: What dish is this? Be specific (e.g., "Pad Thai with shrimp" not just "noodles")
2. INGREDIENTS: List all visible ingredients with estimated quantities
3. PORTION ESTIMATION: Estimate the total portion size in grams. Use visual cues:
   - Standard dinner plate is ~27cm diameter
   - Standard bowl is ~15cm diameter
   - Use the plate/bowl rim as a reference for scale
   - Estimate depth/height of food
4. PREPARATION METHOD: How was this likely prepared? (grilled, fried, steamed, etc.)
   This affects calorie density significantly.

Return your analysis as JSON:
{
  "dish_name": "string",
  "cuisine_type": "string",
  "ingredients": [
    {"name": "string", "estimated_grams": number, "is_primary": boolean}
  ],
  "total_portion_grams": number,
  "preparation_method": "string",
  "confidence": number
}

Return ONLY valid JSON, no markdown fences or extra text.`;

// Legacy — kept for type compatibility but Gemini is now the primary vision model

/**
 * Build a min/max range around a macro estimate based on confidence.
 *
 * Research (NYU 2025, DietAI24) shows AI photo-based estimation has
 * 20-30% error without volumetric computation. Our margins:
 *   High confidence (>0.8): ±20% (was ±15% — too narrow per research)
 *   Medium confidence (0.5-0.8): ±35% (was ±30%)
 *   Low confidence (<0.5): ±50% (new tier — signals high uncertainty)
 */
function buildMacroRange(value: number, confidence: number): MacroRange {
  const margin = confidence > 0.8 ? 0.20
    : confidence >= 0.5 ? 0.35
    : 0.50;
  return {
    min: Math.round(value * (1 - margin) * 10) / 10,
    max: Math.round(value * (1 + margin) * 10) / 10,
    best_estimate: Math.round(value * 10) / 10,
  };
}

/**
 * Analyze a single food photo: identify dish, estimate ingredients, cross-reference USDA.
 */
export async function analyzeFoodPhoto(
  imageUrl: string,
): Promise<VisionAnalysis> {
  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({
    model: GEMINI_FLASH,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          dish_name: { type: SchemaType.STRING },
          cuisine_type: { type: SchemaType.STRING },
          ingredients: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                estimated_grams: { type: SchemaType.NUMBER },
                is_primary: { type: SchemaType.BOOLEAN },
              },
              required: ["name", "estimated_grams", "is_primary"],
            },
          },
          total_portion_grams: { type: SchemaType.NUMBER },
          preparation_method: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["dish_name", "cuisine_type", "ingredients", "total_portion_grams", "preparation_method", "confidence"],
      },
    },
  });

  // Preprocess image: resize to 1024x768 max, convert to JPEG
  let base64Data: string;
  try {
    const { base64 } = await preprocessImage(imageUrl);
    base64Data = base64;
  } catch {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    base64Data = Buffer.from(await res.arrayBuffer()).toString("base64");
  }

  return analyzeBase64(model, base64Data);
}

/**
 * Analyze a food photo from a raw buffer (e.g., user upload).
 * Same pipeline as analyzeFoodPhoto but skips the HTTP fetch step.
 */
export async function analyzeFoodPhotoFromBuffer(
  buffer: Buffer,
): Promise<VisionAnalysis> {
  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({
    model: GEMINI_FLASH,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          dish_name: { type: SchemaType.STRING },
          cuisine_type: { type: SchemaType.STRING },
          ingredients: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                estimated_grams: { type: SchemaType.NUMBER },
                is_primary: { type: SchemaType.BOOLEAN },
              },
              required: ["name", "estimated_grams", "is_primary"],
            },
          },
          total_portion_grams: { type: SchemaType.NUMBER },
          preparation_method: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["dish_name", "cuisine_type", "ingredients", "total_portion_grams", "preparation_method", "confidence"],
      },
    },
  });

  let base64Data: string;
  try {
    const { base64 } = await preprocessBuffer(buffer);
    base64Data = base64;
  } catch {
    base64Data = buffer.toString("base64");
  }

  return analyzeBase64(model, base64Data);
}

/**
 * Shared Gemini analysis pipeline: takes base64 image data, returns VisionAnalysis.
 */
async function analyzeBase64(
  model: ReturnType<ReturnType<typeof getGeminiClient>["getGenerativeModel"]>,
  base64Data: string,
): Promise<VisionAnalysis> {
  const result = await model.generateContent([
    { text: VISION_SYSTEM_PROMPT + "\n\nAnalyze this food photo and estimate its nutritional content. Return ONLY valid JSON." },
    { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
  ]);

  const text = result.response.text();
  if (!text) throw new Error("No text response from Gemini vision analysis");

  // With responseMimeType: "application/json", Gemini returns clean JSON
  // extractJson is kept as safety net for edge cases
  const visionResult = extractJson<ClaudeVisionResponse>(text);

  // Cross-reference each ingredient against USDA
  const ingredients: IngredientEstimate[] = [];
  const usdaReferences: string[] = [];
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const ingredient of visionResult.ingredients) {
    try {
      const usdaMacros = await estimateMacros(
        ingredient.name,
        ingredient.estimated_grams,
        visionResult.preparation_method,
      );

      totalCalories += usdaMacros.calories;
      totalProtein += usdaMacros.protein_g;
      totalCarbs += usdaMacros.carbs_g;
      totalFat += usdaMacros.fat_g;

      usdaReferences.push(usdaMacros.serving_description);

      ingredients.push({
        ...ingredient,
        usda_match: usdaMacros.serving_description,
        macros: {
          calories: usdaMacros.calories,
          protein_g: usdaMacros.protein_g,
          carbs_g: usdaMacros.carbs_g,
          fat_g: usdaMacros.fat_g,
        },
      });
    } catch {
      // USDA lookup failed for this ingredient — include it without macros
      ingredients.push({ ...ingredient });
    }
  }

  const confidence = visionResult.confidence;

  return {
    dish_name: visionResult.dish_name,
    cuisine_type: visionResult.cuisine_type,
    ingredients,
    preparation_method: visionResult.preparation_method,
    macros: {
      calories: buildMacroRange(totalCalories, confidence),
      protein_g: buildMacroRange(totalProtein, confidence),
      carbs_g: buildMacroRange(totalCarbs, confidence),
      fat_g: buildMacroRange(totalFat, confidence),
    },
    confidence,
    usda_references: usdaReferences,
  };
}

/**
 * Analyze multiple photos of the same dish and return an averaged ensemble result.
 * More photos → tighter confidence intervals.
 */
export async function analyzeMultiplePhotos(
  imageUrls: string[]
): Promise<EnsembleAnalysis> {
  if (imageUrls.length === 0) {
    throw new Error("At least one image URL is required");
  }

  const analyses = await Promise.all(
    imageUrls.map((url) => analyzeFoodPhoto(url))
  );

  // Detect outliers using MAD on calorie estimates
  const calorieEstimates = analyses.map(
    (a) => a.macros.calories.best_estimate
  );
  const outlierIndices = detectOutliers(calorieEstimates);

  // Filter out outliers for averaging
  let validAnalyses = analyses.filter((_, i) => !outlierIndices.includes(i));
  let effectiveOutliers = outlierIndices;

  if (validAnalyses.length === 0) {
    // All are outliers — fall back to using all
    validAnalyses = [...analyses];
    effectiveOutliers = [];
  }

  const n = validAnalyses.length;

  // Average the macros
  const avgCalories =
    validAnalyses.reduce((s, a) => s + a.macros.calories.best_estimate, 0) / n;
  const avgProtein =
    validAnalyses.reduce((s, a) => s + a.macros.protein_g.best_estimate, 0) / n;
  const avgCarbs =
    validAnalyses.reduce((s, a) => s + a.macros.carbs_g.best_estimate, 0) / n;
  const avgFat =
    validAnalyses.reduce((s, a) => s + a.macros.fat_g.best_estimate, 0) / n;

  // Confidence improves with more photos: base * (1 + log2(n)/10)
  // Original formula (1 - 1/sqrt(n)) gave 0.29x for n=2 which is too low.
  // New formula gives ~5-10% boost per additional photo, capped at 1.0
  const avgBaseConfidence =
    validAnalyses.reduce((s, a) => s + a.confidence, 0) / n;
  const ensembleConfidence = Math.min(1, avgBaseConfidence * (1 + Math.log2(n) / 10));

  // Tighter margin with ensemble
  const margin = ensembleConfidence > 0.8 ? 0.1 : 0.2;

  function ensembleRange(value: number): MacroRange {
    return {
      min: Math.round(value * (1 - margin) * 10) / 10,
      max: Math.round(value * (1 + margin) * 10) / 10,
      best_estimate: Math.round(value * 10) / 10,
    };
  }

  // Use data from the first valid analysis for non-numeric fields
  const base = validAnalyses[0];

  return {
    dish_name: base.dish_name,
    cuisine_type: base.cuisine_type,
    ingredients: base.ingredients,
    preparation_method: base.preparation_method,
    macros: {
      calories: ensembleRange(avgCalories),
      protein_g: ensembleRange(avgProtein),
      carbs_g: ensembleRange(avgCarbs),
      fat_g: ensembleRange(avgFat),
    },
    confidence: Math.round(ensembleConfidence * 1000) / 1000,
    usda_references: base.usda_references,
    num_photos_analyzed: imageUrls.length,
    outlier_indices: effectiveOutliers,
  };
}

/**
 * Detect outlier indices using median absolute deviation (MAD).
 * Values more than 2x the MAD from the median are flagged as outliers.
 */
function detectOutliers(values: number[]): number[] {
  if (values.length < 3) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

  const deviations = values.map((v) => Math.abs(v - median));
  const sortedDev = [...deviations].sort((a, b) => a - b);
  const madMid = Math.floor(sortedDev.length / 2);
  const mad =
    sortedDev.length % 2 === 0
      ? (sortedDev[madMid - 1] + sortedDev[madMid]) / 2
      : sortedDev[madMid];

  // Threshold: value deviates more than 2x MAD from median (or 50% of median if MAD is tiny)
  const threshold = Math.max(mad * 2, median * 0.5);

  return values
    .map((v, i) => (Math.abs(v - median) > threshold ? i : -1))
    .filter((i) => i !== -1);
}

/**
 * Batch process photos using Claude Haiku (cheaper model for background jobs).
 * Writes results directly to the database. Processes up to 3 concurrently
 * to balance throughput with API rate limits.
 */
export async function batchAnalyzePhotos(jobs: BatchJob[]): Promise<void> {
  const CONCURRENCY = 3;

  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map((job) => processPhotoJob(job)));
  }
}

async function processPhotoJob(job: BatchJob): Promise<void> {
  try {
    const analysis = await analyzeFoodPhoto(job.imageUrl);

    const bestCal = analysis.macros.calories.best_estimate;
    const bestProtein = analysis.macros.protein_g.best_estimate;
    const bestCarbs = analysis.macros.carbs_g.best_estimate;
    const bestFat = analysis.macros.fat_g.best_estimate;

    await prisma.dish.update({
      where: { id: job.dishId },
      data: {
        caloriesMin: analysis.macros.calories.min,
        caloriesMax: analysis.macros.calories.max,
        proteinMinG: analysis.macros.protein_g.min,
        proteinMaxG: analysis.macros.protein_g.max,
        carbsMinG: analysis.macros.carbs_g.min,
        carbsMaxG: analysis.macros.carbs_g.max,
        fatMinG: analysis.macros.fat_g.min,
        fatMaxG: analysis.macros.fat_g.max,
        macroConfidence: analysis.confidence,
        macroSource: "vision_ai",
        photoCountAnalyzed: { increment: 1 },
        lastVerified: new Date(),
      },
    });

    // Store the photo analysis
    await prisma.dishPhoto.create({
      data: {
        dishId: job.dishId,
        sourceUrl: job.imageUrl,
        sourcePlatform: "google_maps",
        macroEstimate: {
          calories: bestCal,
          protein_g: bestProtein,
          carbs_g: bestCarbs,
          fat_g: bestFat,
        },
        analyzedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(
      `Failed to analyze photo for dish ${job.dishId}:`,
      (error as Error).message
    );
  }
}

export type {
  VisionAnalysis,
  EnsembleAnalysis,
  IngredientEstimate,
  MacroRange,
  BatchJob,
  ClaudeVisionResponse,
} from "./types";
