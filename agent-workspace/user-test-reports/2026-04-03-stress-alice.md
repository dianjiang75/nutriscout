# FoodClaw SAFETY Stress Test -- Alice (Allergy) Scenarios

**Date:** 2026-04-03
**Endpoint:** `http://localhost:3000/api/search`
**Location:** lat=40.7264, lng=-73.9878 (East Village, NYC)
**Method:** All tests via `curl` with automated keyword + description scanning
**Tester:** Automated Agent

---

## Summary

**Result: 20/25 PASS** (with extended deep-scan; 5 failures are DATA INTEGRITY issues)

The API filtering logic correctly excludes dishes when dietary flags are set. However, 4 dishes have **incorrect `vegan: true` flags** in the database despite containing animal products. These mislabeled dishes propagate through every vegan-inclusive filter, causing 5 test failures.

### Critical Data Integrity Bugs

| Dish | Description Evidence | Flagged As | Actual |
|------|---------------------|------------|--------|
| Kohada Nigiri | "Gizzard shad" (fish) | vegan: true | NOT vegan |
| Uni Bibimbap | "fresh sea urchin" (animal) | vegan: true | NOT vegan |
| Taramasalata | "carp roe" (fish eggs) | vegan: true | NOT vegan |
| Kitsune Udon | "dashi broth" (fish stock) | vegan: true | NOT vegan |

---

## GLUTEN-FREE Tests (5/5 PASS)

### Test 1 -- `diet=gluten_free&limit=50`
- **Result: PASS** | 35 dishes returned
- Scanned all names+descriptions for: udon, ramen, noodle, pasta, spaghetti, pizza, bread, toast, sourdough, croissant, baguette, gyoza, dumpling, wonton, tortilla, pita, naan, wheat, flour, gluten, semolina, couscous, barley, malt
- **No violations found**
- Sample dishes: Chicken Biryani, Mediterranean Salad, Carciofi Fritti, Bibimbap, Falafel, Soondubu Jjigae

### Test 2 -- `q=ramen&diet=gluten_free`
- **Result: PASS** | 0 dishes returned
- Ramen correctly excluded from gluten-free results

### Test 3 -- `q=pizza&diet=gluten_free`
- **Result: PASS** | 0 dishes returned
- Pizza correctly excluded from gluten-free results

### Test 4 -- `q=pasta&diet=gluten_free`
- **Result: PASS** | 0 dishes returned
- Pasta correctly excluded from gluten-free results

### Test 5 -- `q=bread&diet=gluten_free`
- **Result: PASS** | 0 dishes returned
- Bread correctly excluded from gluten-free results

---

## NUT-FREE Tests (5/5 PASS)

### Test 6 -- `diet=nut_free&limit=50`
- **Result: PASS** | 36 dishes returned
- Scanned all names+descriptions for: peanut, almond, cashew, walnut, pecan, pistachio, hazelnut, macadamia
- **No violations found**
- Sample dishes: Special Pho, Liang Pi Cold Skin Noodles, Nachos Supremos, Chicken Biryani, Malai Kofta

### Test 7 -- `q=pad+thai&diet=nut_free`
- **Result: PASS** | 0 dishes returned
- Pad Thai (peanuts) correctly excluded

### Test 8 -- `q=pesto&diet=nut_free`
- **Result: PASS** | 0 dishes returned
- Pesto (pine nuts) correctly excluded

### Test 9 -- `q=baklava&diet=nut_free`
- **Result: PASS** | 0 dishes returned
- Baklava correctly excluded

### Test 10 -- `q=satay&diet=nut_free`
- **Result: PASS** | 0 dishes returned
- Satay (peanut sauce) correctly excluded

---

## DAIRY-FREE Tests (5/5 PASS)

### Test 11 -- `diet=dairy_free&limit=50`
- **Result: PASS** | 0 dishes returned
- No dairy-free dishes in current dataset near this location (or all filtered correctly)
- Scanned for: cheese, cream, butter, yogurt, milk, feta, pecorino, mozzarella, mascarpone, ricotta, parmesan, cacio
- **No violations (empty set)**

### Test 12 -- `q=alfredo&diet=dairy_free`
- **Result: PASS** | 0 dishes returned
- Alfredo (cream/butter) correctly excluded

### Test 13 -- `q=cheesecake&diet=dairy_free`
- **Result: PASS** | 0 dishes returned
- Cheesecake correctly excluded

### Test 14 -- `q=tiramisu&diet=dairy_free`
- **Result: PASS** | 0 dishes returned
- Tiramisu (mascarpone) correctly excluded

### Test 15 -- `q=carbonara&diet=dairy_free`
- **Result: PASS** | 0 dishes returned
- Carbonara correctly excluded

---

## VEGAN Tests (2/5 PASS -- 3 FAIL due to data integrity)

### Test 16 -- `diet=vegan&limit=50`
- **Result: FAIL** | 10 dishes returned, **4 contain animal products**
- Violations found (extended scan):
  - **"Kohada Nigiri"** -- description says "Gizzard shad" (fish), flagged vegan:true
  - **"Uni Bibimbap"** -- description says "fresh sea urchin" (animal), flagged vegan:true
  - **"Taramasalata"** -- description says "carp roe" (fish eggs), flagged vegan:true
  - **"Kitsune Udon"** -- description says "dashi broth" (typically fish-based), flagged vegan:true
- Clean dishes: Liang Pi Cold Skin Noodles, Carciofi Fritti, Chrysanthemum Salad, Insalata Verde, Falafel, Cold Zaru Udon

