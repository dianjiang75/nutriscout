import type { DietaryFlags } from "@/types";
import type { DishResult } from "@/lib/orchestrator/types";

// ─── Configurable Safety Thresholds ─────────────────────
// These can be tuned based on user feedback and regulatory requirements.

/** Confidence thresholds for dietary safety decisions */
const THRESHOLDS = {
  /** Min confidence to keep a dish with unknown dietary flag */
  UNKNOWN_FLAG_MIN: 0.7,
  /** Min confidence for allergy-critical restrictions (e.g., nut_free) */
  ALLERGY_CRITICAL_MIN: 0.85,
  /** Below this confidence, add a "not verified" warning even if flag is true */
  WARNING_THRESHOLD: 0.9,
} as const;

/**
 * Allergy-critical restrictions that need stricter filtering.
 * These are FDA Big 9 allergens where a false positive could cause
 * anaphylaxis. Requires explicit `true` flag + high confidence.
 * Add new entries here instead of modifying the verify() function.
 */
const ALLERGY_CRITICAL: (keyof DietaryFlags)[] = [
  "nut_free",
  "gluten_free",
  "dairy_free",  // lactose intolerance + casein allergy
  "vegan",       // ethical + health — must not serve animal products
  "vegetarian",  // must not serve meat/fish
];

/**
 * Allergen-to-dietary-flag mapping.
 * Maps FDA Big 9 allergens to the dietary flags that would exclude them.
 * If a user excludes "peanuts", we check for nut_free flag on the dish.
 */
const ALLERGEN_TO_FLAG: Record<string, keyof DietaryFlags> = {
  peanuts: "nut_free",
  tree_nuts: "nut_free",
  wheat: "gluten_free",
  gluten: "gluten_free",
  milk: "dairy_free",
  // eggs intentionally NOT mapped to dairy_free — eggs are NOT dairy.
  // Egg allergen uses keyword-only matching (no dedicated egg_free flag exists).
  // These allergens don't map to a dietary flag — filtered by description keyword matching:
  // eggs, fish, shellfish, soybeans, sesame, celery, mustard, lupin, molluscs, sulphites
};

/**
 * Dishes known to commonly contain specific allergens.
 * When these are flagged as allergen-free, require higher confidence (WARNING_THRESHOLD)
 * because the AI may have missed peanuts in Pad Thai, nuts in baklava, etc.
 */
const KNOWN_ALLERGEN_DISHES: Partial<Record<keyof DietaryFlags, string[]>> = {
  // Dishes that commonly contain hidden nuts despite appearing nut-free
  nut_free: [
    "pad thai", "kung pao", "satay", "baklava", "pesto", "mole", "dan dan", "mapo", "som tum",
    "thai curry", "massaman", "panang", "penang curry",
    "pecan pie", "praline", "nougat", "gianduja",
    "romesco", "muhammara", "fesenjan",
    "chinese chicken salad", "caesar salad",  // often has pine nuts or crouton with nut cross-contact
  ],
  // Dishes that commonly contain hidden gluten
  gluten_free: [
    "ramen", "udon", "nabeyaki", "spaghetti", "linguine", "penne", "fettuccine", "lo mein", "chow mein",
    "tiramisu", "ladyfinger", "croissant", "baguette", "pizza", "calzone", "gyoza", "dumpling", "wonton",
    "couscous", "bulgur", "tabbouleh", "seitan", "fu", "wheat noodle",
    "orzo", "farfalle", "rigatoni", "tortellini", "gnocchi",
    "beer-battered", "tempura", "katsu", "tonkatsu", "panko-crusted",
    "teriyaki", "hoisin", "oyster sauce",  // most contain wheat-based soy sauce
    "miso soup", "ramen broth",
  ],
  // Dishes that commonly contain hidden dairy
  dairy_free: [
    "alfredo", "carbonara", "mac and cheese", "gratin", "fondue", "queso", "tiramisu", "cheesecake",
    "butter chicken", "cacio e pepe",
    "white sauce", "béchamel", "bechamel", "cream sauce", "cream of mushroom",
    "hollandaise", "béarnaise", "bearnaise",
    "mashed potato", "scalloped potato", "au gratin",
    "risotto", "lobster bisque", "chowder", "creamy soup",
  ],
  // Dishes that are virtually never vegan despite potentially seeming so
  vegan: [
    "eel", "unagi", "omakase", "bolognese", "ragu", "meatball", "steak", "burger", "lamb", "pork",
    "bacon", "prosciutto", "sashimi", "omelette", "frittata", "tiramisu", "cheesecake",
    "nigiri", "kohada", "uni bibimbap", "taramasalata", "kitsune udon",
    "caesar dressing", "worcestershire sauce", "fish sauce", "oyster sauce",
    "dashi", "bonito flakes", "katsuobushi",
  ],
  // Dishes that are virtually never vegetarian
  vegetarian: [
    "eel", "unagi", "omakase", "sashimi", "bolognese", "ragu", "meatball", "steak", "lamb chop",
    "pork belly", "bacon", "prosciutto", "kebab",
    "caesar salad",  // anchovies in dressing
    "ramen", "pho",  // typically pork/chicken/beef broth
    "french onion soup",  // typically beef broth
    "paella", "clam chowder", "bouillabaisse",
    "worcestershire", "fish sauce",
  ],
};

