# User Test Report -- Loop 3

**Date:** 2026-04-03
**Endpoint:** `GET /api/search`
**Location:** lat=40.7264, lng=-73.9878 (East Village, NYC)

## Summary

| # | Agent | Test | Result |
|---|-------|------|--------|
| 1 | EMMA | Default browse (limit=20) | PASS |
| 2 | EMMA | category=thai | PASS |
| 3 | EMMA | category=japanese | PASS |
| 4 | EMMA | categories=thai,italian | PASS |
| 5 | EMMA | Search "chicken" | PASS |
| 6 | EMMA | Pagination (offset 0 vs 5) | PASS |
| 7 | PETE | protein_min=30 | PASS |
| 8 | PETE | calorie_limit=500 | PASS |
| 9 | PETE | calories_max=500 (alias) | PASS |
| 10 | PETE | max_wait=10 | PASS |

**Result: 10/10 PASS**

## EMMA Tests -- Detail

### T1: Default browse (limit=20)
- Returned 20 dishes (total_count=45)
- Photos: 20/20 (100%) -- well above 50% threshold

### T2: category=thai
- Returned 12 dishes, all from Thai-cuisine restaurants
- Zero non-Thai results

### T3: category=japanese
- Returned 9 dishes, all from Japanese-cuisine restaurants
- Zero non-Japanese results

### T4: categories=thai,italian (multi-category)
- Returned 20 dishes (total_count=21)
- Cuisines seen: Thai, Isan, Italian, Italian-American, Seafood, American
- All dishes belong to restaurants tagged with at least one matching cuisine

### T5: Search "chicken"
- Returned 19 dishes, all containing "chicken" in name/description/data
- 100% relevance

### T6: Pagination
- offset=0, limit=10: 10 results
- offset=5, limit=10: 10 results
- Result sets are NOT identical -- pagination is working

## PETE Tests -- Detail

### T7: protein_min=30
- Returned 20 dishes
- Minimum protein_max_g across results: 40.3g (all well above 30g threshold)
- Maximum protein_max_g: 76.2g

### T8: calorie_limit=500
- Returned 20 dishes
- Zero dishes with calories_max > 500

### T9: calories_max=500 (alias check)
- calorie_limit=500 returned 20 dishes
- calories_max=500 returned 20 dishes
- Sorted ID lists are identical -- alias works correctly

### T10: max_wait=10 (previously broken)
- Returned 12 dishes
- Wait times seen: 7, 8, 9 minutes
- Maximum wait: 9 minutes -- all strictly below 10
- BUG IS FIXED
