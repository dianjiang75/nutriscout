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
import { getGeminiClient, GEMINI_FLASH, getQwenClient, QWEN_3, getDeepSeekClient, DEEPSEEK_V4 } from "@/lib/ai/clients";
import { extractJson } from "@/lib/utils/parse-json";
import { prisma } from "@/lib/db/client";
import type { RawMenuItem } from "@/lib/agents/menu-crawler/types";
import { isWineOrSpirit, isInterestingBeverage, isComboOrMealDeal, isKidsMenuItem } from "../menu-crawler/clean-dish-name";

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

  // Fallback chain: Gemini Flash → Qwen → DeepSeek → fail-open
  // PRODUCTION TARGET: Gemini Flash (best vision/structured output)
  // MVP FALLBACK: Qwen 3 / DeepSeek V4 (cheap, text-only)
  const fallbackChain = [
    { name: "gemini-flash", fn: async () => {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text) return null;
      return extractJson<FoodVerification[]>(text);
    }},
    { name: "qwen-3", fn: async () => {
      const client = getQwenClient();
      const r = await client.chat.completions.create({
        model: QWEN_3, max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });
      const text = r.choices[0]?.message?.content;
      if (!text) return null;
      return extractJson<FoodVerification[]>(text);
    }},
    { name: "deepseek-v4", fn: async () => {
      const client = getDeepSeekClient();
      const r = await client.chat.completions.create({
        model: DEEPSEEK_V4, max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });
      const text = r.choices[0]?.message?.content;
      if (!text) return null;
      return extractJson<FoodVerification[]>(text);
    }},
  ];

  for (const { name, fn } of fallbackChain) {
    try {
      const result = await fn();
      if (result && Array.isArray(result) && result.length > 0) {
        if (name !== "gemini-flash") {
          console.log(`[dish-auditor] Using ${name} for food verification (Gemini unavailable)`);
        }
        return result;
      }
    } catch (err) {
      console.warn(`[dish-auditor] ${name} failed:`, (err as Error).message?.substring(0, 80));
    }
  }

  // All models failed — fail-open with 0.8 confidence
  console.warn("[dish-auditor] All LLM models failed — fail-open with confidence 0.8");
  return items.map(item => ({
    name: item.name,
    is_food: true,
    food_confidence: 0.8,
    likely_ingredients: [],
    allergen_flags: [],
    rejection_reason: null,
  }));
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

/** Item type classification — matches Prisma MenuItemType enum + "non_food" for rejected items */
export type DishType = "dish" | "dessert" | "drink" | "side" | "condiment" | "addon" | "combo" | "kids" | "unknown" | "non_food";

export interface AuditResult {
  item: RawMenuItem;
  passed: boolean;
  normalizedName: string;
  dishType: DishType;
  auditConfidence: number;
  formatResult: ValidationResult;
  foodVerification: FoodVerification | null;
  consistencyResult: ConsistencyResult | null;
  rejectionReasons: string[];
}

/**
 * Classify an item into the expanded MenuItemType set.
 * Only "dish" and "dessert" items get: dish cards, AI photos, search results, image generation.
 * Other types exist in the restaurant menu but NOT in search or photo pipeline.
 */