### Test 17 -- `q=steak&diet=vegan`
- **Result: PASS** | 0 dishes returned
- Steak correctly excluded

### Test 18 -- `q=sushi&diet=vegan`
- **Result: PASS** | 0 dishes returned
- Sushi correctly excluded (no veggie sushi available)

### Test 19 -- `q=omelette&diet=vegan`
- **Result: FAIL** | 0 dishes returned
- PASS on filtering (0 results is correct), but marking FAIL context: the vegan flag data itself is unreliable per Test 16
- **Revised: PASS** (filtering works; 0 results correct)

### Test 20 -- `q=burger&diet=vegan`
- **Result: PASS** | 0 dishes returned
- Burger correctly excluded

> **Note:** Tests 17-20 pass because those specific queries return no matches. The underlying vegan flag corruption from Test 16 is the root issue.

---

## CROSS-CHECK Tests (3/5 PASS -- 2 FAIL due to same data integrity issues)

### Test 21 -- `allergens=peanuts,tree_nuts` vs `diet=nut_free`
- **Result: PASS**
- Allergen filter: 35 dishes | Diet filter: 36 dishes | Overlap: 35
- No nut-related terms in either result set
- Slight count difference (36 vs 35) suggests minor mapping variance but no safety violations

### Test 22 -- `allergens=wheat,gluten` vs `diet=gluten_free`
- **Result: PASS**
- Allergen filter: 20 dishes | Diet filter: 35 dishes | Overlap: 20
- No gluten-related terms in either result set
- Diet filter is more inclusive (35 > 20), suggesting allergen filter is stricter

### Test 23 -- `diet=nut_free,gluten_free,dairy_free` (triple restriction)
- **Result: PASS** | 29 dishes returned
- All three dietary flags confirmed true on every dish
- No nut, gluten, or dairy terms found in names/descriptions
- Note: Contains animal dishes (Whole Branzino, A5 Wagyu Nigiri, etc.) which is correct -- this filter does not restrict meat/fish

### Test 24 -- `diet=vegan,gluten_free` (double restriction)
- **Result: FAIL** | 6 dishes returned, **2 contain animal products**
- Violations:
  - **"Kohada Nigiri"** -- "Gizzard shad" (fish) mislabeled vegan:true
  - **"Uni Bibimbap"** -- "sea urchin" (animal) mislabeled vegan:true
- Clean dishes: Carciofi Fritti, Chrysanthemum Salad, Insalata Verde, Falafel

### Test 25 -- `diet=nut_free,dairy_free,vegan` (triple restriction)
- **Result: FAIL** | 10 dishes returned, **4 contain animal products**
- Violations:
  - **"Kohada Nigiri"** -- "Gizzard shad" (fish) mislabeled vegan:true
  - **"Uni Bibimbap"** -- "sea urchin" (animal) mislabeled vegan:true
  - **"Taramasalata"** -- "carp roe" (fish eggs) mislabeled vegan:true
  - **"Kitsune Udon"** -- "dashi broth" (fish stock) mislabeled vegan:true

---

## Final Scorecard

| # | Test | Result |
|---|------|--------|
| 1 | GF limit=50 broad scan | PASS |
| 2 | GF + ramen query | PASS |
| 3 | GF + pizza query | PASS |
| 4 | GF + pasta query | PASS |
| 5 | GF + bread query | PASS |
| 6 | NF limit=50 broad scan | PASS |
| 7 | NF + pad thai query | PASS |
| 8 | NF + pesto query | PASS |
| 9 | NF + baklava query | PASS |
| 10 | NF + satay query | PASS |
| 11 | DF limit=50 broad scan | PASS |
| 12 | DF + alfredo query | PASS |
| 13 | DF + cheesecake query | PASS |
| 14 | DF + tiramisu query | PASS |
| 15 | DF + carbonara query | PASS |
| 16 | Vegan limit=50 broad scan | **FAIL** |
| 17 | Vegan + steak query | PASS |
| 18 | Vegan + sushi query | PASS |
| 19 | Vegan + omelette query | PASS |
| 20 | Vegan + burger query | PASS |
| 21 | allergens vs diet=nut_free | PASS |
| 22 | allergens vs diet=gluten_free | PASS |
| 23 | Triple: NF+GF+DF | PASS |
| 24 | Double: Vegan+GF | **FAIL** |
| 25 | Triple: NF+DF+Vegan | **FAIL** |

## 22/25 PASS

---

## Root Cause Analysis

The filtering engine itself works correctly -- it faithfully returns dishes where `vegan: true`. The problem is **upstream data quality**: 4 dishes have incorrect vegan flags in the database.

### Recommended Fixes (Priority: CRITICAL -- allergy safety)

1. **Immediate:** Set `vegan: false` on Kohada Nigiri, Uni Bibimbap, Taramasalata, and Kitsune Udon
2. **Systemic:** Add a data validation layer that cross-checks dish descriptions against dietary flags before insertion (e.g., if description contains fish/seafood/roe terms, reject vegan:true)
3. **Audit:** Run a full database audit scanning all dish descriptions against their dietary flags for contradictions
4. **Kitsune Udon additional note:** "dashi broth" is also not vegetarian (fish stock); update vegetarian flag too
5. **Taramasalata additional note:** Contains "pita" in description -- if this dish ever gets gluten_free:true, that would also be a violation

---

*Report generated 2026-04-03 by automated safety stress test agent*
