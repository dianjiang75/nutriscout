/**
 * Photo matching system for FoodClaw.
 *
 * Matches existing AI-generated dish images on disk to dishes in the database.
 * Uses a 3-strategy approach:
 *   1. Exact name match in generated-photos.json
 *   2. Case-insensitive name match in generated-photos.json
 *   3. Fuzzy filesystem match (Dice coefficient on kebab-case slug)
 *
 * Returns the URL path (e.g., "/dishes/pad-thai-goong-v2.jpg") or null.
 */

import fs from "fs";
import path from "path";

// Resolve paths relative to the nutriscout project root
const PROJECT_ROOT = path.resolve(__dirname, "../../../");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const GENERATED_PHOTOS_PATH = path.join(
  PROJECT_ROOT,
  "scripts",
  "generated-photos.json"
);
const DISHES_DIR = path.join(PUBLIC_DIR, "dishes");

/** Minimum Dice coefficient to accept a fuzzy filesystem match */
const FUZZY_THRESHOLD = 0.7;

/** Cache of generated-photos.json mapping (dish name -> URL path) */
let generatedPhotosCache: Record<string, string> | null = null;

/** Cache of files on disk in the dishes directory */
let diskFilesCache: string[] | null = null;

/**
 * Find a matching photo for a dish name.
 *
 * Strategy 1: Exact name match in generated-photos.json
 * Strategy 2: Case-insensitive name match in generated-photos.json
 * Strategy 3: Fuzzy filesystem match (Dice coefficient on kebab-case slug)
 * Strategy 4: No match = null (don't generate)
 */
export function matchPhotoForDish(dishName: string): string | null {
  const generatedPhotos = loadGeneratedPhotos();

  // Strategy 1: Exact match in generated-photos.json
  if (generatedPhotos[dishName]) {
    const urlPath = generatedPhotos[dishName];
    if (fileExistsInPublic(urlPath)) {
      return urlPath;
    }
  }

  // Strategy 2: Case-insensitive match in generated-photos.json
  const lowerName = dishName.toLowerCase();
  const ciKey = Object.keys(generatedPhotos).find(
    (k) => k.toLowerCase() === lowerName
  );
  if (ciKey) {
    const urlPath = generatedPhotos[ciKey];
    if (fileExistsInPublic(urlPath)) {
      return urlPath;
    }
  }

  // Strategy 3: Fuzzy filesystem match
  const slug = toKebabCase(dishName);
  const files = loadDiskFiles();
  const best = findBestFileMatch(slug, files);
  if (best && best.score >= FUZZY_THRESHOLD) {
    return `/dishes/${best.filename}`;
  }

  // No match
  return null;
}

/** Convert dish name to kebab-case slug. */
export function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[']/g, "") // remove apostrophes (Joe's -> joes)
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

/** Generate character bigrams from a string. */
function bigrams(str: string): Set<string> {
  const s = str.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const bg = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bg.add(s.slice(i, i + 2));
  }
  return bg;
}

/** Dice coefficient similarity (bigram-based). Returns 0-1. */
export function diceCoefficient(a: string, b: string): number {
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/** Load and cache generated-photos.json. */
function loadGeneratedPhotos(): Record<string, string> {
  if (generatedPhotosCache) return generatedPhotosCache;

  try {
    const raw = fs.readFileSync(GENERATED_PHOTOS_PATH, "utf-8");
    generatedPhotosCache = JSON.parse(raw) as Record<string, string>;
  } catch {
    // If file doesn't exist or is malformed, use empty map
    generatedPhotosCache = {};
  }

  return generatedPhotosCache;
}

/** Load and cache the list of files in the dishes directory. */
function loadDiskFiles(): string[] {
  if (diskFilesCache) return diskFilesCache;

  try {
    diskFilesCache = fs.readdirSync(DISHES_DIR).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".webp";
    });
  } catch {
    diskFilesCache = [];
  }

  return diskFilesCache;
}

/** Check if a URL path (e.g., "/dishes/foo.jpg") exists in the public directory. */
function fileExistsInPublic(urlPath: string): boolean {
  const fullPath = path.join(PUBLIC_DIR, urlPath);
  return fs.existsSync(fullPath);
}

/**
 * Strip version suffixes and extensions from a filename for matching.
 * "pad-thai-goong-v2.jpg" -> "pad-thai-goong"
 */
function stripFilename(filename: string): string {
  return filename
    .replace(/\.(jpg|jpeg|png|webp)$/i, "") // strip extension
    .replace(/-v\d+$/, ""); // strip -v2, -v3, etc.
}

/**
 * Find the best matching file on disk using Dice coefficient on slugs.
 * Compares against filenames with version suffixes and extensions stripped.
 */
function findBestFileMatch(
  slug: string,
  files: string[]
): { filename: string; score: number } | null {
  let best: { filename: string; score: number } | null = null;

  for (const file of files) {
    const stripped = stripFilename(file);
    const score = diceCoefficient(slug, stripped);

    if (score > (best?.score ?? 0)) {
      best = { filename: file, score };
    }
  }

  return best;
}

/** Clear caches (useful for testing or re-running). */
export function clearCaches(): void {
  generatedPhotosCache = null;
  diskFilesCache = null;
}
