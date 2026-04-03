import * as cheerio from "cheerio";
import { getGeminiClient, GEMINI_FLASH } from "@/lib/ai/clients";
import { SchemaType } from "@google/generative-ai";
import { extractJson } from "@/lib/utils/parse-json";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import type { MenuSourceStrategy, RawMenuItem, RestaurantInfo } from "./types";

const MENU_EXTRACTION_PROMPT = `This is a photo of a restaurant menu. Extract ALL menu items with:
- Item name
- Description (if any)
- Price (if visible)
- Section/category (e.g., "Appetizers", "Mains", "Desserts")

Return as JSON array:
[{"name": "string", "description": "string", "price": "string", "category": "string"}]

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
      return parseHtmlMenu(menuHtml);
    } catch {
      return null;
    }
  },
};

/**
 * Extract menu items from JSON-LD (Schema.org) structured data.
 * Many restaurant sites embed menu data as <script type="application/ld+json">.
 * This is the cleanest data source — exact names, prices, descriptions.
 */
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
                items.push({
                  name: item.name,
                  description: item.description || "",
                  price,
                  category,
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
                items.push({
                  name: item.name,
                  description: item.description || "",
                  price,
                  category,
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

      const priceText =
        $el.find(".price, [class*='price']").first().text().trim() || null;

      // Find the nearest preceding heading to use as category
      const closestSection = $el.closest("[class*='section'], [class*='category'], [data-category]");
      const sectionHeading = closestSection.find("h2, h3, [class*='heading'], [class*='title']").first().text().trim();
      // Also check preceding siblings for headings
      const prevHeading = $el.prevAll("h2, h3").first().text().trim()
        || $el.parent().prevAll("h2, h3").first().text().trim();
      const category = sectionHeading || prevHeading || null;

      items.push({
        name,
        description,
        price: priceText,
        category,
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

  return items;
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
                allItems.push(...parsed.map((item: RawMenuItem) => ({ ...item, photoUrl })));
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

export const menuSources: MenuSourceStrategy[] = [
  websiteSource,
  googlePhotosSource,
  deliveryPlatformSource,
].sort((a, b) => a.priority - b.priority);
