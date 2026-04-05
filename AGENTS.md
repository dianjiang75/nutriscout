<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# FoodClaw Agent Architecture

## Core Agents (in codebase)

### 1. Vision Analyzer (`src/lib/agents/vision-analyzer/`)
- Analyzes food photos using Gemini Flash vision model (NOT Claude — migrated; `import { getGeminiClient, GEMINI_FLASH }` in index.ts)
- Estimates macros (calories, protein, carbs, fat) as ranges (min/max)
- Returns confidence scores and dietary flag inferences
- Model: `GEMINI_FLASH` (Gemini Flash) for cost efficiency; Claude Haiku import is legacy/unused

### 2. Menu Crawler (`src/lib/agents/menu-crawler/`)
- **Two-tier storage**: MenuItem (complete menu archive) → Dish (promoted dish cards only)
- 5-step pipeline: Scrape → Store in MenuItem → Classify → Promote to Dish → Archive stale
- Crawls from 3 sources: website HTML, Google Maps photos, delivery platforms (stub)
- **MenuItem table** stores EVERYTHING from the menu (sides, drinks, add-ons) with soft-delete
- **Dish table** only gets promoted items: main dishes, desserts, interesting beverages
- Pre-tagging at scrape time: `isWineOrSpirit()` → drink, `isDessertItem()` → dessert, `isComboOrMealDeal()` → combo, `isKidsMenuItem()` → kids
- Items not pre-tagged go through Gemini auditor for classification; fail-open at confidence 0.8
- Circuit breaker: if crawl returns < 20% of known items, skip stale archival (prevents scraper failure from mass-archiving)
- Allergen extraction from HTML footnotes/legends BEFORE name cleaning strips markers
- Nutrition extraction (calories, macros) from menu HTML when restaurant publishes them
- Uses Claude Sonnet for dietary flag analysis on promoted dishes only (safety-critical)
- CRITICAL: dietary flags use conservative defaults — `null` (unknown) not `true` when uncertain
- Delete protection: Prisma middleware converts `delete`/`deleteMany` on MenuItem to soft-delete
- `onDelete: Restrict` on Restaurant → MenuItem (prevents cascade data loss)

### 3. Review Aggregator (`src/lib/agents/review-aggregator/`)
- Summarizes dish-specific reviews from Google and Yelp
- Extracts sentiment, common praises, complaints, dietary warnings
- Links review data to individual dishes, not just restaurants

### 4. Logistics Poller (`src/lib/agents/logistics-poller/`)
- Polls foot traffic data (Google Popular Times patterns)
- Tracks estimated wait times by day-of-week and hour
- Delivery platform availability (stub — returns mock data)

### 5. Search Orchestrator (`src/lib/orchestrator/`)
- Main search pipeline: query → cache check → DB query → logistics → evaluation → cache store
- Applies dietary filters, macro filters, text search, category/cuisine filters
- Uses Redis semantic cache for repeat queries

### 6. Apollo Evaluator (`src/lib/evaluator/`)
- Post-search dietary safety verification layer
- Removes unsafe dishes, adds warning labels to uncertain ones
- Allergy-critical restrictions (nut_free, gluten_free) require explicit `true` + 85%+ confidence

## Automation Agents (skills)

### 7. Learning Agent (`/learn` skill)
- Runs nightly at 2 AM via macOS launchd
- Researches: Frontend, Backend, Competitors, Market, Design, Nutrition, Food Tech
- Writes structured digests to `agent-workspace/learning-digests/`
- Each finding includes risk tier, impact/effort/urgency scores, target files

### 8. Improvement Agent (`/improve` skill)
- Runs nightly at 4 AM via macOS launchd
- Reads latest digests, measures baseline metrics (tsc, lint, tests, bundle size)
- Implements GREEN/YELLOW tier changes, validates each individually
- Reverts on failure, writes improvement log with before/after metrics

### 9. Discovery Agent (`/discovery` skill)
- Runs nightly at 2 AM as AGENT 0 (first in the nightly-agents sequence, before /pipeline)
- Scans `DiscoveryArea` records for areas due for re-scan (based on `discoveryIntervalDays`)
- Calls Google Places Nearby Search to find restaurants NOT yet in the DB
- Queues new restaurants for crawl via BullMQ FlowProducer (priority 5 = nightly scheduled)
- Researches coverage gaps, adds new discovery areas for trending neighborhoods
- Script: `scripts/nightly-discovery.ts` (supports `--dry-run`, `--max-areas N`, `--max-restaurants N`)
- API: `GET/POST /api/discover/areas` for managing discovery targets
- Seed: `scripts/seed-discovery-areas.ts` (20 NYC neighborhoods + Denver test market)
- Budget caps: MAX_AREAS=10, MAX_RESTAURANTS=50 per run to control Google Places API costs

