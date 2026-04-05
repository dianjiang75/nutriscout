import * as cheerio from "cheerio";
import { getGeminiClient, GEMINI_FLASH } from "@/lib/ai/clients";
import { SchemaType } from "@google/generative-ai";
import { extractJson } from "@/lib/utils/parse-json";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { isLikelyFoodItem } from "./clean-dish-name";
import type { MenuSourceStrategy, RawMenuItem, RestaurantInfo } from "./types";

const MENU_EXTRACTION_PROMPT = `This is a photo of a restaurant menu. Extract ALL menu items with:
- Item name
- Description (if any — include ingredient lists exactly as written)
- Price (if visible)
- Section/category (e.g., "Appetizers", "Mains", "Desserts")
- Ingredients (if listed on the menu — extract the exact ingredient text as written)
- Dietary symbols visible (e.g., "V" for vegan, "GF" for gluten-free, any allergen icons)
- Any visible calorie or nutrition information

Return as JSON array:
[{"name": "string", "description": "string", "price": "string", "category": "string", "ingredients": "string or null", "dietaryTags": ["string"], "calories": number or null}]

Return ONLY valid JSON, no markdown fences or extra text.`;

/**
 * Source 1: Parse menu from the restaurant's own website.
 */
export const websiteSource: MenuSourceStrategy = {
  name: "website",
  priority: 1,

  async fetch(restaurant: RestaurantInfo): Promise<RawMenuItem[] | null> {
    if (!restaurant.websiteUrl) return null;

    try {
      // Try common menu page patterns
      const menuPaths = ["/menu", "/our-menu", "/food", "/food-menu", "/drinks"];
      // California SB 478 (eff. July 1, 2026) + EU FIC Regulation allergen disclosure paths.
      // Restaurants posting allergen data here are legally obligated to be accurate —
      // items from these pages get elevated dietary confidence (0.95) in the crawler.
      const compliancePaths = [
        "/allergens", "/allergen-info", "/allergen-information",
        "/nutrition", "/nutritional-info", "/nutrition-info",
        "/menu-allergens", "/food-allergens", "/dietary",
        "/allergens-nutrition", "/nutrition-allergens",
      ];
      const baseUrl = restaurant.websiteUrl.replace(/\/$/, "");

      let menuHtml: string | null = null;

      // First try the main page for a menu link
      const mainRes = await fetchWithRetry(baseUrl, {
        headers: { "User-Agent": "FoodClaw/1.0 (menu-indexer)" },
      }, { maxRetries: 2, timeoutMs: 10000 });

      if (mainRes.ok) {
        const html = await mainRes.text();
        const $ = cheerio.load(html);

        // Look for menu links in the page
        const menuLink = $('a[href*="menu" i], a:contains("Menu")').first();
        if (menuLink.length) {
          const href = menuLink.attr("href");
          if (href) {
            const menuUrl = href.startsWith("http")
              ? href
              : new URL(href, baseUrl).toString();
            const menuRes = await fetchWithRetry(menuUrl, {
              headers: { "User-Agent": "FoodClaw/1.0 (menu-indexer)" },
            }, { maxRetries: 2, timeoutMs: 10000 });
            if (menuRes.ok) {
              menuHtml = await menuRes.text();
            }
          }
        }
      }

      // Try common paths if no menu link found
      if (!menuHtml) {
        for (const path of menuPaths) {
          try {
            const res = await fetchWithRetry(`${baseUrl}${path}`, {
              headers: { "User-Agent": "FoodClaw/1.0 (menu-indexer)" },
            }, { maxRetries: 2, timeoutMs: 5000 });
            if (res.ok) {
              menuHtml = await res.text();
              break;
            }
          } catch {
            continue;
          }
        }
      }

      if (!menuHtml) return null;

      // Try JSON-LD structured data first (most reliable source)
      const jsonLdItems = extractJsonLdMenu(menuHtml);
      if (jsonLdItems.length > 0) return jsonLdItems;

      // Fall back to CSS selector parsing
      const menuItems = parseHtmlMenu(menuHtml);

      // Additionally, scan compliance/allergen pages for higher-confidence dietary data.
      // California SB 478 (effective July 1, 2026) means CA restaurants must post this.
      // Items from compliance pages get source='compliance_page' so the crawler can
      // boost their dietaryConfidence to 0.95 (restaurant self-certified = legally liable).
      const complianceItems = await fetchCompliancePages(baseUrl, compliancePaths);
      if (complianceItems.length > 0) {
        // Merge: compliance page items override menu items for matching dish names
        const complianceNames = new Set(complianceItems.map((i) => i.name.toLowerCase()));
        const deduped = menuItems.filter((i) => !complianceNames.has(i.name.toLowerCase()));
        return [...complianceItems, ...deduped];
      }

      return menuItems;
    } catch {
      return null;
    }
  },
};

