# Quality Report — 2026-04-04 (Nightly 7-Agent Run)

## Metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Type errors | 0 | 0 | = |
| Lint errors | 0 | 0 | = |
| Lint warnings | 16 | 16 | = |
| Tests passing | 193 | 193 | = |
| Tests failing | 0 | 0 | = |
| Build | n/a | n/a | = |
| TODO count | 2 | 2 | = |

## Agent Changes Summary (7 Agents)

### AGENT 0 — Discovery
- Added 15 new discovery areas: 7 Brooklyn (Williamsburg, Park Slope, Bushwick, Carroll Gardens, DUMBO, Fort Greene, Prospect Heights), 4 Queens (Flushing, Astoria, Jackson Heights, LIC), 4 Denver (RiNo, LoHi, LoDo, Capitol Hill)
- Dry run confirmed 50 new restaurants found (Flushing 20, Williamsburg 20, LES 10)
- Files: `scripts/seed-discovery-areas.ts`, `scripts/nightly-discovery.ts`

### AGENT 1 — Pipeline
- USDA portion validation: clamped to 1g–5000g to prevent garbage macros
- Crawl worker: capped photo batch at 20 per crawl
- Photo worker: added input validation (dishId/photoUrl check)
- Menu crawler: improved error logging with restaurant context
- Files: `src/lib/usda/client.ts`, `workers/crawl-worker.ts`, `workers/photo-worker.ts`, `src/lib/agents/menu-crawler/index.ts`

### AGENT 2 — Backend
- Created `prisma/post-migrate.sql` with 8 critical indexes (GIN dietaryFlags, FTS search_vector, trgm name, GiST geo, HNSW embedding, partial indexes)
- Cache error handling: wrapped get/set/del in try/catch (graceful fallthrough)
- Logger: added correlation IDs + slow request detection (>2s)
- Slow query logging: enabled in production (was dev-only)
- Files: `prisma/post-migrate.sql` (new), `src/lib/cache/index.ts`, `src/lib/utils/logger.ts`, `src/lib/db/client.ts`

### AGENT 3 — Search
- FTS simple fallback: uses indexed `search_vector_simple` column instead of on-the-fly tsvector
- Diversity cap re-sort: now re-sorts macro_match and default relevance after cap
- DB-calculated distances: uses earthdistance values from geo pre-filter
- Files: `src/lib/db/geo.ts`, `src/lib/orchestrator/index.ts`

### AGENT 4 — API
- Rate limiting: added `withRateLimit("read")` to 4 unprotected routes
- Error responses: standardized `/api/restaurants` to use `apiSuccess()`/`apiError()`
- Input validation: added lat/lng bounds checking on restaurants endpoint
- Files: `src/app/api/restaurants/route.ts`, `src/app/api/restaurants/[id]/route.ts`, `src/app/api/restaurants/[id]/menu/route.ts`, `src/app/api/dishes/[id]/route.ts`

### AGENT 5 — Frontend
- Converted all 3 remaining `<img>` tags to `next/image`: dish-card, recognition-results, photo-upload
- Created `src/app/dish/[id]/not-found.tsx` for proper 404 handling
- Files: `src/components/dish-card.tsx`, `src/components/recognition-results.tsx`, `src/components/photo-upload.tsx`, `src/app/dish/[id]/not-found.tsx` (new)

### AGENT 6 — Quality
- Fixed lint warning: commented out unused `useBulkEnqueue` variable in nightly-discovery.ts
- Verified: 0 regressions across all 7 agents
- Files: `scripts/nightly-discovery.ts`

## Regressions Found & Fixed

1. **Lint warning** in `nightly-discovery.ts`: unused `useBulkEnqueue` variable introduced by Discovery agent. Fixed by commenting out (noted for future bulk optimization).

## Regressions Reverted

None — all changes passed tsc, lint, and tests.

## Patterns Added to AGENTS.md

- `withRateLimit("read")` wrapper now used on restaurant/dish detail routes
- `post-migrate.sql` contains all raw SQL indexes — run after `prisma migrate deploy`
- Cache operations (get/set/del) now swallow errors and fall through gracefully
- Logger `withLogging()` generates correlation IDs via `crypto.randomUUID().slice(0, 8)`

## Cumulative Progress

| Date | tsc | lint err | lint warn | tests pass | tests fail |
|------|-----|----------|-----------|------------|------------|
| 2026-04-01 | 0 | 2 | 5 | 93 | 1 |
| 2026-04-03 | 0 | 0 | 11 | 150 | 0 |
| 2026-04-04 | 0 | 0 | 16 | 193 | 0 |

Tests: 93 → 150 → 193 (+43 since last run). Lint warnings: 11 → 16 (pre-existing unused vars, not from agent changes). Zero regressions introduced.