### 10. Delivery Scraper (`src/lib/agents/delivery-scraper/`)
- Scrapes DoorDash + Uber Eats for per-item dish ratings (thumbs up %, "Most Liked" tags)
- Uses Playwright headless Chromium with stealth (UA rotation, webdriver flag removal)
- Browser pool: singleton browser, new BrowserContext per scrape, auto-restart after 50 contexts
- Selector strategy: 3-tier fallback (data-testid → ARIA → CSS pattern) in centralized `selectors.ts`
- Restaurant matching: Dice coefficient on name bigrams (0.6 weight) + address similarity (0.4), threshold 0.7
- Creates new Dish records for items found on delivery platforms but not in website crawl
- Writes to ReviewSummary: `doordashThumbsUpPct`, `ubereatsThumbsUpPct`, `isMostLiked`
- Worker: `delivery-worker.ts` — concurrency 1, rate 2/min
- Script: `scripts/nightly-delivery-scrape.ts` (supports `--dry-run`, `--max N`)
- Pipeline: runs AFTER menu crawl, BEFORE review aggregation (FlowProducer chains them)
- Budget: 50 restaurants/night, ~25 min at 2/min

### 11. User Test Agent (`/user-test` skill)
- Runs nightly at 6 AM via macOS launchd, after learn and improve complete
- Simulates 5 customer personas end-to-end via real API calls:
  - **Explorer Emma** — browses categories, searches, tests navigation and empty states
  - **Protein Pete** — max protein sort, macro filtering, nutritional goal accuracy
  - **Allergy Alice** — nut-free + gluten-free safety, evaluator thresholds, false positives (SAFETY CRITICAL)
  - **Speedy Sam** — wait time sort, distance filtering, delivery data
  - **Foodie Fiona** — reviews, photos, macro source transparency, dish detail completeness
- Writes reports to `agent-workspace/user-test-reports/` and maintains BACKLOG.md
- CRITICAL/MAJOR issues feed back as top-priority items for the next /learn and /improve cycle

## Discovered Patterns

