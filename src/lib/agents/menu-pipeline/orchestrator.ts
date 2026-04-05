/**
 * Menu Pipeline Orchestrator — entry point for the refactored crawl pipeline.
 *
 * The old monolithic crawlRestaurant() is now split into 3 independent agents:
 *   1. Menu Scraper  — fetch + parse + store in MenuItem
 *   2. Menu Classifier — classify + promote to Dish
 *   3. Stale Archiver — archive items not seen this crawl
 *
 * The orchestrator queues the initial scrape job. The scrape worker chains
 * classify + archive on completion (same pattern as the old crawl-worker).
 *
 * BullMQ Flow isn't used here because we don't know the restaurantId until
 * after scraping completes — the scrape worker handles chaining via its
 * "completed" event handler.
 *
 * Priority tiers (from AGENTS.md):
 *   1 = user-triggered
 *   2 = user feedback
 *   5 = nightly scheduled
 *  10 = review aggregation
 *  20 = bulk stale re-crawl
 */

// ─── Single restaurant crawl ────────────────────────────

/**
 * Orchestrate a full crawl pipeline for a single restaurant.
 *
 * Queues a scrape job on the "menu-scrape" queue. The scrape worker will
 * chain classify + archive + photo analysis + delivery scrape + review
 * aggregation on completion.
 *
 * @param googlePlaceId - Google Places API place ID
 * @param priority - BullMQ priority (default 5 = nightly scheduled)
 * @returns The BullMQ job ID
 */
export async function orchestrateCrawl(
  googlePlaceId: string,
  priority = 5
): Promise<string> {
  const { menuScrapeQueue } = await import("../../../../workers/queues");

  const job = await menuScrapeQueue.add(
    `scrape-${googlePlaceId}`,
    { googlePlaceId },
    {
      jobId: `scrape-${googlePlaceId}`,
      priority,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    }
  );

  return job.id!;
}

// ─── Batch crawl ────────────────────────────────────────

/**
 * Orchestrate crawl pipelines for multiple restaurants at once.
 *
 * Uses addBulk() for a single Redis pipeline call instead of N round-trips.
 * Each job gets deduplication via jobId: `scrape-${googlePlaceId}`.
 *
 * @param googlePlaceIds - Array of Google Places API place IDs
 * @param priority - BullMQ priority (default 5 = nightly scheduled)
 * @returns Number of jobs queued
 */
export async function orchestrateBatchCrawl(
  googlePlaceIds: string[],
  priority = 5
): Promise<number> {
  if (googlePlaceIds.length === 0) return 0;

  const { menuScrapeQueue } = await import("../../../../workers/queues");

  await menuScrapeQueue.addBulk(
    googlePlaceIds.map((id) => ({
      name: `scrape-${id}`,
      data: { googlePlaceId: id },
      opts: {
        jobId: `scrape-${id}`,
        priority,
        attempts: 3,
        backoff: { type: "exponential" as const, delay: 5000 },
      },
    }))
  );

  return googlePlaceIds.length;
}

// ─── Classify-only (for re-classification without re-scraping) ──

/**
 * Queue a classify-only job for a restaurant.
 *
 * Useful when the auditor logic changes and existing MenuItems need
 * re-classification without re-scraping the website.
 *
 * @param restaurantId - Internal restaurant UUID
 * @param priority - BullMQ priority (default 5)
 * @returns The BullMQ job ID
 */
export async function orchestrateClassify(
  restaurantId: string,
  priority = 5
): Promise<string> {
  const { menuClassifyQueue } = await import("../../../../workers/queues");

  const job = await menuClassifyQueue.add(
    `classify-${restaurantId}`,
    { restaurantId },
    {
      jobId: `reclassify-${restaurantId}`,
      priority,
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
    }
  );

  return job.id!;
}

// ─── Archive-only (for manual stale cleanup) ────────────

/**
 * Queue an archive-only job for a restaurant.
 *
 * Useful for manual cleanup or when a restaurant has been confirmed closed.
 *
 * @param restaurantId - Internal restaurant UUID
 * @param crawlTimestamp - The reference timestamp (items older than this get archived)
 * @param source - Menu source to scope archival to
 * @param priority - BullMQ priority (default 20 = bulk stale re-crawl)
 * @returns The BullMQ job ID
 */
export async function orchestrateArchive(
  restaurantId: string,
  crawlTimestamp: Date,
  source: string,
  priority = 20
): Promise<string> {
  const { staleArchiveQueue } = await import("../../../../workers/queues");

  const job = await staleArchiveQueue.add(
    `archive-${restaurantId}`,
    {
      restaurantId,
      crawlTimestamp: crawlTimestamp.toISOString(),
      source,
    },
    {
      jobId: `manual-archive-${restaurantId}`,
      priority,
      attempts: 2,
      backoff: { type: "exponential", delay: 3000 },
    }
  );

  return job.id!;
}