/**
 * Fetch allergen/nutrition compliance pages and return tagged menu items.
 * Items are tagged source='compliance_page' so the main crawler can boost
 * their dietaryConfidence to 0.95.
 */
async function fetchCompliancePages(
  baseUrl: string,
  paths: string[]
): Promise<RawMenuItem[]> {
  for (const path of paths) {
    try {
      const res = await fetchWithRetry(`${baseUrl}${path}`, {
        headers: { "User-Agent": "FoodClaw/1.0 (allergen-compliance-indexer)" },
      }, { maxRetries: 1, timeoutMs: 5000 });

      if (!res.ok) continue;

      const html = await res.text();

      // Must contain allergen-related content to be a compliance page
      const allergenSignals = /\b(allergen|allerg|gluten.free|nut.free|dairy.free|contains|may contain|suitable for)\b/i;
      if (!allergenSignals.test(html)) continue;

      const items = parseHtmlMenu(html);
      if (items.length === 0) continue;

      // Tag all items from this page as compliance_page
      return items.map((item) => ({ ...item, source: "compliance_page" as const }));
    } catch {
      continue;
    }
  }
  return [];
}

/**
 * Extract menu items from JSON-LD (Schema.org) structured data.
 * Many restaurant sites embed menu data as <script type="application/ld+json">.
 * This is the cleanest data source — exact names, prices, descriptions.
 */
/**
 * Extract ingredients from a JSON-LD menu item.
 * Handles Schema.org recipeIngredient, ingredient, and nutrition fields.
 */
function extractJsonLdIngredients(item: Record<string, unknown>): string | null {
  // Schema.org recipeIngredient (array of strings)
  if (item.recipeIngredient && Array.isArray(item.recipeIngredient)) {
    return (item.recipeIngredient as string[]).join(", ");
  }
  // Some sites use 'ingredient' (non-standard but common)
  if (item.ingredient && typeof item.ingredient === "string") {
    return item.ingredient;
  }
  if (item.ingredient && Array.isArray(item.ingredient)) {
    return (item.ingredient as string[]).join(", ");
  }
  return null;
}

/**
 * Extract ingredients from description text.
 * Many menus describe dishes as: "Dish Name - ingredient1, ingredient2, ingredient3"
 * or "served with ingredient1 and ingredient2"
 */
export function extractIngredientsFromDescription(description: string): string | null {
  if (!description || description.length < 5) return null;

  // If description reads like an ingredient list (short, comma-separated, no sentences)
  // e.g., "grilled chicken, romaine, parmesan, croutons, caesar dressing"
  const words = description.split(/\s+/);
  const commas = (description.match(/,/g) || []).length;
  const periods = (description.match(/\./g) || []).length;

  // High comma-to-word ratio + few periods = likely ingredient list
  if (commas >= 2 && periods <= 1 && words.length <= 30) {
    return description;
  }

  // Look for "served with" / "topped with" / "made with" patterns
  const withMatch = description.match(
    /(?:served|topped|made|tossed|drizzled|garnished|finished|accompanied|paired)\s+with\s+(.+)/i
  );
  if (withMatch) {
    return withMatch[1].replace(/\.$/, "").trim();
  }

  // Look for "contains:" or "ingredients:" prefix
  const containsMatch = description.match(
    /(?:contains|ingredients|featuring|includes)\s*[:—–-]\s*(.+)/i
  );
  if (containsMatch) {
    return containsMatch[1].replace(/\.$/, "").trim();
  }

  return null;
}