- Dietary flags in DB are JSONB with path queries: `dietaryFlags: { path: [key], equals: true }`
- Redis cache keys: `query:{hash}` for search results
- All macro values stored as Decimal in Prisma, cast to Number in API responses
- Menu source priority: website HTML > Google Photos > delivery platforms
- `getSourceIcon()` returns JSX elements (not component references) to avoid React render-phase component creation
- `optimizePackageImports: ["lucide-react"]` in next.config.ts for tree-shaking
- Profile page uses `next/link` `<Link>` for internal nav (not `<a>`)
- Cache key for search must include `searchText`, `categories`, `sortBy` — not just dietary + geo
- BullMQ job deduplication via `jobId: crawl-${googlePlaceId}` and `jobId: photo-${dishId}`
- USDA ingredient matching uses synonym map (e.g., "shrimp" → "shrimp, cooked") in `usda/client.ts`
- API routes use `apiSuccess()`/`apiError()` from `src/lib/utils/api-response.ts` for consistent responses
- UUID validation on path params via regex before Prisma query (prevents DB errors on bad IDs)
- Worker files use singleton PrismaClient (module-level), not per-job instantiation
- `viewportFit: "cover"` in layout.tsx is required for iOS safe-area-inset CSS to work
- Price parsing: use `parsePriceString()` for ranges, "Market Price", "$$$" — never raw `parseFloat`
- Vision batch analysis uses `Promise.allSettled` with `CONCURRENCY=3` — tests must account for non-sequential execution
- `DishCardData` interface (dish-card.tsx) does NOT have a `warnings` field — evaluator warnings are dropped in page.tsx mapping (known gap, needs fix)
- `NutritionalGoals.priority` union: `"max_protein" | "min_calories" | "min_fat" | "min_carbs" | "balanced"` — no GLP-1 option yet
- Sesame allergen handled via keyword matching in evaluator (no dedicated `sesame_free` dietary flag)
- USDA_SYNONYMS map in `src/lib/usda/client.ts` has 100+ entries (expanded 2026-04-02); includes prep-aware calorie multipliers
- `estimateMacros()` now accepts optional `preparationMethod` — applies frying/steaming multiplier to calories and fat
- pgvector hnsw iterative_scan not yet enabled — dietary-filtered vector search may underreturn on sparse categories
- GIN index on `dietaryFlags` JSONB not yet in schema — needs raw SQL migration (Prisma can't express jsonb_path_ops indexes)
- Next.js 16.2: caching is fully opt-in — all `fetch()` calls in Server Components must have explicit cache/revalidate options or they run fresh per request
- Prisma provider is already `"prisma-client"` (Prisma 7 migration done) — `compilerBuild = "fast"` not yet set
- Rate limiter uses atomic Redis Lua script (sliding window) — no race conditions under concurrency
- BullMQ queues have `removeOnComplete: 100` / `removeOnFail: 500` to prevent Redis memory bloat
- Evaluator `KNOWN_ALLERGEN_DISHES` map: dishes like Pad Thai claiming nut_free need 0.9+ confidence (not 0.85)
- Evaluator allergen keywords include singular AND plural forms ("peanut" + "peanuts")
- Allergens= code path applies same ALLERGY_CRITICAL_MIN confidence gate as dietary restrictions
- Orchestrator geo pre-filter: `getRestaurantIdsWithinRadius()` runs before Prisma query when lat/lng/radius provided
- Restaurant diversity cap: max 3 dishes per restaurant, preserves sort order (no interleaving)
- `next.config.ts` images: wildcard `**` pattern removed (was open proxy); AVIF format enabled
- Gemini vision uses `responseSchema` with `SchemaType` enum for guaranteed structured output
- Jest: `jose` is mocked via `__mocks__/jose.ts` + `moduleNameMapper` (ESM-only package)
- All API routes use `apiSuccess()`/`apiError()` envelope: `{ success: true, data: ... }` or `{ success: false, error: ... }`
- Tests must check `body.data.X` for success responses (not `body.X`)
- Gemini model upgrade path: current `GEMINI_FLASH` constant likely points to `gemini-1.5-flash`; upgrade target is `gemini-2.5-flash` (GA, 25% better on Nutrition5k benchmark). Do NOT use `gemini-2.5-flash-image` suffix — has known structured output bug (GitHub issue #1028 in google-gemini/cookbook)
- DietAI24 RAG pattern (Nature 2025): best-practice vision nutrition — inject USDA calorie values for identified ingredients INTO the Gemini prompt context BEFORE asking for macro estimates, not post-hoc. Reduces MAE by 63–83%. Target: `vision-analyzer/index.ts` + `usda/client.ts`
- California allergen law (effective July 1, 2026): CA restaurants must post allergen data on menu or QR-linked page. Machine-readable source FoodClaw can crawl. Tag dishes `source: "compliance_page"` as highest dietary flag confidence. Target: `menu-crawler/index.ts`
- Yelp Menu Vision (Oct 21, 2025): AR camera overlay on printed menus showing dish photos — works at-table only, no macro data, no dietary safety. FoodClaw differentiator: pre-decision, verified macros, Apollo Evaluator safety layer.
- Nutritionix geo-aware API: accepts lat/lng, returns nutrition data for 200K+ restaurant locations — useful fallback for branded chain dishes where USDA FDC is sparse
- GLP-1 filter is URGENT (Apr 2026): major restaurant chains (Shake Shack, Chipotle, Subway) now labeling menu items "GLP-1 Friendly". Add `"glp1_friendly"` to `NutritionalGoals.priority` union mapping to `{ protein_min_g: 25, calories_max: 500, fiber_boost: true }`. Also add pattern matching in Menu Crawler for "GLP-1 friendly" labels.
- Spokin verified restaurant model: restaurants answer 27-question allergy FAQ to get verified status. Spokin's public data can be used as confidence signal booster for our Apollo Evaluator (where they say nut-free certified, elevate our confidence score)
- pgvector sparse-collection HNSW fix: when dietary filters reduce candidate set below ~500 dishes, either enable `SET hnsw.ef_search = 200` per-query or run dietary pre-filter in Prisma first then vector re-rank on the filtered subset (avoids sparse HNSW degradation, same issue OpenTable encountered and solved with Qdrant)
- pgvector iterative scan: `SET hnsw.iterative_scan = relaxed_order` before vector queries is the canonical fix for dietary-filtered underreturn (pgvector 0.8.0+); `relaxed_order` has best perf; `strict_order` preserves exact distance ordering but is slower; `off` is legacy default
- GIN index on `dietaryFlags` must use `jsonb_path_ops` operator class for 36x smaller index and faster `@>` containment queries; add via raw SQL in post-migrate.sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dishes_dietary_flags ON dishes USING GIN (dietary_flags jsonb_path_ops)`
- `fullTextSearchDishes()` in geo.ts should use `websearch_to_tsquery()` (not manual `word & word` join) — handles quoted food names, optional terms, and foreign dish names; current manual construction breaks on single-word queries
- Prisma 7.4 query caching: add `compilerBuild = "fast"` to generator block in schema.prisma to enable plan caching; reduces per-query compilation from 0.1–1ms to 1–10µs; not yet set
- earthdistance GiST expression index: `CREATE INDEX idx_restaurants_geo ON restaurants USING gist(ll_to_earth(latitude::float, longitude::float))` required for geo pre-filter to use index scan; without it, `earth_box @>` does seq scan
- Next.js 16: `use cache` directive + `unstable_cacheTag('restaurant:{id}')` is correct pattern for dish/restaurant detail pages; `revalidateTag()` in Server Action invalidates on crawl complete
- BullMQ Flows (`FlowProducer`): correct pattern for crawl → vision → USDA pipeline chains where parent waits for all children; parent receives child results via `job.getChildrenValues()`
- BullMQ priority tiers: 1=user-triggered, 2=user feedback, 5=nightly scheduled, 10=review aggregation, 20=bulk stale re-crawl; priority aging (boost by 1 after 5min wait) prevents low-priority starvation
- Redis tag-based invalidation: maintain `restaurant-cache-refs:{restaurantId}` Redis SET of cache keys; on crawl complete DEL all members then the set itself
- Hybrid RRF search: combining FTS (GIN) + vector (HNSW) via Reciprocal Rank Fusion (k=60) outperforms either alone; implement in `src/lib/similarity/` when vector search is active
- GIN trgm index on `dishes.name` (`gin_trgm_ops`) speeds up `findDishesByNameSimilarity()` — currently performs seq scan for `similarity() > 0.2` threshold checks
- For dietary safety caching (nut_free, gluten_free): never serve semantically cached results from different dietary restriction combos — partition semantic cache by dietary restriction hash
- Discovery areas stored in `discovery_areas` table; nightly script filters by `discoveryIntervalDays` in JS (Prisma can't express date arithmetic in WHERE)
- Discovery dedup: script loads all `googlePlaceId`s into a Set before scanning, also adds to the Set during scan to prevent cross-area duplicates
- Discovery FlowProducer job name: `discovery-{areaId}` with children `discovery-crawl` on `menu-crawl` queue
- Discovery area duplicate check uses coordinate proximity (0.01 degrees ~1km) OR case-insensitive name match
- Yelp business match in nightly-discovery.ts requires city/state extracted from Google `formattedAddress` — parse as comma-separated parts: `[street, city, stateZip, country]`
- Evaluator ALLERGEN_TO_FLAG: eggs must NOT map to `dairy_free` — eggs are not dairy. Use keyword-only matching for egg allergen since no `egg_free` flag exists
- Vision analyzer ensemble confidence formula: `base * (1 + log2(n)/10)` gives ~7% boost per additional photo; original `base * (1 - 1/sqrt(n))` was unusably low for n=2
- JSON-LD menu price parsing: always check `String(price).startsWith("$")` before prepending `$` to avoid `$$12.99`
- `pickBestMatch()` in usda/client.ts can return null — always null-check before using result
- Redis `lazyConnect: true` requires explicit `.connect()` call to surface misconfigurations at startup instead of on first query
- Rate limiter sorted set member should use monotonic counter `${now}:${++counter}` not `Math.random()` for guaranteed uniqueness
- Production logger MIN_LEVEL should be `info` (not `warn`) so normal API requests are visible in monitoring; configurable via `LOG_LEVEL` env var
- post-migrate.sql: `idx_dishes_macro_source`, `idx_delivery_last_checked`, `idx_dishes_low_confidence` indexes added for macro quality sorting, delivery staleness, and re-analysis targeting
- Button component in shadcn/ui does NOT support `asChild` prop — use `<Link><Button>` wrapping pattern instead
- Gemini 2.5 Flash GA confirmed (April 2026): use model ID `gemini-2.5-flash` (already set correctly in clients.ts). Do NOT use `gemini-2.5-flash-image` — structured output bug. Context window: 1M tokens, 3000 images/prompt.
- `responseSchema` in vision-analyzer is duplicated verbatim in `analyzeFoodPhoto()` and `analyzeFoodPhotoFromBuffer()` — extract to module-level `VISION_RESPONSE_SCHEMA` constant to avoid maintenance drift
- DietAI RAG pattern NOT YET IMPLEMENTED in code: current vision analyzer does USDA lookup post-hoc (after Gemini returns ingredients). Correct approach: (1) lightweight Gemini pass to identify ingredients, (2) look up USDA per-100g calorie densities, (3) inject those values as context into main Gemini prompt. Expected MAE reduction: 63-83%. Target: `vision-analyzer/index.ts`
- CalCam (Polyverse/Google) two-pass validation: after primary Gemini analysis, run a second Gemini call asking it to verify its own macro output against nutritional logic (e.g., flag a 2000-calorie salad). Reduces gross errors ~10-15%. Cost: 2x API calls per photo.
- Vision prompt already uses plate/bowl reference cues for portion estimation (aligned with best practice for no-hardware systems). Gap: no explicit food height/depth field in schema — add `height_cm` to capture tall layered dishes (burgers, sandwiches, stacked plates).
- Nutritionix API (200K+ US restaurant locations, dietitian-verified) is higher accuracy than USDA generic for branded chain dishes. Plan: add `getNutritionixMacros()` to `usda/client.ts` as fallback when chain restaurant context is known. Needs `NUTRITIONIX_APP_ID` + `NUTRITIONIX_API_KEY` env vars.
- April 2026 USDA FDC Foundation Foods additions: mayonnaise, salad dressings, peanut butter, condensed milk, edamame (upgraded), canned beans. Add to USDA_SYNONYMS in `usda/client.ts`: ranch, caesar dressing, vinaigrette, blue cheese dressing, italian dressing, balsamic (high-frequency hidden calorie sources in restaurant salads).
- Vision allergen inference: photo-based allergen detection has high false negative rate for hidden allergens (cross-contamination, sauces). Vision analyzer should add `potential_allergens` field to response schema as advisory signal only — Apollo Evaluator continues to own all hard safety decisions.
- Competitor accuracy benchmarks (2026): PlateLens ±1.2% MAPE (uses depth sensor), MyFitnessPal ±18%, Bitesnap ±34%. FoodClaw's ±20-50% ranges are honest. Target: narrow high-confidence tier to ±15% by implementing DietAI RAG (above).
- Delivery scraper uses `playwright-core` (not `playwright`) — keeps package small (~2MB), browser installed separately via `npx playwright install chromium`
- Delivery scraper browser pool: module-level singleton, auto-restarts after 50 BrowserContexts, stealth via UA rotation + webdriver flag removal
- Delivery scraper selectors are centralized in `selectors.ts` — single file to update when platforms change their DOM
- `isWineOrSpirit()` in `clean-dish-name.ts` detects wines (grape names, vintage years, wine categories), spirits (brand listings + aging terms), beers (IPA/lager/stout patterns). Preserves dishes with spirit words + food context ("Vodka Rigatoni"), cocktails ("Tequila Sunrise"), and food items in drink categories
- `isDishWorthRecommending()` + `isWineOrSpirit()` are wired into the crawl pipeline and also used by the delivery scraper to filter junk at ingestion time
- Yelp reviews use GraphQL API (not REST `/reviews` endpoint which is deprecated/403). Requires `Accept-Language: en_US` header. Daily points limit resets at midnight GMT.
- Yelp Business IDs populated via `scripts/match-yelp-ids.ts` — uses Business Match → Business Search fallback. 129/130 restaurants matched.
- ReviewSummary now has delivery rating columns: `doordashThumbsUpPct`, `doordashReviewCount`, `ubereatsThumbsUpPct`, `ubereatsReviewCount`, `isMostLiked`, `lastDeliveryRatingUpdate`
- Review aggregator `summarizeDishReviews()` accepts optional `DeliveryRatingContext` — delivery platform ratings are injected into the LLM prompt as additional context (no extra API call)
- `VISION_RESPONSE_SCHEMA` is now a module-level `Schema` typed constant in vision-analyzer/index.ts — use it for both `analyzeFoodPhoto()` and `analyzeFoodPhotoFromBuffer()`. Do NOT use `as const` on Gemini schemas — `required: string[]` must be mutable, not readonly.
- Review aggregator `aggregateReviews()` now uses `Promise.allSettled` with CONCURRENCY=3 for dish summarization — parallel LLM calls for ~3x speedup. Failed individual dishes are logged and skipped.
- Apollo Evaluator `ALLERGEN_KEYWORDS` now covers EU 14 allergens: added celery, mustard, lupin, sulphites, molluscs beyond FDA Big 9. Worcestershire sauce also added under `fish` keywords (contains anchovies).
- `KNOWN_ALLERGEN_DISHES` has ~120+ entries (expanded 2026-04-04): Thai curry variants, massaman/panang, praline, nougat, couscous, seitan, beer-battered, tempura, teriyaki/hoisin (soy sauce has wheat), béchamel, hollandaise, risotto, chowder, caesar salad (anchovies), ramen/pho (meat broth).
- USDA_SYNONYMS now has ~340+ entries (added 2026-04-04): specialty grains (farro, teff, freekeh, amaranth), Japanese/SE Asian (lemongrass, nori, wakame, matcha, dashi), Middle Eastern (za'atar, sumac, harissa), Latin American (tomatillo, jicama, nopal), plant-based (jackfruit, seitan), salad dressings (ranch, caesar, vinaigrette, blue cheese).
- USDA FDC Branded data type: add `"Branded"` to `dataType` param in `searchFood()` query for chain restaurant context to find branded food entries (1M+ products including major chains).
- Menu crawler compliance page detection: `fetchCompliancePages()` in sources.ts checks 11 URL patterns for allergen/nutrition disclosure pages; items tagged `source: 'compliance_page'` get `dietaryConfidence: 0.95` in main crawler (restaurant is legally liable for accuracy).
- `RawMenuItem.source` optional field: `'compliance_page' | 'menu'` — set by `fetchCompliancePages()` in sources.ts; used in index.ts to elevate dietary confidence.
- California SB 478 allergen disclosure law: effective July 1, 2026 — CA restaurants must post allergen data on-menu or QR page. FoodClaw's compliance page detection is designed to harvest this automatically on launch date.
- Search query intent classification (not yet implemented): regex-based `classifyQueryIntent()` can distinguish dish name / nutritional goal / dietary request / mood searches → route to right filter combination without LLM.
- Cuisine diversity in search: current diversity cap is per-restaurant only; add per-cuisine cap (max 4 dishes per cuisine type) to prevent all results being from same cuisine when searching broad category.
- Review aggregator review freshness: pass review dates to Qwen prompt and instruct to weight reviews from last 12 months more heavily — simple prompt change, no infra cost.
- Review aggregator `price_perception` field: add `'expensive' | 'fair' | 'great_value' | 'unknown'` to `DishReviewSummary` — extracted from review sentiment keywords.
- `startTransition()` wraps category pill and sort button `setSearch` calls in `page.tsx` — prevents main thread blocking on sort/filter presses (INP fix).
- `scroll-padding-top: 4rem` on `html` in globals.css — WCAG 2.2 criterion 2.4.11 keyboard fix for sticky header obscuring focused elements.
- UI (pending Dian approval): LCP — first 2 `DishCard` images should get `priority` prop (pass `isPriority={index < 2}` from page.tsx); add `priority` prop to `DishCard`.
- UI (pending Dian approval): WCAG 2.2 — `ConfidenceDot` touch target is 10×10px, minimum is 24×24px. Needs invisible 24px wrapper button around the dot.
- pgvector `hnsw.max_scan_tuples` safe value is 20,000 (not 10,000): the upstream pgvector default is 20,000; 10,000 terminates scan early on sparse dietary combos (kosher+nut_free) and silently returns fewer results. Already corrected in similarity/index.ts (2026-04-04).
- Prisma `previewFeatures` now includes `"partialIndexes"` (added 2026-04-04) — enables conditional index expressions in schema.prisma, e.g., `@@index([macroSource], where: "macro_source IS NOT NULL")` for partial index support.
- BullMQ `addBulk()` should replace per-restaurant `queue.add()` loops in `scripts/nightly-discovery.ts` — single Redis pipeline call vs. N round-trips; 10x faster for 50-restaurant batches.
- `search_vector_simple` gap: FTS fallback in `geo.ts` calls `to_tsvector('simple', name)` on-the-fly per row — no GIN index exists for `'simple'` dictionary. Either add `search_vector_simple` generated column + GIN index, or switch to `websearch_to_tsquery('english', ...)` which uses the existing `search_vector` (`'english'` dictionary) column. The on-the-fly approach causes seq scan.
- BullMQ sandboxed processors: `photo-worker.ts` and `crawl-worker.ts` should use `processor: path.resolve('./worker-fn.js')` (file path, not inline function) to run each job in a forked Node.js child process — prevents memory leaks from Playwright/vision model accumulation and isolates OOM crashes from the main queue process.
- Redis 8.6 `io-threads` config: set `io-threads 8` + `io-threads-do-reads yes` in redis.conf for multi-threaded I/O on Redis ≥ 6. Not yet configured. Relevant for BullMQ under high job throughput (>10K ops/sec).
- PgBouncer transaction mode requirement: `prisma.$transaction()` with `SET LOCAL` statements (as used in similarity/index.ts for HNSW settings) requires PgBouncer in **session mode**, not transaction mode. In transaction mode, `SET LOCAL` is applied to a different connection than the subsequent query. If PgBouncer is added in future, use `pgbouncer_mode = "session"` or move HNSW settings to `SET` (session-level) with explicit reset.
- UI (pending Dian approval): Focus ring at 50% opacity (`outline-primary/50` in globals.css line 161) may fail WCAG 2.2 criterion 2.4.13. Fix: remove `/50` opacity suffix.
- UI (pending Dian approval): Dark mode food photo quality — add `dark:brightness-90` to `<Image>` in `dish-card.tsx` (food photos appear oversaturated on dark backgrounds).
- UI (pending Dian approval): React 19.2 `<Activity>` component — wrap `FilterDrawer` in `<Activity mode={open ? "visible" : "hidden"}>` to preserve filter state across open/close without remounting.
- GLP-1 label pattern in menu-crawler now also catches chain-specific terms: "Good Fit Menu" (Shake Shack), "High Protein Menu" (Chipotle), "Skinnylicious" (Cheesecake Factory) — these are chain brand names for their GLP-1 sections as of April 2026.
- California ADDE Act (eff. July 1, 2026): chains with 20+ CA locations must disclose all 9 major allergens per dish on-menu or QR code. Fines $500–$2,500/violation. FoodClaw's compliance page crawler is foundation — next step: detect QR codes in HTML and follow them (menu-crawler/sources.ts).
- Allergen AI liability (FDA Feb 2026 scrutiny): >70% of AI restaurant allergen systems make definitive safety claims without cross-contamination modeling. FoodClaw's Apollo Evaluator confidence thresholds are correct, but UI needs explicit "verify with restaurant" disclaimer on allergy-critical dishes. UI pending Dian approval.
- Nutritionix has 202K+ US restaurant menu items, geo-aware, dietitian-verified. Better than USDA generic for branded chains. Commercial-only (no free tier). Plan: `getNutritionixMacros()` in `usda/client.ts` as USDA miss fallback. Needs `NUTRITIONIX_APP_ID` + `NUTRITIONIX_API_KEY`.
- DoorDash Zesty (AI restaurant discovery, SF/NYC pilot): restaurant-first, social-first, no dish macros, no allergen safety. FoodClaw moat confirmed: dish-first + verified macros + Apollo safety layer.
- Spokin has 73K+ community reviews, 80+ allergen filters, Verified Brand partners (24-question FAQ). No dish-level macros, no AI confidence scoring. FoodClaw complement: where Spokin verifies a chain, boost Apollo Evaluator confidence for that chain (Spokin signal integration — future work).
- `DeliveryRatingContext` interface added to review-aggregator (by linter, 2026-04-04): `doordashThumbsUpPct`, `ubereatsThumbsUpPct`, `isMostLiked` — delivery platform signals passed into `summarizeDishReviews()` for richer summaries. Optional parameter, backwards compatible.
- pgvector HNSW max_scan_tuples should be 20000 (upstream default), not 10000 — current setting in similarity/index.ts line 107 is too low and may cause early scan termination for sparse dietary combos (kosher + nut_free). ef_search=100 is safe; danger zone is above 200 where PG cost model flips to seq scan.
- pgvector HNSW index build: use ef_construction=128 (not 64) for better recall at index build time. Applies on next rebuild only (not live queries). Change in post-migrate.sql HNSW CREATE INDEX block.
- FTS 'simple' dictionary fallback in fullTextSearchDishes() performs a sequential scan — the 'simple' tsvector is not indexed. Fix: add `search_vector_simple` generated column + GIN index in post-migrate.sql and use it in the fallback query in geo.ts.
- BullMQ addBulk() should be used in nightly-discovery.ts for batch restaurant queueing (currently queues one-at-a-time). Saves 49 Redis round-trips for a 50-restaurant batch.
- BullMQ sandboxed processors: photo-worker and crawl-worker should use sandboxed processor files (separate child processes) to prevent heap accumulation from Gemini base64 buffers and HTML DOM trees across repeated jobs.
- Redis 8 I/O threading: set `io-threads 8` + `io-threads-do-reads yes` in redis.conf for up to 2x throughput on multi-core servers. Nightly agent coordination (all 6 agents + BullMQ state + rate limiter) stresses Redis throughput.
- Prisma 7.4 partialIndexes preview feature available — add `"partialIndexes"` to previewFeatures in schema.prisma to enable defining conditional indexes directly in schema (avoids needing post-migrate.sql for partial index patterns).
- PgBouncer transaction mode is required for Prisma 7 + prisma.$transaction() — session mode breaks prepared statements. For PgBouncer 1.21+: do NOT set `?pgbouncer=true` in DATABASE_URL (that flag is now legacy and counter-productive). Use separate DIRECT_DATABASE_URL for prisma migrate commands.
- `post-migrate.sql` now exists at `prisma/post-migrate.sql` — run after `prisma migrate deploy`. Contains GIN (dietaryFlags, search_vector, trgm), GiST (geo), HNSW (embedding), and partial indexes.
- Cache `cacheGet`/`cacheSet`/`cacheDel` now swallow Redis errors gracefully — callers fall through to DB on cache failure (no more 500s from Redis outages).
- Logger `withLogging()` generates correlation IDs (`requestId`) from `x-request-id` header or `crypto.randomUUID().slice(0,8)`. Also flags slow requests (>2s).
- `withRateLimit("read")` must wrap all public GET routes — restaurant detail, dish detail, and menu routes were unprotected until 2026-04-04.
- `estimateMacros()` clamps portion to 1g–5000g — prevents nonsensical macro values from vision analyzer errors (0g or 50000g portions).
- Crawl worker caps photo analysis batch at 20 per restaurant — prevents queue flooding for large menus.
- FTS simple dictionary fallback now uses indexed `search_vector_simple` generated column (post-migrate.sql) — no more on-the-fly `to_tsvector('simple', ...)` seq scans.
- Discovery areas expanded (2026-04-04): 30 total — 15 Manhattan, 7 Brooklyn, 4 Queens, 4 Denver. Flushing (priority 1) is the richest new area (20 restaurants per scan).
- Orchestrator geo duplicate query fixed (2026-04-05): `getRestaurantIdsWithinRadius()` was called twice per geo search (step 2b for IDs, step 3 for distances). Fix: store full `geoResultsCache` at step 2b and reuse at step 3. Eliminates one earthdistance DB round-trip per search.
- GLP-1 label pattern in menu-crawler covers (as of 2026-04-05): Shake Shack "Good Fit Menu", Chipotle "High Protein Menu", Cheesecake Factory "Skinnylicious", Subway "Protein Pocket", Smoothie King "GLP-1 Menu"/"GLP-1 Support Menu", Factor "GLP-1 Balance", generic "GLP-1 Friendly"/"GLP-1 Support".
- Review aggregator prompt (2026-04-05): review date string is now included in each review line so LLM can weight recent reviews more heavily and note discrepancies between old and new feedback.
- USDA_SYNONYMS has ~418+ entries (2026-04-05): added breakfast (pancakes, waffles, French toast, granola, acai), Mediterranean (hummus, tzatziki, shawarma, gyro, falafel, pita), Latin (guacamole, refried beans, carnitas, al pastor), premium proteins (wagyu, sablefish/black cod, hamachi/yellowtail, foie gras), cheeses (burrata, manchego, cotija, queso fresco), plant-based (hemp seeds, nutritional yeast, spirulina), dairy alternatives (almond milk, oat milk, soy milk).
- Smoothie King GLP-1 menu is labeled "GLP-1 Menu" or "GLP-1 Support Menu" on their website; Factor meal kits use "GLP-1 Balance" as their line name — both are now detected by menu-crawler pattern.
- image-generator `part.inlineData` TypeScript error: Gemini SDK types `inlineData` as optional even inside a truthy check — use non-null assertion `part.inlineData!.data!` after `if (part.inlineData?.data)` guard to satisfy compiler.
- `invalidateRestaurant()` now uses tag-based invalidation (Redis SET `cache-tag:restaurant:{id}` + pipeline DEL) instead of SCAN cursor. Tests must mock `smembers` and `pipeline`, not `scan`.
- Crawl area API (`/api/crawl/area`) uses `apiSuccess()` envelope — test assertions must use `body.data.restaurants_found` (not `body.restaurants_found`).
- Discovery areas expanded to 30 total (2026-04-05): 15 Manhattan, 7 Brooklyn, 4 Queens, 4 Denver. Flushing (priority 1) is the richest new area.
- Orchestrator geo dedup (2026-04-05): `getRestaurantIdsWithinRadius()` result cached as `geoResultsCache` to avoid double DB call per geo search.
- **MenuItem model (2026-04-05)**: Two-tier storage — `MenuItem` (complete menu archive, soft-delete only) + `Dish` (promoted dish cards). MenuItem has `nameNormalized` for dedup, `menuAllergens`/`menuDietaryTags` from HTML scrape, `archivedAt`/`archivedReason` for soft-delete. Unique constraint: `(restaurantId, nameNormalized, source)`.
- MenuItem `onDelete: Restrict` on Restaurant relation — prevents cascade data loss. Deactivate restaurants via `isActive: false` instead of deleting.
- Prisma `$extends` middleware in `db/client.ts` intercepts `delete`/`deleteMany` on MenuItem model → converts to soft-delete. Hard-delete requires `hardDeleteMenuItem()` in `src/lib/menu/archive.ts`.
- `normalizeName()` in `src/lib/menu/archive.ts`: lowercase, strip dietary tags `(V)/(GF)`, strip size modifiers `- Small/Large`, strip footnote markers `*†‡`, collapse whitespace. Used as dedup key.
- Pre-tagging at scrape time (before auditor): `isWineOrSpirit()` → drink, `isDessertItem()` → dessert, `isCocktailOrSpecialDrink()` → drink, `isComboOrMealDeal()` → combo, `isKidsMenuItem()` → kids. Pre-tagged items skip Gemini auditor (save API cost).
- Promotion rules: `dish` + `dessert` → always promoted. `drink` + `isInterestingBeverageOrCategory()` → promoted. Everything else → MenuItem only (full menu display).
- `isInterestingBeverage()` expanded (2026-04-05): covers coffee, iced coffee, tea, thai iced tea, vietnamese coffee, hot chocolate, affogato, macchiato, mocha, cortado, flat white, americano, frappe, turkish coffee, irish coffee.
- `isWineOrSpirit()` expanded (2026-04-05): calvados, armagnac, marc, pastis, pisco, fernet; dessert wines (port, madeira, sherry, marsala, sauternes, tokaji); category typo "champage" caught; "after dinner" category → drink.
- Circuit breaker on stale archival: if crawl returns < 20% of previous active MenuItem count, skip archiving and log warning (prevents scraper failure from mass-archiving).
- Auditor duplicate check DISABLED (2026-04-05): re-crawls naturally find the same dishes — items are updated, not rejected as duplicates. Dedup within same crawl handled by `normalizeName()` Set in `crawlRestaurant()`.
- Auditor fail-open fixed (2026-04-05): Gemini API failure now returns `food_confidence: 0.8` (above 0.7 threshold). Previously returned 0.5 which triggered rejection gate — silently rejecting ALL items.
- Photo matching: `src/lib/photos/match-photo.ts` — 3-strategy matching (exact name in generated-photos.json → case-insensitive match → Dice coefficient fuzzy on kebab-case slugs). Threshold 0.7. No generation — null if no match.
- `extractRawAnnotations()` in sources.ts: captures dietary tag symbols (V, VG, GF, DF, NF, H, K) and footnote markers from raw HTML BEFORE `cleanDishName()` strips them.
- `extractMenuAnnotations()` in sources.ts: scans HTML for allergen legend/footnote blocks and inline calorie/macro patterns. Best-effort enrichment, not blocking.
- `extractIngredientsFromDescription()` in sources.ts: parses ingredient lists from dish descriptions (comma-separated patterns, "served with X" patterns, "contains:" patterns).
- `isDishCard` boolean on MenuItem: explicit dish card decision separate from `menuItemType`. Set by classifier, human-auditable via `/admin/audit/classifier`.
- `dishCardConfidence` on MenuItem: LLM confidence for dish card decision. Items < 0.7 routed to human audit.
- Category-based pre-tagging (2026-04-05): scraper uses menu section name to classify before LLM. "Appetizers" → dish, "Desserts" → dessert, "Beverages" → drink, "Sides" → side. Eliminates most LLM calls.
- LLM fallback chains (2026-04-05): Claude Sonnet → Qwen 3 → DeepSeek V4 → placeholder. Both dietary analyzer and food auditor. Automatically uses cheapest working model. See `memory/project_model_strategy.md` for full model map.
- Agent split (2026-04-05): monolithic `crawlRestaurant()` split into 5 agents: Menu Scraper (`menu-scraper/`), Menu Classifier (`menu-classifier/`), Stale Archiver (`stale-archiver/`), Photo Matcher (`photos/match-photo.ts`), Pipeline Orchestrator (`menu-pipeline/orchestrator.ts`). Each has its own BullMQ worker.
- Evaluation framework (2026-04-05): scraper evaluator (recall), classifier evaluator (accuracy), 66 ground truth items, corrections.json for human overrides. Run via `scripts/run-evaluations.ts`.
- Human audit UI: `/admin/audit/classifier` (type + dish card correction), `/admin/audit/photos` (approve/reject). Low-confidence items auto-routed to human review.
- Batch crawl: `scripts/batch-crawl.ts` — runs scraper → classifier → archiver sequentially per restaurant. No Redis/BullMQ needed. `--max N`, `--dry-run`, `--skip-classify` options.
