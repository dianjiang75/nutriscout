/**
 * Centralized DOM selectors for delivery platform scraping.
 *
 * Uses a 3-tier fallback strategy per element type:
 *   1. data-testid attributes (most stable across deploys)
 *   2. ARIA / semantic attributes
 *   3. Text content / CSS class patterns (least stable)
 *
 * When a selector tier succeeds, we log which tier was used so we can
 * monitor selector health over time and catch DOM changes early.
 */
import type { Page, Locator } from "playwright-core";

export type SelectorTier = "testid" | "aria" | "pattern";

interface SelectorResult<T> {
  tier: SelectorTier;
  data: T;
}

/** Try selectors in order, return first that finds elements. */
async function trySelectors(
  page: Page,
  selectors: { tier: SelectorTier; locator: Locator }[],
  minCount: number = 1
): Promise<{ tier: SelectorTier; locator: Locator } | null> {
  for (const s of selectors) {
    const count = await s.locator.count();
    if (count >= minCount) return s;
  }
  return null;
}

// ── DoorDash Selectors ──────────────────────────────────────────────

export const doordash = {
  /** Store search result cards. */
  storeCards(page: Page) {
    return trySelectors(page, [
      { tier: "testid", locator: page.locator('[data-testid="StoreCard"]') },
      { tier: "aria", locator: page.locator('[role="listitem"] a[href*="/store/"]') },
      { tier: "pattern", locator: page.locator('a[href*="/store/"][class*="StoreCard"], a[href*="/store/"][class*="store"]') },
    ]);
  },

  /** Menu item containers on a store page. */
  menuItems(page: Page) {
    return trySelectors(page, [
      { tier: "testid", locator: page.locator('[data-testid="MenuItem"], [data-testid="MenuItemCard"]') },
      { tier: "aria", locator: page.locator('[role="button"][data-anchor-id*="MenuItem"]') },
      { tier: "pattern", locator: page.locator('[class*="MenuItem"], [class*="menu-item"], [class*="ItemCard"]') },
    ]);
  },

  /** Extract item name from a menu item element. */
  async itemName(el: Locator): Promise<string | null> {
    // Try data-testid first
    const testid = el.locator('[data-testid="MenuItemName"], [data-testid="ItemName"]');
    if (await testid.count() > 0) return (await testid.first().textContent())?.trim() || null;

    // Try heading inside
    const heading = el.locator('h3, h4, [class*="name" i], [class*="title" i]');
    if (await heading.count() > 0) return (await heading.first().textContent())?.trim() || null;

    return null;
  },

  /** Extract item description. */
  async itemDescription(el: Locator): Promise<string | null> {
    const desc = el.locator('[data-testid="MenuItemDescription"], [class*="description" i], [class*="desc" i], p');
    if (await desc.count() > 0) return (await desc.first().textContent())?.trim() || null;
    return null;
  },

  /** Extract item price. */
  async itemPrice(el: Locator): Promise<number | null> {
    const price = el.locator('[data-testid="MenuItemPrice"], [class*="price" i]');
    if (await price.count() > 0) {
      const text = (await price.first().textContent())?.trim() || "";
      const match = text.match(/\d+(?:\.\d+)?/);
      return match ? parseFloat(match[0]) : null;
    }
    return null;
  },

  /** Extract item photo URL. */
  async itemPhoto(el: Locator): Promise<string | null> {
    const img = el.locator('img[src*="doordash"], img[src*="cdn"]');
    if (await img.count() > 0) return await img.first().getAttribute("src");
    return null;
  },

  /** Check if item has "Most Liked" or "Popular" badge. */
  async isMostLiked(el: Locator): Promise<boolean> {
    const badge = el.locator('[data-testid*="liked" i], [data-testid*="popular" i], [class*="liked" i], [class*="popular" i]');
    if (await badge.count() > 0) return true;
    // Text check
    const text = (await el.textContent()) || "";
    return /most liked|popular/i.test(text);
  },

  /** Extract thumbs up count / percentage. */
  async thumbsUpData(el: Locator): Promise<{ pct: number | null; count: number | null }> {
    const text = (await el.textContent()) || "";
    // DoorDash shows "X% (Y)" or "X% of customers liked this"
    const pctMatch = text.match(/(\d+)%/);
    const countMatch = text.match(/\((\d+)\)/);
    return {
      pct: pctMatch ? parseInt(pctMatch[1]) : null,
      count: countMatch ? parseInt(countMatch[1]) : null,
    };
  },

  /** Extract menu section/category name. */
  async sectionName(el: Locator, page: Page): Promise<string | null> {
    // Look for a preceding section header
    const section = el.locator('xpath=ancestor::*[contains(@class,"section") or contains(@class,"Section") or contains(@class,"category")]//h2 | ancestor::*[contains(@class,"section")]//h3');
    if (await section.count() > 0) return (await section.first().textContent())?.trim() || null;
    return null;
  },
};

