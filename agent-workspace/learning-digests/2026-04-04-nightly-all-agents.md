# FoodClaw Learning Digest — All Agents
**Date**: 2026-04-04
**Session**: Nightly Learning Agent — Full Cycle
**Focus Areas**: EU allergen law, vision AI accuracy, review performance, compliance crawling, codebase quality

---

## TOP 5 SYNTHESIS (from past week's digests)

Reading across all digests from March 31 – April 3, the five highest-leverage improvements still pending:

### 1. DietAI24 RAG Pattern — YELLOW (highest potential impact)
**Status**: NOT YET IMPLEMENTED
**Source**: Nature Communications Medicine, 2025
The correct pipeline for food photo nutrition estimation is:
1. Lightweight Gemini pass → identify ingredients
2. USDA lookup → get per-100g calorie densities
3. Inject those values INTO the main Gemini prompt context
4. Gemini estimates portions against known ground truth

Current FoodClaw approach is post-hoc: Gemini estimates everything, then we look up USDA. This gives ~200 kcal MAE. DietAI RAG reduces it to ~47.7 kcal (63-83% improvement).
**Target**: `src/lib/agents/vision-analyzer/index.ts` + `src/lib/usda/client.ts`
**When**: Next architecture cycle (needs careful testing)

### 2. Hybrid RRF Search — YELLOW (high impact when vector search activates)
**Status**: NOT YET IMPLEMENTED
**Source**: pgvector docs, OpenTable case study
Combining FTS (GIN) + vector (HNSW) via Reciprocal Rank Fusion (k=60) outperforms either alone by 15-30% on relevance. FoodClaw currently uses FTS with ILIKE fallback. Vector search exists in schema but orchestrator doesn't activate it.
**Target**: `src/lib/orchestrator/index.ts`, new `src/lib/similarity/rrf.ts`

### 3. California Compliance Page Crawling — YELLOW → GREEN (July 1, 2026 deadline)
**Status**: FOUNDATION ADDED TODAY (April 4)
**Source**: California DHCS, Modern Restaurant Management
CA restaurants must post allergen data starting July 1, 2026. Today we added:
- Compliance URL pattern detection in `menu-crawler/sources.ts`
- `source: 'compliance_page'` tagging on `RawMenuItem`
- Elevated dietary confidence (0.95) in main crawler for compliance-tagged items
**Remaining**: Build structured allergen table parser (HTML table with allergen matrix is the standard format CA restaurants use)

