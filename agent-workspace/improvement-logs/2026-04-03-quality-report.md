# Quality Report — 2026-04-03

## Metrics
| Metric | Before (2026-04-01) | After | Delta |
|--------|---------------------|-------|-------|
| Type errors | 0 | 0 | — |
| Lint errors | 2 | 0 | -2 |
| Lint warnings | 5 | 11 | +6 (pre-existing, not from this run) |
| Tests passing | 93 | 150 | +57 |
| Tests failing | 1 | 0 | -1 |
| Build | n/a | n/a | — |
| TODO count | 2 | 1 | -1 |

## Agent Changes Summary (18 files, +128/-56 lines)

### Discovery (AGENT 0)
- Fixed Yelp business match: extract city/state from Google `formattedAddress` (was sending empty params)
- Added 15 new discovery areas (Bed-Stuy, Greenpoint, LIC, Arthur Ave, Hell's Kitchen, Koreatown, LoHi Denver, Capitol Hill Denver, etc.)
- Dry-run discovered 50 new restaurants across Midtown, Flushing, Chinatown

### Pipeline (AGENT 1)
- Added missing `glp1_labeled: false` to placeholder dietary flags
- Fixed unsafe `menuSource` type assertion for "none" case
- Fixed USDA client non-null assertion on `pickBestMatch()`
- Fixed vision analyzer outlier array mutation (`const` → `let` with reassignment)
- Fixed ensemble confidence formula (was 0.29x for n=2, now logarithmic)
- Fixed JSON-LD price double-formatting (`$$12.99` → `$12.99`)

### Backend (AGENT 2)
- Added 3 new indexes in post-migrate.sql (macro_source, delivery_last_checked, low_confidence)
- Added Redis eager `.connect()` for early failure detection
- Fixed rate limiter member uniqueness (Math.random → monotonic counter)
- Changed production log level from `warn` to `info`

### Search (AGENT 3)
- **CRITICAL**: Removed incorrect `eggs: "dairy_free"` mapping from evaluator (eggs are NOT dairy)
- Fixed wait time filter: `<` → `<=` (inclusive)
- Consolidated redundant allergen keyword checks in evaluator

### API (AGENT 4)
- Standardized favorites routes to use `apiSuccess`/`apiError` helpers
- Added rate limiting to notification preferences routes
- Added UUID validation to restaurant traffic route

### Frontend (AGENT 5)
- Fixed locked tab click prevention on bottom nav
- Improved error boundary with "Go home" escape hatch + dev digest display

## Regressions Found & Fixed
- **Button `asChild` prop**: Error boundary changes initially used `Button asChild` which doesn't exist in this project's shadcn/ui version. Reverted to `<Link><Button>` wrapping pattern. (Fixed in-session)

## Regressions Reverted
None — all changes compile, lint, and test cleanly.

## Patterns Added to AGENTS.md
1. Yelp business match requires city/state from `formattedAddress`
2. Eggs must NOT map to `dairy_free` — use keyword-only matching
3. Vision ensemble confidence: `base * (1 + log2(n)/10)` formula
4. JSON-LD price: check `startsWith("$")` before prepending
5. `pickBestMatch()` can return null — always check
6. Redis `lazyConnect` needs explicit `.connect()`
7. Rate limiter: monotonic counter > Math.random
8. Production logger: `info` not `warn`
9. Three new indexes in post-migrate.sql
10. Button component doesn't support `asChild`

## Cumulative Progress
Since 2026-04-01:
- Lint errors: 2 → 0 (resolved)
- Tests: 93 → 150 (+57 new tests passing, from 1 failing to 0)
- TODO count: 2 → 1
- Safety: Critical eggs/dairy evaluator bug fixed
- Coverage: 15 new discovery areas, 50 new restaurants discovered
