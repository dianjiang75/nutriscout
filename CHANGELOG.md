# Changelog

All notable changes to NutriScout, in reverse chronological order.

---

## 2026-03-30 — Deployment Prep & Verification Fixes

### Added
- Railway deployment config (`railway.json`) with healthcheck and auto-restart
- Unified worker entry point (`workers/start-all.ts`) for running both BullMQ workers in one process
- Production scripts: `start:workers`, `start:crawl-worker`, `start:logistics-worker`, `db:migrate`, `db:seed`
- `prisma generate` added to build pipeline and postinstall hook
- Comprehensive project guide (`docs/GUIDE.md`)

### Fixed
- **Orchestrator logistics data** — Search results now include real wait times and busyness data. Previously hardcoded to `null`, causing all search cards to show "Wait N/A". Fixed by batch-fetching `RestaurantLogistics` for current day/hour.
- **Frontend data mapping** — Home page and dish detail page were misreading the search API response format. API returns flat fields (`calories_min`, `protein_min_g`) and nested `restaurant.name`, but UI expected a nested `macros` object and top-level `restaurant_name`. Fixed the mapping in both pages.
- **Seed script env loading** — `seed-demo.ts` failed with SCRAM auth error because `tsx` doesn't auto-load `.env`. Added `import "dotenv/config"`.

### Verified
- All 110 tests pass across 17 suites
- TypeScript compilation clean
- Next.js production build succeeds
- Search cards display colored wait time badges
- Macro bars show real nutritional data
- Restaurant names display correctly

---

## 2026-03-29 — Phase 12: Integration Tests, Seed Data & README

### Added
- **Seed script** (`scripts/seed-demo.ts`) — 18 East Village NYC restaurants, 137 dishes across 11 cuisines, 409 photos, 105 review summaries, 90 logistics entries, 18 delivery options, 1 demo user
- **End-to-end tests** (`__tests__/integration/e2e.test.ts`) — 9 tests covering user registration, login, profile update, vegan search, dish detail, long-wait alternatives, calorie limits, community feedback
- **README** with architecture diagram, tech stack, setup instructions, API docs

---

## 2026-03-29 — Phase 11: Frontend UI

### Added
- **Onboarding page** — 4-step wizard (info, dietary restrictions, goals, preferences)
- **Home/search page** — Geolocation, dish card feed, dietary filter chips, sort options (Best Match / Nearest / Top Rated / Shortest Wait), loading skeletons, infinite scroll
- **Dish detail page** — Photo carousel, macro range bars, dietary compliance badges, reviews with praises/complaints, restaurant info with wait badge, similar dishes, long-wait promotion banner
- **Profile page** — Edit dietary restrictions, nutritional goals, preferences
- **Components** — DishCard, MacroBar, ConfidenceDot, WaitBadge, RangeBar
- **Design system** — Custom CSS variables (ns-green, ns-amber, ns-red, ns-protein, ns-carbs, ns-fat, ns-calories) integrated with Tailwind v4

---

## 2026-03-29 — Phase 10: API Routes

### Added
- 14 REST API endpoints: auth (register/login), search, dish detail/similar/photos, restaurant detail/menu/traffic, community feedback, crawl (single/area)
- Full test coverage — 7 test files covering all endpoints
- Health check endpoint (DB + Redis connectivity)

### Fixed
- Area crawl route rejected `lat=0, lng=0` due to falsy check. Changed `!latitude` to `latitude == null`.

---

## 2026-03-28 — Phase 9: Background Workers

### Added
- BullMQ job queue system with Redis
- **Menu crawl worker** — Concurrency 3, rate limited 10/min, exponential backoff (5s/25s/125s)
- **Logistics update worker** — Concurrency 5, rate limited 20/min
- Queue definitions and shared Redis connection

---

## 2026-03-28 — Phase 8: Orchestrator & Evaluator

### Added
- **Atlas Orchestrator** — Main search coordinator: cache check, DB query with dietary/macro/cuisine filters, result enrichment, caching
- **Apollo Evaluator** — Dietary safety checker with 0.85 confidence threshold for allergy-critical flags
- **Similarity Engine** — Vector-based dish similarity using pgvector nearest-neighbor search

---

## 2026-03-28 — Phase 7: Semantic Cache Layer

### Added
- Redis cache client with ioredis (global singleton, lazy connect)
- Multi-tier TTL strategy: USDA (30d), menus (7d), reviews (3d), traffic (15min), queries (5min)
- Cache key generation for search queries based on dietary filters, nutritional goals, and location

---

## 2026-03-28 — Phase 6: Logistics Engine

### Added
- **Logistics Poller agent** — Fetches foot traffic from BestTime.app API
- Traffic data storage by restaurant, day-of-week, and hour
- Estimated wait time calculation based on busyness percentage

---

## 2026-03-27 — Phase 5: Review Aggregation

### Added
- **Review Aggregator agent** — Pulls Yelp reviews mentioning specific dishes
- Claude-powered summarization: extracts praises, complaints, and generates summary text
- Dish-level review storage with average rating and review count

---

## 2026-03-27 — Phase 4: Menu Discovery

### Added
- **Menu Crawler agent** — Multi-source menu extraction (website HTML/PDF, Google Places, Yelp)
- HTML scraping with Cheerio, PDF parsing with pdf-parse
- Dish extraction with name, description, price, and category

---

## 2026-03-27 — Phase 3: Vision Macro Estimation

### Added
- **Vision Analyzer agent** — Sends dish photos to Claude Vision API for macro estimation
- Ensemble analysis: multiple photos combined using MAD (Median Absolute Deviation) outlier detection
- Confidence scoring based on data source and photo count
- Range-based output (min/max for each macro) instead of false-precision single numbers

---

## 2026-03-27 — Phase 2: USDA Client

### Added
- USDA FoodData Central API client
- Ingredient-level nutrition lookup
- Reference data for validating vision-based estimates
- Rate limiting: 3,600 requests/hour

---

## 2026-03-27 — Phase 1: Project Scaffolding

### Added
- Next.js 16 project with App Router, React 19, TypeScript
- Tailwind CSS v4 with shadcn/ui (base-ui primitives)
- PostgreSQL schema via Prisma 7 with pgvector, cube, earthdistance extensions
- Docker Compose for local Postgres + Redis
- Full Prisma schema: User, Restaurant, Dish, DishPhoto, DishReviewSummary, RestaurantLogistics, DeliveryOption, CommunityFeedback
- Environment config with .env.example
