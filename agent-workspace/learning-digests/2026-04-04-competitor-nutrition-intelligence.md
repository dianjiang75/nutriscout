# Competitor Intelligence & Nutrition/Food Tech Research
**Date:** 2026-04-04
**Session:** AGENTIC FOOD - learning schedule
**Searches:** 10 topics, ~15 articles fetched

---

## Finding 1: DoorDash Zesty — AI-Social Restaurant Discovery (No Dish-Level Data)

**Source:** [CDO Magazine](https://www.cdomagazine.tech/aiml/doordash-debuts-ai-powered-social-app-zesty-for-local-restaurant-discovery) | [Restaurant Business Online](https://www.restaurantbusinessonline.com/technology/doordash-testing-restaurant-discovery-app-called-zesty) | [Fox News](https://www.foxnews.com/tech/doordash-launches-zesty-ai-app-finding-local-food)

**What it is:** DoorDash launched Zesty in pilot in SF Bay Area and NYC. It uses an AI chatbot for conversational restaurant discovery, pulls from DoorDash, Google Maps, and TikTok, and includes a social feed where users post photo reviews with emoji-tier ratings ("Loved this!", "Kinda mid", "Not for me"). There is a "Top Zesties" leaderboard.

**Critical gap Zesty has:** No dish-level discovery, no dietary filters, no nutrition data, no allergen safety layer. It is restaurant-first, social-first. It will not help a user with a nut allergy find a specific dish that's safe.

**What FoodClaw should do:**
- Zesty validates that social + conversational AI for food discovery has major-brand momentum. FoodClaw should add a conversational search bar (e.g., "high protein pasta near me under 600 cal") on top of its existing filter stack.
- FoodClaw's key differentiator must be made more visible: dish-first + verified macros + Apollo safety layer. Zesty is the restaurant-first competitor we knew was coming.
- Consider adding brief social proof (e.g., user-submitted dish photos, rating) to dish cards — not a full social feed, but a trust signal.

**Risk tier:** GREEN (opportunity, not threat — different market position)
**Priority:** 2
**Target files:** `src/app/page.tsx`, `src/components/search/search-bar.tsx` (conversational query UX), `src/lib/orchestrator/index.ts` (natural language query parsing)

---

## Finding 2: Yummly Void — Recipe App Market Gap

**Source:** [Peel Blog](https://trypeel.app/blog/best-yummly-alternatives-2026) | [MealThinker](https://mealthinker.com/blog/yummly-alternative) | [Plan to Eat](https://www.plantoeat.com/blog/2024/12/yummly-is-closing-discover-the-best-meal-planning-alternative/)

**What happened:** Yummly shut down December 2024 (Whirlpool/KitchenAid corporate restructuring). Top replacements in 2026: Paprika (recipe clipper), Samsung Food (meal planning), MealThinker (AI taste profile), Pluck (social clip from TikTok/Instagram). None focus on restaurant dish discovery with macro verification.

**What FoodClaw should do:**
- Yummly had millions of users who filtered recipes by dietary restriction and nutrition goals. Many are now using apps that don't bridge the gap to restaurant dishes. FoodClaw can target ex-Yummly users who want the same dietary + nutrition filtering but for restaurants.
- Consider "Saved Dishes" / recipe-style bookmarking to appeal to the Yummly-style organizational habit.
- Positioning copy: "The Yummly you wish existed — but for restaurants."

**Risk tier:** GREEN (market opportunity)
**Priority:** 3
**Target files:** `src/app/profile/page.tsx` (saved dishes feature), marketing copy

---

## Finding 3: AI Allergen Safety — 70%+ of Restaurant AI Systems Fail Basic Tests

**Source:** [Menumiz Blog Feb 2026](https://brand.menumiz.com/2026/02/20/if-your-restaurants-ai-cant-handle-gluten-free-its-not-ready-for-prime-time/) | [FDA Allergen Thresholds Meeting Feb 2026](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies) | [Alhena AI](https://alhena.ai/blog/ai-food-beverage-ecommerce-allergen-safety-dietary-personalization/)

**Key finding:** A 2024 audit found >70% of AI restaurant bots make definitive safety claims about dietary restrictions without access to real-time kitchen data, cross-contamination risk, or supplier change tracking. The FDA held a public meeting Feb 2026 on allergen thresholds and applications — regulatory scrutiny is increasing.

**Best practices emerging in 2026:**
- Human-in-the-loop design: AI assists, kitchen staff confirms
- Mandatory disclaimer on every allergen-sensitive interaction
- Sesame now required alongside the classic Big 8 (FDA 2026 update confirms sesame in routine inspections)
- Never make definitive safe claims; use confidence tiers and explicit uncertainty language

**What FoodClaw should do:**
- Apollo Evaluator already has the right architecture (confidence thresholds + ALLERGY_CRITICAL_MIN). This research validates it.
- Add explicit disclaimer text to dish cards when a dish is flagged as "safe" for allergy-critical restrictions: "Based on available menu data. Cross-contamination risk may exist — verify with restaurant."
- Sesame is already in keyword matching in evaluator — confirm it is included in all relevant confidence gates.
- The FDA regulatory trend means FoodClaw's verified safety layer is a genuine competitive moat as liability exposure grows for apps making unqualified claims.

**Risk tier:** YELLOW (regulatory risk if disclaimers absent; opportunity if FoodClaw leads on transparency)
**Priority:** 1
**Target files:** `src/lib/evaluator/index.ts`, `src/components/dish-card/dish-card.tsx` (add disclaimer to allergy flags), `src/lib/evaluator/index.ts` (sesame confidence gate audit)

---

## Finding 4: GLP-1 Friendly Labels — Major Chains Already Acting, App Opportunity Urgent

**Source:** [Food Ingredient First](https://www.foodingredientsfirst.com/news/glp-1-friendly-menus-food-dining-2026.html) | [NPR Mar 2026](https://www.npr.org/2026/03/23/nx-s1-5699407/glp-1-ozempic-zepbound-wegovy-nutrition) | [Shotlee Blog](https://www.shotlee.app/blog/how-restaurants-are-adapting-to-rising-glp-1-usage-like-ozempic)

**Key finding:** ~12% of Americans have now used GLP-1 drugs (Ozempic, Wegovy, Zepbound). Shake Shack ("Good Fit Menu"), Chipotle ("High Protein Menu"), Olive Garden (smaller portions), Cheesecake Factory ("Skinnylicious"), Smoothie King are all now explicitly labeling GLP-1-friendly items. Criteria:
- Protein: 25g+ per meal
- Calories: ≤500 (for those with suppressed appetite needing nutrient density)
- Fiber: boosted
- Carbs: reduced
- Portion: smaller, nutrient-dense

**What FoodClaw should do:**
- This is already in AGENTS.md as URGENT — this research confirms the urgency. 12% of Americans is a massive addressable segment.
- Implement `"glp1_friendly"` as a `NutritionalGoals.priority` option mapping to `{ protein_min_g: 25, calories_max: 500, fiber_boost: true }`.
- Add GLP-1 label pattern matching in Menu Crawler for strings like "GLP-1 friendly", "Good Fit", "High Protein Menu", "Skinnylicious", "nutrient dense".
- In search UI, add GLP-1 as a goal filter option with brief explanation ("For GLP-1 medication users — high protein, nutrient-dense, smaller portions").

**Risk tier:** YELLOW (missed opportunity if delayed; easy to implement)
**Priority:** 1
**Target files:**
- `src/lib/orchestrator/index.ts` (add glp1_friendly priority handling)
- `src/lib/agents/menu-crawler/index.ts` (pattern match GLP-1 labels)
- `src/app/search/page.tsx` or filter component (add GLP-1 goal option)
- `src/types/` or Prisma schema (extend NutritionalGoals.priority union)

---

## Finding 5: AI Food Photo Accuracy — Wide Variance, Invisible Ingredients Remain Key Weakness

**Source:** [Welling.ai 2026](https://www.welling.ai/articles/ai-food-tracker-photo-recognition-calories-2026) | [MDPI Nutrients 2025](https://www.mdpi.com/2072-6643/18/6/966) | [AI Food Tracker Benchmark](https://ai-food-tracker.com/) | [PMC Systematic Review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10836267/)

**Key findings:**
- Best-in-class: 94.3% food ID accuracy on 500 test meals, ±1.2% portion accuracy (top tier apps, 2026)
- Average relative error range: 0.10%–38% for calories, 0.09%–33% for volume — enormous spread
- Biggest weakness: invisible ingredients (oils, butter, sauces) — a stir-fry can have 200+ hidden calories from oil that no photo-based AI can see
- High agreement expected for energy and carbs (volumetric), lower for protein and lipids (invisible)
- Clinical study (MDPI 2025): AI vs. registered dietitians on hospital meal images — AI is competitive and sometimes superior for standard meals

**Relevance to FoodClaw's Vision Analyzer (Gemini Flash):**
- FoodClaw's DietAI24 pattern (already in AGENTS.md) of injecting USDA calorie values into Gemini prompt context before asking for estimates is validated by this research as the correct approach — addresses the invisible ingredient problem by using ingredient-level data rather than pure visual estimation.
- Range-based estimates (min/max macros) rather than point estimates are best practice for handling uncertainty — FoodClaw already does this.
- Consider upgrading to Gemini 2.5 Flash (already flagged in AGENTS.md) — better on Nutrition5k benchmark, key for protein/fat accuracy.

**Risk tier:** GREEN (validates current approach, flag for upgrade)
**Priority:** 2
**Target files:** `src/lib/agents/vision-analyzer/index.ts` (Gemini model upgrade, USDA injection already planned)

---

## Finding 6: USDA FoodData Central — April 2026 Foundation Foods Release

**Source:** [USDA FoodData Central Future Updates](https://fdc.nal.usda.gov/future-updates/)

**Key finding:** April 2026 release adds Foundation Foods including:
- Condiments: mayonnaise, salad dressings, peanut butter, condensed milk
- Vegetables: edamame, canned beans
- Fruits: cranberries, grapefruit, prunes, raisins

October 2025 release (already available) added: seafood (mahi mahi, swordfish, squid, snapper, halibut, scallops, crustaceans), vegetables (banana/jalapeño/poblano/serrano peppers, turnips, fennel, parsnips, radishes, beet greens, radicchio).

**What FoodClaw should do:**
- These new Foundation Foods items will improve matching accuracy for dishes containing these ingredients. USDA_SYNONYMS map should be updated to include new synonyms for these recently-added items (e.g., "scallops" → "sea scallops", "edamame" → "edamame, cooked").
- After April 2026 release, trigger a re-analysis pass on dishes that previously had `macroSource: "estimated"` due to USDA lookup failures for these ingredients.
- Add these ingredients to the synonym map proactively.

**Risk tier:** GREEN (data quality improvement)
**Priority:** 3
**Target files:** `src/lib/usda/client.ts` (USDA_SYNONYMS map expansion)

---

## Finding 7: California ADDE Act — Effective July 1, 2026, First US State Allergen Menu Law

**Source:** [ArentFox Schiff](https://www.afslaw.com/perspectives/alerts/california-enacts-first-the-nation-allergen-disclosure-law-restaurant-chains) | [AAFA](https://aafa.org/aafa-bill-to-require-allergen-labeling-in-california-restaurants-becomes-law/) | [CBS8](https://www.cbs8.com/article/news/local/california/2026-new-california-laws-major-allergens-restaurant-menus/509-9af4217c-7bcd-48da-bbbd-acd440dab642) | [FDA Law Blog](https://www.thefdalawblog.com/2025/10/californias-new-allergen-disclosure-law-a-sign-of-things-to-come/)

**Exact requirements:**
- Applies to: Restaurant chains with 20+ CA locations, same name, substantially same menu
- Effective: July 1, 2026
- Must disclose: All 9 major allergens (milk, eggs, peanuts, tree nuts, fish, shellfish, wheat, soy, sesame) per menu item
- Disclosure methods: On-menu labeling OR QR code linking to allergen chart/grid/booklet (must also offer print alternative)
- Fines: $500–$2,500 per violation
- Excluded: Mobile food, temporary facilities, prepackaged foods under federal regs

**What FoodClaw should do (high urgency — July 1 deadline is 88 days away):**
- This is already noted in AGENTS.md as a crawl target. Now confirmed with full details.
- Menu Crawler must be updated to: (1) detect and follow QR codes on digital menus to allergen pages; (2) tag dishes crawled from these compliance pages as `source: "compliance_page"` with highest dietary flag confidence; (3) prioritize CA chain restaurants for re-crawl between now and July 1 to capture allergen data as chains publish it.
- The law creates a machine-readable public data source for ~20+ location chains — a major opportunity to boost Apollo Evaluator confidence for exactly the restaurant types that have the most menu data.
- Start crawling compliance pages now — chains are publishing them ahead of July 1.

**Risk tier:** YELLOW (time-sensitive — 88 days to July 1)
**Priority:** 1
**Target files:**
- `src/lib/agents/menu-crawler/index.ts` (QR code detection, compliance_page source tag, CA chain priority)
- `src/lib/evaluator/index.ts` (highest confidence for compliance_page source)
- `scripts/nightly-discovery.ts` (prioritize CA chains in discovery areas)

---

## Finding 8: Nutritionix API — 202K+ Restaurant Items, Geo-Aware, Branded Chain Coverage

**Source:** [SpikeAPI Blog](https://www.spikeapi.com/blog/top-nutrition-apis-for-developers-2026) | [Nutritionix Developer](https://developer.nutritionix.com/) | [Bytes AI](https://trybytes.ai/blogs/best-apis-for-menu-nutrition-data)

**Key finding:** Nutritionix in 2026:
- 1.9M+ unique food items: 991K grocery foods + 202K restaurant menu items
- 209K+ restaurant locations with nutrition data
- 92% UPC match rate for packaged foods
- Natural language food query: "2 slices of Chipotle chicken pizza" → instant nutrition
- Geo-aware API: accepts lat/lng, returns nutrition for nearby branded locations
- Verified by registered dietitians
- No longer has a free public tier — requires commercial agreement

**What FoodClaw should do:**
- Nutritionix is the ideal fallback when USDA FDC returns no match for branded chain dishes (e.g., "Shake Shack ShackBurger" → no USDA entry → Nutritionix returns exact chain nutrition).
- Integrate Nutritionix as fallback in the USDA resolution pipeline after synonym expansion fails.
- Use geo-aware endpoint for discovery: when user searches "Chipotle High Protein Bowl near me", Nutritionix can return exact macro data for that location's menu items.
- Cost consideration: commercial API — use only for cache misses after USDA fails, not as primary source.

**Risk tier:** GREEN (data quality improvement for branded chains)
**Priority:** 2
**Target files:** `src/lib/usda/client.ts` (add Nutritionix fallback after USDA miss), `src/lib/agents/menu-crawler/index.ts` (Nutritionix enrichment step for chain restaurants)

---

## Finding 9: Spokin vs. Fig — Allergy App Feature Gap FoodClaw Can Exploit

**Source:** [Spokin App](https://www.spokin.com/about-the-spokin-app) | [Food Allergy Institute](https://foodallergyinstitute.com/resources/blog/4-best-apps-for-food-allergies) | [Bearable Blog](https://bearable.app/best-allergy-tracker-app-2025/)

**Spokin features:**
- 73,000+ reviews across 80 countries
- Filters by 80+ allergens
- Verified Brand partners (24-question allergen FAQ answered)
- Community-driven restaurant reviews
- Auto-injector expiry/recall tracking
- No dish-level macro data; no AI-based confidence scoring

**Fig features:**
- Grocery product barcode scanning
- Ingredient-level allergen detection
- Primarily for grocery shopping, not restaurants

**Key gap FoodClaw fills that neither does:**
- Neither Spokin nor Fig does restaurant dish-level discovery with AI macro estimation + confidence-scored allergen safety verification. Spokin is community reviews (subjective), Fig is grocery scanning. FoodClaw is the only play that combines: (a) proactive dish crawling, (b) photo-based vision analysis, (c) quantified confidence scores, (d) Apollo safety evaluation layer.
- Spokin's 24-question allergen FAQ (answered by brands) is a confidence signal source FoodClaw can use: where Spokin marks a brand/chain as verified, boost Apollo Evaluator confidence for that chain's dishes.
- Consider Spokin partnership or data-sharing arrangement as a confidence signal booster (already noted in AGENTS.md).

**Risk tier:** GREEN (competitive positioning, partnership opportunity)
**Priority:** 3
**Target files:** `src/lib/evaluator/index.ts` (Spokin signal integration when available)

---

## Finding 10: FoodTech Funding — "Food as Medicine" and AI Nutrition Dominate 2025–2026

**Source:** [SeedTable](https://www.seedtable.com/best-foodtech-startups) | [GreyB Personalized Nutrition](https://greyb.com/blog/personalized-nutrition-startups/) | [TFN FoodTech Startups](https://techfundingnews.com/six-us-foodtech-startups-watch-2025/)

**Key finding:**
- Food tech raised $1.4B in Q1 2025 alone; "food as medicine" and AI nutrition are the top VC themes
- Notable Series A/B: David ($75M Series A, metabolic health); Poppi (acquired $1.7B); Aioly (US — live video dish recognition with nutritional insights)
- Investors explicitly calling out: personalized nutrition, GLP-1 adjacent food products, AI-driven macro tracking, dietary safety for medical diets
- Aioly (direct competitor signal): uses live video for dish recognition + nutritional insights — similar to FoodClaw's vision analysis but focused on personal tracking, not restaurant discovery

**What FoodClaw should do:**
- The VC thesis validates FoodClaw's core concept. When fundraising, position in the "food as medicine" category with GLP-1 angle + Apollo safety layer as clinical-grade differentiators.
- Aioly is worth monitoring as a competitor — if they add restaurant discovery, they enter FoodClaw's space.
- Functional food + GLP-1 + allergen compliance = the three strongest VC signals right now. FoodClaw touches all three.
- Series A target sweet spot: $5M–$15M with the food-as-medicine + AI nutrition narrative.

**Risk tier:** GREEN (market validation, fundraising positioning)
**Priority:** 3
**Target files:** None (strategy/positioning)

---

## Summary Table

| # | Finding | Risk | Priority | Code Change Needed? |
|---|---------|------|----------|---------------------|
| 1 | DoorDash Zesty — restaurant-first, no dish/macro/allergen data | GREEN | 2 | Yes — conversational search bar |
| 2 | Yummly void — millions of displaced dietary-filter users | GREEN | 3 | Yes — saved dishes, positioning |
| 3 | AI allergen safety failures — 70%+ of restaurant AI systems fail | YELLOW | 1 | Yes — disclaimer on dish cards |
| 4 | GLP-1 labels now on Shake Shack, Chipotle, etc. | YELLOW | 1 | Yes — glp1_friendly goal + crawler |
| 5 | AI food photo accuracy — invisible ingredients remain key weakness | GREEN | 2 | Yes — Gemini 2.5 Flash upgrade |
| 6 | USDA April 2026 release — mayonnaise, edamame, peanut butter | GREEN | 3 | Yes — expand USDA_SYNONYMS |
| 7 | California ADDE Act — 20+ location chains must post allergens July 1 | YELLOW | 1 | Yes — compliance_page crawler |
| 8 | Nutritionix — 202K restaurant items, geo-aware, best for chains | GREEN | 2 | Yes — fallback after USDA miss |
| 9 | Spokin/Fig gap — no dish-level macro+safety in allergy apps | GREEN | 3 | No (positioning insight) |
| 10 | VC funding — food as medicine + GLP-1 + allergen = top themes | GREEN | 3 | No (fundraising signal) |

## Top 3 Immediate Actions (Priority 1)

1. **California ADDE compliance crawler** — 88 days to July 1. Add QR code detection + `compliance_page` source tag + highest confidence flag to menu-crawler. Re-crawl CA chain restaurants now to capture allergen data as it's published.

2. **GLP-1 filter** — 12% of Americans on GLP-1 drugs. Implement `glp1_friendly` as a priority option in NutritionalGoals union. Add menu crawler pattern matching for chain GLP-1 labels. Add UI filter option.

3. **Apollo Evaluator allergen disclaimer** — Add explicit uncertainty disclaimer to dish cards when allergen-critical flags are displayed. Reduces liability exposure as FDA regulatory scrutiny increases.
