/**
 * Scraper Evaluator
 *
 * Measures scraper accuracy by comparing actual MenuItem records in the DB
 * against ground truth data (known items that should exist for a restaurant).
 *
 * Metrics:
 * - recall: what fraction of known items were actually scraped
 * - falseItems: scraped items that match knownNonItems (junk that leaked through)
 * - missedItems: knownItems that were NOT found in the DB
 */

import { PrismaClient } from "@/generated/prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

export interface ScraperEvalResult {
  restaurantId: string;
  restaurantName: string;
  expectedItemCount: number;
  actualItemCount: number;
  recall: number;
  falseItems: string[];
  missedItems: string[];
}

interface GroundTruthRestaurant {
  googlePlaceId: string;
  name: string;
  expectedItemCount: number;
  knownItems: string[];
  knownNonItems: string[];
}

interface GroundTruthData {
  restaurants: GroundTruthRestaurant[];
}

function loadGroundTruth(): GroundTruthData {
  const filePath = join(__dirname, "ground-truth.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as GroundTruthData;
}

/**
 * Normalize a name for fuzzy matching: lowercase, strip punctuation, collapse whitespace.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if a scraped item name matches a ground truth name.
 * Uses normalized substring matching — ground truth names are often shorter
 * than the full scraped name (e.g., "Shakshuka" matches "Shakshuka with Feta").
 */
function nameMatches(scrapedName: string, truthName: string): boolean {
  const a = normalize(scrapedName);
  const b = normalize(truthName);
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Evaluate scraper output against ground truth for a specific restaurant.
 * Returns null if the restaurant is not in ground truth or not found in DB.
 */
export async function evaluateScraper(
  restaurantId: string,
  prisma: PrismaClient
): Promise<ScraperEvalResult | null> {
  // Look up the restaurant to get its googlePlaceId
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, googlePlaceId: true },
  });

  if (!restaurant) return null;

  const groundTruth = loadGroundTruth();
  const truthEntry = groundTruth.restaurants.find(
    (r) => r.googlePlaceId === restaurant.googlePlaceId
  );

  if (!truthEntry) return null;

  // Get all active (non-archived) MenuItems for this restaurant
  const menuItems = await prisma.menuItem.findMany({
    where: {
      restaurantId,
      archivedAt: null,
    },
    select: { name: true },
  });

  const scrapedNames = menuItems.map((mi) => mi.name);

  // Compute missed items: known items NOT found in scraped results
  const missedItems: string[] = [];
  for (const knownItem of truthEntry.knownItems) {
    const found = scrapedNames.some((scraped) =>
      nameMatches(scraped, knownItem)
    );
    if (!found) {
      missedItems.push(knownItem);
    }
  }

  // Compute false items: scraped items that match known non-items (junk)
  const falseItems: string[] = [];
  for (const scrapedName of scrapedNames) {
    const isJunk = truthEntry.knownNonItems.some((nonItem) =>
      nameMatches(scrapedName, nonItem)
    );
    if (isJunk) {
      falseItems.push(scrapedName);
    }
  }

  // Recall: fraction of known items that were found
  const foundCount = truthEntry.knownItems.length - missedItems.length;
  const recall =
    truthEntry.knownItems.length > 0
      ? foundCount / truthEntry.knownItems.length
      : 1;

  return {
    restaurantId,
    restaurantName: restaurant.name,
    expectedItemCount: truthEntry.expectedItemCount,
    actualItemCount: scrapedNames.length,
    recall,
    falseItems,
    missedItems,
  };
}

/**
 * Evaluate all restaurants in ground truth. Looks up each by googlePlaceId.
 */
export async function evaluateAllScrapers(
  prisma: PrismaClient
): Promise<ScraperEvalResult[]> {
  const groundTruth = loadGroundTruth();
  const results: ScraperEvalResult[] = [];

  for (const entry of groundTruth.restaurants) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { googlePlaceId: entry.googlePlaceId },
      select: { id: true },
    });

    if (!restaurant) {
      console.warn(
        `[scraper-eval] Restaurant not in DB: ${entry.name} (${entry.googlePlaceId})`
      );
      continue;
    }

    const result = await evaluateScraper(restaurant.id, prisma);
    if (result) {
      results.push(result);
    }
  }

  return results;
}