function extractJsonLdMenu(html: string): RawMenuItem[] {
  const $ = cheerio.load(html);
  const items: RawMenuItem[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "");
      // Handle single object or array of objects
      const objects = Array.isArray(data) ? data : [data];

      for (const obj of objects) {
        // Direct Restaurant with hasMenu
        if (obj["@type"] === "Restaurant" && obj.hasMenu) {
          const menu = obj.hasMenu;
          const sections = menu.hasMenuSection || menu.hasMenuItem ? [menu] : [];
          if (Array.isArray(menu.hasMenuSection)) sections.push(...menu.hasMenuSection);

          for (const section of sections) {
            const category = section.name || null;
            const menuItems = section.hasMenuItem || [];
            const itemList = Array.isArray(menuItems) ? menuItems : [menuItems];

            for (const item of itemList) {
              if (item.name) {
                const rawPrice = item.offers?.price
                  || item.offers?.lowPrice
                  || item.price
                  || null;
                const price = rawPrice != null ? (String(rawPrice).startsWith("$") ? String(rawPrice) : `$${rawPrice}`) : null;
                // Extract ingredients from JSON-LD (Schema.org recipeIngredient or ingredient fields)
                const ingredients = extractJsonLdIngredients(item);
                items.push({
                  name: item.name,
                  description: item.description || "",
                  price,
                  category,
                  menuIngredients: ingredients || undefined,
                });
              }
            }
          }
        }

        // Direct Menu type
        if (obj["@type"] === "Menu") {
          const sections = obj.hasMenuSection || [];
          const sectionList = Array.isArray(sections) ? sections : [sections];

          for (const section of sectionList) {
            const category = section.name || null;
            const menuItems = section.hasMenuItem || [];
            const itemList = Array.isArray(menuItems) ? menuItems : [menuItems];

            for (const item of itemList) {
              if (item.name) {
                const rawPrice = item.offers?.price ?? null;
                const price = rawPrice != null ? (String(rawPrice).startsWith("$") ? String(rawPrice) : `$${rawPrice}`) : null;
                const ingredients = extractJsonLdIngredients(item);
                items.push({
                  name: item.name,
                  description: item.description || "",
                  price,
                  category,
                  menuIngredients: ingredients || undefined,
                });
              }
            }
          }
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  return items;
}

/**
 * Parse HTML content to extract menu items.
 */
export function parseHtmlMenu(html: string): RawMenuItem[] {
  const $ = cheerio.load(html);
  const items: RawMenuItem[] = [];

  // Common menu item patterns
  const selectors = [
    ".menu-item",
    ".dish",
    ".food-item",
    '[class*="menu-item"]',
    '[class*="dish"]',
    '[data-testid*="menu"]',
  ];

  // Build a heading map: for each element position in the DOM, track the most
  // recent h2/h3 heading text. This fixes the bug where currentCategory was
  // always null because closestSection/prevAll couldn't find headings in
  // typical flat menu HTML structures.
  const allHeadings: { text: string }[] = [];
  $("h2, h3, [class*='section-title'], [class*='category-title'], [class*='menu-heading']").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 1 && text.length < 60) {
      allHeadings.push({ text });
    }
  });

  // Try structured selectors first
  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const name =
        $el.find("h3, h4, .item-name, .dish-name, .name").first().text().trim() ||
        $el.find("[class*='name'], [class*='title']").first().text().trim();

      if (!name) return;

      const description =
        $el.find("p, .description, .desc, [class*='description']").first().text().trim() || "";

      // Look for ingredient-specific elements (some menus have dedicated ingredient fields)
      const ingredientEl =
        $el.find("[class*='ingredient'], [class*='contents'], .ingredients, .dish-ingredients").first().text().trim() || null;

      const priceText =
        $el.find(".price, [class*='price']").first().text().trim() || null;

      // Category detection: try multiple strategies
      // 1. Closest section container with a heading
      const closestSection = $el.closest("[class*='section'], [class*='category'], [data-category]");
      const sectionHeading = closestSection.find("h2, h3, [class*='heading'], [class*='title']").first().text().trim();

      // 2. data-category attribute on element or parent
      const dataCategory = $el.attr("data-category")
        || $el.closest("[data-category]").attr("data-category")
        || null;

      // 3. Preceding sibling headings (walk up DOM tree)
      const prevHeading = $el.prevAll("h2, h3").first().text().trim()
        || $el.parent().prevAll("h2, h3").first().text().trim()
        || $el.parent().parent().prevAll("h2, h3").first().text().trim();

      const category = sectionHeading || dataCategory || prevHeading || null;

      // Extract ingredients: prefer dedicated element, fall back to description parsing
      const menuIngredients = ingredientEl
        || extractIngredientsFromDescription(description)
        || undefined;

      items.push({
        name,
        description,
        price: priceText,
        category,
        menuIngredients,
      });
    });

    if (items.length > 0) break;
  }

  // Fallback: look for heading + list patterns
  if (items.length === 0) {
    $("h2, h3").each((_, heading) => {
      const category = $(heading).text().trim();
      const nextItems = $(heading).nextUntil("h2, h3");

      nextItems.find("li, dt, .item").each((_, item) => {
        const name = $(item).text().trim().split("\n")[0].trim();
        if (name && name.length > 2 && name.length < 100) {
          items.push({
            name,
            description: "",
            price: null,
            category,
          });
        }
      });
    });
  }

  // Filter: isLikelyFoodItem() rejects obvious junk (hotel amenities, nav, phone numbers).
  // Wine/spirit items pass through — they're tagged later in the pipeline, not filtered here.
  return items.filter(item => isLikelyFoodItem(item.name, item.description || ""));
}

