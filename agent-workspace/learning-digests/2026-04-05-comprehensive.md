# FoodClaw Learning Digest — 2026-04-05

## Executive Summary

Today's cycle focused on a double-DB-round-trip bug in the search orchestrator (geo pre-filter called twice per search), fixing pre-existing TypeScript errors in the image generator, expanding the USDA synonym map with ~60 new high-frequency menu items, updating the GLP-1 label pattern to cover Smoothie King and Factor brands, and improving review summarization with date-aware freshness weighting. All changes passed 193/193 tests with 0 type errors and lint warnings reduced from 16 to 6.

---

## Agent-by-Agent Learnings

### Vision Analyzer (`src/lib/agents/vision-analyzer/`)

**Finding**: DietAI RAG pattern still not implemented — post-hoc USDA lookup remains the architecture. This is the highest-leverage improvement tracked across multiple digests.
**Risk**: YELLOW
**Impact**: HIGH | **Effort**: HIGH | **Urgency**: MEDIUM
**Target files**: `src/lib/agents/vision-analyzer/index.ts`, `src/lib/usda/client.ts`
**Recommendation**: Implement two-pass: (1) lightweight Gemini call to identify ingredients, (2) USDA lookup for per-100g calorie densities, (3) inject those values as context into main Gemini macro estimation prompt. Expected MAE reduction: 63–83%. Deferred — requires careful testing and new prompt engineering.

**Finding**: Gemini 2.5 Flash shows 25% improvement across benchmarks including food recognition. CalCam (Polyverse + Google) reported 20% user satisfaction boost on food recognition with Gemini 2.0 → 2.5 Flash upgrade.
**Risk**: GREEN
**Impact**: MED | **Effort**: LOW | **Urgency**: LOW
**Target files**: `src/lib/ai/clients.ts`
**Recommendation**: Confirm `GEMINI_FLASH` constant in clients.ts points to `gemini-2.5-flash`. Already confirmed in previous cycles.

---

### Menu Crawler (`src/lib/agents/menu-crawler/`)

**Finding**: Smoothie King ("GLP-1 Menu", "GLP-1 Support Menu") and Factor meals ("GLP-1 Balance") have explicit GLP-1 labels not covered by the previous regex pattern.
**Risk**: GREEN
**Impact**: MED | **Effort**: LOW | **Urgency**: HIGH
**Target files**: `src/lib/agents/menu-crawler/index.ts`
**Recommendation**: IMPLEMENTED — expanded `GLP1_LABEL_PATTERN` to cover Smoothie King and Factor brand terms. Also added `protein pocket` for Subway.

**Finding**: California ADDE Act (effective July 1, 2026) compliance page crawler is the foundation, but QR code detection in HTML is not yet implemented. Research shows AI QR code solutions are now deployed by major chains — some use dynamic QR codes linking to allergen AI assistants.
**Risk**: YELLOW
**Impact**: HIGH | **Effort**: MED | **Urgency**: HIGH (July 1 deadline)
**Target files**: `src/lib/agents/menu-crawler/sources.ts`
**Recommendation**: Add QR code URL extraction in `fetchCompliancePages()` — parse `<img>` with qr.io/bitly/dynamic-qr patterns + follow QR-linked URLs for allergen tables. Deferred — requires QR code URL pattern research per chain.

---

### Review Aggregator (`src/lib/agents/review-aggregator/`)

**Finding**: Review date was passed in `RawReview` but not included in the LLM prompt text, so the model couldn't differentiate old from recent reviews.
**Risk**: GREEN
**Impact**: MED | **Effort**: LOW | **Urgency**: LOW
**Target files**: `src/lib/agents/review-aggregator/index.ts`
**Recommendation**: IMPLEMENTED — added `r.date` to review text in prompt: `Review N (5 stars, google, 3 months ago): "..."`. Added instruction to weight last-12-month reviews more heavily and note discrepancies.

---

### Search Orchestrator (`src/lib/orchestrator/`)

**Finding**: `getRestaurantIdsWithinRadius()` was called TWICE per geo search — once for the pre-filter ID list (step 2b) and again to build the distance map (step 3). This doubled the DB round-trip for every geo search, adding ~5-15ms of unnecessary latency.
**Risk**: GREEN (bug fix)
**Impact**: MED | **Effort**: LOW | **Urgency**: HIGH
**Target files**: `src/lib/orchestrator/index.ts`
**Recommendation**: IMPLEMENTED — stored `geoResultsCache` from step 2b and reused it in step 3. Eliminates duplicate earthdistance query.

---

### USDA Client (`src/lib/usda/client.ts`)

**Finding**: 60+ high-frequency restaurant menu items were missing from USDA_SYNONYMS: breakfast staples (pancakes, waffles, French toast, granola, acai bowls), Mediterranean/Middle Eastern (hummus, tzatziki, shawarma, gyro, falafel, pita), Latin/Mexican (guacamole, tortilla chips, refried beans, carnitas, al pastor, carne asada), specialty proteins (wagyu, sablefish, hamachi, foie gras), trending cheeses (burrata, manchego, cotija), plant-based (hemp seeds, nutritional yeast, spirulina), and dairy alternatives (almond milk, oat milk, soy milk).
**Risk**: GREEN
**Impact**: MED | **Effort**: LOW | **Urgency**: LOW
**Target files**: `src/lib/usda/client.ts`
**Recommendation**: IMPLEMENTED — ~55 entries added (363→418). Removed duplicate `striped bass` entry that caused TypeScript error.

