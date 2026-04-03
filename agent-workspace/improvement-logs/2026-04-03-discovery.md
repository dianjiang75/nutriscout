# Discovery Agent Report — 2026-04-03

## Coverage Analysis

### Current State
- **Total active discovery areas**: 20 (after seeding)
- **Total restaurants in DB**: 30
- **Areas scanned this run**: 3 (Midtown Manhattan, Flushing, Chinatown/Little Italy)
- **New restaurants found**: 50 (dry-run — not yet queued)

### Coverage by Borough
| Borough | Areas | Priority 1 | Priority 2-3 | Priority 4-5 |
|---------|-------|-----------|--------------|--------------|
| Manhattan | 15 | 3 (Midtown, Chinatown, Koreatown) | 10 | 2 |
| Brooklyn | 9 | 0 | 6 | 3 |
| Queens | 5 | 1 (Flushing) | 4 | 0 |
| Bronx | 2 | 0 | 1 | 1 |
| Denver | 4 | 0 | 3 | 1 |

### Sparse Areas (< 5 restaurants)
All areas are currently sparse — the DB has only 30 restaurants total across 20 areas. Priority: scan all P1/P2 areas first.

## Bug Fixes Applied

### 1. Yelp Business Match — City/State Extraction (CRITICAL)
**File**: `scripts/nightly-discovery.ts:141-155`
**Problem**: Yelp API `businesses/matches` endpoint was called with empty `city=` and `state=` params, causing all Yelp lookups to fail (especially for non-NYC areas like Denver).
**Fix**: Parse city and state from Google Places' `formattedAddress` field (format: "123 Main St, City, ST 12345, USA"). Extracts street, city, and state components correctly for both NYC and Denver addresses.

## New Discovery Areas Added

Added 15 new areas to `scripts/seed-discovery-areas.ts` based on trending food neighborhood research:

### NYC — Brooklyn (emerging, 5 new)
| Area | Lat/Lng | Radius | Priority | Rationale |
|------|---------|--------|----------|-----------|
| Bed-Stuy | 40.6872, -73.9418 | 0.5 mi | 3 | Growing bistro scene (Badaboom, etc.) |
| Red Hook | 40.6734, -74.0066 | 0.3 mi | 4 | New openings (Third Time's the Charm) |
| Greenpoint | 40.7274, -73.9514 | 0.4 mi | 3 | Malaysian, Polish, new concepts |
| Carroll Gardens / Gowanus | 40.6795, -73.9917 | 0.4 mi | 3 | Thai (Hungry Thirsty), new fast-casual |
| Prospect Heights | 40.6775, -73.9692 | 0.3 mi | 3 | Jewish deli, diverse scene |

### NYC — Queens (2 new)
| Area | Lat/Lng | Radius | Priority | Rationale |
|------|---------|--------|----------|-----------|
| Long Island City | 40.7425, -73.9365 | 0.4 mi | 2 | Booming dining scene, new cafes |
| Sunnyside / Woodside | 40.7432, -73.9053 | 0.4 mi | 3 | Diverse immigrant food scene |

### NYC — Bronx (2 new)
| Area | Lat/Lng | Radius | Priority | Rationale |
|------|---------|--------|----------|-----------|
| Arthur Avenue / Belmont | 40.8554, -73.8880 | 0.3 mi | 2 | NYC's "real Little Italy" |
| City Island | 40.8468, -73.7868 | 0.3 mi | 4 | Iconic seafood destination |

### NYC — Manhattan gaps (4 new)
| Area | Lat/Lng | Radius | Priority | Rationale |
|------|---------|--------|----------|-----------|
| Hell's Kitchen | 40.7638, -73.9918 | 0.4 mi | 2 | Dense restaurant row, diverse cuisine |
| Koreatown / Herald Square | 40.7481, -73.9872 | 0.25 mi | 1 | Concentrated Korean dining 24/7 |
| Washington Heights | 40.8417, -73.9393 | 0.5 mi | 3 | Dominican food hub |
| NoHo / Bowery | 40.7260, -73.9929 | 0.25 mi | 2 | High-end dining, new concepts |

### Denver expansion (2 new)
| Area | Lat/Lng | Radius | Priority | Rationale |
|------|---------|--------|----------|-----------|
| LoHi / Highland | 39.7580, -105.0093 | 0.4 mi | 2 | Denver's trendiest food neighborhood |
| Capitol Hill Denver | 39.7316, -104.9791 | 0.4 mi | 3 | Walkable, diverse, Xiquita (Best New 2025) |

## Dry-Run Results

```
Areas scanned:       3 (hit max-restaurants cap after 3 P1 areas)
Places found:        60
Already in DB:       0
New restaurants:     50
Jobs queued:         0 (dry-run)
```

### Top Discoveries
- **Midtown**: Din Tai Fung, ICHIRAN Ramen, Keens Steakhouse, Cho Dang Gol
- **Flushing**: Haidilao, Nan Xiang Soup Dumplings, Shanghai You Garden, Happy Lamb Hot Pot
- **Chinatown**: Golden Diner, Au Cheval, Scarr's Pizza, Joe's Shanghai

## Recommendations for Next Run

1. **Run LIVE** to queue the 50 discovered restaurants for crawling
2. **Increase MAX_RESTAURANTS** to 100 temporarily — only 3 of 20 areas were scanned due to the 50 cap
3. **Seed new areas** before next nightly run: `npx tsx scripts/seed-discovery-areas.ts`
4. **Priority scan order**: Koreatown (P1) → Hell's Kitchen (P2) → Arthur Avenue (P2) → LIC (P2) → LoHi (P2)
5. **Future markets to research**: SF Bay Area, Chicago, Los Angeles, Boston — for post-NYC expansion