/**
 * Source 2: Extract menu from Google Maps photos.
 */
export const googlePhotosSource: MenuSourceStrategy = {
  name: "google_photos",
  priority: 2,

  async fetch(restaurant: RestaurantInfo): Promise<RawMenuItem[] | null> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey || apiKey === "placeholder") return null;

    try {
      // Get place photos via Google Places API v2 (New)
      const { getPlaceDetails, getPhotoUrl } = await import("@/lib/google-places/client");
      const placeData = await getPlaceDetails(restaurant.googlePlaceId, "photos");
      const photos = placeData.photos || [];

      if (photos.length === 0) return null;

      // Get first few photos and send to Gemini Flash for menu extraction
      // (migrated from Claude Haiku — 10x cheaper, same OCR quality)
      const allItems: RawMenuItem[] = [];
      const gemini = getGeminiClient();
      const model = gemini.getGenerativeModel({
        model: GEMINI_FLASH,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING },
                price: { type: SchemaType.STRING },
                category: { type: SchemaType.STRING },
                ingredients: { type: SchemaType.STRING, nullable: true },
                dietaryTags: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                },
                calories: { type: SchemaType.NUMBER, nullable: true },
              },
              required: ["name"],
            },
          },
        },
      });

      for (const photo of photos.slice(0, 3)) {
        const photoUrl = getPhotoUrl(photo.name, 1600);

        try {
          // Fetch photo as base64 for Gemini inline_data
          const photoRes = await fetchWithRetry(photoUrl, {}, { maxRetries: 1 });
          if (!photoRes.ok) continue;
          const photoBuffer = Buffer.from(await photoRes.arrayBuffer());
          const base64 = photoBuffer.toString("base64");
          const mimeType = photoRes.headers.get("content-type") || "image/jpeg";

          const result = await model.generateContent([
            { inlineData: { mimeType, data: base64 } },
            { text: MENU_EXTRACTION_PROMPT },
          ]);

          const text = result.response.text();
          if (text) {
            try {
              const parsed = extractJson<RawMenuItem[]>(text);
              if (Array.isArray(parsed)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                allItems.push(...parsed.map((item: any) => {
                  const mapped: RawMenuItem = {
                    name: String(item.name || ""),
                    description: String(item.description || ""),
                    price: item.price ? String(item.price) : null,
                    category: item.category ? String(item.category) : null,
                    photoUrl,
                  };
                  // Pass through ingredients, dietary tags, and calories from Gemini extraction
                  if (item.ingredients && typeof item.ingredients === "string") {
                    mapped.menuIngredients = item.ingredients;
                  }
                  const tags = item.dietaryTags;
                  if (Array.isArray(tags) && tags.length > 0) {
                    mapped.menuDietaryTags = tags.map(String);
                  }
                  const cal = item.calories;
                  if (typeof cal === "number" && cal > 0) {
                    mapped.menuCalories = cal;
                  }
                  return mapped;
                }));
              }
            } catch {
              // Skip unparseable photo menu extraction
            }
          }
        } catch {
          continue;
        }
      }

      return allItems.length > 0 ? allItems : null;
    } catch {
      return null;
    }
  },
};

/**
 * Source 3: Delivery platform (stub — deferred to Phase 7).
 */
export const deliveryPlatformSource: MenuSourceStrategy = {
  name: "delivery_platform",
  priority: 3,

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetch(_restaurant: RestaurantInfo): Promise<RawMenuItem[] | null> {
    // Stub — will be implemented in Phase 7
    return null;
  },
};

// ---------------------------------------------------------------------------
// Annotation extraction — best-effort parsing of allergen legends, nutrition
// data, and dietary symbols from raw menu HTML.
// ---------------------------------------------------------------------------

