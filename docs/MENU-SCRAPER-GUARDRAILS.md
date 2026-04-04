# Menu Scraper Guardrails & Audit Pipeline

## Why This Matters

The menu scraper is the **first agent in the pipeline**. Every downstream agent depends on its output being accurate:
- **Vision Analyzer** → wastes Gemini API calls on non-food images
- **Dietary Flag Analyzer** → produces meaningless allergen data for non-dishes
- **Review Aggregator** → can't find reviews for "Wheelchair-accessible basin"
- **Image Generator** → wastes $0.05/image generating photos of hotel amenities
- **Search Results** → users see garbage instead of food

**A single bad dish can kill someone** if the allergen data is wrong. This agent must have ZERO hallucination tolerance.

## What Went Wrong (April 2026 Incident)

### Root Causes
1. **Google Places "nearby restaurant" returned hotels** — Hotel Riu Plaza, Kimpton Hotel Eventi, Hotel Chelsea were treated as restaurants
2. **HTML parser scraped ALL page content** — The fallback parser grabbed any text under `<h2>/<h3>` headings, including:
   - Hotel amenities: "24-Hour GYM", "WC with grab rails", "Step-free shower"
   - Business info: "Bookings: 1 888 748 4990", "Close to Times Square"
   - Navigation: "360° Tour", "Sunday", "Monday" (operating hours)
3. **No validation before DB insert** — Zero checks on whether extracted text was actually food
4. **No audit layer** — Nothing reviewed the data after crawl

### Data Impact
- 3 hotels scraped as restaurants
- 45+ non-food items stored as "dishes"
- AI images generated for non-food items ($2+ wasted)
- Junk appeared in user search results

---

## Architecture: 4-Layer Defense

```
┌─────────────────────────────────────────────────┐
│ Layer 1: SOURCE FILTERING                        │
│ Google Places → Filter by type (restaurant only) │
│ Reject: hotels, gyms, spas, banks, stores        │
│ Validate: has menu page, serves food             │
└─────────────────┬───────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────┐
│ Layer 2: MENU EXTRACTION                         │
│ HTML/Photo → Extract dish name, description,     │
│ price, category, INGREDIENTS                     │
│ isLikelyFoodItem() rejects obvious non-food      │
│ Structured data (JSON-LD) preferred over CSS     │
└─────────────────┬───────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────┐
│ Layer 3: PRE-INSERT AUDIT (3 Agents)             │
│                                                  │
│ Agent A: FORMAT VALIDATOR                        │
│ - Every dish MUST have: name (3-80 chars),       │
│   at least partial description or ingredients    │
│ - Price must be a valid number or null            │
│ - Category must be food-related                  │
│ - Rejects: phone numbers, URLs, HTML tags,       │
│   amenities, business info, navigation text      │
│                                                  │
│ Agent B: FOOD KNOWLEDGE VERIFIER (LLM-powered)   │
│ - Sends batch of extracted items to Gemini Flash  │
│ - Prompt: "Is each item a real food/drink dish?  │
│   Rate confidence 0-1. Flag non-food items."     │
│ - Threshold: items with food_confidence < 0.7    │
│   are REJECTED before DB insert                  │
│ - Also extracts/verifies ingredients from name+  │
│   description for allergen safety                │
│                                                  │
│ Agent C: DUPLICATE & CONSISTENCY CHECKER          │
│ - Checks if dish already exists in DB            │
│ - Normalizes names (remove extra whitespace,      │
│   fix encoding, standardize capitalization)       │
│ - Validates price is reasonable for the cuisine   │
│   (a $0.01 steak or $500 coffee = suspicious)    │
│ - Cross-references with restaurant's cuisine type │
│   (sushi at a Mexican restaurant = suspicious)    │
└─────────────────┬───────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────┐
│ Layer 4: POST-INSERT MONITORING                  │
│ - Nightly audit queries DB for suspicious items  │
│ - Checks: dishes without calories, dishes with   │
│   no reviews after 7 days, dishes with broken    │
│   photo URLs, dishes with impossible macros       │
│ - Flags items for manual review                  │
│ - Auto-deactivates clearly junk items            │
└─────────────────────────────────────────────────┘
```

---

## Layer 2: Improved Menu Extraction Rules

### What MUST be extracted per dish:
1. **Name** — The actual dish name (3-80 characters)
2. **Description** — What's in it, how it's prepared
3. **Ingredients** — CRITICAL for allergen safety. Parse from description or dedicated ingredients field
4. **Price** — Numeric value or null
5. **Category** — Appetizers, Mains, Desserts, Drinks, Sides

