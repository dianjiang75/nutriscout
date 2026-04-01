<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# NutriScout Agent Architecture

## Core Agents (in codebase)

### 1. Vision Analyzer (`src/lib/agents/vision-analyzer/`)
- Analyzes food photos using Claude Vision API
- Estimates macros (calories, protein, carbs, fat) as ranges (min/max)
- Returns confidence scores and dietary flag inferences
- Model: claude-haiku-4-5 for cost efficiency

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
