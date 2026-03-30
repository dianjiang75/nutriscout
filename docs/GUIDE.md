# NutriScout — How It All Works

A plain-English walkthrough of what NutriScout is, how every piece fits together, and why we made the choices we did.

---

## What Is NutriScout?

NutriScout is a **dish-first food discovery app**. Instead of browsing restaurants and hoping to find something that fits your diet, you search for *dishes* — and NutriScout finds ones that match your dietary restrictions (vegan, gluten-free, halal, etc.) and nutritional goals (high protein, low carb, etc.) at restaurants near you.

Think of it as: "Show me high-protein, gluten-free meals within a mile of me, sorted by shortest wait time."

---

## The Big Picture

Here's the flow from a user's perspective:

1. **Onboarding** — You tell the app your dietary restrictions, nutritional goals, and preferences (max walk distance, max wait time, price range).
2. **Search** — The home screen shows a feed of dish cards near your location, filtered by your preferences. You can toggle dietary filters (vegan, halal, etc.) and sort by match quality, distance, rating, or wait time.
3. **Dish Detail** — Tap a dish to see its estimated macros (calories, protein, carbs, fat) shown as ranges, dietary compliance badges, user reviews, restaurant info, current wait time, and similar alternatives.
4. **Profile** — Update your dietary restrictions and goals anytime.

---

## How Data Gets Into the System

NutriScout doesn't have a restaurant owner portal. Instead, it **crawls** restaurant data automatically through a pipeline of AI agents:

### Step 1: Restaurant Discovery

The **area crawl** endpoint takes a latitude, longitude, and radius, then calls the Google Places API to find restaurants in that area. Each restaurant gets stored with its name, address, coordinates, cuisine type, and Google rating.

### Step 2: Menu Crawling

The **Menu Crawler agent** takes a restaurant's Google Place ID and tries to find its menu through multiple sources (in order of preference):

1. The restaurant's own website (scrapes HTML or PDF menus)
2. Google Places menu data
3. Yelp listing

It extracts dish names, descriptions, prices, and categories. This runs as a **background job** — when you trigger a crawl, it gets queued and processed by a BullMQ worker (more on workers below).

### Step 3: Photo-Based Macro Estimation

This is the core innovation. The **Vision Analyzer agent** uses Claude's vision API to analyze photos of each dish and estimate its macronutrients:

- It sends dish photos to Claude and asks it to estimate calories, protein, carbs, and fat
- Each analysis returns a **range** (e.g., 450-550 calories), not a single number — because estimating macros from photos is inherently uncertain
- If multiple photos exist, it runs analysis on each one separately, then combines the results using **MAD (Median Absolute Deviation)** outlier detection — this throws out any wildly different estimate and averages the rest
- The result includes a **confidence score** (0-1) that reflects how certain the estimate is

The confidence intervals widen based on how much data we have:
- Restaurant-published nutrition info: +-5% (most reliable)
- 10+ photos analyzed: +-15%
- 2-3 photos: +-25%
- Just 1 photo: +-35% (least reliable)

### Step 4: USDA Cross-Reference

The **USDA client** queries the USDA FoodData Central database to cross-reference macro estimates. If a dish contains identifiable ingredients (like "grilled chicken breast"), we can look up USDA's reference data and use it to validate or narrow the vision-based estimates.

### Step 5: Review Aggregation

The **Review Aggregator agent** pulls reviews from Yelp that mention specific dishes. It uses Claude to:

- Summarize what reviewers say about the dish
- Extract common praises ("generous portions", "perfectly seasoned")
- Extract common complaints ("too salty", "small serving")
- Generate an average dish-specific rating

### Step 6: Logistics / Foot Traffic

The **Logistics Poller agent** checks BestTime.app for real-time foot traffic data at each restaurant. It stores:

- Current busyness percentage (how full the restaurant is right now)
- Estimated wait time in minutes

This data is stored by day-of-week and hour, so the system knows typical patterns (e.g., "this place is always packed at 7pm on Fridays").

---

## How Search Works (The Atlas Orchestrator)

When you search for dishes, the **Atlas Orchestrator** coordinates everything:

