# Discovery Agent Report — 2026-04-05

## Coverage Analysis

**Before:** 30 discovery areas (15 Manhattan, 7 Brooklyn, 4 Queens, 4 Denver), 30 restaurants in DB.

**After:** 45 discovery areas across all 5 NYC boroughs + expanded Denver.

## New Areas Added (15 total)

### Manhattan (+2)
- Murray Hill / Curry Hill (priority 2) — Lexington Ave Indian restaurant corridor
- Inwood (priority 3) — Dominican food destination at Manhattan's tip

### Brooklyn (+4)
- Sunset Park (priority 2) — 8th Ave Chinatown, major food destination
- Greenpoint (priority 2) — Polish + new American dining scene
- Bay Ridge (priority 3) — Middle Eastern and Italian food hub
- Flatbush / Ditmas Park (priority 3) — Caribbean food corridor

### Queens (+4)
- Woodside / Sunnyside (priority 3) — Thai, Filipino, Turkish mix
- Elmhurst (priority 2) — Southeast Asian food hub (Thai, Malay, Indonesian)
- Forest Hills (priority 3) — Central Asian (Uzbek, Georgian) restaurants
- Corona (priority 3) — Mexican street food destination

### Bronx (+2) — NEW BOROUGH
- Arthur Avenue / Belmont (priority 2) — NYC's real Little Italy
- City Island (priority 3) — Seafood destination

### Staten Island (+1) — NEW BOROUGH
- St. George / Tompkinsville (priority 3) — Sri Lankan food capital of US

### Denver (+4)
- South Broadway (SoBo) (priority 3) — restaurant row
- Tennyson Street (priority 3) — boutique dining corridor
- Federal Boulevard (priority 2) — Vietnamese/Mexican food strip, huge density
- Stanley Marketplace / Aurora (priority 3) — food hall + Aurora's diverse dining

## Code Fixes Applied

### seed-discovery-areas.ts
- **Added coordinate proximity dedup**: seed script previously only checked name for duplicates. Now also checks if coordinates are within 0.01 degrees (~1km), matching the API route's dedup logic. Prevents seeding overlapping areas.

## Dry-Run Results

```
Areas scanned:       3 (Flushing, Williamsburg, LES — hit 50-restaurant cap)
Places found:        60
Already in DB:       0
New restaurants:     50 (cap reached)
Jobs queued:         0 (dry run)
```

Notable finds: Haidilao Hotpot, Nan Xiang Soup Dumplings, Peter Luger, L'industrie Pizzeria, Dhamaka, Scarr's Pizza.

## Recommendations

1. **Run live discovery** (`npx tsx scripts/nightly-discovery.ts`) to queue the 50 new restaurants for crawl
2. **Re-seed** (`npx tsx scripts/seed-discovery-areas.ts`) to add the 15 new areas to the database
3. **Increase MAX_RESTAURANTS** from 50 to 75 — 3 areas consumed the entire budget; at 10 areas per night, many areas won't get scanned
4. **Bronx/SI coverage is thin** — Arthur Avenue alone could yield 20+ restaurants; consider adding Mott Haven (Bronx) for emerging food scene
5. **Elmhurst/Corona priority** should be elevated to 1 — these are among NYC's most food-dense, diverse neighborhoods
