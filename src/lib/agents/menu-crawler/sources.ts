import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import type { MenuSourceStrategy, RawMenuItem, RestaurantInfo } from "./types";

const MENU_EXTRACTION_PROMPT = `This is a photo of a restaurant menu. Extract ALL menu items with:
- Item name
- Description (if any)
- Price (if visible)
- Section/category (e.g., "Appetizers", "Mains", "Desserts")

Return as JSON array:
[{"name": "string", "description": "string", "price": "string", "category": "string"}]

Return ONLY valid JSON, no markdown fences or extra text.`;

function getAnthropicClient(): Anthropic {
  return new Anthropic();
}

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
      const mainRes = await fetch(baseUrl, {
        headers: { "User-Agent": "FoodClaw/1.0 (menu-indexer)" },
        signal: AbortSignal.timeout(10000),
      });

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
            const menuRes = await fetch(menuUrl, {
              headers: { "User-Agent": "FoodClaw/1.0 (menu-indexer)" },
              signal: AbortSignal.timeout(10000),
            });
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
            const res = await fetch(`${baseUrl}${path}`, {
              headers: { "User-Agent": "FoodClaw/1.0 (menu-indexer)" },
              signal: AbortSignal.timeout(5000),
            });
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
                const price = item.offers?.price
                  || item.offers?.lowPrice
                  || item.price
                  || null;
                items.push({
                  name: item.name,
                  description: item.description || "",
                  price: price ? `$${price}` : null,
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
                items.push({
                  name: item.name,
                  description: item.description || "",
                  price: item.offers?.price ? `$${item.offers.price}` : null,
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
      // Get place details with photos
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${restaurant.googlePlaceId}&fields=photos&key=${apiKey}`;
      const detailsRes = await fetch(detailsUrl);
      if (!detailsRes.ok) return null;

      const details = await detailsRes.json();
      const photos = details.result?.photos || [];

      if (photos.length === 0) return null;

      // Get first few photos and send to Claude for menu extraction
      const allItems: RawMenuItem[] = [];
      const client = getAnthropicClient();

      for (const photo of photos.slice(0, 3)) {
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${photo.photo_reference}&key=${apiKey}`;

        try {
          const response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            messages: [
              {
                role: "user",
                content: [
                  { type: "image", source: { type: "url", url: photoUrl } },
                  { type: "text", text: MENU_EXTRACTION_PROMPT },
                ],
              },
            ],
          });

          const textBlock = response.content.find((b) => b.type === "text");
          if (textBlock && textBlock.type === "text") {
            const parsed = JSON.parse(textBlock.text);
            if (Array.isArray(parsed)) {
              allItems.push(...parsed.map((item: RawMenuItem) => ({ ...item, photoUrl })));
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