1. **Cache check** — First, it checks Redis to see if someone recently ran a similar query. If so, it returns the cached results instantly (cache lives for 5 minutes).

2. **Database query** — It builds a Prisma query that filters by:
   - Dietary flags (e.g., `vegan = true AND gluten_free = true`)
   - Calorie/protein limits
   - Restaurant cuisine preferences
   - Only active restaurants and available dishes

3. **Logistics lookup** — It batch-fetches current wait times for all restaurants in the result set (matching today's day and current hour).

4. **Result enrichment** — Each dish gets packaged with its macros, dietary flags, restaurant info, review summary, and current wait time.

5. **Safety evaluation** — The results pass through the **Apollo Evaluator** before being returned.

6. **Cache storage** — Results get cached in Redis for the next similar query.

### Sorting

Depending on what you pick, results are sorted by:
- **Best Match** — default, sorted by newest
- **Nearest** — by distance (requires PostGIS earth_distance calculation)
- **Top Rated** — by review rating
- **Shortest Wait** — by current estimated wait time
- **Max Protein** / **Min Calories** / etc. — by the relevant macro field

---

## The Apollo Evaluator (Dietary Safety)

This is one of the most important pieces. The Apollo Evaluator checks every dish result for dietary safety before showing it to you.

**The core rule:** For allergy-critical flags (nut_free, gluten_free), a dish must have at least **85% confidence** to be labeled as safe. If confidence is below that threshold, the dish gets a warning.

**Why this matters:** If someone has a nut allergy and we're only 60% sure a dish is nut-free, we should NOT present it as safe. We'd rather show fewer results than risk someone's health. **False negatives (missing a safe dish) are acceptable. False positives (showing an unsafe dish as safe) are not.**

---

## The Caching Strategy

Redis caches data at multiple tiers, each with a different TTL (time-to-live):

| Data Type | Cache Duration | Why |
|-----------|---------------|-----|
| USDA nutrition data | 30 days | Doesn't change |
| Restaurant/menu info | 7 days | Menus change slowly |
| Macro estimates | 7 days | Recalculated on new photos |
| Review summaries | 3 days | New reviews trickle in |
| Traffic/delivery | 15 minutes | Changes frequently |
| Search queries | 5 minutes | Keeps popular searches fast |

This means the first person to search "vegan near East Village" waits a couple seconds. Everyone after them for the next 5 minutes gets instant results.

---

## Background Workers

Some tasks are too slow to run during a web request (crawling a menu can take 30+ seconds). These run as **background jobs** using BullMQ (a Redis-based job queue):

### Menu Crawl Worker
- Processes restaurant menu crawl jobs
- Concurrency: 3 jobs at a time
- Rate limited: max 10 jobs/minute (to respect external API limits)
- Automatic retry with exponential backoff: 5s, 25s, 125s

### Logistics Worker
- Updates foot traffic data for restaurants
- Concurrency: 5 jobs at a time
- Rate limited: max 20 jobs/minute

Workers run as a **separate process** from the web server. In production, this means a separate Railway service running `npm run start:workers`.

---

## The Database

PostgreSQL 17 with three important extensions:

### pgvector
Stores vector embeddings for dishes. This powers the **similar dishes** feature — each dish gets a vector representation, and finding "similar dishes" is a nearest-neighbor search in vector space.

### cube + earthdistance
These work together to calculate real geographic distances. When you search "within 1 mile", the database uses these extensions to compute actual distances between your coordinates and each restaurant's coordinates.

### Key Tables

| Table | What It Stores |
|-------|---------------|
| `User` | Account info, dietary restrictions, nutritional goals, preferences |
| `Restaurant` | Name, address, coordinates, cuisine type, Google rating |
| `Dish` | Name, description, price, macro ranges, dietary flags, confidence scores |
| `DishPhoto` | Photo URLs and their source (user, Google, Yelp) |
| `DishReviewSummary` | AI-generated review summary, praises, complaints, rating |
| `RestaurantLogistics` | Busyness % and wait time, by day-of-week and hour |
| `DeliveryOption` | Which delivery platforms serve each restaurant |
| `CommunityFeedback` | User-submitted corrections to dietary flags or macros |

---

## The Frontend

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, and shadcn/ui components.

### Pages

| Page | What It Does |
|------|-------------|
| `/onboarding` | 4-step wizard: basic info, dietary restrictions, nutritional goals, preferences |
| `/` (home) | Search feed with dietary filter chips, sort options, dish card grid, infinite scroll |
| `/dish/[id]` | Full dish detail: photo carousel, macro range bars, dietary badges, reviews, restaurant info, similar dishes |
| `/profile` | Edit your dietary restrictions, goals, and preferences |

### Key UI Components

- **DishCard** — The main card in the search feed. Shows dish photo, name, restaurant, macro bar, confidence indicator, rating, distance, wait time badge, and delivery platform badges.
- **MacroBar** — Horizontal stacked bar showing protein/carbs/fat proportions at a glance.
- **ConfidenceDot** — Green/amber/red dot indicating how reliable the macro estimate is.
- **WaitBadge** — Color-coded wait time: green (<=5 min), amber (<=20 min), red (>20 min).
- **RangeBar** — On the dish detail page, shows macro ranges as filled bars (e.g., 450-550 cal out of a 1200 cal scale).

### Smart UI Behavior

- **Long wait promotion:** If a dish's restaurant has a >20 minute wait, the detail page shows a banner with similar dishes at nearby restaurants with shorter waits.
- **Progressive loading:** The page loads instantly with cached data. Live data (traffic, delivery) loads asynchronously.
- **Geolocation:** The app auto-detects your location. Falls back to NYC East Village if denied.

---

## The Demo Data

The seed script creates a realistic dataset for development and demos:

- **18 restaurants** in NYC's East Village across 11 cuisines (Thai, Mexican, Italian, Indian, Japanese, American, Mediterranean, Vietnamese, Korean, Chinese, French)
- **137 dishes** with realistic macro ranges and dietary flags
- **409 photos** (placeholder URLs)
- **105 review summaries** with praises and complaints
- **90 logistics entries** (traffic data by day/hour)
- **18 delivery options** (DoorDash, Uber Eats, Grubhub)
- **1 demo user** with vegan + gluten-free restrictions

---

## External APIs Used

| API | What We Use It For | Rate Limit |
|-----|-------------------|------------|
| Google Places | Restaurant discovery, menu links, photos | Per Google billing |
| Anthropic Claude | Vision macro estimation, review summarization, menu parsing | Per Anthropic billing |
| USDA FoodData Central | Reference nutrition data for ingredients | 3,600/hour |
| Yelp Fusion | Restaurant reviews, additional menu data | 5,000/day |
| BestTime.app | Real-time foot traffic and busyness data | 100/hour |

---

## How It All Connects

Here's the full lifecycle of a dish, from discovery to your screen:

```
Restaurant discovered via Google Places API
    |
    v
Menu crawled (website/Google/Yelp) --> Dishes stored in DB
    |
    v
Photos analyzed by Claude Vision --> Macro ranges estimated
    |
    v
USDA data cross-referenced --> Estimates refined
    |
    v
Reviews pulled from Yelp --> Summaries generated by Claude
    |
    v
Traffic data from BestTime --> Wait times stored by hour
    |
    v
You search "high protein near me"
    |
    v
Atlas Orchestrator queries DB with your filters
    |
    v
Apollo Evaluator checks dietary safety
    |
    v
Results cached in Redis, sent to your phone
    |
    v
You tap a dish --> Detail page with full macros, reviews, wait time
    |
    v
Long wait? --> "Try these similar dishes nearby" banner
```

---

## What's NOT Built Yet

- Distance-based sorting (needs PostGIS `earth_distance` queries wired into the orchestrator)
- Real delivery platform integration (currently just stores which platforms are available)
- User authentication with proper JWT/session tokens (current auth is simplified)
- Push notifications for wait time changes
- Restaurant owner dashboard for claiming and updating listings
- Scheduled nightly crawl automation (script exists but no cron/scheduler)
