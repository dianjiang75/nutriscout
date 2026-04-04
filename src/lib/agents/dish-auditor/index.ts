/**
 * Dish Auditor — 3-agent validation pipeline that runs BEFORE dishes enter the DB.
 *
 * Agent A: Format Validator (rules-based, instant, free)
 * Agent B: Food Knowledge Verifier (LLM-powered, Gemini Flash)
 * Agent C: Duplicate & Consistency Checker (DB queries)
 *
 * All three must pass before a dish is inserted. This is the guardrail
 * that prevents "Wheelchair-accessible basin" from becoming a menu item.
 */
import { getGeminiClient, GEMINI_FLASH } from "@/lib/ai/clients";
import { extractJson } from "@/lib/utils/parse-json";
import { prisma } from "@/lib/db/client";
import type { RawMenuItem } from "@/lib/agents/menu-crawler/types";

// ─── JUNK PATTERNS ──────────────────────────────────────
// These patterns are DEFINITE non-food. If ANY match, the item is rejected immediately.
const JUNK_PATTERNS = [
  // Hotel/building amenities
  /\b(gym|pool|spa|sauna|jacuzzi|elevator|lobby|concierge|valet|parking|shuttle|wifi|wi-fi)\b/i,
  /\b(check-in|checkout|check-out|luggage|baggage|key card|safe deposit|minibar|mini-bar)\b/i,
  /\b(hairdryer|hair dryer|shampoo|conditioner|towel|iron(?:ing)?|laundry)\b/i,
  /\b(air condition|heating|balcony|terrace|grab rail|shower|bathtub|toilet|wc )\b/i,
  /\b(doorman|bellhop|reception|front desk|housekeeping|room service|wake-up)\b/i,
  // Navigation/business
  /\b(booking|reservation|phone|call us|contact us|email us|our address|get directions)\b/i,
  /\b(close to|near |subway|bus stop|train station|airport|located at)\b/i,
  /\b(24-hour|24 hour|open daily|hours of operation|we are open|opening hours)\b/i,
  /\b(360°|virtual tour|gallery|our story|about us|careers|jobs)\b/i,
  /\b(instagram|facebook|twitter|tiktok|follow us|subscribe|newsletter)\b/i,
  // Standalone day names
  /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i,
  // Phone numbers
  /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,
  // URLs
  /https?:\/\//,
  // Wheelchair/accessibility
  /\b(wheelchair|accessible|disability|handicap|step-free|ramp|braille)\b/i,
];

// ─── AGENT A: FORMAT VALIDATOR ──────────────────────────

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDishFormat(item: RawMenuItem): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = item.name?.trim() || "";
  const desc = (item.description || "").trim();

  // Name checks
  if (!name || name.length < 3) errors.push("Name too short");
  if (name.length > 80) errors.push("Name too long (likely a sentence, not a dish)");
  if (/[<>{}]/.test(name)) errors.push("Contains HTML/code characters");

  // Junk pattern matching
  const combined = (name + " " + desc).toLowerCase();
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(combined)) {
      errors.push(`Matches junk pattern: ${pattern.source.substring(0, 30)}`);
      break;
    }
  }

  // Mostly numbers
  if (/^\d+[\s.,-]*\d*$/.test(name)) errors.push("Name is just numbers");

  // Wine list codes
  if (name.includes("|") && /\d{4}/.test(name)) errors.push("Looks like wine list code");

  // Price sanity
  if (item.price) {
    const priceNum = parseFloat(item.price.replace(/[^0-9.]/g, ""));
    if (!isNaN(priceNum)) {
      if (priceNum < 0.5) warnings.push("Price < $0.50 (suspicious)");
      if (priceNum > 500) warnings.push("Price > $500 (suspicious)");
    }
  }

  // No description AND no price = probably not a menu item
  if (!desc && !item.price) warnings.push("No description and no price");

  return { isValid: errors.length === 0, errors, warnings };
}

// ─── AGENT B: FOOD KNOWLEDGE VERIFIER ───────────────────

export interface FoodVerification {
  name: string;
  is_food: boolean;
  food_confidence: number;
  likely_ingredients: string[];
  allergen_flags: string[];
  rejection_reason: string | null;
}

/**
 * Verify a batch of items using Gemini Flash.
 * Returns food confidence scores — items below 0.7 are rejected.
 */
