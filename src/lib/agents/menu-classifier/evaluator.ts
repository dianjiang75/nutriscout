/**
 * Classifier Evaluator
 *
 * Measures classification accuracy by comparing the `menuItemType` field
 * on MenuItem records against ground truth labels.
 *
 * Ground truth items are matched by name (fuzzy) and optionally by restaurant.
 * Items labeled "general" in ground truth are matched across all restaurants.
 *
 * Corrections file overrides ground truth when the human has manually fixed a label.
 */

import { PrismaClient } from "@/generated/prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

export interface ClassifierEvalResult {
  totalEvaluated: number;
  correctCount: number;
  accuracy: number;
  errors: Array<{
    name: string;
    expected: string;
    actual: string;
    restaurantId: string;
  }>;
  /** Breakdown by type: { dish: { correct: 10, total: 12 }, ... } */
  byType: Record<string, { correct: number; total: number }>;
  /** Items from ground truth that were not found in the DB at all */
  notFound: string[];
}

interface GroundTruthItem {
  name: string;
  expectedType: string;
  restaurant: string;
}

interface CorrectionItem {
  name: string;
  correctType: string;
  reason: string;
  addedBy: string;
  date: string;
}

interface GroundTruthData {
  items: GroundTruthItem[];
}

interface CorrectionsData {
  corrections: CorrectionItem[];
}

function loadGroundTruth(): GroundTruthData {
  const filePath = join(__dirname, "ground-truth.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as GroundTruthData;
}

function loadCorrections(): CorrectionsData {
  const filePath = join(__dirname, "corrections.json");
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as CorrectionsData;
  } catch {
    return { corrections: [] };
  }
}

/**
 * Normalize a name for matching: lowercase, strip common suffixes, collapse whitespace.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^a-z0-9'& ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if two names match for evaluation purposes.
 */
function nameMatches(dbName: string, truthName: string): boolean {
  const a = normalize(dbName);
  const b = normalize(truthName);
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Evaluate classifier output against ground truth.
 * Queries the DB for all active MenuItems and compares menuItemType against expected.
 */
export async function evaluateClassifier(
  prisma: PrismaClient
): Promise<ClassifierEvalResult> {
  const groundTruth = loadGroundTruth();
  const corrections = loadCorrections();

  // Build corrections lookup (name -> correctType)
  const correctionMap = new Map<string, string>();
  for (const c of corrections.corrections) {
    correctionMap.set(normalize(c.name), c.correctType);
  }

  // Load all restaurants for name-to-id mapping
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true, name: true },
  });
  const restaurantByName = new Map<string, string>();
  for (const r of restaurants) {
    restaurantByName.set(normalize(r.name), r.id);
  }

  // Load all active MenuItems
  const allItems = await prisma.menuItem.findMany({
    where: { archivedAt: null },
    select: {
      name: true,
      menuItemType: true,
      restaurantId: true,
      restaurant: { select: { name: true } },
    },
  });

  const errors: ClassifierEvalResult["errors"] = [];
  const notFound: string[] = [];
  const byType: Record<string, { correct: number; total: number }> = {};
  let correctCount = 0;
  let totalEvaluated = 0;

  for (const truthItem of groundTruth.items) {
    // Apply correction if one exists
    const correctedType =
      correctionMap.get(normalize(truthItem.name)) ?? truthItem.expectedType;

    // Find matching MenuItem in DB
    // For "general" restaurant items, search across all restaurants
    // For specific restaurants, narrow search
    let match: (typeof allItems)[number] | undefined;

    if (truthItem.restaurant === "general") {
      match = allItems.find((mi) => nameMatches(mi.name, truthItem.name));
    } else {
      // Find restaurant ID for the named restaurant
      const restId = restaurantByName.get(normalize(truthItem.restaurant));
      if (restId) {
        match = allItems.find(
          (mi) =>
            mi.restaurantId === restId &&
            nameMatches(mi.name, truthItem.name)
        );
      }
      // Fallback: try any restaurant if specific match fails
      if (!match) {
        match = allItems.find((mi) => nameMatches(mi.name, truthItem.name));
      }
    }

    if (!match) {
      notFound.push(truthItem.name);
      continue;
    }

    totalEvaluated++;
    const actualType = match.menuItemType;

    // Track per-type stats
    if (!byType[correctedType]) {
      byType[correctedType] = { correct: 0, total: 0 };
    }
    byType[correctedType].total++;

    if (actualType === correctedType) {
      correctCount++;
      byType[correctedType].correct++;
    } else {
      errors.push({
        name: truthItem.name,
        expected: correctedType,
        actual: actualType,
        restaurantId: match.restaurantId,
      });
    }
  }

  const accuracy = totalEvaluated > 0 ? correctCount / totalEvaluated : 0;

  return {
    totalEvaluated,
    correctCount,
    accuracy,
    errors,
    byType,
    notFound,
  };
}