function classifyDishType(name: string, category?: string | null): DishType {
  const trimmedName = name.trim();
  const lower = (trimmedName + " " + (category || "")).toLowerCase();
  const nameLower = trimmedName.toLowerCase();
  const categoryLower = (category || "").toLowerCase();

  // ── Desserts (check BEFORE sides so "Bread Pudding" → dessert, not side) ──
  const DESSERT_PATTERNS = /\b(cake|pie|ice cream|gelato|tiramisu|cheesecake|brownie|cookies?|pudding|flan|mochi|churros?|crème brûlée|creme brulee|sorbet|parfait|sundae|tarts?|macarons?|baklava|dough?nuts?|donuts?|cupcakes?|panna cotta|cannoli|profiteroles?|eclairs?|beignets?|cobbler|strudel|meringue|mousse|pavlova|bread pudding|bananas foster|banana split|s'?mores|chocolate lava|crêpes?|crepes?)\b/;
  const DESSERT_CATEGORIES = /\b(dessert|sweets|pastry|bakery|dulce)\b/;
  if (DESSERT_PATTERNS.test(nameLower) || DESSERT_CATEGORIES.test(categoryLower)) {
    // "Waffle" in a dessert category → dessert; standalone "Waffle" → dish (breakfast)
    if (/\bwaffles?\b/.test(nameLower) && !DESSERT_CATEGORIES.test(categoryLower)) {
      // Fall through — waffle without dessert context is a dish
    } else {
      return "dessert";
    }
  }

  // ── Drinks ──
  if (/\b(wine|beer|cocktail|margarita|martini|sangria|mojito|prosecco|champagne|whiskey|bourbon|vodka|gin|rum|tequila|sake|soju|merlot|chardonnay|cabernet|pinot|riesling|sauvignon|rosé|malbec|tempranillo|syrah|cider|lager|ale|stout|ipa|sparkling|seltzer|lemonade|juice|smoothie|milkshake|horchata|lassi|coffee|espresso|latte|cappuccino|tea|matcha|kombucha|soda|cola)\b/.test(lower)) {
    return "drink";
  }
  if (/^(water|ice water|sparkling water|still water|tap water)$/i.test(trimmedName)) return "drink";
  if (/\b(añejo|reposado|blanco|mezcal|amaro|grappa|digestif|aperitif)\b/.test(lower)) return "drink";
  if (/\b(wine|drink|beverage|cocktail)\b/.test(categoryLower)) return "drink";
  // Use imported helpers for beverage detection
  if (isInterestingBeverage(nameLower)) return "drink";
  if (isWineOrSpirit(trimmedName, category)) return "drink";

  // ── Kids menu items ──
  if (isKidsMenuItem(trimmedName)) return "kids";

  // ── Combos / meal deals ──
  if (isComboOrMealDeal(trimmedName)) return "combo";

  // ── Addons (extras, upgrades, substitutions) ──
  if (/^(add|extra|sub|substitute|upgrade|upsize|make it|with added)\s+/i.test(trimmedName)) return "addon";
  if (/^additional\s+/i.test(trimmedName)) return "addon";

  // ── Condiments (sauces, dressings — NOT edamame or standalone kimchi) ──
  if (/^(extra sauce|dipping sauce|ranch|ketchup|mayo|hot sauce|soy sauce|tartar sauce|aioli|gravy|salsa|guacamole side|pesto)\s*(\(.+\))?$/i.test(trimmedName)) return "condiment";
  if (/^(dried seaweed|seaweed|pickles)\s*(\(.+\))?$/i.test(trimmedName)) return "condiment";
  if (/^\d+\s*(pieces?|pcs?|oz|ml)\)?$/i.test(trimmedName)) return "condiment"; // "2 Pieces", "4oz"

  // ── Side dishes ──
  // "Side of X" prefix → side
  if (/^side\s+(of\s+)?/i.test(trimmedName)) return "side";
  // Exact matches for basic carbs/starches
  if (/^(rice|naan|roti|tortilla|pita|baguette|roll|biscuit)\s*(basket|service)?$/i.test(trimmedName)) return "side";
  // Contains "fries" → side (catches "Truffle Fries", "Garlic Fries", "Loaded Fries")
  if (/\bfries\b/i.test(nameLower)) return "side";
  // Contains "bread" → side, BUT NOT "Bread Pudding" (already caught as dessert above)
  if (/\bbread\b/i.test(nameLower) && !DESSERT_PATTERNS.test(nameLower)) return "side";
  // Other common sides
  if (/^(onion rings|coleslaw|mashed potatoes|hush puppies|tater tots|mac\s*(?:&|and)\s*cheese|cornbread|corn bread)$/i.test(trimmedName)) return "side";
  // "Kimchi" as "side of kimchi" → side (caught above by "Side of" prefix)
  // Standalone "Kimchi" on menu → condiment only if explicitly marked
  if (/^kimchi$/i.test(trimmedName)) return "side"; // Standalone kimchi = side/appetizer, not condiment

  // ── Edamame is a dish (appetizer), NOT condiment ──
  if (/^edamame$/i.test(trimmedName)) return "dish";

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
        auditConfidence: 0,
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
        auditConfidence: v.food_confidence,
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
    const verification = verifications[formatPassed.indexOf(item)] || null;
    const confidence = verification?.food_confidence ?? 0.8;

    // Duplicates are NOT rejected — re-crawls naturally find the same dishes.
    // The pipeline will update existing records, not create new ones.
    // Only reject if it's a duplicate WITHIN the same crawl batch (handled by dedup in index.ts).
    if (false) {
      // Legacy duplicate rejection — disabled. Kept for reference.
    } else {
      results.push({
        item,
        passed: true,
        normalizedName: consistency.normalizedName,
        dishType,
        auditConfidence: confidence,
        formatResult: validateDishFormat(item),
        foodVerification: verification,
        consistencyResult: consistency,
        rejectionReasons: [],
      });
    }
  }

  return results;
}
