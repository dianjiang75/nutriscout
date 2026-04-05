/**
 * Stale Archiver Agent — archive items not seen in the recent crawl.
 *
 * Extracted from crawlRestaurant() step 5. This agent is responsible for:
 *   1. Counting active MenuItems for a restaurant + source
 *   2. Counting items seen in the current crawl (lastSeenAt >= crawlTimestamp)
 *   3. CIRCUIT BREAKER: if seen < 20% of active, skip archiving
 *   4. Otherwise: soft-archive items where lastSeenAt < crawlTimestamp
 *
 * Depends on: MenuItem records already updated by the Menu Scraper agent
 * (specifically the lastSeenAt timestamp set during upsert).
 */

import { prisma } from "@/lib/db/client";

// ─── Types ──────────────────────────────────────────────

export interface ArchiveResult {
  restaurantId: string;
  itemsArchived: number;
  circuitBreakerTripped: boolean;
}

// ─── Main archive function ──────────────────────────────

/**
 * Archive stale MenuItems that weren't seen in the most recent crawl.
 *
 * CIRCUIT BREAKER: If the current crawl found < 20% of previously active
 * items, the scraper likely failed — we skip archiving entirely to prevent
 * a bad scrape from mass-archiving the entire menu.
 *
 * @param restaurantId - The restaurant to process
 * @param crawlTimestamp - When the scrape started (items with lastSeenAt >= this are "seen")
 * @param source - The menu source to scope archival to (e.g., "website")
 */
export async function archiveStaleItems(
  restaurantId: string,
  crawlTimestamp: Date,
  source: string
): Promise<ArchiveResult> {
  // Map source string to the enum values used in the DB
  const sourceEnum = mapSourceToEnum(source);

  // Count currently active (non-archived) items for this restaurant + source
  const previousActiveCount = await prisma.menuItem.count({
    where: {
      restaurantId,
      source: sourceEnum,
      archivedAt: null,
    },
  });

  // Count items seen in this crawl (lastSeenAt updated during scrape)
  const seenThisCrawl = await prisma.menuItem.count({
    where: {
      restaurantId,
      source: sourceEnum,
      archivedAt: null,
      lastSeenAt: { gte: crawlTimestamp },
    },
  });

  // CIRCUIT BREAKER: if seen < 20% of active count, skip archiving
  const archiveThreshold = Math.max(previousActiveCount * 0.2, 3);

  if (previousActiveCount > 0 && seenThisCrawl < archiveThreshold) {
    console.warn(
      `[stale-archiver] CIRCUIT BREAKER: Found only ${seenThisCrawl} items (of ${previousActiveCount} active) ` +
        `for restaurant ${restaurantId}. Skipping stale archival — scraper may have failed.`
    );
    return {
      restaurantId,
      itemsArchived: 0,
      circuitBreakerTripped: true,
    };
  }

  // Archive items from this source that weren't seen in this crawl
  const { count: archivedCount } = await prisma.menuItem.updateMany({
    where: {
      restaurantId,
      source: sourceEnum,
      archivedAt: null,
      lastSeenAt: { lt: crawlTimestamp },
    },
    data: {
      archivedAt: new Date(),
      archivedReason: "menu_removed",
    },
  });

  if (archivedCount > 0) {
    console.log(
      `[stale-archiver] Archived ${archivedCount} stale items for restaurant ${restaurantId}`
    );
  }

  return {
    restaurantId,
    itemsArchived: archivedCount,
    circuitBreakerTripped: false,
  };
}

// ─── Source enum mapping ────────────────────────────────

type MenuItemSourceEnum =
  | "website"
  | "google_photos"
  | "delivery_platform"
  | "compliance_page"
  | "manual"
  | "backfill";

function mapSourceToEnum(source: string): MenuItemSourceEnum {
  const map: Record<string, MenuItemSourceEnum> = {
    website: "website",
    google_photos: "google_photos",
    delivery_platform: "delivery_platform",
    compliance_page: "compliance_page",
    manual: "manual",
  };
  return map[source] || "website";
}