export async function verifyFoodItems(
  items: RawMenuItem[],
  restaurantCuisine?: string,
): Promise<FoodVerification[]> {
  if (items.length === 0) return [];

  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({ model: GEMINI_FLASH });

  const itemList = items.map((item, i) => ({
    index: i,
    name: item.name,
    description: item.description || "",
    price: item.price || "",
    category: item.category || "",
  }));

  const prompt = `You are a food safety auditor for a restaurant menu app. Your job is to verify that menu items are REAL FOOD or DRINK dishes.

Restaurant cuisine: ${restaurantCuisine || "Unknown"}

For each item below, determine:
1. is_food: Is this a real food or drink dish that a restaurant would serve? (true/false)
2. food_confidence: How confident are you? (0.0 to 1.0)
3. likely_ingredients: What ingredients would this dish contain? List the main ones.
4. allergen_flags: Any allergen concerns (peanuts, tree_nuts, shellfish, dairy, gluten, eggs, soy, sesame, fish)
5. rejection_reason: If NOT food, why? (e.g., "hotel amenity", "business info", "website navigation")

Items to verify:
${JSON.stringify(itemList)}

Return ONLY a JSON array:
[{"name":"...","is_food":true,"food_confidence":0.95,"likely_ingredients":["..."],"allergen_flags":["..."],"rejection_reason":null}]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) return items.map(item => ({
      name: item.name,
      is_food: true, // fail-open on API error
      food_confidence: 0.5,
      likely_ingredients: [],
      allergen_flags: [],
      rejection_reason: null,
    }));

    return extractJson<FoodVerification[]>(text);
  } catch {
    // Fail-open: if LLM verification fails, let format validator handle it
    return items.map(item => ({
      name: item.name,
      is_food: true,
      food_confidence: 0.5,
      likely_ingredients: [],
      allergen_flags: [],
      rejection_reason: null,
    }));
  }
}

// ─── AGENT C: DUPLICATE & CONSISTENCY CHECKER ───────────

export interface ConsistencyResult {
  isDuplicate: boolean;
  existingDishId: string | null;
  normalizedName: string;
  warnings: string[];
}

export async function checkConsistency(
  item: RawMenuItem,
  restaurantId: string,
): Promise<ConsistencyResult> {
  const warnings: string[] = [];

  // Normalize name
  const normalizedName = item.name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[""'']/g, "'")
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  // Check for exact duplicate in same restaurant
  const existing = await prisma.dish.findFirst({
    where: {
      restaurantId,
      name: { equals: normalizedName, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    return {
      isDuplicate: true,
      existingDishId: existing.id,
      normalizedName,
      warnings: ["Duplicate dish in same restaurant"],
    };
  }

  // Price sanity by cuisine
  if (item.price) {
    const priceNum = parseFloat(item.price.replace(/[^0-9.]/g, ""));
    if (!isNaN(priceNum) && priceNum > 200) {
      warnings.push(`Price $${priceNum} seems high — verify`);
    }
  }

  return {
    isDuplicate: false,
    existingDishId: null,
    normalizedName,
    warnings,
  };
}

// ─── FULL AUDIT PIPELINE ────────────────────────────────

/** Item type classification — determines visibility in search and image generation */
export type DishType = "dish" | "drink" | "side" | "condiment" | "non_food";

export interface AuditResult {
  item: RawMenuItem;
  passed: boolean;
  normalizedName: string;
  dishType: DishType;
  formatResult: ValidationResult;
  foodVerification: FoodVerification | null;
  consistencyResult: ConsistencyResult | null;
  rejectionReasons: string[];
}

/**
 * Classify an item as dish, drink, side, condiment, or non_food.
 * Only "dish" items get: dish cards, AI photos, search results, image generation.
 * Drinks/sides/condiments exist in the restaurant menu but NOT in search or photo pipeline.
 */
function classifyDishType(name: string, category?: string | null): DishType {
  const lower = (name + " " + (category || "")).toLowerCase();

  // Drinks
  if (/\b(wine|beer|cocktail|margarita|martini|sangria|mojito|prosecco|champagne|whiskey|bourbon|vodka|gin|rum|tequila|sake|soju|merlot|chardonnay|cabernet|pinot|riesling|sauvignon|rosé|malbec|tempranillo|syrah|cider|lager|ale|stout|ipa|sparkling|seltzer|lemonade|juice|smoothie|milkshake|horchata|lassi|coffee|espresso|latte|cappuccino|tea|matcha|kombucha|soda|cola)\b/.test(lower)) {
    return "drink";
  }
  if (/^(water|ice water|sparkling water|still water|tap water)$/i.test(name.trim())) return "drink";
  if (/\b(añejo|reposado|blanco|mezcal|amaro|grappa|digestif|aperitif)\b/.test(lower)) return "drink";
  if (category?.toLowerCase().includes("wine") || category?.toLowerCase().includes("drink") || category?.toLowerCase().includes("beverage") || category?.toLowerCase().includes("cocktail")) return "drink";

  // Side dishes / individual ingredients / condiments
  if (/^(bread|rice|naan|roti|tortilla|pita|baguette|roll|biscuit)\s*(basket|service)?$/i.test(name.trim())) return "side";
  if (/^(french fries|fries|onion rings|coleslaw|mashed potatoes|corn bread|hush puppies)$/i.test(name.trim())) return "side";
  if (/^(dried seaweed|seaweed|pickles|kimchi|edamame|extra sauce|dipping sauce|ranch|ketchup|mayo|hot sauce|soy sauce)\s*(\(.+\))?$/i.test(name.trim())) return "condiment";
  if (/^\d+\s*(pieces?|pcs?|oz|ml)\)?$/i.test(name.trim())) return "condiment"; // "2 Pieces", "4oz"

  return "dish";
}

/**
 * Run ALL 3 audit agents on a batch of menu items.
 * Returns only items that pass all checks.
 *
 * Pipeline: Format → Food Verify → Consistency
 * Each stage filters out bad items so downstream stages process less.
 */
export async function auditMenuItems(
  items: RawMenuItem[],
  restaurantId: string,
  restaurantCuisine?: string,
): Promise<AuditResult[]> {
  const results: AuditResult[] = [];

  // Stage 1: Format validation (instant, free)
  const formatPassed: RawMenuItem[] = [];
  for (const item of items) {
    const format = validateDishFormat(item);
    if (!format.isValid) {
      results.push({
        item,
        passed: false,
        normalizedName: item.name,
        dishType: "non_food",
        formatResult: format,
        foodVerification: null,
        consistencyResult: null,
        rejectionReasons: format.errors,
      });
    } else {
      formatPassed.push(item);
    }
  }

  // Stage 2: Food knowledge verification (LLM, batched)
  const verifications = await verifyFoodItems(formatPassed, restaurantCuisine);
  const foodPassed: RawMenuItem[] = [];

  for (let i = 0; i < formatPassed.length; i++) {
    const item = formatPassed[i];
    const v = verifications[i] || { is_food: true, food_confidence: 0.5, likely_ingredients: [], allergen_flags: [], rejection_reason: null };

    if (!v.is_food || v.food_confidence < 0.7) {
      results.push({
        item,
        passed: false,
        normalizedName: item.name,
        dishType: "non_food",
        formatResult: validateDishFormat(item),
        foodVerification: v,
        consistencyResult: null,
        rejectionReasons: [v.rejection_reason || `Low food confidence: ${v.food_confidence}`],
      });
    } else {
      foodPassed.push(item);
      // Attach ingredient data to the item for downstream use
      (item as RawMenuItem & { _ingredients?: string[]; _allergens?: string[] })._ingredients = v.likely_ingredients;
      (item as RawMenuItem & { _allergens?: string[] })._allergens = v.allergen_flags;
    }
  }

  // Stage 3: Consistency check (DB queries)
  for (const item of foodPassed) {
    const consistency = await checkConsistency(item, restaurantId);

    const dishType = classifyDishType(item.name, item.category);

    if (consistency.isDuplicate) {
      results.push({
        item,
        passed: false,
        normalizedName: consistency.normalizedName,
        dishType,
        formatResult: validateDishFormat(item),
        foodVerification: verifications[formatPassed.indexOf(item)] || null,
        consistencyResult: consistency,
        rejectionReasons: ["Duplicate dish"],
      });
    } else {
      results.push({
        item,
        passed: true,
        normalizedName: consistency.normalizedName,
        dishType,
        formatResult: validateDishFormat(item),
        foodVerification: verifications[formatPassed.indexOf(item)] || null,
        consistencyResult: consistency,
        rejectionReasons: [],
      });
    }
  }

  return results;
}
