# NutriScout

**Dish-first food discovery platform.** Find restaurant dishes that match your dietary needs and nutritional goals using AI-powered menu analysis, photo-based macro estimation, and real-time logistics.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Next.js 16 Frontend               │
│  Onboarding → Search Feed → Dish Detail → Profile    │
└──────────────┬───────────────────────────────────────┘
               │ REST API (/api/*)
┌──────────────▼───────────────────────────────────────┐
│                   API Routes Layer                    │
│  auth · search · dishes · restaurants · feedback     │
└──────┬───────────────────────────────────┬───────────┘
       │                                   │
┌──────▼──────┐  ┌───────────┐  ┌─────────▼──────────┐
│   Atlas     │  │  Apollo   │  │  Background Workers │
│ Orchestrator│──│ Evaluator │  │  (BullMQ + Redis)   │
└──┬──────────┘  └───────────┘  └──────┬──────────────┘
   │                                    │
┌──▼────────────────────────────────────▼──────────────┐
│                    Agent Layer                         │
│ Vision Analyzer · Menu Crawler · Review Aggregator    │
│ Logistics Poller · Similarity Engine                  │
└──┬──────────┬───────────┬──────────────┬─────────────┘
   │          │           │              │
┌──▼──┐ ┌────▼───┐ ┌─────▼────┐ ┌──────▼──────┐
│USDA │ │Claude  │ │Google    │ │BestTime.app │
│ API │ │Vision  │ │Places/   │ │(foot        │
│     │ │API     │ │Yelp      │ │ traffic)    │
└─────┘ └────────┘ └──────────┘ └─────────────┘
               │
        ┌──────▼──────┐
        │ PostgreSQL   │
        │ + pgvector   │
        │ Redis cache  │
        └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| Backend | Next.js API Routes, TypeScript |
| Database | PostgreSQL 17 + pgvector, cube, earthdistance |
| Cache | Redis 7 via ioredis, multi-tier TTL (5 min → 30 days) |
| Queue | BullMQ — menu crawl + logistics update workers |
| AI | Anthropic Claude (Sonnet for real-time, Haiku for batch) |
| External APIs | USDA FoodData Central, Google Places, Yelp Fusion, BestTime.app |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 17 with pgvector extension
- Redis 7

### Install

```bash
npm install
```

### Environment

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `GOOGLE_PLACES_API_KEY` | Google Places API key |
| `USDA_API_KEY` | USDA FoodData Central API key |
| `YELP_API_KEY` | Yelp Fusion API key |
| `BESTTIME_API_KEY` | BestTime foot traffic API key |

### Database Setup

```bash
npx prisma migrate dev       # Run migrations
npx prisma generate          # Generate client
npm run db:seed              # Seed 18 restaurants, 137 dishes in NYC East Village
```

### Run Locally

```bash
# Dev server (port 3000)
npm run dev

# Background workers (separate terminal)
npm run start:workers
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check (DB + Redis) |
| `POST` | `/api/auth/register` | Create user account |
| `POST` | `/api/auth/login` | Login by email |
| `PATCH` | `/api/users/profile` | Update dietary preferences & goals |
| `GET` | `/api/search` | Search dishes by location, diet, macros |
| `GET` | `/api/dishes/[id]` | Dish detail with macros and reviews |
| `GET` | `/api/dishes/[id]/similar` | Similar dishes nearby |
| `GET` | `/api/dishes/[id]/photos` | Dish photo gallery |
| `GET` | `/api/restaurants/[id]` | Restaurant detail |
| `GET` | `/api/restaurants/[id]/menu` | Full menu |
| `GET` | `/api/restaurants/[id]/traffic` | Current foot traffic & wait time |
| `POST` | `/api/feedback` | Submit community feedback on a dish |
| `POST` | `/api/crawl/restaurant` | Trigger on-demand menu crawl |
| `POST` | `/api/crawl/area` | Discover restaurants in radius |

## Deployment (Railway)

NutriScout is configured for [Railway](https://railway.app) with `railway.json`.

### Services

| Service | Start Command | Purpose |
|---------|--------------|---------|
| **Web** | `npm run db:migrate && npm start` | Next.js app (auto-detected) |
| **Worker** | `npm run start:workers` | BullMQ crawl + logistics workers |
| **Postgres** | Railway plugin | Enable pgvector, cube, earthdistance |
| **Redis** | Railway plugin | Cache + job queue (TCP, not REST) |

### Deploy Steps

1. Push repo to GitHub
2. Create a new Railway project, connect the repo
3. Add Postgres and Redis plugins
4. Enable PostgreSQL extensions: `pgvector`, `cube`, `earthdistance`
5. Add a second service from the same repo for workers — set start command to `npm run start:workers`
6. Set env vars: `DATABASE_URL` and `REDIS_URL` are auto-injected by plugins; add the API keys manually
7. First deploy: run `npm run db:seed` via Railway CLI or shell

## Crawl Pipeline

```bash
# Single restaurant
npx tsx scripts/crawl-restaurant.ts <google_place_id>

# Area discovery
npx tsx scripts/seed-area.ts <lat> <lng> <radius_miles>

# Nightly full crawl
npx tsx scripts/nightly-crawl.ts
```

## Tests

```bash
npm test                # 110 tests across 17 suites
npx tsc --noEmit        # Type check
npm run build           # Production build
```

## Design Decisions

1. **Dietary safety first.** Apollo evaluator enforces 0.85 confidence threshold for allergy-critical flags (nut_free, gluten_free). False negatives over false positives.

2. **Ranges, not false precision.** Macro estimates show confidence intervals that widen by data source: restaurant-published (+-5%), 10+ photos (+-15%), 2-3 photos (+-25%), 1 photo (+-35%).

3. **Cache-first architecture.** Redis multi-tier cache (USDA: 30d, menus: 7d, traffic: 15min, queries: 5min). Live data loads progressively. Target: <2s initial page load.

4. **Ensemble photo analysis.** Multiple photo analyses combined using MAD (Median Absolute Deviation) outlier detection for robust macro estimation.

5. **Rate-limited external APIs.** Sliding-window rate limiter: USDA 3600/hr, Yelp 5000/day, BestTime 100/hr.
