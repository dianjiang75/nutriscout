# FoodClaw Session Handoff — April 5, 2026 (Session 2: Pipeline Refactor)

## What Was Done This Session

### Major Architecture: Two-Tier Menu + Dish System

Split the monolithic `crawlRestaurant()` into a two-tier data model with 5 independent agents:

**New data model:**
- `MenuItem` table — complete menu archive (everything scraped, soft-delete only)
- `Dish` table — promoted dish cards only (what users see in search)
- MenuItem → Dish link via `dishId` (many-to-one: multiple sources can feed one dish)

**5 Independent Agents:**
| Agent | File | BullMQ Queue | Purpose |
|-------|------|-------------|---------|
| Menu Scraper | `src/lib/agents/menu-scraper/` | `menu-scrape` | Fetch + parse + store MenuItem |
| Menu Classifier | `src/lib/agents/menu-classifier/` | `menu-classify` | Classify types + promote to Dish |
| Stale Archiver | `src/lib/agents/stale-archiver/` | `stale-archive` | Soft-archive old items |
| Photo Matcher | `src/lib/photos/match-photo.ts` | — | Fuzzy match disk images |
| Pipeline Orchestrator | `src/lib/agents/menu-pipeline/orchestrator.ts` | — | Chains agents via BullMQ |

**Workers:** `workers/menu-scrape-worker.ts`, `workers/menu-classify-worker.ts`, `workers/stale-archive-worker.ts`

### Classification System

**MenuItemType enum:** `dish`, `dessert`, `drink`, `alcohol`, `side`, `condiment`, `addon`, `combo`, `kids`, `unknown`

