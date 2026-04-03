# FoodClaw Stress Test -- Emma (Explorer) Persona

**Date:** 2026-04-03
**Endpoint:** http://localhost:3000
**Location:** lat=40.7264, lng=-73.9878 (East Village, NYC)
**Runner:** Automated curl via Bash
**Total Tests:** 25

---

## Failures

### T9 -- Search "ramen" returns zero results

- **Endpoint:** `GET /api/search?q=ramen&lat=40.7264&lng=-73.9878`
- **Expected:** At least 1 dish (multiple ramen restaurants exist in the dataset, e.g. Raku serves udon/Japanese noodles)
- **Actual:** `{ "dishes": [], "total_count": 0 }` with HTTP 200
- **Impact:** Users searching for ramen -- a common East Village cuisine -- get no results. This is a search indexing or keyword-matching gap. The dataset has Japanese noodle dishes (Nabeyaki Udon, etc.) but none tagged or matching "ramen" by name or description.
- **Severity:** Medium. Core search miss for a popular food term in the area.
- **Suggested fix:** Either add ramen dishes to the seed data, or expand search to match related cuisine types (e.g., "ramen" should surface Japanese noodle soups).

---

## Summary

| # | Test | Result |
|---|------|--------|
| 1 | Default browse limit=20, unique IDs | PASS |
| 2 | category=thai filter | PASS |
| 3 | category=japanese filter | PASS |
| 4 | category=italian filter | PASS |
| 5 | Multi-category thai,japanese | PASS |
| 6 | category=mexican | PASS |
| 7 | Search "chicken" | PASS |
| 8 | Search "sushi" | PASS |
| 9 | Search "ramen" | **FAIL** |
| 10 | Search "salad" | PASS |
| 11 | Pagination offset=0/5/10 no overlap | PASS |
| 12 | Dish detail (first result) | PASS |
| 13 | Dish detail (second result) | PASS |
| 14 | Nonsense search returns empty, 200 | PASS |
| 15 | limit=1 returns exactly 1 | PASS |
| 16 | limit=100 handles gracefully | PASS |
| 17 | Search "pad thai" multi-word | PASS |
| 18 | Search single char "a" no crash | PASS |
| 19 | Sort=rating descending | PASS |
| 20 | Sort=distance ascending | PASS |
| 21 | /api/search/suggest?q=chi returns suggestions | PASS |
| 22 | /api/search/suggest?q=x returns OK | PASS |
| 23 | /api/restaurants returns restaurants with distances | PASS |
| 24 | /api/restaurants category=thai filter | PASS |
| 25 | /api/restaurants sort=rating descending | PASS |

## 24/25 PASS
