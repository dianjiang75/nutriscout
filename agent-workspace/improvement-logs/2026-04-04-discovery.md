# Discovery Agent Report — 2026-04-04

## Coverage Analysis

### Before
- **30 areas total**: 15 Manhattan-only discovery areas
- **30 restaurants** in DB
- **0 Brooklyn, 0 Queens, 0 Denver** coverage

### After
- **30 areas total**: 15 Manhattan + 7 Brooklyn + 4 Queens + 4 Denver
- **50 new restaurants** identified in dry run (Google Places API confirmed working)

## New Areas Added (15)

### Brooklyn (7 areas)
| Area | Lat/Lng | Radius | Priority | Rationale |
|------|---------|--------|----------|-----------|
| Williamsburg | 40.7081, -73.9571 | 0.4 mi | 1 | Top food destination: L'industrie, Peter Luger, Francie |
| Park Slope / Gowanus | 40.6710, -73.9814 | 0.4 mi | 2 | Pies 'n' Thighs expansion, Paulie Gee's Gowanus |
| Bushwick | 40.6944, -73.9213 | 0.4 mi | 3 | Emerging BBQ/Dominican scene (Bark Barbecue) |
| Carroll Gardens / Cobble Hill | 40.6795, -73.9991 | 0.3 mi | 2 | Bar Ferdinando, Gertrude's — refined dining |
| DUMBO / Brooklyn Heights | 40.7033, -73.9903 | 0.3 mi | 2 | Tourist + local dining hub |
| Fort Greene / Clinton Hill | 40.6882, -73.9718 | 0.35 mi | 3 | Diverse neighborhood dining |
| Prospect Heights / Crown Heights | 40.6775, -73.9619 | 0.4 mi | 3 | Caribbean & trendy spots |

### Queens (4 areas)
| Area | Lat/Lng | Radius | Priority | Rationale |
|------|---------|--------|----------|-----------|
| Flushing | 40.7580, -73.8306 | 0.4 mi | 1 | NYC's best Chinese food — Nan Xiang, Haidilao, 50+ spots |
| Astoria | 40.7724, -73.9301 | 0.4 mi | 2 | Greek, Middle Eastern, diverse |
| Jackson Heights | 40.7468, -73.8831 | 0.35 mi | 2 | Best South Asian food in NYC |
| Long Island City | 40.7425, -73.9566 | 0.35 mi | 3 | Growing food scene near waterfront |

### Denver (4 areas)
| Area | Lat/Lng | Radius | Priority | Rationale |
|------|---------|--------|----------|-----------|
| RiNo Denver | 39.7713, -104.9812 | 0.4 mi | 2 | Safta, Uchi, Denver Central Market |
| LoHi Denver | 39.7585, -105.0072 | 0.35 mi | 2 | Westword best restaurant neighborhood |
| LoDo Denver | 39.7530, -104.9990 | 0.35 mi | 3 | Downtown dining |
| Capitol Hill Denver | 39.7314, -104.9788 | 0.35 mi | 3 | Eclectic neighborhood dining |

## Dry Run Results

- **Areas scanned**: 3 of 10 due (hit 50 restaurant cap)
- **Flushing**: 20 new restaurants (Haidilao, Nan Xiang, Shanghai You Garden, etc.)
- **Williamsburg**: 20 new restaurants (Peter Luger, Francie, L'industrie, etc.)
- **Lower East Side**: 10 new restaurants (Scarr's Pizza, Kiki's, Dhamaka, etc.)
- **Total new**: 50 restaurants ready to queue

## Code Changes

1. **seed-discovery-areas.ts**: Added 15 new areas (7 Brooklyn, 4 Queens, 4 Denver)
2. **nightly-discovery.ts**: Added `addBulk` availability check for future batch optimization

## Recommendations for Next Run

1. Run live discovery to actually queue the 50 restaurants for crawling
2. After crawl completes, re-run to scan remaining 7 due areas
3. Consider increasing `MAX_RESTAURANTS_DEFAULT` to 100 now that we have 30 areas
4. Flushing alone has 20+ restaurants — may need radius increase or multiple scans
5. Denver areas need real traffic data to validate — may need radius adjustment
