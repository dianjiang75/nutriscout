# User Test Report: Loop 3 -- Sam & Fiona

**Date:** 2026-04-03
**Tester:** Agent (automated curl)
**Coordinates:** lat=40.7264, lng=-73.9878

## Summary

| # | Persona | Test | Result | Score |
|---|---------|------|--------|-------|
| 1 | SAM | sort=wait_time ascending | FAIL | 0/1 |
| 2 | SAM | max_wait=15 filter | FAIL | 0/1 |
| 3 | SAM | max_wait=10 (regression) | FAIL | 0/1 |
| 4 | SAM | max_wait=5 strict | FAIL | 0/1 |
| 5 | SAM | sort=distance & radius=1 | FAIL | 0.5/1 |
| 6 | FIONA | sort=rating descending | FAIL | 0/1 |
| 7 | FIONA | Dish detail (desc + review) | PASS | 1/1 |
| 8 | FIONA | /discover page 200 | PASS | 1/1 |
| 9 | FIONA | /recognize page 200 | PASS | 1/1 |
| 10 | FIONA | vapid-key endpoint | PASS | 1/1 |

**Overall: 3.5 / 10**

---

## Failures

### T1 FAIL -- sort=wait_time not sorting ascending

The API returns restaurants in default order regardless of `sort=wait_time`. First 5 estimated waits: `[12, 15, 16, 16, 11]` -- the 11 after 16 breaks ascending order.

**Endpoint:** `GET /api/restaurants?lat=40.7264&lng=-73.9878&sort=wait_time`

### T2 FAIL -- max_wait=15 not filtering

All 20 restaurants returned regardless of `max_wait=15`. Found 9 restaurants with waits over 15 (values: 16, 16, 18, 20, 16, 20, 19, 18, 20).

**Endpoint:** `GET /api/restaurants?lat=40.7264&lng=-73.9878&max_wait=15`

### T3 FAIL -- max_wait=10 still broken (regression confirmed)

Previously reported as broken; still broken. All 20 restaurants returned with no filtering. 16 of 20 have waits exceeding 10.

**Endpoint:** `GET /api/restaurants?lat=40.7264&lng=-73.9878&max_wait=10`

### T4 FAIL -- max_wait=5 not filtering

All 20 restaurants returned. Only 1 restaurant (L'Artusi, wait=5) should qualify. Instead 19 of 20 have waits exceeding 5.

**Endpoint:** `GET /api/restaurants?lat=40.7264&lng=-73.9878&max_wait=5`

### T5 PARTIAL FAIL -- radius=1 not filtering (sort works)

Distance sorting IS working (ascending order confirmed). However, the `radius=1` filter is ignored -- 7 restaurants beyond 1 mile are returned (up to 4.6 miles). Partial credit for working sort.

**Endpoint:** `GET /api/restaurants?lat=40.7264&lng=-73.9878&sort=distance&radius=1`

### T6 FAIL -- sort=rating not descending

Ratings are not sorted: `[4.5, 4.4, 4.5, 4.4, 4.4, 4.4, 4.5, 4.3, 4.3, 4.6, 4.7, ...]`. The highest-rated restaurant (Sushi Nakazawa, 4.7) appears at position 11 instead of position 1.

**Endpoint:** `GET /api/restaurants?lat=40.7264&lng=-73.9878&sort=rating`

---

## Passes

- **T7** -- `/api/dishes/{id}` returns description (72 chars > 20) and `review_summary` object with `average_rating`, `summary`, `review_count`, `praises`, and `complaints`.
- **T8** -- `/discover` returns HTTP 200.
- **T9** -- `/recognize` returns HTTP 200.
- **T10** -- `/api/notifications/push/vapid-key` returns HTTP 200 with `{"success":true,"data":{"publicKey":""}}`. Note: publicKey is empty string (may need VAPID key configuration).

---

## Root Cause Analysis

All 5 SAM failures and the FIONA sort failure share the same root cause: **the `/api/restaurants` route does not implement `sort`, `max_wait`, or `radius` query parameter handling**. The route returns all active restaurants in default database order regardless of these parameters. The parameters are accepted but ignored in the query logic.

### Recommended Fix

In `src/app/api/restaurants/route.ts`:
1. Add `WHERE estimated_wait <= :max_wait` filtering when `max_wait` param is present
2. Add `WHERE distance <= :radius` filtering when `radius` param is present
3. Add `ORDER BY` clause for `sort=wait_time` (ASC), `sort=rating` (DESC), `sort=distance` (ASC)
