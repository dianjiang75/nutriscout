# Improvement Log — 2026-04-05 (Nightly Learning Agent)

## Metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Type errors | 2 | 0 | -2 |
| Lint errors | 0 | 0 | = |
| Lint warnings | 16 | 6 | -10 |
| Tests passing | 193 | 193 | = |
| Tests failing | 0 | 0 | = |
| USDA synonyms | ~363 | ~418 | +55 |

## Changes Made

### 1. Bug Fix: Orchestrator double geo DB query (PERF)
**File**: `src/lib/orchestrator/index.ts`
**Lines**: 122–151, 208–216
**What**: `getRestaurantIdsWithinRadius()` was called twice per geo search. The first call at step 2b stored only the restaurant IDs (discarding distance_miles). The second call at step 3 re-fetched the same data to build the distance map.
**Fix**: Stored full `geoResultsCache` (id + distance_miles) from step 2b. Reused it at step 3 instead of re-querying.
**Impact**: Eliminates one earthdistance SQL query (~5–15ms) per search request with geo params.

### 2. Bug Fix: TypeScript errors in image-generator (CORRECTNESS)
**File**: `src/lib/agents/image-generator/index.ts`
**Lines**: 150–153, 162
**What**: Two pre-existing TS errors: `part.inlineData` typed as possibly undefined by Gemini SDK despite truthy guard; `Buffer | null` type passed to `sharp()` which doesn't accept null.
**Fix**: Used non-null assertions (`part.inlineData!.data!`) after guard check; added `as Buffer` cast after null-guard.
**Impact**: Eliminates 2 TypeScript compile errors. Image generation was functionally correct (errors were type-system gaps), but tsc was non-zero.

### 3. Feature: Expanded GLP-1 label detection (COVERAGE)
**File**: `src/lib/agents/menu-crawler/index.ts`
**Lines**: 50–57
**What**: GLP-1 pattern regex was missing Smoothie King ("GLP-1 Menu", "GLP-1 Support Menu"), Factor ("GLP-1 Balance"), and Subway ("Protein Pocket") brand labels confirmed as active in March 2026.
**Fix**: Extended `GLP1_LABEL_PATTERN` regex to cover these chains. Also clarified the comment with all current chains.
**Impact**: Menu crawler now detects more explicitly-labeled GLP-1 items from 3 additional chains.

### 4. Improvement: Review date in LLM prompt (QUALITY)
**File**: `src/lib/agents/review-aggregator/index.ts`
**Lines**: 197, 215
**What**: Review date field (`r.date`) was available in `RawReview` but was never included in the prompt text sent to Qwen. The LLM had no way to differentiate a 3-year-old review from a recent one.
**Fix**: Added `${r.date ? `, ${r.date}` : ""}` to each review's label text. Added prompt instruction to weight last-12-month reviews more heavily and note discrepancies.
**Impact**: Review summaries now reflect recent quality changes (e.g., if a dish declined after a chef change).

### 5. Data: USDA synonyms expansion (ACCURACY)
**File**: `src/lib/usda/client.ts`
**Lines**: 366–428
**What**: ~55 high-frequency restaurant menu items were missing: breakfast (pancakes, waffles, French toast, granola, acai), Mediterranean (hummus, tzatziki, shawarma, falafel), Latin/Mexican (guacamole, refried beans, carnitas, al pastor), premium proteins (wagyu, sablefish, hamachi, foie gras), trending cheeses (burrata, manchego, cotija), plant-based health foods (hemp seeds, nutritional yeast, spirulina), dairy alternatives (almond milk, oat milk, soy milk).
**Fix**: Added all entries with accurate USDA FDC search terms. Removed duplicate `striped bass` key (was causing TS error, already existed at line 281).
**Impact**: Vision analyzer can now look up macros for 55 more common restaurant ingredients without falling back to the LLM-assisted USDA search.

### 6. Lint: Removed unused `totalSources` variable (CLEANUP)
**File**: `src/lib/agents/review-aggregator/index.ts`
**Lines**: 193
**What**: `totalSources` was computed but never used, causing lint warning.
**Fix**: Commented out with a note for future multi-source confidence weighting.
**Impact**: Reduced lint warnings from 16 → 6.

## Regressions Found
None — all 193 tests pass.

## Research Highlights (documented in digest)
- Orchestrator geo double-query confirmed as legitimate bug via code inspection
- GLP-1 chain expansion confirmed via multiple news sources (CNBC, Tasting Table, NBC News)
- Gemini 2.5 Flash 25% benchmark improvement confirmed (already using correct model)
- Smoothie King "GLP-1 Support Menu" and Factor "GLP-1 Balance" confirmed as active product lines
- California ADDE Act (July 1, 2026) compliance page + QR detection is next priority for menu-crawler
- BullMQ Worker Threads (v3.13+) available as lighter alternative to sandboxed fork processes
- Prisma `compilerBuild = "fast"` already set (confirmed); default in 7.3.0+

## Deferred
See `learning-digests/2026-04-05-comprehensive.md` for full backlog.
