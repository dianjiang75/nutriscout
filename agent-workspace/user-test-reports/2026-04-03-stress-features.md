# FoodClaw Stress Test: New Features + Edge Cases

**Date:** 2026-04-03
**Target:** http://localhost:3000
**Coordinates:** lat=40.7264, lng=-73.9878

## Failures

None.

## Summary

| # | Endpoint | Expected | Actual | Result |
|---|----------|----------|--------|--------|
| 1 | GET /recognize | 200 | 200 | PASS |
| 2 | GET /discover | 200 | 200 | PASS |
| 3 | GET /api/notifications/push/vapid-key | JSON with publicKey | publicKey present | PASS |
| 4 | GET /api/discover/viewport (no user coords) | restaurants array | array returned | PASS |
| 5 | GET /api/discover/viewport (with user coords) | distance/walk/drive | all populated | PASS |
| 6 | GET /api/search (no params) | 400 | 400 | PASS |
| 7 | GET /api/dishes/not-a-uuid | 400 | 400 | PASS |
| 8 | GET /api/dishes/00000000-... | 404 | 404 | PASS |
| 9 | GET /api/search lat=999&lng=999 | graceful | 400 | PASS |
| 10 | GET /api/restaurants/not-a-uuid | graceful | 400 | PASS |
| 11 | GET /api/search diet=invalid_diet | graceful | 200 (ignored) | PASS |
| 12 | GET /api/search sort=invalid_sort | graceful | 400 | PASS |
| 13 | GET /api/search calorie_limit=-1 | graceful | 400 | PASS |
| 14 | GET /api/health | healthy | healthy | PASS |
| 15 | GET /api/search/suggest?q= | empty suggestions | [] | PASS |

**15/15 PASS**
