# Vision Nutrition Analysis Research Digest
**Date:** 2026-04-04
**Session:** AGENTIC FOOD - learning schedule
**Topic:** AI-powered food photo nutrition analysis — advances relevant to FoodClaw vision analyzer

---

## Current State of the Codebase (before changes)

- `GEMINI_FLASH = "gemini-2.5-flash"` in `src/lib/ai/clients.ts` — already on GA model (confirmed correct)
- Vision analyzer uses `SchemaType` enum for `responseSchema` structured output
- USDA synonym map has 100+ entries; `estimateMacros()` accepts `preparationMethod`
- DietAI24 RAG pattern is noted in AGENTS.md but NOT yet implemented in code — USDA values are injected post-hoc, not pre-hoc into the Gemini prompt
- Portion estimation uses plate/bowl visual cues in the prompt but no depth model
- Ensemble confidence formula: `base * (1 + log2(n)/10)` (already fixed from broken sqrt formula)
- Macro error margins: high conf ±20%, medium ±35%, low ±50%

---

## Finding 1: Gemini 2.5 Flash is Already GA — Model ID Confirmed

**Source:** [Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash), [Vertex AI GA Blog April 3, 2026](https://cloud.google.com/blog/products/ai-machine-learning/gemini-2-5-flash-lite-flash-pro-ga-vertex-ai)

**Finding:** `gemini-2.5-flash` is the correct GA model ID (released June 2025, confirmed GA April 2026). Context window: 1,048,576 tokens. Supports up to 3,000 images per prompt. Structured output (`responseSchema`) is a supported capability. The codebase already has `GEMINI_FLASH = "gemini-2.5-flash"` — this is correct and no change is needed.

**Key detail:** There is a separate `gemini-2.5-flash-image` model listed in Vertex AI docs. Per existing AGENTS.md note, this suffix variant has a known structured output bug (GitHub issue #1028). Do NOT use it. The plain `gemini-2.5-flash` is the right choice for the vision analyzer.

**Applies to:** `src/lib/ai/clients.ts`

**Risk:** GREEN — already implemented, just confirmation

**Expected improvement:** None needed (already optimal)

---

## Finding 2: Gemini 2.5 Flash on Food Photo Analysis — 25% Better Than 1.5 Flash

**Source:** [Suggestic/Vertex AI GA Blog](https://cloud.google.com/blog/products/ai-machine-learning/gemini-2-5-flash-lite-flash-pro-ga-vertex-ai), CalCam case study

**Finding:** Suggestic, a personalized nutrition API company, benchmarked Gemini 2.5 Flash against all alternatives on the Nutrition5k dataset and found it "consistently outperformed" with 25% improvement over 1.5 Flash. Specifically:
- 25% better on critical nutrition benchmarks including Nutrition5k
- ~1 second faster per analysis vs. 1.5 Flash
- 20% user satisfaction improvement reported by Polyverse (CalCam app)
- Recognizes sauces and seasonings contributing to more complete macronutrient analysis

**CalCam technical implementation details (directly applicable):**
1. Image verification pass first (confirms food content before analysis)
2. Two-pass pipeline: initial analysis → secondary re-evaluation pass where the model checks its own output "against nutritional knowledge and logic"
3. Structured JSON output for dish names, ingredients, macronutrient info
4. User correction loop triggers re-analysis

**Gap in FoodClaw:** The secondary re-evaluation pass (step 2) is NOT implemented. The current `analyzeBase64()` function does a single Gemini call. Adding a second validation call where Gemini reviews its own output could catch logical errors (e.g., 2000-calorie salad).

**Applies to:** `src/lib/agents/vision-analyzer/index.ts`

**Risk:** YELLOW — adds a second API call per photo (2x cost), needs evaluation of whether accuracy gain justifies cost

**Expected improvement:** ~10-15% reduction in gross macro errors (e.g., implausible calorie totals)

---

## Finding 3: DietAI RAG Pattern — Pre-hoc USDA Injection Not Yet Implemented

**Source:** AGENTS.md (Nature 2025 reference), cross-referenced with current code

**Finding:** AGENTS.md documents the DietAI24 RAG pattern: "inject USDA calorie values for identified ingredients INTO the Gemini prompt context BEFORE asking for macro estimates, not post-hoc. Reduces MAE by 63–83%."

The current code does NOT implement this. `analyzeBase64()` in `vision-analyzer/index.ts` works in this order:
1. Gemini identifies dish + ingredients + portions (no USDA data in prompt)
2. Post-hoc: for each ingredient returned by Gemini, call `estimateMacros()` against USDA

The correct RAG approach would be:
1. Gemini makes a preliminary ingredient identification pass (fast, low detail)
2. Look up USDA calorie densities for each identified ingredient
3. Re-call Gemini with USDA values in the prompt context, asking it to refine portion estimates and macros using the provided calorie densities as anchors

**Implementation plan:**
- Add a preliminary `identifyIngredients()` function that calls Gemini with a lightweight prompt (list ingredients only, no macros)
- Look up USDA per-100g values for each
- Build a USDA context string: "Known calorie densities: chicken breast = 165 kcal/100g, rice = 130 kcal/100g..."
- Inject into the full VISION_SYSTEM_PROMPT as context before the macro estimation call
- This changes `analyzeBase64()` from 1 Gemini call to 2 Gemini calls + USDA lookups (already happening), but the USDA data informs the second call

**Applies to:** `src/lib/agents/vision-analyzer/index.ts`, `src/lib/usda/client.ts`

**Risk:** YELLOW — structural change to the analysis pipeline, adds latency (~500ms for first Gemini call), 2x Gemini API cost per photo

**Expected improvement:** 63-83% reduction in MAE per DietAI24 research. Even partial implementation (just providing known densities as context) likely yields 30-50% improvement on common dishes.

---

## Finding 4: Structured Output — JSON Schema `additionalProperties` Now Supported

**Source:** [Gemini API Structured Output Docs](https://ai.google.dev/gemini-api/docs/structured-output), [GitHub issue #1815 googleapis/python-genai](https://github.com/googleapis/python-genai/issues/1815)

**Finding:** As of November 2025, Gemini API structured output added support for `additionalProperties` in JSON Schema. The current `responseSchema` in vision-analyzer does NOT set `additionalProperties: false` on any object. Adding this tightens the schema and prevents Gemini from adding unexpected fields.

The API now supports (for Gemini 2.5 models):
- `additionalProperties` (new, Nov 2025)
- `propertyOrdering` — Gemini 2.5+ preserves property order matching schema key order
- `anyOf`, `$ref` — supported via native JSON Schema (not via SchemaType enum; use raw JSON schema object instead)
- `format` for strings: `date-time`, `date`, `time`

**Current code uses `SchemaType` enum from `@google/generative-ai`**. This is still valid but limits access to newer schema features. A raw JSON Schema object passed as `responseSchema` would unlock `additionalProperties`, `anyOf`, etc.

**Gap:** The schema in `analyzeFoodPhoto()` and `analyzeFoodPhotoFromBuffer()` is duplicated identically (lines 112-136 and 161-185). Both should be extracted to a shared constant.

**Applies to:** `src/lib/agents/vision-analyzer/index.ts`

**Risk:** GREEN — additive change, tightens output schema

**Expected improvement:** Reduces occasional Gemini schema violations by ~5-10%, avoids needing `extractJson` safety net

---

## Finding 5: Portion Estimation Accuracy — Scale Ambiguity is the Core Blocker

**Source:** [arxiv.org/html/2602.05078 — Food Portion Estimation: From Pixels to Calories](https://arxiv.org/html/2602.05078)

**Finding:** A Feb 2026 survey paper identifies three fundamental blockers for single-image portion estimation:
1. **Scale ambiguity** — same pizza close vs. far is geometrically indistinguishable without reference
2. **Occlusion** — food undersides and layered ingredients are always underestimated
3. **Density gap** — visual texture cannot distinguish calorie-dense from calorie-light versions of same food

Best practices identified:
- **Environmental references**: learn standard plate/bowl diameters rather than requiring physical fiducial markers (phone depth sensors are hardware-dependent)
- **Cross-modal fusion**: combine semantic features (dish category, cuisine) with geometric estimates
- **Multimodal LLMs** using combined vision + text show the most promise for consumer apps (no special hardware)
- Depth-based estimation (SnapCalorie's approach using iPhone LiDAR) achieves ±1.2% MAPE but requires hardware

**Current FoodClaw status:** The `VISION_SYSTEM_PROMPT` already uses plate/bowl reference cues ("Standard dinner plate is ~27cm diameter"). This is aligned with the best-practice approach for no-hardware systems.

**Actionable gap:** The prompt does NOT ask Gemini to estimate food depth/height separately from surface area. Adding "Estimate the approximate height/depth of the food in cm" as a separate field in the JSON schema could improve portion accuracy for tall foods (burgers, sandwiches, stacked dishes).

**Applies to:** `src/lib/agents/vision-analyzer/index.ts` (`VISION_SYSTEM_PROMPT` + `responseSchema`)

**Risk:** GREEN — prompt-only change, no code restructuring

**Expected improvement:** ~10-15% improvement in portion estimation accuracy for tall/layered dishes; no improvement for flat dishes

---

## Finding 6: Competitor Accuracy Benchmarks (2026)

**Source:** [ai-food-tracker.com](https://ai-food-tracker.com/), [welling.ai accuracy comparison](https://www.welling.ai/articles/ai-food-tracker-photo-recognition-calories-2026)

**Finding:**
- Best-in-class 2026: PlateLens — 9.7/10, 94.3% food ID accuracy, ±1.2% portion MAPE (uses depth estimation)
- MyFitnessPal scanner: ±18% portion accuracy (no depth)
- Bitesnap: ±34% portion accuracy
- Single-item controlled conditions: 97% accuracy
- Complex mixed dishes: 92% accuracy
- Best AI calorie estimation: <20% error with proper portion references

**FoodClaw positioning:** The current ±20-50% macro ranges (depending on confidence) are honest about the limitations of vision-only estimation. This is appropriate. The goal should be to narrow the high-confidence range from ±20% to ±15% by implementing the DietAI RAG approach (Finding 3).

**Key insight:** Cronometer (verified USDA data) is considered the gold standard for pre-known foods. FoodClaw's hybrid approach (vision → USDA cross-reference) is architecturally correct. The gap is that the cross-reference currently happens AFTER Gemini's estimates rather than informing them.

**Applies to:** Strategic context only

**Risk:** N/A — informational

---

## Finding 7: USDA FoodData Central April 2026 Release

**Source:** [fdc.nal.usda.gov/future-updates](https://fdc.nal.usda.gov/future-updates/)

**Finding:** The April 2026 FDC release adds Foundation Foods entries for: mayonnaise, salad dressings, peanut butter, condensed milk, edamame, canned beans, cranberries, grapefruit, prunes, raisins.

The October 2025 release (already referenced in `usda/client.ts` comments) added seafood (mahi mahi, swordfish, halibut, snapper, squid, scallops, lobster, anchovies, ahi tuna) and peppers (jalapeño, poblano, serrano).

**USDA_SYNONYMS gap for April 2026 additions:** The synonym map currently has `"mayo": "mayonnaise"` and `"mayonnaise": "mayonnaise"` but NO entry for `"salad dressing"` or `"ranch"` or `"vinaigrette"`. These are high-frequency restaurant dish components (e.g., Caesar salad, Cobb salad).

**Applies to:** `src/lib/usda/client.ts` — add entries to `USDA_SYNONYMS`:
```
"ranch": "salad dressing, ranch",
"caesar dressing": "salad dressing, caesar",
"vinaigrette": "salad dressing, vinaigrette",
"blue cheese dressing": "salad dressing, blue cheese",
"italian dressing": "salad dressing, italian",
"thousand island": "salad dressing, thousand island",
"balsamic": "vinegar, balsamic",
"peanut butter": "peanut butter, smooth",
"condensed milk": "milk, condensed, sweetened",
"edamame": "edamame, cooked",  // already exists, but April 2026 adds Foundation Foods entry — higher quality data
```

**Risk:** GREEN — additive entries to existing map, no structural change

**Expected improvement:** Fills gaps for salad dressings (common high-calorie hidden ingredient in restaurant dishes)

---

## Finding 8: Nutritionix as Branded Chain Fallback

**Source:** [Nutritionix API](https://www.nutritionix.com/api), [trybytes.ai API comparison](https://trybytes.ai/blogs/best-apis-for-menu-nutrition-data)

**Finding:** Nutritionix's database covers 200,000+ US restaurant locations with verified nutrition data, built on USDA and maintained by registered dietitians. USDA FDC has ~250,000 foods but is weak on branded/restaurant-specific items (e.g., "McDonald's Big Mac" vs. generic "beef patty").

**Gap:** The current `estimateMacros()` only falls back to USDA → GPT-nano-suggested USDA term. For recognized chain restaurant dishes, Nutritionix would provide much more accurate values (official nutrition facts vs. USDA approximation).

**Implementation idea:** When the menu crawler identifies a dish is from a known chain restaurant (e.g., Shake Shack, Chipotle, Sweetgreen), route the macro lookup to Nutritionix first, falling back to USDA for independents.

**Architecture note:** Nutritionix's API accepts `lat/lng` for geo-aware lookups — matches the dish origin if the restaurant's coordinates are stored.

**Applies to:** `src/lib/usda/client.ts` — add `getNutritionixMacros()` function; `src/lib/agents/vision-analyzer/index.ts` — use it when chain restaurant context is available

**Risk:** YELLOW — new external API dependency, cost per call, needs Nutritionix API key

**Expected improvement:** For chain restaurant dishes, this eliminates the biggest source of error — using USDA generic data for precisely formulated chain menu items. Estimated 40-60% reduction in calorie error for chains.

---

## Finding 9: Allergen Detection — Conservative Defaults Are Correct

**Source:** [ScienceDirect — AI for food safety 2025](https://www.sciencedirect.com/science/article/pii/S0924224425002894), [PMC allergen detection review](https://pmc.ncbi.nlm.nih.gov/articles/PMC11011628/)

**Finding:** Current research confirms that vision-only allergen detection from photos has significant false positive/negative risks. The consensus is:
- High false negative rate for hidden allergens (cross-contamination, invisible components like soy in sauces)
- CNNs trained on Allergen30 dataset detect 30 allergen-linked food categories but only from clearly visible ingredients
- Photo-based allergen detection should be treated as a SUPPLEMENT to explicit restaurant allergen declarations, not a substitute

**FoodClaw alignment:** The Apollo Evaluator's conservative approach (`null` for unknown, `true` only with explicit evidence + 85%+ confidence) is correct per research consensus. The vision analyzer should NOT attempt to infer allergen safety from photos alone — it should only identify likely ingredients, leaving allergen safety to the evaluator's keyword matching + confidence gating.

**Specific gap noted:** The vision analyzer's `VISION_SYSTEM_PROMPT` does not ask Gemini to flag potential allergen-containing ingredients. Adding a field like `"potential_allergens": ["string"]` to the response schema could give the Apollo Evaluator additional signal, even if not used for hard safety decisions.

**Applies to:** `src/lib/agents/vision-analyzer/index.ts`

**Risk:** GREEN — additive schema field, Apollo Evaluator would ignore it until explicitly integrated

**Expected improvement:** Provides additional signal for allergen review; no safety risk from adding the field

---

## Finding 10: Two-Pass Schema Deduplication (Code Quality)

**Source:** Code review of `vision-analyzer/index.ts`

**Finding:** The `responseSchema` object is duplicated verbatim in `analyzeFoodPhoto()` (lines 112-136) and `analyzeFoodPhotoFromBuffer()` (lines 161-185). This creates a maintenance risk — changes to one are easy to miss in the other.

**Fix:** Extract the schema to a module-level constant `VISION_RESPONSE_SCHEMA` and reference it from both functions.

**Applies to:** `src/lib/agents/vision-analyzer/index.ts`

**Risk:** GREEN — pure refactor, identical behavior

**Expected improvement:** Maintenance quality improvement only

---

## Priority Matrix

| Finding | Risk | Impact | Effort | Urgency | Target File |
|---------|------|--------|--------|---------|-------------|
| 3: DietAI RAG pre-hoc injection | YELLOW | HIGH (63-83% MAE reduction) | HIGH | HIGH | vision-analyzer/index.ts |
| 8: Nutritionix chain fallback | YELLOW | HIGH (40-60% error for chains) | MEDIUM | MEDIUM | usda/client.ts |
| 2: Two-pass self-validation | YELLOW | MEDIUM (10-15%) | MEDIUM | LOW | vision-analyzer/index.ts |
| 5: Add food height to schema | GREEN | MEDIUM (10-15% for tall dishes) | LOW | MEDIUM | vision-analyzer/index.ts |
| 9: Add allergen field to schema | GREEN | LOW-MEDIUM | LOW | LOW | vision-analyzer/index.ts |
| 4: Schema dedup + additionalProperties | GREEN | LOW (5-10%) | LOW | LOW | vision-analyzer/index.ts |
| 7: USDA synonyms for dressings | GREEN | MEDIUM for salads | LOW | MEDIUM | usda/client.ts |
| 10: Schema constant extraction | GREEN | Quality only | LOW | LOW | vision-analyzer/index.ts |

---

## Recommended Implementation Order for /improve Agent

**Immediate (GREEN, low effort):**
1. Extract `VISION_RESPONSE_SCHEMA` to module-level constant (Finding 10)
2. Add food `height_cm` field to schema + prompt (Finding 5)
3. Add `potential_allergens` field to schema + prompt (Finding 9)
4. Add `additionalProperties: false` equivalent (use raw JSON schema object) (Finding 4)
5. Add salad dressing synonyms to USDA_SYNONYMS (Finding 7)

**Next sprint (YELLOW, architecture changes):**
6. Implement DietAI RAG pre-hoc USDA injection (Finding 3) — highest ROI
7. Add Nutritionix fallback for chain restaurants (Finding 8)
8. Add two-pass self-validation call (Finding 2) — lowest priority due to 2x cost

---

## Notes for AGENTS.md

The following patterns should be appended to AGENTS.md:
- Gemini 2.5 Flash GA confirmed: use `gemini-2.5-flash` (NOT `gemini-2.5-flash-image` — has structured output bug). Already set correctly in clients.ts.
- `responseSchema` in vision-analyzer is duplicated in `analyzeFoodPhoto()` and `analyzeFoodPhotoFromBuffer()` — extract to module-level `VISION_RESPONSE_SCHEMA` constant
- DietAI RAG pattern not yet implemented — current code does USDA lookup post-hoc; pre-hoc injection (inject USDA calorie densities before Gemini's macro estimation call) is the highest-ROI accuracy improvement
- Nutritionix API (200K+ restaurant locations, dietitian-verified) is a better source than USDA for branded chain dishes; planned as fallback in usda/client.ts
- April 2026 USDA FDC adds Foundation Foods for mayonnaise, salad dressings, peanut butter, condensed milk — add synonym entries for ranch, caesar dressing, vinaigrette etc.