/** Keywords that indicate an allergen is present in a dish description.
 * IMPORTANT: Include both singular AND plural forms — description text varies.
 * e.g., "peanut sauce" won't match "peanuts" keyword without singular form.
 * Covers both FDA Big 9 (US) and EU 14 major allergens.
 */
const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  // FDA Big 9
  peanuts: ["peanut", "peanuts", "groundnut", "groundnuts", "monkey nut"],
  tree_nuts: ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "pine nut", "brazil nut", "coconut", "chestnut", "praline", "nougat", "marzipan", "gianduja", "frangipane"],
  fish: ["fish", "salmon", "tuna", "cod", "branzino", "mackerel", "anchovy", "anchovies", "catfish", "trout", "bass", "halibut", "swordfish", "mahi", "tilapia", "snapper", "flounder", "sole", "sea bass", "striped bass", "worcestershire"],
  shellfish: ["shrimp", "crab", "lobster", "clam", "mussel", "oyster", "squid", "octopus", "prawn", "scallop", "crawfish", "crayfish", "langoustine", "abalone", "barnacle"],
  soybeans: ["soy", "tofu", "edamame", "miso", "tempeh", "soybean", "soya", "tamari", "natto"],
  sesame: ["sesame", "tahini", "goma", "til", "benne"],
  wheat: ["wheat", "flour", "bread", "naan", "pita", "tortilla", "crouton", "breadcrumb", "panko", "sourdough", "toast", "brioche", "biscuit", "pastry", "croissant", "baguette", "ciabatta", "focaccia", "semolina", "spelt", "kamut", "emmer", "einkorn", "durum", "seitan", "fu"],
  eggs: ["egg", "eggs", "omelette", "omelet", "tamago", "meringue", "frittata", "quiche", "aioli", "hollandaise", "carbonara"],
  milk: ["cheese", "cream", "butter", "yogurt", "milk", "ricotta", "burrata", "mozzarella", "paneer", "mascarpone", "ghee", "whey", "feta", "pecorino", "parmigiano", "parmesan", "brie", "gouda", "cheddar", "gruyere", "provolone", "cacio", "camembert", "roquefort", "gorgonzola", "béchamel", "bechamel", "alfredo", "fondue"],
  // EU 14 allergens beyond the FDA Big 9
  celery: ["celery", "celeriac", "celery root", "celery salt", "celery seed", "lovage"],
  mustard: ["mustard", "mustard seed", "mustard oil", "dijon", "whole-grain mustard", "english mustard", "american mustard"],
  lupin: ["lupin", "lupine", "lupin flour", "lupin seed", "lupin bean"],
  sulphites: ["sulphite", "sulfite", "sulphur dioxide", "sulfur dioxide", "dried fruit", "wine sauce", "wine reduction", "pickled"],
  molluscs: ["snail", "escargot", "slug", "abalone", "squid ink", "cuttlefish ink", "whelk", "periwinkle"],
};