// ── Uber Eats Selectors ─────────────────────────────────────────────

export const ubereats = {
  /** Store search result cards. */
  storeCards(page: Page) {
    return trySelectors(page, [
      { tier: "testid", locator: page.locator('[data-testid="store-card"], [data-testid="StoreCard"]') },
      { tier: "aria", locator: page.locator('a[href*="/store/"][role="link"]') },
      { tier: "pattern", locator: page.locator('a[href*="/store/"][class*="store"], a[href*="/store/"][class*="card"]') },
    ]);
  },

  /** Menu item containers on a store page. */
  menuItems(page: Page) {
    return trySelectors(page, [
      { tier: "testid", locator: page.locator('[data-testid="store-item-card"], [data-testid="menu-item"]') },
      { tier: "aria", locator: page.locator('[role="button"][data-testid*="item"]') },
      { tier: "pattern", locator: page.locator('[class*="menu-item"], [class*="MenuItem"], [class*="itemCard"]') },
    ]);
  },

  /** Extract item name from a menu item element. */
  async itemName(el: Locator): Promise<string | null> {
    const testid = el.locator('[data-testid="rich-text-component"], [data-testid="item-title"]');
    if (await testid.count() > 0) return (await testid.first().textContent())?.trim() || null;

    const heading = el.locator('h3, h4, span[class*="name" i], span[class*="title" i]');
    if (await heading.count() > 0) return (await heading.first().textContent())?.trim() || null;

    return null;
  },

  /** Extract item description. */
  async itemDescription(el: Locator): Promise<string | null> {
    const desc = el.locator('[class*="description" i], [class*="subtitle" i], p');
    if (await desc.count() > 0) return (await desc.first().textContent())?.trim() || null;
    return null;
  },

  /** Extract item price. */
  async itemPrice(el: Locator): Promise<number | null> {
    const price = el.locator('[data-testid*="price"], [class*="price" i]');
    if (await price.count() > 0) {
      const text = (await price.first().textContent())?.trim() || "";
      const match = text.match(/\d+(?:\.\d+)?/);
      return match ? parseFloat(match[0]) : null;
    }
    return null;
  },

  /** Extract item photo URL. */
  async itemPhoto(el: Locator): Promise<string | null> {
    const img = el.locator('img[src*="ubereats"], img[src*="cloudfront"], img[src*="cdn"]');
    if (await img.count() > 0) return await img.first().getAttribute("src");
    return null;
  },

  /** Check if item has "Popular" or "Liked" badge. */
  async isMostLiked(el: Locator): Promise<boolean> {
    const badge = el.locator('[data-testid*="popular" i], [data-testid*="liked" i], [class*="popular" i], [class*="badge" i]');
    if (await badge.count() > 0) return true;
    const text = (await el.textContent()) || "";
    return /popular|most liked|liked by \d+%/i.test(text);
  },

  /** Extract "Liked by X% (Y)" rating data. */
  async thumbsUpData(el: Locator): Promise<{ pct: number | null; count: number | null }> {
    const text = (await el.textContent()) || "";
    // Uber Eats shows "Liked by 92% (154)"
    const match = text.match(/(?:liked by\s+)?(\d+)%\s*(?:\((\d+)\))?/i);
    return {
      pct: match ? parseInt(match[1]) : null,
      count: match && match[2] ? parseInt(match[2]) : null,
    };
  },
};
