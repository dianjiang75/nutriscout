/** A menu item scraped from a delivery platform with per-item rating data. */
export interface DeliveryScrapedItem {
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  photoUrl: string | null;
  /** Thumbs up / liked percentage (0-100). Null if not displayed. */
  thumbsUpPct: number | null;
  /** Total number of ratings for this item. */
  ratingCount: number | null;
  /** Whether the item is tagged "Most Liked" or "Popular" on the platform. */
  isMostLiked: boolean;
  /** Platform-specific item tags like "Good portion", "Tasty", etc. */
  tags: string[];
}

/** Result of searching for a restaurant on a delivery platform. */
export interface DeliveryMatchResult {
  /** Platform URL for the restaurant's menu page. */
  platformUrl: string;
  /** Fuzzy match confidence (0-1). */
  matchConfidence: number;
  /** The name as it appears on the platform. */
  platformName: string;
  /** The address as shown on the platform. */
  platformAddress: string | null;
}

/** Combined scrape result for one restaurant on one platform. */
export interface PlatformScrapeResult {
  platform: "doordash" | "ubereats";
  match: DeliveryMatchResult | null;
  items: DeliveryScrapedItem[];
  /** Errors that occurred during scraping (non-fatal). */
  warnings: string[];
}

/** Full scrape result for one restaurant across all platforms. */
export interface DeliveryScrapeResult {
  restaurantId: string;
  restaurantName: string;
  platforms: PlatformScrapeResult[];
  /** Total unique items found across all platforms. */
  totalItemsScraped: number;
  /** Items matched to existing dishes in DB. */
  itemsMatchedToDishes: number;
  /** New dishes created from delivery data. */
  newDishesCreated: number;
}

/** Job data for the delivery-scrape BullMQ queue. */
export interface DeliveryScrapeJobData {
  restaurantId: string;
  /** Skip platforms where we already have fresh data. */
  skipFreshPlatforms?: boolean;
}
