/**
 * Uber Eats scraper: search for a restaurant and extract per-item ratings.
 *
 * Uber Eats shows:
 * - "Liked by X% (N)" on each item
 * - "Popular" badge
 * - Item photos, descriptions, prices
 */
import type { Page } from "playwright-core";
import { ubereats as sel } from "./selectors";
import { createScrapeContext, humanDelay, scrollToLoadAll } from "./browser-pool";
import { findBestMatch, type MatchCandidate } from "./match-restaurant";
import type { DeliveryScrapedItem, DeliveryMatchResult, PlatformScrapeResult } from "./types";

const UBEREATS_BASE = "https://www.ubereats.com";
const NAV_TIMEOUT = 30_000;

/**
 * Search Uber Eats for a restaurant and scrape its menu items with ratings.
 */
export async function scrapeUberEats(
  restaurantName: string,
  restaurantAddress: string,
  lat: number,
  lng: number,
  existingPlatformUrl?: string | null
): Promise<PlatformScrapeResult> {
  const warnings: string[] = [];
  const context = await createScrapeContext();

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT);

    let match: DeliveryMatchResult | null = null;

    if (existingPlatformUrl) {
      match = {
        platformUrl: existingPlatformUrl,
        matchConfidence: 1,
        platformName: restaurantName,
        platformAddress: null,
      };
    } else {
      match = await searchRestaurant(page, restaurantName, restaurantAddress, lat, lng);
    }

    if (!match) {
      return { platform: "ubereats", match: null, items: [], warnings: ["No match found on Uber Eats"] };
    }

    await page.goto(match.platformUrl, { waitUntil: "domcontentloaded" });
    await humanDelay();

    // Check for block/CAPTCHA
    const pageText = await page.textContent("body");
    if (pageText && /verify you are human|access denied|blocked/i.test(pageText)) {
      return {
        platform: "ubereats",
        match,
        items: [],
        warnings: ["CAPTCHA or block page detected"],
      };
    }

    await scrollToLoadAll(page, 15);

    const items = await extractMenuItems(page, warnings);

    return { platform: "ubereats", match, items, warnings };
  } catch (err) {
    return {
      platform: "ubereats",
      match: null,
      items: [],
      warnings: [`Uber Eats scrape error: ${(err as Error).message}`],
    };
  } finally {
    await context.close();
  }
}

async function searchRestaurant(
  page: Page,
  name: string,
  address: string,
  lat: number,
  lng: number
): Promise<DeliveryMatchResult | null> {
  const encodedName = encodeURIComponent(name);
  const searchUrl = `${UBEREATS_BASE}/search?q=${encodedName}&pl=${lat},${lng}`;

  await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
  await humanDelay();

  const storeResult = await sel.storeCards(page);
  if (!storeResult) return null;

  const { locator } = storeResult;
  const count = Math.min(await locator.count(), 5);

  const candidates: MatchCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const card = locator.nth(i);
    const cardName = (await card.textContent())?.split("\n")[0]?.trim() || "";
    const href = await card.locator("a[href*='/store/']").first().getAttribute("href").catch(() => null)
      || await card.getAttribute("href");

    if (cardName && href) {
      candidates.push({
        name: cardName,
        address: null,
        url: href.startsWith("http") ? href : `${UBEREATS_BASE}${href}`,
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
    warnings.push("No menu items found on Uber Eats page");
    return [];
  }

  const { locator, tier } = menuResult;
  const count = await locator.count();
  warnings.push(`Uber Eats: found ${count} items via ${tier} selectors`);

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
        category: null, // Uber Eats sections are harder to map
        photoUrl,
        thumbsUpPct: thumbsUp.pct,
        ratingCount: thumbsUp.count,
        isMostLiked: mostLiked,
        tags: [],
      });
    } catch {
      // Skip individual item errors
    }
  }

  return items;
}
