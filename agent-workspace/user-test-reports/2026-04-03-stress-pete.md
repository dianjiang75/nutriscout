# Pete (Protein) Stress Test -- 2026-04-03

**Endpoint base:** `http://localhost:3000`
**Coordinates:** lat=40.7264, lng=-73.9878
**Method:** All 20 tests via curl, automated assertions

---

## Failures

### T16: Similar dishes for high-protein dish -- FAIL

- **Endpoint:** `GET /api/dishes/:id/similar?lat=40.7264&lng=-73.9878`
- **Dish tested:** Special Pho (`cd65bd2b-972d-4328-9251-ab57e1aed3fe`)
- **Error:** `Raw query failed. Code: 42703. Message: column "macro_embedding" does not exist`
- **Root cause:** The `/similar` endpoint references a `macro_embedding` column that does not exist in the database schema. The vector-similarity query is broken.
- **Severity:** High -- the "similar dishes" feature is completely non-functional.

---

## Summary

**19/20 PASS**

| # | Test | Result |
|---|------|--------|
| 1 | protein_min=30 | PASS |
| 2 | protein_min=50 | PASS |
| 3 | protein_min=100 | PASS |
| 4 | calorie_limit=500 | PASS |
| 5 | calorie_limit=300 | PASS |
| 6 | calorie_limit=200 | PASS |
| 7 | calories_max=500 (alias) | PASS |
| 8 | protein_min=25 + calorie_limit=600 | PASS |
| 9 | protein_min=20 + calorie_limit=800 | PASS |
| 10 | goal=max_protein + sort=macro_match | PASS |
| 11 | goal=min_calories + sort=macro_match | PASS |
| 12 | goal=max_protein + protein_min=30 | PASS |
| 13 | max_wait=10 on /api/search | PASS |
| 14 | max_wait=15 on /api/search | PASS |
| 15 | max_wait=5 on /api/search | PASS |
| 16 | Similar dishes for high-protein dish | **FAIL** |
| 17 | Dish detail macro check | PASS |
| 18 | /api/restaurants?max_wait=10 | PASS |
| 19 | /api/restaurants?max_wait=15 | PASS |
| 20 | /api/restaurants?radius=0.5 | PASS |