**Classification order:**
1. Category-based pre-tagging (restaurant's own menu sections → type, no LLM cost)
2. Name-based pre-tagging (`isWineOrSpirit()` → alcohol, `isComboOrMealDeal()` → combo, etc.)
3. LLM auditor for remaining `unknown` items (Gemini Flash → Qwen → DeepSeek fallback)

**Promotion rules (what gets a dish card):**
- `dish` → YES
- `dessert` → YES
- `drink` + `isInterestingBeverageOrCategory()` → YES (cocktails, lattes, specialty drinks)
- Everything else → NO (stored in MenuItem for full menu display)

### LLM Fallback Chains

Both dietary analyzer and food auditor use: **Claude Sonnet → Qwen 3 → DeepSeek V4 → placeholder**

Currently Claude ($0 balance) and Gemini (429 quota) are down. Qwen and DeepSeek handle everything.
When billing is topped up, Claude/Gemini are automatically tried first (first in chain).

### Data Protection

- `onDelete: Restrict` on Restaurant → MenuItem (prevents cascade data loss)
- Prisma `$extends` soft-delete middleware (disabled in Next.js due to Turbopack crash — enforced at app layer via `archive.ts`)
- Circuit breaker: if crawl returns < 20% of known items, skip archiving
- `hardDeleteMenuItem()` requires `auditConfidence >= 0.9` + `archivedReason = junk_detected` + 7-day grace

### Human Audit UI

**Standalone server** (bypasses Next.js Turbopack crashes):
```bash
npx tsx scripts/audit-server.ts
# http://localhost:3001      — Classifier audit
# http://localhost:3001/?tab=photos — Photo audit
```

Features: checkboxes, bulk approve, Google Image search button, reject button, type buttons (dish/dessert/drink/alcohol/side/etc.)

All corrections saved to `src/lib/agents/menu-classifier/corrections.json` as training data.

### Evaluation Framework

- Scraper evaluator: recall against known menu item counts
- Classifier evaluator: accuracy against 66 labeled ground truth items
- Run: `npx tsx scripts/run-evaluations.ts`
- Ground truth: `src/lib/agents/menu-scraper/ground-truth.json`, `src/lib/agents/menu-classifier/ground-truth.json`
- Corrections: `src/lib/agents/menu-classifier/corrections.json` (328 human corrections)

---

## Current DB State

```
Restaurants:       763 (284 crawled, 479 uncrawled)
Menu Items:        4,134 (1,678 fresh crawled + 2,456 backfill)
  dish:            2,490 (2,458 dish cards)
  alcohol:         1,277 (0 cards — never promoted)
  drink:           148 (52 cards — interesting beverages only)
  dessert:         44 (44 cards)
  side:            43 (14 cards)
  combo:           15 (7 cards)
  kids:            10 (0 cards)
  unknown:         101 (all archived as junk)
  condiment:       4
  addon:           2
Dishes:            3,309 (3,110 available)
Photos:            976 (fuzzy-matched from 1,371 files on disk)
Dietary flags:     1,315 dishes (via Qwen analysis)
Reviews:           144 (not re-run this session)
```

### Audit Queue Status
- Classifier: ~404 items still need review (fresh crawls with low confidence)
- Photos: ~952 unreviewed photo matches

---

## API Keys Status

| API | Status | Notes |
|-----|--------|-------|
| Google Places | ✅ Working | Free trial credit |
| Yelp Fusion | ✅ Working | 5,000/day free |
| Qwen 3 (DashScope) | ✅ Working | $0.16/M input — handles ALL classification + dietary |
| DeepSeek V4 | ✅ Working | $0.30/M input — backup for Qwen |
| Gemini Flash | ❌ 429 quota | Resets daily — upgrade at aistudio.google.com/plan |
| Anthropic Claude | ❌ $0 balance | Top up at console.anthropic.com/settings/billing |
| OpenAI GPT | ❌ Quota exhausted | Needs billing |

---

## Known Issues

### 1. Next.js Turbopack API Routes Crash
Next.js 16.2.x has a Turbopack bug where API routes fail to compile in dev mode (manifest files not written). **Workaround:** Use standalone audit server (`scripts/audit-server.ts`). Pinned to Next.js 16.2.0 but the issue is intermittent.

### 2. Prisma $extends Disabled
The soft-delete middleware via `$extends` causes Next.js server crashes. Disabled in `db/client.ts`. Delete protection is enforced at application layer via `archive.ts` functions. Re-enable when Next.js/Prisma compatibility improves.

### 3. Classification Accuracy for Backfill Data
2,456 backfill items have `menuItemType: 'dish'` regardless of actual type (no classification was done pre-refactor). These will be correctly classified on next re-crawl. Don't manually review backfill items — let the pipeline re-crawl and classify them.

### 4. Alcohol Still Leaking Through as Dishes
Some Italian/French wines with obscure producer names (no grape names, no vintage years) still get classified as `dish`. The auto-fixer catches vintage years + appellations + categories, but winery-name-only entries need the Gemini/Qwen auditor working to classify correctly.

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/audit-server.ts` | Standalone audit UI (port 3001) — use this, not Next.js |
| `scripts/batch-crawl.ts` | Crawl uncrawled restaurants (`--max N`, `--dry-run`, `--skip-classify`) |
| `scripts/backfill-menu-items.ts` | Migrate Dish → MenuItem (already run, don't re-run) |
| `scripts/apply-photo-matches.ts` | Fuzzy match disk photos to dishes |
| `scripts/run-evaluations.ts` | Run scraper + classifier accuracy evaluations |
| `scripts/test-crawl.ts` | Test single restaurant crawl with detailed output |
| `scripts/backup-db.sh` | DB backup (ALWAYS run before destructive ops) |

---

## What The Next Session Should Do

### Priority 1: Crawl Remaining 479 Restaurants
```bash
npx tsx scripts/batch-crawl.ts --max 100
```
Runs ~2 min per restaurant with menu. ~50% have parseable websites.

### Priority 2: Continue Audit Review (~404 classifier items, ~952 photos)
```bash
npx tsx scripts/audit-server.ts
# Open http://localhost:3001
```

### Priority 3: Re-Run Photo Matching After New Crawls
```bash
npx tsx scripts/apply-photo-matches.ts
```

### Priority 4: Enable Review Aggregation
Reviews pipeline already exists (`src/lib/agents/review-aggregator/`). Uses Qwen 3 (working). Needs to be run for all 763 restaurants.

### Priority 5: Top Up API Billing
- Anthropic: https://console.anthropic.com/settings/billing (needed for safety-critical dietary analysis)
- Gemini: https://aistudio.google.com/plan (needed for vision analysis + food verification)

---

## Architecture Diagram

```
Google Places API → Discovery Agent → restaurants table
                                           │
                                    Menu Scraper Agent
                                    (fetch + parse + store)
                                           │
                                      menu_items table
                                    (complete menu archive)
                                           │
                                   Menu Classifier Agent
                                (classify types + promote)
                                     │              │
                          ┌──────────┘              └──────────┐
                     Promoted items               Non-promoted items
                    (dish/dessert/drink)          (alcohol/side/combo/kids)
                          │                              │
                     dishes table                  Stay in menu_items
                   (dish cards for search)        (full menu display)
                          │
                ┌─────────┼──────────┐
           Photo Matcher  │   Dietary Analyzer
          (fuzzy match)   │  (Claude→Qwen→DeepSeek)
                          │
                   dish_photos table
                   + dietary_flags
                          │
                   Apollo Evaluator
                  (safety gate at search time)
                          │
                    Search Results
```

## Key Files Changed This Session

| File | What Changed |
|------|-------------|
| `prisma/schema.prisma` | Added MenuItem model, MenuItemType/MenuItemSource/ArchiveReason enums, isDishCard, alcohol type |
| `src/lib/db/client.ts` | Added (then disabled) $extends soft-delete middleware |
| `src/lib/ai/clients.ts` | Fixed Anthropic client to pass key explicitly |
| `src/lib/menu/archive.ts` | NEW — normalizeName(), archiveMenuItem(), hardDeleteMenuItem() |
| `src/lib/photos/match-photo.ts` | NEW — 3-strategy fuzzy photo matching |
| `src/lib/agents/menu-scraper/` | NEW — scrape agent (extracted from crawlRestaurant) |
| `src/lib/agents/menu-classifier/` | NEW — classify + promote agent, evaluator, ground truth |
| `src/lib/agents/stale-archiver/` | NEW — stale archival with circuit breaker |
| `src/lib/agents/menu-pipeline/` | NEW — FlowProducer orchestrator |
| `src/lib/agents/menu-crawler/index.ts` | Rewritten with 5-step flow, LLM fallback chains |
| `src/lib/agents/menu-crawler/clean-dish-name.ts` | Hardened isLikelyFoodItem(), expanded isInterestingBeverage(), new helpers |
| `src/lib/agents/menu-crawler/sources.ts` | Added allergen/nutrition/ingredient extraction |
| `src/lib/agents/dish-auditor/index.ts` | Expanded classification, LLM fallback, fail-open fix |
| `workers/menu-scrape-worker.ts` | NEW — BullMQ worker |
| `workers/menu-classify-worker.ts` | NEW — BullMQ worker |
| `workers/stale-archive-worker.ts` | NEW — BullMQ worker |
| `scripts/audit-server.ts` | NEW — standalone audit UI (port 3001) |
| `scripts/batch-crawl.ts` | NEW — batch crawl without Redis |

## WHAT NOT TO DO

1. ❌ **Do NOT run `seed-manhattan.ts`** — it deletes all data
2. ❌ **Do NOT upgrade Next.js past 16.2.0** — Turbopack API route crash
3. ❌ **Do NOT re-enable Prisma $extends** in db/client.ts — crashes Next.js server
4. ❌ **Do NOT manually review backfill items** — they'll be re-classified on next crawl
5. ❌ **Do NOT delete MenuItem records** — use soft-delete (archivedAt) via archive.ts
6. ❌ **Do NOT run batch crawl without backup** — `./scripts/backup-db.sh pre-crawl` first
