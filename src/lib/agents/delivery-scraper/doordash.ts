/**
 * DoorDash scraper: search for a restaurant and extract per-item ratings.
 *
 * DoorDash shows:
 * - "Most Liked" badge on top 3 items
 * - Thumbs up % and count on each item (when enough ratings)
 * - Item photos, descriptions, prices
 */
import type { Page } from "playwright-core";
import { doordash as sel } from "./selectors";
import { createScrapeContext, humanDelay, scrollToLoadAll, quickDelay } from "./browser-pool";
import { findBestMatch, type MatchCandidate } from "./match-restaurant";
import type { DeliveryScrapedItem, DeliveryMatchResult, PlatformScrapeResult } from "./types";

const DOORDASH_BASE = "https://www.doordash.com";
const NAV_TIMEOUT = 30_000;

/**
 * Search DoorDash for a restaurant and scrape its menu items with ratings.
 */
export async function scrapeDoorDash(
  restaurantName: string,
  restaurantAddress: string,
  existingPlatformUrl?: string | null
): Promise<PlatformScrapeResult> {
  const warnings: string[] = [];
  const context = await createScrapeContext();

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT);

    let match: DeliveryMatchResult | null = null;

    if (existingPlatformUrl) {
      // Use cached URL
      match = {
        platformUrl: existingPlatformUrl,
        matchConfidence: 1,
        platformName: restaurantName,
        platformAddress: null,
      };
    } else {
      // Search for the restaurant
      match = await searchRestaurant(page, restaurantName, restaurantAddress);
    }

    if (!match) {
      return { platform: "doordash", match: null, items: [], warnings: ["No match found on DoorDash"] };
    }

    // Navigate to the store page
    await page.goto(match.platformUrl, { waitUntil: "domcontentloaded" });
    await humanDelay();

    // Check for CAPTCHA or block page
    const pageText = await page.textContent("body");
    if (pageText && /verify you are human|access denied|blocked/i.test(pageText)) {
      return {
        platform: "doordash",
        match,
        items: [],
        warnings: ["CAPTCHA or block page detected"],
      };
    }

    // Scroll to load all menu sections
    await scrollToLoadAll(page, 15);

    // Extract menu items
    const items = await extractMenuItems(page, warnings);

    return { platform: "doordash", match, items, warnings };
  } catch (err) {
    return {
      platform: "doordash",
      match: null,
      items: [],
      warnings: [`DoorDash scrape error: ${(err as Error).message}`],
    };
  } finally {
    await context.close();
  }
}

async function searchRestaurant(
  page: Page,
  name: string,
  address: string
): Promise<DeliveryMatchResult | null> {
  const encodedName = encodeURIComponent(name);
  const searchUrl = `${DOORDASH_BASE}/search/store/${encodedName}/`;

  await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
  await humanDelay();

  // Wait for store cards to appear
  const storeResult = await sel.storeCards(page);
  if (!storeResult) return null;

  const { locator } = storeResult;
  const count = Math.min(await locator.count(), 5); // Check top 5 results

  const candidates: MatchCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const card = locator.nth(i);
    const cardName = (await card.textContent())?.split("\n")[0]?.trim() || "";
    const href = await card.locator("a[href*='/store/']").first().getAttribute("href").catch(() => null)
      || await card.getAttribute("href");
    const cardAddress = null; // DoorDash cards don't always show full address

    if (cardName && href) {
      candidates.push({
        name: cardName,
        address: cardAddress,
        url: href.startsWith("http") ? href : `${DOORDASH_BASE}${href}`,
      });
    }
  }

  const best = findBestMatch(name, address, candidates);
  if (!best) return null;

  return {
    platformUrl: best.candidate.url,
    matchConfidence: best.compositeScore,
    platformName: best.candidate.name,
    platformAddress: best.candidate.address,
  };
}

async function extractMenuItems(
  page: Page,
  warnings: string[]
): Promise<DeliveryScrapedItem[]> {
  const menuResult = await sel.menuItems(page);
  if (!menuResult) {
    warnings.push("No menu items found on DoorDash page");
    return [];
  }

  const { locator, tier } = menuResult;
  const count = await locator.count();
  warnings.push(`DoorDash: found ${count} items via ${tier} selectors`);

  const items: DeliveryScrapedItem[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const el = locator.nth(i);
      const name = await sel.itemName(el);
      if (!name) continue;

      const [description, price, photoUrl, mostLiked, thumbsUp] = await Promise.all([
        sel.itemDescription(el),
        sel.itemPrice(el),
        sel.itemPhoto(el),
        sel.isMostLiked(el),
        sel.thumbsUpData(el),
      ]);

      items.push({
        name,
        description,
        price,
        category: await sel.sectionName(el, page),
        photoUrl,
        thumbsUpPct: thumbsUp.pct,
        ratingCount: thumbsUp.count,
        isMostLiked: mostLiked,
        tags: [],
      });
    } catch {
      // Skip individual item errors, continue to next
    }
  }

  return items;
}
