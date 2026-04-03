# FoodClaw Stress Test -- Sam (Speed) Persona

**Date:** 2026-04-03
**Location:** lat=40.7264, lng=-73.9878
**Runner:** Claude (automated curl)

---

## /api/search Tests (1--10)

| # | Scenario | Result |
|---|----------|--------|
| 1 | sort=wait_time limit=20 -- ascending order | PASS |
| 2 | sort=distance limit=20 -- ascending order | PASS |
| 3 | max_wait=15 -- all waits < 15 | PASS |
| 4 | max_wait=10 -- all waits < 10 | PASS |
| 5 | max_wait=5 -- few or zero results | PASS |
| 6 | radius=1 -- all within 1 mile | PASS |
| 7 | radius=0.5 -- all within 0.5 mile | PASS |
| 8 | max_wait=15 + sort=distance -- both applied | PASS |
| 9 | radius=1 + sort=wait_time -- both applied | PASS |
| 10 | max_wait=10 + radius=2 + sort=wait_time -- all 3 applied | PASS |

## /api/restaurants Tests (11--15)

| # | Scenario | Result |
|---|----------|--------|
| 11 | sort=wait_time -- ascending | PASS |
| 12 | sort=rating -- descending | PASS |
| 13 | sort=distance -- ascending | PASS |
| 14 | max_wait=10 -- filtered | PASS |
| 15 | radius=1 -- filtered | PASS |

---

No failures recorded.

**15/15 PASS**
