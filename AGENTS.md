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
- Crawls restaurant menus from 3 sources: website HTML, Google Maps photos, delivery platforms (stub)
- Uses Claude to extract structured menu items from photos
- Analyzes ingredients for dietary flags (vegan, GF, halal, kosher, nut-free)
- CRITICAL: dietary flags use conservative defaults — `null` (unknown) not `true` when uncertain

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

### 10. User Test Agent (`/user-test` skill)
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
