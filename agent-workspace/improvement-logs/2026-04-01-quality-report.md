# Quality Report — 2026-04-01

## Metrics
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Type errors | 0 | 0 | 0 |
| Lint errors | 2 | 2 | 0 |
| Lint warnings | 5 | 5 | 0 |
| Tests passing | 81 | 93 | +12 |
| Tests failing | 12 | 1 | -11 |
| Test suites failing | 9 | 4 | -5 |
| Build | N/A (env vars) | N/A | — |
| TODO count | 2 | 2 | 0 |

**Note**: The 2 lint errors (require-imports in usda test) and 1 remaining test failure (logistics poller mock) + 3 suite failures (jose ESM, auth, e2e, profile) are all **pre-existing** — not caused by any agent's changes today.

## Agent Changes Summary (26 files modified, 2 new files)

- **Pipeline** (6 fixes): Robust price parsing, extractJson for reviews, dish deduplication on re-crawl, failed batch recovery with placeholder entries, vision batch concurrency (3x), USDA synonym mapping (30+ entries)
- **Backend** (7 fixes): Prisma indexes (category, availability, macroSource), Redis health check, prefix-based cache invalidation, singleton Prisma in workers, BullMQ job deduplication, photo worker in start-all.ts
- **Search** (5 fixes): Similarity engine geographic radius filtering, macro_match sort, wait_time sort, cache key includes searchText/categories/sortBy, max_wait_minutes filter
- **API** (5 fixes): Zod validation on crawl/similar/feedback routes, UUID validation on dish/restaurant detail, standardized apiSuccess/apiError responses
- **Frontend** (5 fixes): viewport-fit cover for iOS, aria-labels on sort + nav, dish detail error.tsx, dish detail loading.tsx skeleton

## Regressions Found & Fixed
1. **Cache test failures** — QueryCacheParams added new required fields (`searchText`, `categories`, `sortBy`). Fixed by updating all test fixtures.
2. **API test failures (UUID validation)** — Dish/restaurant/similar/feedback tests used short IDs like "d1", "r1". Fixed by using proper UUIDs in all test fixtures.
3. **API test failures (response shape)** — Crawl, similar, feedback routes now wrap in `{ success, data }`. Updated test assertions.
4. **API test failures (rate limiting)** — Crawl tests hit rate limiter. Added `jest.mock("@/lib/middleware/rate-limiter")` to mock it.
5. **Vision analyzer test** — `batchAnalyzePhotos` now uses `Promise.allSettled` with concurrency, breaking sequential mock assumptions. Rewrote test to use `mockImplementation` with call counter.

## Regressions Reverted
None — all regressions were fixable.

## Patterns Added to AGENTS.md
- Cache key must include searchText, categories, sortBy
- BullMQ dedup via jobId
- USDA synonym map
- apiSuccess/apiError for consistent responses
- UUID validation before DB queries
- Worker singleton PrismaClient
- viewportFit: cover for iOS safe-area
- parsePriceString for robust price handling
- Vision batch uses Promise.allSettled — tests must handle non-sequential execution

## Cumulative Progress
Previous report (2026-03-31): 72 tests passing, 21 failing
Today: 93 tests passing (+21), 1 failing (-20). Significant improvement in test coverage and passing rate.