---

### Apollo Evaluator (`src/lib/evaluator/`)

**Finding**: No gaps found today. Evaluator has comprehensive EU 14 allergens, 120+ known-allergen dishes, and proper confidence gating. Architecture is solid.
**Risk**: GREEN
**Impact**: LOW | **Effort**: N/A | **Urgency**: LOW
**Recommendation**: Continue monitoring for new chain-specific allergen disclosures as ADDE Act data becomes available (July 1, 2026).

---

### Image Generator (`src/lib/agents/image-generator/`)

**Finding**: Pre-existing TypeScript errors: `part.inlineData` possibly undefined (TS18048) and `Buffer | null` passed to `sharp()` (TS2769). These caused `tsc` to fail before our session started — verified these errors existed before today's changes.
**Risk**: GREEN (bug fix)
**Impact**: LOW | **Effort**: LOW | **Urgency**: MED
**Target files**: `src/lib/agents/image-generator/index.ts`
**Recommendation**: IMPLEMENTED — narrowed inlineData access with non-null assertions after guard check. Added `as Buffer` cast after null-check guard.

---

### Logistics Poller / Discovery / Delivery Scraper

**Finding**: No new action items beyond what's already tracked. Delivery scraper budget at 50 restaurants/night is appropriate given Playwright session stability.

---

## Top 5 Cross-Agent Recommendations

1. **DietAI RAG Vision Pattern** — inject USDA calorie densities into Gemini prompt before macro estimation. 63–83% MAE reduction expected. Requires architectural change + testing. Target: `vision-analyzer/index.ts` + `usda/client.ts`. HIGH impact, HIGH effort.

2. **QR Code Compliance Page Following** — crawl QR-linked allergen pages ahead of July 1, 2026 ADDE Act deadline. CA chains with 20+ locations must post all 9 major allergens. Add QR URL extraction to `menu-crawler/sources.ts`. HIGH urgency.

3. **Nutritionix API Integration** — 202K+ branded restaurant dishes, dietitian-verified, geo-aware. Add `getNutritionixMacros()` to `usda/client.ts` as a fallback for chain restaurant context. Needs `NUTRITIONIX_APP_ID` + `NUTRITIONIX_API_KEY`. HIGH accuracy for Chipotle, Sweetgreen, etc.

4. **Hybrid RRF Search** — Reciprocal Rank Fusion combining FTS (GIN) + vector (HNSW) outperforms either by 15–30%. pgvector vector search is in schema but not active in orchestrator. When vector search activates, implement RRF in `src/lib/similarity/rrf.ts`. MEDIUM effort.

5. **Allergen QR Disclaimer UI** — FDA Feb 2026 scrutiny found >70% of AI allergen systems make definitive claims without cross-contamination modeling. Apollo Evaluator thresholds are correct but UI needs "verify with restaurant" disclaimer on allergy-critical dishes. Pending Dian approval.

---

## Implemented This Session

| Change | File | Type |
|--------|------|------|
| Fixed duplicate `getRestaurantIdsWithinRadius()` DB call | `src/lib/orchestrator/index.ts:122-151, 208-216` | Bug fix (perf) |
| Expanded GLP-1 label pattern (Smoothie King, Factor, Subway) | `src/lib/agents/menu-crawler/index.ts:50-57` | Feature |
| Added review date to LLM prompt + freshness weighting instruction | `src/lib/agents/review-aggregator/index.ts:197,215` | Quality |
| Added ~55 USDA synonyms (breakfast, Mediterranean, Latin, proteins) | `src/lib/usda/client.ts:366-428` | Data |
| Fixed duplicate `striped bass` key in USDA_SYNONYMS | `src/lib/usda/client.ts:410` | Bug fix |
| Fixed TypeScript errors in image-generator (inlineData + Buffer types) | `src/lib/agents/image-generator/index.ts:150-153,162` | Bug fix |
| Removed unused `totalSources` variable in review-aggregator | `src/lib/agents/review-aggregator/index.ts:193` | Lint fix |

**Metrics after session:**
- tsc: 0 errors (was 2 pre-existing errors)
- lint: 0 errors, 6 warnings (was 16 warnings)
- tests: 193/193 passing (unchanged — no regressions)

---

## Deferred (needs Dian approval or too risky)

- **DietAI RAG two-pass vision** — HIGH effort, needs testing harness
- **QR code compliance page following** — needs chain-specific URL research
- **Nutritionix API** — needs env vars + commercial key
- **Hybrid RRF search** — needs vector search activation first
- **UI: allergen "verify with restaurant" disclaimer** — pending Dian approval
- **UI: LCP priority prop for first 2 DishCards** — pending Dian approval
- **UI: ConfidenceDot touch target 24x24px** — pending Dian approval
- **CalCam two-pass macro validation** — 2x API cost, needs cost analysis
- **BullMQ sandboxed processors for photo/crawl workers** — significant refactor
- **Spokin confidence signal integration** — third-party API partnership needed