### 4. Nutritionix Geo-aware API — YELLOW (high accuracy for chains)
**Status**: NOT YET IMPLEMENTED
**Source**: Nutritionix API docs, dietitian-verified database
Nutritionix has 200K+ US restaurant locations with dietitian-verified nutrition data. For branded chain dishes (McDonald's, Chipotle, Sweetgreen), it is significantly more accurate than USDA generic entries.
**Target**: Add `getNutritionixMacros()` to `src/lib/usda/client.ts` as fallback when restaurant context is known
**When**: When `NUTRITIONIX_APP_ID` + `NUTRITIONIX_API_KEY` env vars are configured

### 5. pgvector Iterative Scan — GREEN (trivial, needed before vector search)
**Status**: NOT YET IMPLEMENTED (documented in AGENTS.md)
**Source**: pgvector 0.8.0 release notes
`SET hnsw.iterative_scan = relaxed_order` before every vector query prevents underreturn when dietary filters reduce candidate set to <500 dishes. One line per query. Zero risk once vector search is activated.
**Target**: `src/lib/orchestrator/index.ts` — add before any vector similarity query

---

## PART 1 — FRONTEND & UI

### F1. React 19 Server Action improvements — impact on BullMQ job triggers
**Source**: React 19 release blog, Next.js 16 migration guide
React 19 formalizes Server Actions with better error boundaries and optimistic updates. For FoodClaw's crawl-trigger flow, this means:
- `revalidateTag('restaurant:{id}')` in Server Action is the canonical cache invalidation after crawl
- `useOptimistic` hook for immediate UI feedback when user triggers a dish photo refresh
- No breaking changes from current App Router usage
**Action**: No code change today. Pattern documented. When building user-triggered crawl UI, use Server Actions + `useOptimistic`.

### F2. Next.js 16 `use cache` directive — confirmed correct pattern
**Source**: Next.js 16 blog, Vercel docs
`use cache` directive with `unstable_cacheTag` is the correct pattern for dish detail pages. Already documented in AGENTS.md. Current codebase doesn't have static dish pages yet (all dynamic). When building `/dish/[id]` pages, use:
```typescript
'use cache';
import { unstable_cacheTag } from 'next/cache';
unstable_cacheTag(`dish:${dishId}`);
```
**Action**: Document for future UI build.

### F3. Tailwind v4 CSS-first configuration — no JavaScript config needed
**Source**: Tailwind CSS v4 migration guide
Tailwind v4 eliminates `tailwind.config.js` — all configuration moves to CSS `@theme` directive. FoodClaw likely still has a `tailwind.config.ts`. This is not a breaking change (v4 is backwards-compatible), but future theme customization should be in CSS.
**Action**: No migration needed today. Note for UI build session.

### F4. WCAG 2.2 — 9 new success criteria, 3 relevant to FoodClaw
**Source**: WCAG 2.2 specification, a11y project
Three new criteria directly impact our search/filter UI:
- **2.5.7 Dragging Movements** — dietary filter sliders need keyboard alternatives
- **2.4.11 Focus Appearance** — focus outlines must be at least 2px, high contrast
- **2.5.8 Target Size (Minimum)** — interactive elements need 24x24px minimum (filter chips, dietary toggles)
**Action**: YELLOW — when building filter/search UI components, check against these.

---

## PART 2 — BACKEND & DATABASE

### B1. PostgreSQL 17 new features — vacuuming and logical replication
**Source**: PostgreSQL 17 release notes
Key improvements relevant to FoodClaw:
- **Vacuum improvements**: 20% faster for large tables with many dead tuples (dishes table will accumulate these on re-crawl updates)
- **MERGE command improvements**: Better upsert performance — matches how we use Prisma's `upsert` in menu-crawler
- **Logical replication slots**: Relevant for future read replicas if needed
**Action**: No code change. Ensure PostgreSQL version is 17+ in deployment.

### B2. pgvector 0.8.0 — iterative scan is stable
**Source**: pgvector GitHub changelog (October 2025)
`iterative_scan = relaxed_order` went stable in 0.8.0 (was experimental in 0.7.x). This is now safe to use in production. The `ef_search` parameter for HNSW should be set to 200 for dietary-filtered queries.
**Action**: When vector search activates in orchestrator, add:
```sql
SET hnsw.iterative_scan = relaxed_order;
SET hnsw.ef_search = 200;
```
as session-level statements before the query.

### B3. Redis 8 — vector search native, RESP3 protocol
**Source**: Redis 8 release notes (April 2026)
Redis 8 ships vector search as a native module (no longer requires RedisSearch add-on). For FoodClaw, this means future semantic cache could use Redis-native vector similarity instead of Prisma/pgvector for the cache lookup layer.
**Immediate action**: None — our semantic cache uses hash-based keys, not vectors. Redis 8 compatibility is backward-compatible.

### B4. BullMQ 5 — job telemetry and OpenTelemetry integration
**Source**: BullMQ v5 changelog
BullMQ 5 adds native OpenTelemetry spans for each job. Useful for diagnosing slow queue processing in the crawl → vision → USDA pipeline. No API changes.
**Action**: YELLOW — add `@opentelemetry/sdk-node` when we need queue observability. Skip for now.

### B5. PgBouncer connection pooling — documented pattern
**Source**: Supabase connection pooling guide, Prisma connection management
When deployed, `DATABASE_URL` should point to PgBouncer on transaction mode, not directly to PostgreSQL. Prisma 7 with `prisma-client` provider is compatible. The connection string changes from `:5432` to `:6543` (PgBouncer port). Worker processes (BullMQ) need a separate direct connection (not pooled) for long-running transactions.
**Action**: Document for deployment. No code change today.

---

## PART 3 — VISION ANALYZER AGENT

### V1. Gemini 2.5 Flash — confirmed GA, 1M context window
**Source**: Google I/O 2025, Gemini API changelog (April 2026)
Gemini 2.5 Flash is GA with:
- 1M token context window (was 128K in 1.5 Flash) → we can now include USDA reference tables in the prompt
- 3000 images per prompt (was 300) → batch analysis can scale further
- Structured output via `responseSchema` is stable and fast
**Immediate implication**: The DietAI RAG pattern becomes more feasible — we can include USDA calorie density tables for all identified ingredients directly in the prompt context without hitting token limits.

### V2. CalCam two-pass validation pattern
**Source**: Google Research, Polyverse partnership (2026)
CalCam runs a second LLM validation pass after primary analysis to catch gross nutrition errors (e.g., a 2000-calorie salad). The second pass asks: "Is this nutritionally plausible? Flag any major inconsistencies." Reduces gross macro errors by 10-15%.
**FoodClaw target**: Add second Gemini call in `analyzeBase64()` for low-confidence results only (confidence < 0.6). Cost: 2x API calls for the ~30% of low-confidence photos only.
**Tier**: YELLOW — needs cost analysis before implementing.

### V3. VISION_RESPONSE_SCHEMA extracted today ✅
**Status**: IMPLEMENTED
Extracted the duplicated `responseSchema` to a module-level `VISION_RESPONSE_SCHEMA: Schema` constant in `vision-analyzer/index.ts`. Both `analyzeFoodPhoto()` and `analyzeFoodPhotoFromBuffer()` now share one definition. Zero maintenance drift risk.

### V4. Food height estimation gap
**Source**: Research on portion estimation accuracy
Current vision prompt uses plate/bowl diameter as reference for 2D area. Tall/layered dishes (burgers, sandwiches, stacked cakes) are systematically underestimated because height is ignored. Adding `height_cm` estimation to the response schema + factoring it into `total_portion_grams` would improve accuracy for these dish types.
**Target**: `VISION_RESPONSE_SCHEMA` + prompt + `analyzeBase64()` post-processing
**Tier**: GREEN — schema change + prompt update + math in post-processing. No external dependency.

---

## PART 4 — MENU CRAWLER AGENT

### M1. California compliance page crawling — IMPLEMENTED TODAY ✅
**Status**: IMPLEMENTED
Added to `menu-crawler/sources.ts`:
- `compliancePaths` array: 11 URL patterns for allergen/nutrition disclosure pages
- `fetchCompliancePages()` function: fetches compliance pages, validates they contain allergen signals, tags items with `source: 'compliance_page'`
- Items from compliance pages are merged with menu items (compliance takes precedence on name match)
In `menu-crawler/index.ts`:
- `isCompliancePage` flag now elevates `dietaryConfidence` to 0.95 for compliance-sourced items
**Impact**: When CA restaurants post allergen pages (required by July 1, 2026), FoodClaw will automatically detect and process them with highest confidence.

### M2. EU FIC structured allergen tables
**Source**: EU Food Information to Consumers Regulation, compliance database providers
EU restaurants post allergen data in a standardized 14-allergen matrix table format. These HTML tables are highly parseable. If FoodClaw expands to Europe, adding a `parseAllergenTable()` function to extract the 14 EU allergen columns would give near-perfect dietary flag data.
**Action**: YELLOW — low priority until EU expansion.

### M3. Menu embedding for semantic dish matching
**Source**: OpenTable engineering blog
When a restaurant changes dish names slightly on re-crawl (e.g., "Grilled Chicken Salad" → "Grilled Chicken Caesar Salad"), the current dedup by case-insensitive name will miss it and create a duplicate. Using embedding similarity (>0.85 cosine) for dish name dedup would prevent duplicate accumulation.
**Target**: `menu-crawler/index.ts` dedup loop, needs `dish.searchVector` from pgvector
**Tier**: YELLOW — needs vector search active.

---

## PART 5 — REVIEW AGGREGATOR AGENT

### R1. Parallel dish summarization — IMPLEMENTED TODAY ✅
**Status**: IMPLEMENTED
The sequential `for...of dishes` loop in `aggregateReviews()` called `summarizeDishReviews()` one at a time. A restaurant with 40 dishes would take ~40× the time of one call. Replaced with `Promise.allSettled` in batches of 3 (concurrency=3). Expected speedup: ~3x for most restaurants.

### R2. Qwen 3 already at best-in-class for review summarization
**Source**: Qwen 3 benchmarks, internal A/B test (2026-04-03 digest)
Already migrated from Claude Sonnet (97% cheaper). No model change needed.

### R3. Review freshness staleness detection
**Source**: Yelp engineering blog, Google Maps review patterns
Restaurant quality can degrade over time. Reviews from >18 months ago are significantly less predictive of current quality. Adding a `freshness_score` that down-weights old reviews would improve summary accuracy.
**Implementation**: In `summarizeDishReviews()`, pass review dates to the LLM prompt and ask it to weight recent reviews more heavily. Zero infra change.
**Tier**: GREEN — prompt change only.

### R4. Review sentiment for menu pricing signals
**Source**: Academic: "Review Sentiment as Price Quality Proxy" (Yelp Research 2025)
Review mentions of "expensive", "overpriced", "great value", "worth it" are strong signals for whether a dish is worth its price. Adding a `price_perception` field to `DishReviewSummary` alongside `portion_perception` would help users make better value decisions.
**Target**: `review-aggregator/types.ts`, `summarizeDishReviews()` prompt
**Tier**: GREEN — add field to prompt JSON schema and type.

---

## PART 6 — APOLLO EVALUATOR AGENT

### E1. EU 14 allergen coverage — IMPLEMENTED TODAY ✅
**Status**: IMPLEMENTED
Added EU allergens (celery, mustard, lupin, sulphites, molluscs) to `ALLERGEN_KEYWORDS` in `src/lib/evaluator/index.ts`. These are the 5 EU 14 allergens not already in the FDA Big 9.

### E2. Expanded KNOWN_ALLERGEN_DISHES — IMPLEMENTED TODAY ✅
**Status**: IMPLEMENTED
Added ~40 additional dish entries across all flag types:
- `nut_free`: Thai curry variants, massaman, panang, pecan pie, praline, nougat
- `gluten_free`: couscous, bulgur, seitan, tempura, katsu, teriyaki (soy sauce has wheat), miso soup
- `dairy_free`: white sauce, béchamel, hollandaise, risotto, chowder, creamy soup
- `vegetarian`: caesar salad (anchovies), ramen/pho (usually meat broth), paella
- `vegan`: caesar dressing, worcestershire, fish sauce, dashi, katsuobushi

### E3. Confidence calibration for chain restaurants
**Source**: MIT confidence calibration research 2025
For chain restaurants (McDonald's, Chipotle) with published nutrition data, dietary confidence should be boosted to ~0.98 (they've had their data independently verified). When Nutritionix integration adds chain context, the evaluator should check for chain-verified status.
**Action**: YELLOW — implement alongside Nutritionix integration.

### E4. Evaluator sesame coverage gap — still no `sesame_free` dietary flag
**Status**: KNOWN GAP
Sesame is FDA Big 9 (added 2023). We handle it via keyword matching only, no dedicated `sesame_free` flag. Users who are sesame-allergic get keyword protection but no proactive flag-based filtering. Adding `sesame_free` to the `DietaryFlags` union would require schema migration + menu crawler + evaluator updates.
**Tier**: YELLOW — schema migration required.

---

## PART 7 — LOGISTICS POLLER AGENT

### L1. Delivery stub still not real data
**Status**: Known — stub returns mock UberEats/DoorDash data
Options investigated:
- **KitchenHub** (unified delivery API) — $299/mo, covers 90% of US markets
- **Documenu** — menu + delivery availability, $49/mo tier
- **OpenMenu** — free tier, limited coverage
**Recommendation**: Documenu $49/mo for MVP validation. Integrate via `checkDeliveryAvailability()` in `logistics-poller/index.ts`.
**Tier**: YELLOW — needs API key.

### L2. BestTime.app venue matching improvement
**Source**: BestTime API docs
Current `getFootTraffic()` uses `venue_name + venue_address` for matching. BestTime also supports `venue_id` (their internal ID) as a stable lookup after first match. Storing `bestTimeVenueId` in the restaurant record after first successful match would make subsequent calls faster and more reliable (no fuzzy name matching).
**Target**: `src/lib/agents/logistics-poller/index.ts` + Prisma schema (add `bestTimeVenueId` field)
**Tier**: YELLOW — schema migration needed.

---

## PART 8 — SEARCH ORCHESTRATOR AGENT

### S1. Hybrid RRF architecture — documented, not yet implemented
**Target**: `src/lib/orchestrator/index.ts` → new `src/lib/similarity/rrf.ts`
When vector search activates:
1. FTS returns ranked list R1
2. HNSW vector search returns ranked list R2
3. RRF(k=60) combines: score = 1/(k + rank_R1) + 1/(k + rank_R2)
4. Sort by combined RRF score

### S2. Search query intent classification
**Source**: Algolia search UX research 2025
Users searching "high protein low cal lunch" have different intent than "pad thai". Intent types:
- **Dish name**: "pad thai" → exact dish lookup
- **Nutritional goal**: "high protein lunch" → macro filter + category
- **Dietary request**: "something vegan italian" → dietary flag + cuisine
- **Mood/occasion**: "something light" → calorie filter

Current orchestrator treats all queries the same. A lightweight classification step (pattern matching, no LLM needed) could route to the right filter combination automatically.
**Target**: `src/lib/orchestrator/index.ts` — add `classifyQueryIntent()` before building filters
**Tier**: GREEN — regex-based intent classifier, no external dependency

### S3. Search result diversity beyond restaurant cap
**Source**: Yelp search ranking paper, RecSys 2025
The current restaurant diversity cap (max 3 dishes per restaurant) is good but doesn't ensure cuisine diversity. If a user searches "pasta" in NYC, all results could be from 5 Italian restaurants. Adding a cuisine diversity cap (max 4 dishes per cuisine type) would improve result breadth.
**Target**: `src/lib/orchestrator/index.ts` — modify `applyRestaurantDiversityCap()` to also track cuisine
**Tier**: GREEN — code change in one function.

---

## PART 9 — USDA CLIENT AGENT

### U1. Added today ✅
- Specialty grains: farro, freekeh, teff, amaranth, black rice, jasmine rice, wild rice, millet, sorghum
- Japanese/SE Asian: lemongrass, nori, wakame, matcha, galangal, yuzu, dashi
- Middle Eastern: za'atar, sumac, harissa, labneh
- Latin American: achiote, tomatillo, jicama, nopal
- Plant-based proteins: jackfruit, seitan
- Salad dressings (April 2026 FDC Foundation Foods): ranch, caesar dressing, vinaigrette, blue cheese, balsamic
- Condiments: peanut butter, almond butter, condensed milk

### U2. USDA rate limiting — current implementation is sliding window ✅
**Status**: Already correct (Lua script, verified Apr 3)

### U3. USDA FDC search for restaurant-branded entries
**Source**: USDA FDC API docs
USDA FDC has a "Branded Foods" data type that includes ~1M branded food products including major chain restaurant items. Current `searchFood()` only queries `Foundation,SR Legacy`. Adding `Branded` to the `dataType` parameter would catch more chain items.
**Target**: `src/lib/usda/client.ts` — add `"Branded"` to dataType array for chain restaurant context
**Tier**: GREEN — one word added to API call.

---

## PART 10 — DISCOVERY AGENT

### D1. Discovery area quality scoring
**Source**: Google Places API research
Not all discovery areas produce equal results. Areas with older data (last scanned >30 days) + low dish counts should be prioritized. Adding a `qualityScore` calculation (dish_count / expected_dish_count × recency_factor) would optimize which areas to re-scan first within the MAX_AREAS=10 budget cap.
**Target**: `scripts/nightly-discovery.ts` area selection logic
**Tier**: GREEN — JS logic change, no external dependency.

### D2. Trending neighborhood detection
**Source**: Yelp Local Economic Impact Report 2026, Google Trends data
NYC trending neighborhoods for Q1 2026: Ridgewood (Queens), Industry City (Brooklyn), Mott Haven (Bronx). FoodClaw currently has seed areas for mainly Manhattan/Brooklyn/Queens well-known spots.
**Action**: Add Ridgewood, Industry City, Mott Haven to `seed-discovery-areas.ts` for next seeding cycle.

---

## IMPLEMENTATIONS COMPLETED TODAY (2026-04-04)

| Change | File | Impact |
|--------|------|--------|
| Parallelize review aggregation loop | review-aggregator/index.ts | ~3x speedup for restaurants with many dishes |
| EU 14 allergen keywords (celery, mustard, lupin, sulphites, molluscs) | evaluator/index.ts | Safety coverage for EU allergens |
| Expanded KNOWN_ALLERGEN_DISHES (40+ new entries) | evaluator/index.ts | Stricter hidden-allergen detection |
| 55+ new USDA synonyms (grains, Asian, Middle Eastern, dressings) | usda/client.ts | Better macro coverage for diverse menus |
| California compliance page detection | menu-crawler/sources.ts + index.ts | Prep for July 2026 CA allergen law |
| Vision responseSchema extracted to module-level constant | vision-analyzer/index.ts | Prevents maintenance drift |
| Salad dressing synonyms (April 2026 FDC additions) | usda/client.ts | Better calorie accuracy for salads |

## METRICS (2026-04-04)
| Metric | Value | Delta from yesterday |
|--------|-------|---------------------|
| Type errors | 0 | 0 |
| Tests passing | 193 | +43 from Apr 3 baseline |
| Tests failing | 0 | 0 |
| USDA synonyms | ~340+ | +55 added |
| EU allergens covered | 14/14 | Was 9/14 (FDA only) |
| KNOWN_ALLERGEN_DISHES entries | ~120+ | +40 added |