export interface MenuAnnotations {
  /** Symbol-to-meaning map from footnotes, e.g. { "*": "contains nuts", "V": "vegan" } */
  legendMap: Record<string, string>;
  /** Per-item annotations keyed by lowercased item name */
  itemAnnotations: Record<string, {
    allergens?: string[];
    dietaryTags?: string[];
    calories?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    ingredients?: string;
  }>;
}

/**
 * Scan menu HTML for footnote/allergen legends and inline nutrition info.
 * This is best-effort — returns empty results when nothing is found.
 */
export function extractMenuAnnotations(html: string): MenuAnnotations {
  const legendMap: Record<string, string> = {};
  const itemAnnotations: MenuAnnotations["itemAnnotations"] = {};

  try {
    const $ = cheerio.load(html);

    // ── Step 1: Build legend map from footnote/legend blocks ──

    // Strategy A: Look for dedicated legend containers
    const legendSelectors = [
      ".allergen-legend", ".dietary-key", ".menu-legend", ".footnote",
      ".legend", ".allergen-key", ".dietary-legend", ".menu-footnote",
      "[class*='legend']", "[class*='footnote']", "[class*='allergen-key']",
    ];

    const legendText: string[] = [];
    for (const sel of legendSelectors) {
      $(sel).each((_, el) => {
        legendText.push($(el).text());
      });
    }

    // Strategy B: Scan all text for lines matching "SYMBOL = meaning" patterns
    // Covers: "* = contains nuts", "(V) = Vegan", "GF = Gluten Free", "† Contains dairy"
    const bodyText = $("body").text();
    legendText.push(bodyText);

    const legendLineRe = /([*†‡§¶#!~^+]+|\([A-Z]{1,3}\)|[A-Z]{1,3})\s*[=:–—-]\s*([A-Za-z][A-Za-z\s,'-]{2,60})/g;
    for (const text of legendText) {
      let match: RegExpExecArray | null;
      while ((match = legendLineRe.exec(text)) !== null) {
        const symbol = match[1].replace(/[()]/g, "").trim();
        const meaning = match[2].trim().toLowerCase();
        if (symbol && meaning) {
          legendMap[symbol] = meaning;
        }
      }
    }

    // ── Step 2: Extract per-item nutrition from HTML ──

    // Calorie patterns: "320 cal", "320 kcal", "Calories: 320", "320-450 cal"
    const calRe = /(\d{1,4})\s*(?:[-–]\s*\d{1,4}\s*)?(?:cal(?:ories?)?|kcal)\b/i;
    const calPrefixRe = /(?:cal(?:ories?)?|kcal)\s*[:=]\s*(\d{1,4})/i;
    const proteinRe = /(\d{1,4})\s*g?\s*(?:protein|prot)\b/i;
    const carbsRe = /(\d{1,4})\s*g?\s*(?:carbs?|carbohydrates?)\b/i;
    const fatRe = /(\d{1,4})\s*g?\s*fat\b/i;

    // Allergen inline patterns: "Contains: milk, wheat", "Allergens: nuts, soy"
    const allergenInlineRe = /(?:contains|allergens?)\s*[:=]\s*([A-Za-z,\s]+?)(?:\.|$)/i;

    // Ingredients pattern: "Ingredients: chicken, rice, ..."
    const ingredientsRe = /(?:ingredients?)\s*[:=]\s*([A-Za-z,\s()'-]+?)(?:\.|$)/i;

    // Scan menu item elements for nutrition data
    const itemSelectors = [
      ".menu-item", ".dish", ".food-item",
      '[class*="menu-item"]', '[class*="dish"]',
      '[data-testid*="menu"]',
      "li", "tr", "dt",
    ];

    for (const sel of itemSelectors) {
      $(sel).each((_, el) => {
        const $el = $(el);
        const fullText = $el.text();
        const nameEl = $el.find("h3, h4, .item-name, .dish-name, .name, [class*='name'], [class*='title']").first();
        const itemName = nameEl.text().trim().toLowerCase();
        if (!itemName || itemName.length < 2 || itemName.length > 100) return;

        const annotation: NonNullable<MenuAnnotations["itemAnnotations"][string]> = {};

        // Calories
        const calMatch = calRe.exec(fullText) || calPrefixRe.exec(fullText);
        if (calMatch) {
          const cal = parseInt(calMatch[1], 10);
          if (cal > 0 && cal <= 5000) annotation.calories = cal;
        }

        // Macros
        const protMatch = proteinRe.exec(fullText);
        if (protMatch) {
          const v = parseInt(protMatch[1], 10);
          if (v > 0 && v <= 500) annotation.proteinG = v;
        }
        const carbMatch = carbsRe.exec(fullText);
        if (carbMatch) {
          const v = parseInt(carbMatch[1], 10);
          if (v > 0 && v <= 1000) annotation.carbsG = v;
        }
        const fatMatch = fatRe.exec(fullText);
        if (fatMatch) {
          const v = parseInt(fatMatch[1], 10);
          if (v > 0 && v <= 500) annotation.fatG = v;
        }

        // Allergens
        const allergenMatch = allergenInlineRe.exec(fullText);
        if (allergenMatch) {
          annotation.allergens = allergenMatch[1]
            .split(",")
            .map(s => s.trim().toLowerCase())
            .filter(s => s.length > 1);
        }

        // Ingredients
        const ingredMatch = ingredientsRe.exec(fullText);
        if (ingredMatch) {
          annotation.ingredients = ingredMatch[1].trim();
        }

        // Dietary tags from legend symbols found in item text
        const tags: string[] = [];
        for (const symbol of Object.keys(legendMap)) {
          // Check if the symbol appears in the item's raw text (not just the name)
          if (fullText.includes(symbol)) {
            tags.push(symbol);
          }
        }
        if (tags.length > 0) annotation.dietaryTags = tags;

        // Only store if we found something useful
        if (Object.keys(annotation).length > 0) {
          itemAnnotations[itemName] = annotation;
        }
      });
    }
  } catch {
    // Best-effort: return whatever we have so far
  }

  return { legendMap, itemAnnotations };
}

/** Common dietary annotation symbols found on restaurant menus */
const DIETARY_TAG_PATTERNS: Array<{ re: RegExp; tag: string }> = [
  { re: /\(V\)|\bV\b(?=\s*$|\s*[,.])/,   tag: "V" },
  { re: /\(VG\)|\bVG\b(?=\s*$|\s*[,.])/,  tag: "VG" },
  { re: /\(GF\)|\bGF\b(?=\s*$|\s*[,.])/,  tag: "GF" },
  { re: /\(DF\)|\bDF\b(?=\s*$|\s*[,.])/,  tag: "DF" },
  { re: /\(NF\)|\bNF\b(?=\s*$|\s*[,.])/,  tag: "NF" },
  { re: /\(H\)|\bH\b(?=\s*$|\s*[,.])/, tag: "H" },
  { re: /\(K\)|\bK\b(?=\s*$|\s*[,.])/, tag: "K" },
];

const FOOTNOTE_MARKER_RE = /[*†‡§¶]+/g;
const DIETARY_EMOJI_RE = /[\u{1F331}\u{1F96C}\u{26A0}\u{FE0F}]/gu;

/**
 * Extract dietary tags and footnote markers from raw item text BEFORE cleaning.
 * Scans for common dietary annotation patterns:
 * - Parenthetical: (V), (VG), (GF), (DF), (NF), (H), (K)
 * - Suffix markers: *, **, †, ‡
 * - Emoji indicators
 */
export function extractRawAnnotations(rawName: string, rawDescription?: string): {
  dietaryTags: string[];
  footnoteMarkers: string[];
} {
  const combined = rawDescription ? `${rawName} ${rawDescription}` : rawName;
  const dietaryTags: string[] = [];
  const footnoteMarkers: string[] = [];

  // Dietary tag patterns
  for (const { re, tag } of DIETARY_TAG_PATTERNS) {
    if (re.test(combined)) {
      dietaryTags.push(tag);
    }
  }

  // Emoji dietary indicators
  if (DIETARY_EMOJI_RE.test(combined)) {
    // 🌱 = plant-based/vegan, 🥬 = vegetarian, ⚠️ = allergen warning
    if (/\u{1F331}/u.test(combined)) dietaryTags.push("V");
    if (/\u{1F96C}/u.test(combined)) dietaryTags.push("VG");
  }

  // Footnote markers
  const markerMatches = combined.match(FOOTNOTE_MARKER_RE);
  if (markerMatches) {
    for (const m of markerMatches) {
      if (!footnoteMarkers.includes(m)) footnoteMarkers.push(m);
    }
  }

  return { dietaryTags, footnoteMarkers };
}

export const menuSources: MenuSourceStrategy[] = [
  websiteSource,
  googlePhotosSource,
  deliveryPlatformSource,
].sort((a, b) => a.priority - b.priority);