### What MUST be rejected:
- Hotel/building amenities (gym, pool, spa, elevator, parking, WiFi)
- Business operations (hours, phone, address, booking info, directions)
- Website navigation (links, page titles, breadcrumbs)
- Day-of-week names (unless part of a dish like "Sunday Roast")
- Single characters or numbers
- Sentences longer than 80 characters (likely paragraphs)
- Wine list codes ("6002 | Syrah | Rene Balthazar...")
- Items with phone numbers or URLs in the name

### Ingredient Extraction Priority:
1. **Structured data** (JSON-LD schema.org/MenuItem) — highest confidence
2. **Allergen compliance page** — legally required to be accurate
3. **Menu description text** — parse ingredients from natural language
4. **AI inference from dish name** — lowest confidence, must be marked as inferred

---

## Layer 3: Pre-Insert Audit Agents

### Agent A: Format Validator (Rules-based, instant)

```typescript
interface DishValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function validateDish(item: RawMenuItem): DishValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Name checks
  if (!item.name || item.name.length < 3) errors.push("Name too short");
  if (item.name.length > 80) errors.push("Name too long (likely a sentence)");
  if (/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(item.name)) errors.push("Contains phone number");
  if (/https?:\/\//.test(item.name)) errors.push("Contains URL");
  if (/[<>]/.test(item.name)) errors.push("Contains HTML tags");
  if (JUNK_PATTERNS.some(p => p.test(item.name))) errors.push("Matches junk pattern");

  // Price checks
  if (item.price) {
    const priceNum = parseFloat(item.price.replace(/[^0-9.]/g, ""));
    if (priceNum < 0.50) warnings.push("Price suspiciously low");
    if (priceNum > 500) warnings.push("Price suspiciously high");
  }

  // Description checks
  if (!item.description && !item.price) warnings.push("No description and no price");

  return { isValid: errors.length === 0, errors, warnings };
}
```

### Agent B: Food Knowledge Verifier (LLM-powered)

Uses Gemini Flash (cheapest) to verify batches of 50 items:

```
Prompt: You are a food safety auditor. For each item below, determine:
1. Is this a real food or drink dish? (confidence 0-1)
2. What are the likely ingredients? List them.
3. Does the name match a known dish? If so, what cuisine?
4. Any allergen concerns based on the name/description?

Items to verify:
[{name, description, category, restaurant_cuisine}]

Return JSON: [{
  "name": string,
  "is_food": boolean,
  "food_confidence": 0-1,
  "likely_ingredients": string[],
  "cuisine_match": string | null,
  "allergen_flags": string[],
  "rejection_reason": string | null
}]
```

Rejection threshold: `food_confidence < 0.7` → REJECT

### Agent C: Duplicate & Consistency Checker

- Normalize dish name (trim, fix encoding, title case)
- Check for exact/fuzzy duplicates in DB
- Validate price is reasonable for cuisine (Mexican dish > $200 = suspicious)
- Cross-reference cuisine (sushi dishes from an Italian restaurant = flag)

---

## Layer 4: Nightly Audit Queries

Run every night BEFORE the improvement agent:

```sql
-- Dishes with no macros after 3 days (broken pipeline)
SELECT name FROM dishes WHERE calories_min IS NULL AND created_at < NOW() - INTERVAL '3 days';

-- Dishes with impossible macros
SELECT name FROM dishes WHERE calories_min > 5000 OR protein_max_g > 200;

-- Dishes with no reviews after 7 days (might be fake/junk)
SELECT d.name FROM dishes d LEFT JOIN review_summaries r ON d.id = r.dish_id
WHERE r.id IS NULL AND d.created_at < NOW() - INTERVAL '7 days';

-- Restaurants with 0 dishes (empty crawl)
SELECT name FROM restaurants WHERE is_active = true
AND id NOT IN (SELECT DISTINCT restaurant_id FROM dishes);

-- Dishes with broken photo URLs
SELECT name FROM dishes d JOIN dish_photos p ON d.id = p.dish_id
WHERE p.source_url NOT LIKE '/dishes/%' AND p.source_url NOT LIKE 'https://%';
```

---

## Implementation Priority

1. **Immediate**: Agent A (format validator) — pure rules, no API cost, catches 90% of junk
2. **Day 1**: Agent B (food verifier) — LLM-powered, catches the remaining 10%
3. **Day 2**: Agent C (duplicate checker) — prevents data bloat
4. **Nightly**: Layer 4 audit queries in the quality agent

---

## Allergen Safety: Non-Negotiable Rules

1. **NEVER insert a dish without attempting ingredient extraction**
2. **If ingredients can't be determined, set all allergen flags to `null` (unknown)**
3. **Never set an allergen flag to `true` (safe) unless confidence > 0.85**
4. **Known allergen dishes (Pad Thai, Satay, Baklava) get stricter threshold (0.90)**
5. **Description keyword override**: If description says "peanut" but AI says nut_free=true, the keyword wins
6. **Log every allergen decision** for audit trail