/**
 * Apollo Evaluator — dietary safety verification.
 *
 * Double-checks every dish against the user's dietary restrictions and allergen exclusions.
 * Removes unsafe dishes and adds warning labels to uncertain ones.
 */
export function verify(
  dishes: DishResult[],
  restrictions: DietaryFlags,
  allergenExclusions?: string[]
): DishResult[] {
  const activeRestrictions = Object.entries(restrictions)
    .filter(([, v]) => v === true)
    .map(([k]) => k as keyof DietaryFlags);

  const allergens = allergenExclusions ?? [];
  if (activeRestrictions.length === 0 && allergens.length === 0) return dishes;

  return dishes
    .filter((dish) => {
      // Allergen keyword filtering — check dish description for allergen indicators
      for (const allergen of allergens) {
        const flagKey = ALLERGEN_TO_FLAG[allergen];
        const confidence = dish.dietary_confidence ?? 0;
        const desc = (dish.description || "").toLowerCase();
        const dishName = (dish.name || "").toLowerCase();
        const keywords = ALLERGEN_KEYWORDS[allergen] || [allergen];

        if (flagKey) {
          const flag = dish.dietary_flags?.[flagKey];
          const isCritical = ALLERGY_CRITICAL.includes(flagKey);

          // Explicitly contains the allergen → exclude
          if (flag === false) return false;

          // Allergy-critical allergens: must be explicitly safe with high confidence
          // This mirrors the dietary restriction path — allergens= must be equally strict
          if (isCritical) {
            if (flag !== true || confidence < THRESHOLDS.ALLERGY_CRITICAL_MIN) return false;
            // Known allergen dishes get even stricter threshold
            const knownDishes = KNOWN_ALLERGEN_DISHES[flagKey] ?? [];
            if (knownDishes.some((kw) => dishName.includes(kw)) && confidence < THRESHOLDS.WARNING_THRESHOLD) return false;
          }

          // Keyword safety net — if description/name mentions the allergen, exclude regardless of flag.
          // Catches cases where AI marks nut_free:true but description says "peanut sauce".
          if (keywords.some((kw) => desc.includes(kw) || dishName.includes(kw))) return false;

          // Flag not explicitly true and no keyword match → exclude for non-critical unknowns
          if (flag !== true && !isCritical) continue;
        } else {
          // No flag mapping — use keyword matching only
          if (keywords.some((kw) => desc.includes(kw) || dishName.includes(kw))) return false;
        }
      }

      for (const restriction of activeRestrictions) {
        const flag = dish.dietary_flags?.[restriction];
        const confidence = dish.dietary_confidence ?? 0;
        const isCritical = ALLERGY_CRITICAL.includes(restriction);

        // Explicitly non-compliant → exclude
        if (flag === false) return false;

        // Unknown flag + low confidence → exclude
        if (flag === null && confidence < THRESHOLDS.UNKNOWN_FLAG_MIN) return false;

        // Allergy-critical: must be explicitly true with high confidence
        if (isCritical && (flag !== true || confidence < THRESHOLDS.ALLERGY_CRITICAL_MIN)) return false;

        // Known allergen-containing dishes get stricter threshold
        if (isCritical && flag === true) {
          const knownDishes = KNOWN_ALLERGEN_DISHES[restriction] ?? [];
          const dName = (dish.name || "").toLowerCase();
          const isKnownAllergenDish = knownDishes.some((kw) => dName.includes(kw));
          if (isKnownAllergenDish && confidence < THRESHOLDS.WARNING_THRESHOLD) return false;
        }

        // Keyword safety net for dietary restrictions
        // Even if flag is true, if description/name contains allergen keywords, exclude.
        // Uses the same comprehensive keyword lists as the allergen-path for consistency.
        if (isCritical && flag === true) {
          const desc = (dish.description || "").toLowerCase();
          const dName = (dish.name || "").toLowerCase();

          // Map dietary restriction to the relevant allergen keyword lists
          const keywordSources: string[][] = [];
          if (restriction === "nut_free") {
            keywordSources.push(ALLERGEN_KEYWORDS["peanuts"] || []);
            keywordSources.push(ALLERGEN_KEYWORDS["tree_nuts"] || []);
          } else if (restriction === "gluten_free") {
            keywordSources.push(ALLERGEN_KEYWORDS["wheat"] || []);
            keywordSources.push(KNOWN_ALLERGEN_DISHES["gluten_free"] || []);
          } else if (restriction === "dairy_free") {
            keywordSources.push(ALLERGEN_KEYWORDS["milk"] || []);
            keywordSources.push(KNOWN_ALLERGEN_DISHES["dairy_free"] || []);
          } else if (restriction === "vegan") {
            // Vegan: exclude any animal product keywords
            keywordSources.push(ALLERGEN_KEYWORDS["milk"] || []);
            keywordSources.push(ALLERGEN_KEYWORDS["eggs"] || []);
            keywordSources.push(ALLERGEN_KEYWORDS["fish"] || []);
            keywordSources.push(ALLERGEN_KEYWORDS["shellfish"] || []);
            keywordSources.push(KNOWN_ALLERGEN_DISHES["vegan"] || []);
            keywordSources.push([
              "chicken", "beef", "pork", "lamb", "duck", "turkey", "veal",
              "bacon", "ham", "sausage", "salami", "prosciutto", "pepperoni",
              "steak", "ribeye", "sirloin", "brisket", "chorizo", "meat",
              "eel", "unagi", "honey", "dashi", "bonito",
              "roe", "caviar", "uni", "sea urchin", "ikura",
              "kohada", "shad", "nigiri", "sashimi",
              "tarama", "anchovy",
            ]);
          } else if (restriction === "vegetarian") {
            keywordSources.push(ALLERGEN_KEYWORDS["fish"] || []);
            keywordSources.push(ALLERGEN_KEYWORDS["shellfish"] || []);
            keywordSources.push(KNOWN_ALLERGEN_DISHES["vegetarian"] || []);
            keywordSources.push([
              "chicken", "beef", "pork", "lamb", "duck", "turkey", "veal",
              "bacon", "ham", "sausage", "salami", "prosciutto", "pepperoni",
              "steak", "ribeye", "sirloin", "brisket", "chorizo", "meat",
              "eel", "unagi", "dashi", "bonito",
              "roe", "caviar", "uni", "sea urchin", "ikura",
              "kohada", "shad", "tarama",
            ]);
          }

          const allKeywords = keywordSources.flat();
          if (allKeywords.some((kw) => desc.includes(kw) || dName.includes(kw))) return false;
        }
      }
      return true;
    })
    .map((dish) => {
      const warnings: string[] = [...dish.warnings];

      for (const restriction of activeRestrictions) {
        const flag = dish.dietary_flags?.[restriction];
        const confidence = dish.dietary_confidence ?? 0;

        // Flag is true but confidence below threshold → add warning
        if (flag === true && confidence < THRESHOLDS.WARNING_THRESHOLD) {
          const label = restriction.replace(/_/g, " ");
          warnings.push(
            `Likely ${label} based on menu analysis, but not verified by the restaurant`
          );
        }

        // Known allergen dishes ALWAYS get a warning regardless of confidence
        // e.g., Pad Thai claiming nut_free even at 0.95 — peanuts are a core ingredient
        if (flag === true && ALLERGY_CRITICAL.includes(restriction)) {
          const knownDishes = KNOWN_ALLERGEN_DISHES[restriction] ?? [];
          const dishName = (dish.name || "").toLowerCase();
          if (knownDishes.some((kw) => dishName.includes(kw))) {
            const label = restriction.replace(/_/g, " ");
            if (!warnings.some((w) => w.includes("traditionally contains"))) {
              warnings.push(
                `This dish traditionally contains ingredients related to ${label} — verify with the restaurant before ordering`
              );
            }
          }
        }

        // Flag is null but confidence >= threshold → borderline, warn
        if (flag === null && confidence >= THRESHOLDS.UNKNOWN_FLAG_MIN) {
          const label = restriction.replace(/_/g, " ");
          warnings.push(
            `${label} status unknown — exercise caution`
          );
        }
      }

      return { ...dish, warnings };
    });
}
