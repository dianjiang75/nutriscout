/**
 * Dish name cleaning pipeline.
 *
 * Raw menu data is messy — ALL CAPS, leading item numbers, embedded prices,
 * stray punctuation, HTML entities, etc. This module normalizes dish names
 * before they hit the database so search, dedup, and display all work cleanly.
 *
 * Each transform is a small pure function. The pipeline runs them in order.
 */

// ── Individual transforms ────────────────────────────────────────────

/** Replace HTML entities (&#39; &amp; &nbsp; etc.) with their characters. */
function decodeHtmlEntities(name: string): string {
  return name
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

/** Collapse tabs, newlines, non-breaking spaces into regular spaces; trim. */
function normalizeWhitespace(name: string): string {
  return name.replace(/[\t\n\r\u00A0\u200B]+/g, " ").replace(/  +/g, " ").trim();
}

/**
 * Strip leading item numbers / codes.
 * Matches patterns like: "1. ", "12) ", "A1. ", "#12 ", "No. 5 ", "1 - ", "1: "
 * Does NOT strip if the number looks like part of the name (e.g., "7-Up Chicken").
 */
function stripLeadingNumbers(name: string): string {
  // Pattern: optional # or "No.", then letter+digits or just digits, then separator
  // IMPORTANT: Don't strip when the number-separator is followed by a letter that forms
  // a compound word (e.g., "3-Cheese Pizza" — the "3-" is part of the name).
  return name
    .replace(/^#\d+[\s.\-:)]+/i, "")        // #12. , #5 -
    .replace(/^No\.?\s*\d+[\s.\-:)]+/i, "")  // No. 5 , No 12.
    .replace(/^[A-Z]?\d+[\s]*[.):;]+\s*/i, "") // A1. , 12) , 42:
    .replace(/^[A-Z]?\d+\s*-\s+/i, "")       // 3 - Beef Tacos (dash with space after = separator)
    .trim();
}

/**
 * Strip trailing prices embedded in the name.
 * "Chicken Parmesan $12.99" → "Chicken Parmesan"
 * "Pad Thai 14.50" → "Pad Thai"
 * Also handles "... - $12" and "... — $12.99"
 */
function stripTrailingPrice(name: string): string {
  return name
    .replace(/\s*[-–—]\s*\$?\d+(?:\.\d{2})?\s*$/, "")
    .replace(/\s+\$\d+(?:\.\d{2})?\s*$/, "")
    .replace(/\s+\d+\.\d{2}\s*$/, "")
    .trim();
}

/**
 * Strip footnote markers: trailing *, †, ‡, **, (v), (gf), (n), (new), (spicy) etc.
 * Preserves meaningful parentheticals that are part of the dish identity
 * like "(Small)", "(Large)", "(2 pcs)".
 */
function stripFootnoteMarkers(name: string): string {
  // Remove trailing asterisks, daggers, plus signs used as footnote markers
  let cleaned = name.replace(/[\s]*[*†‡+]+\s*$/, "").trim();

  // Remove common tag-style suffixes: (v), (vg), (gf), (df), (nf), (new), (spicy), (hot)
  // These are menu annotations, not part of the dish name
  cleaned = cleaned.replace(
    /\s*\(\s*(?:v|vg|vegan|gf|gluten[\s-]?free|df|dairy[\s-]?free|nf|nut[\s-]?free|new|hot|spicy|mild|contains nuts|vegetarian|halal|kosher)\s*\)\s*$/gi,
    ""
  ).trim();

  return cleaned;
}

/** Remove stray leading/trailing punctuation that isn't part of the name. */
function stripStrayPunctuation(name: string): string {
  // Leading dashes, bullets, dots (but not quotes or parens which might be intentional)
  let cleaned = name.replace(/^[\s\-–—•·.,;:]+/, "").trim();
  // Trailing dashes, dots (but keep closing parens/quotes)
  cleaned = cleaned.replace(/[\s\-–—.,;:]+$/, "").trim();
  // Trailing ellipsis
  cleaned = cleaned.replace(/\.{2,}$/, "").trim();
  return cleaned;
}

/**
 * Normalize casing to Title Case when the input is ALL CAPS or all lowercase.
 * Mixed case names (already properly formatted) are left untouched.
 *
 * Smart about:
 * - Small words that should stay lowercase (of, and, with, etc.)
 * - ALL-CAPS acronyms in otherwise mixed text (BBQ, NYC) — left alone
 * - Hyphenated words: "Stir-Fried" not "Stir-fried"
 * - Apostrophes: "Mac 'n' Cheese"
 */
/**
 * Common food/restaurant acronyms that should stay uppercase.
 * These are preserved even when converting from ALL CAPS.
 */
const KNOWN_ACRONYMS = new Set([
  "bbq", "blt", "nyc", "la", "dc", "xl", "xo", "pb",
  "mac", "diy", "og", "abv", "ipa", "ibu", "abts",
]);

function normalizeCasing(name: string): string {
  // Only transform if the name is ALL CAPS or all lowercase
  const isAllCaps = name === name.toUpperCase() && /[A-Z]/.test(name);
  const isAllLower = name === name.toLowerCase() && /[a-z]/.test(name);

  if (!isAllCaps && !isAllLower) return name;

  const lowerName = name.toLowerCase();
  const smallWords = new Set([
    "a", "an", "the", "and", "but", "or", "nor", "for", "yet", "so",
    "of", "in", "on", "at", "to", "by", "up", "as", "with", "from",
    "into", "over", "al", "de", "du", "la", "le", "el", "di", "da",
    "e", "con", "en", "y", "n",
  ]);

  return lowerName
    .split(" ")
    .map((word, index) => {
      // Preserve known acronyms as uppercase
      if (KNOWN_ACRONYMS.has(word)) return word.toUpperCase();
      // Short all-consonant words (2-3 chars) are likely acronyms — keep uppercase
      if (word.length <= 3 && /^[^aeiou]+$/.test(word) && /^[a-z]+$/.test(word) && !smallWords.has(word)) {
        return word.toUpperCase();
      }
      // First word is always capitalized
      if (index === 0) return capitalizeWord(word);
      // Small words stay lowercase (unless first)
      if (smallWords.has(word)) return word;
      return capitalizeWord(word);
    })
    .join(" ");
}

/** Capitalize a word, handling hyphens and apostrophes. */
function capitalizeWord(word: string): string {
  // Handle hyphenated words: "stir-fried" → "Stir-Fried"
  if (word.includes("-")) {
    return word
      .split("-")
      .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
      .join("-");
  }
  if (word.length === 0) return word;
  return word[0].toUpperCase() + word.slice(1);
}

/** Normalize unicode: smart quotes → straight, em-dashes → hyphens in names, etc. */
function normalizeUnicode(name: string): string {
  return name
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // smart double quotes
    .replace(/\u2026/g, "...")                     // ellipsis char
    .replace(/[\u2013\u2014]/g, "-");              // en/em dash → hyphen (in dish names)
}

/**
 * Strip common category prefixes that leak into dish names.
 * e.g., "Appetizers: Spring Rolls" → "Spring Rolls"
 * Only strips if the prefix matches a known menu section keyword.
 */
function stripCategoryPrefix(name: string): string {
  const categoryPrefixes =
    /^(?:appetizers?|starters?|entrees?|mains?|main\s+courses?|sides?|side\s+dishes?|desserts?|beverages?|drinks?|soups?|salads?|specials?|chef'?s?\s+specials?)\s*[:–—\-]\s*/i;
  return name.replace(categoryPrefixes, "").trim();
}

/**
 * Strip calorie/nutrition info sometimes embedded in dish names.
 * e.g., "Grilled Salmon (450 cal)" or "Caesar Salad - 320 calories"
 */
function stripEmbeddedCalories(name: string): string {
  return name
    .replace(/\s*\(\s*\d+\s*(?:cal|kcal|calories?)\s*\)\s*/gi, "")
    .replace(/\s*[-–—]\s*\d+\s*(?:cal|kcal|calories?)\s*$/gi, "")
    .trim();
}

/** Remove quantity/size suffixes that are metadata, not name. "Pad Thai (Serves 2)" */
function stripServingInfo(name: string): string {
  return name
    .replace(/\s*\(\s*(?:serves?\s*\d+|for\s*\d+|feeds?\s*\d+)\s*\)\s*$/gi, "")
    .trim();
}

// ── Dish Quality Filter ─────────────────────────────────────────────

/**
 * Determine if a menu item is a real dish worth recommending to users.
 *
 * Filters out:
 * - Sides and add-ons ("Side of Rice", "Extra Cheese", "Add Avocado")
 * - Basic beverages ("Water", "Coke", "Sprite", "Iced Tea")
 * - Condiments and sauces ("Ketchup", "Soy Sauce", "Ranch Dressing")
 * - Utensils and non-food items ("Chopsticks", "Extra Napkins")
 * - Generic modifiers ("Large", "Small", "Gluten Free Option")
 * - Items that are clearly sections/headers not dishes
 *
 * Allows through:
 * - Interesting beverages (cocktails, specialty coffee, smoothies, boba, aqua fresca)
 * - Full dishes even if small (appetizers, dim sum, tapas)
 * - Desserts
 */
export function isDishWorthRecommending(name: string, category?: string | null): boolean {
  const lower = name.toLowerCase();
  const catLower = (category || "").toLowerCase();

  // ─── Category-level exclusions ───
  const excludedCategories = [
    "add-ons", "add ons", "addons", "extras", "modifications",
    "sides", "side orders", "side dishes",
    "condiments", "sauces", "dressings", "toppings",
    "beverages", "drinks", "soft drinks", "sodas",
    "utensils", "supplies", "miscellaneous",
  ];
  if (excludedCategories.some((c) => catLower === c || catLower.startsWith(c))) {
    // Exception: allow items from drinks category if they're interesting
    if (catLower.includes("drink") || catLower.includes("beverage")) {
      if (isInterestingBeverage(lower)) return true;
    }
    return false;
  }

  // ─── Name-based exclusions ───

  // Side/add-on patterns
  if (/^(?:side\s+(?:of\s+)?|extra\s+|add\s+|sub(?:stitute)?\s+)/i.test(lower)) return false;
  if (/^(?:additional|upgrade|upsize|upcharge)/i.test(lower)) return false;

  // Basic drinks nobody wants to rate
  if (isBasicDrink(lower)) return false;

  // Condiments and sauces
  if (isCondiment(lower)) return false;

  // Non-food items
  if (isNonFood(lower)) return false;

  // Pure size/modifier entries (not actual dishes)
  if (/^(?:small|medium|large|regular|xl|extra large|half|full|single|double|triple)$/i.test(lower)) return false;
  if (/^(?:gluten[\s-]?free|vegan|vegetarian|dairy[\s-]?free)\s*(?:option|version)?$/i.test(lower)) return false;

  // Suspiciously long "creative" names that are likely marketing copy or parsing errors
  const wordCount = lower.split(/\s+/).length;
  if (wordCount > 12) return false;

  // Names that are clearly section headers or notes
  if (/^(?:please\s|note:|ask\s|see\s|check\s|call\s|coming\ssoon)/i.test(lower)) return false;
  if (/^(?:lunch|dinner|brunch|breakfast|happy\shour)\s+(?:menu|special|combo)/i.test(lower)) return false;

  return true;
}

function isBasicDrink(lower: string): boolean {
  const basicDrinks = [
    // Water
    "water", "bottled water", "sparkling water", "still water",
    "hot water", "ice water", "tap water",
    // Sodas
    "coke", "coca-cola", "coca cola", "diet coke", "pepsi", "diet pepsi",
    "sprite", "7up", "7-up", "mountain dew", "fanta", "dr pepper",
    "ginger ale", "root beer", "club soda", "tonic water", "seltzer",
    // Basic teas
    "iced tea", "unsweetened tea", "sweet tea", "hot tea",
    // Basic juice
    "orange juice", "apple juice", "cranberry juice",
    // Generic
    "soft drink", "fountain drink", "soda", "can of soda",
    "juice box", "milk", "chocolate milk",
  ];
  return basicDrinks.some((d) => lower === d || lower === `a ${d}` || lower === `${d} refill`);
}

export function isInterestingBeverage(lower: string): boolean {
  const interestingPatterns = [
    "cocktail", "martini", "margarita", "mojito", "sangria",
    "smoothie", "shake", "milkshake", "frappe", "frappuccino",
    "boba", "bubble tea", "taro", "matcha",
    "coffee", "iced coffee", "vietnamese coffee", "ca phe",
    "turkish coffee", "irish coffee",
    "latte", "cappuccino", "espresso", "cold brew", "pour over",
    "macchiato", "mocha", "cortado", "flat white", "americano",
    "affogato",
    "tea", "iced tea", "thai iced tea", "thai tea",
    "hot chocolate", "hot cocoa",
    "cider",
    "aqua fresca", "horchata", "jamaica", "tamarindo",
    "sake", "soju", "shochu", "makkoli",
    "lassi", "mango lassi", "chai",
    "kombucha", "lemonade", "arnold palmer",
    "mexican soda", "jarritos",
    // Classic cocktails with spirit names
    "sunrise", "sunset", "sour", "fizz", "mule", "spritz",
    "negroni", "paloma", "daiquiri", "gimlet", "highball",
    "old fashioned", "manhattan", "cosmopolitan", "sidecar",
    "punch", "toddy", "colada", "caipirinha", "crusta", "flip",
  ];
  return interestingPatterns.some((p) => lower.includes(p));
}

/**
 * Check if a menu item is an interesting beverage by name or by its category.
 * Returns true if:
 * - isInterestingBeverage(name) matches, OR
 * - category contains cocktail/mixology/bar/specialty drink keywords
 */
export function isInterestingBeverageOrCategory(name: string, category?: string | null): boolean {
  if (isInterestingBeverage(name.toLowerCase())) return true;
  if (!category) return false;
  const catLower = category.toLowerCase();
  const beverageCategories = [
    "cocktail", "mixology", "bar", "specialty drink",
    "signature drink", "craft beverage",
  ];
  return beverageCategories.some((c) => catLower.includes(c));
}

function isCondiment(lower: string): boolean {
  const condiments = [
    "ketchup", "mustard", "mayonnaise", "mayo", "ranch",
    "soy sauce", "hot sauce", "sriracha", "tabasco",
    "salsa", "guacamole cup", "sour cream", "pico de gallo",
    "tartar sauce", "cocktail sauce", "bbq sauce", "buffalo sauce",
    "dipping sauce", "extra sauce", "side of sauce",
    "dressing", "vinaigrette", "side of dressing",
    "butter packet", "cream cheese packet", "jelly packet",
    "salt", "pepper", "sugar", "sweetener",
  ];
  // Exact match or starts with "side of"
  return condiments.some((c) => lower === c || lower === `side of ${c}` || lower === `extra ${c}`);
}

function isNonFood(lower: string): boolean {
  const nonFood = [
    "chopsticks", "fork", "spoon", "knife", "napkin", "napkins",
    "plate", "bowl", "cup", "to-go container", "takeout container",
    "bag", "plastic bag", "utensils", "cutlery",
    "gift card", "merchandise", "t-shirt", "hat",
    "catering", "party tray", "event booking",
  ];
  return nonFood.some((n) => lower === n || lower.includes(n));
}

// ── Food Item Validation ────────────────────────────────────────────

/**
 * Validate that a menu item is actually food/drink, not hotel amenities,
 * website navigation, business hours, events, promotions, or other garbage.
 *
 * This is the LAST LINE OF DEFENSE before data enters the database.
 * Be aggressive about rejecting — a missed real dish can be re-crawled,
 * but junk in the DB pollutes search results and wastes image generation.
 *
 * Moved from sources.ts to centralize all dish-name filtering logic.
 */
export function isLikelyFoodItem(name: string, description: string): boolean {
  const lower = (name + " " + description).toLowerCase();
  const nameLower = name.toLowerCase().trim();

  // Definite non-food patterns
  const JUNK_PATTERNS = [
    // Hotel/building amenities
    /\b(gym|pool|spa|sauna|jacuzzi|elevator|lobby|concierge|valet|parking|shuttle|wifi|wi-fi)\b/,
    /\b(check-in|checkout|check-out|luggage|baggage|key card|safe deposit|minibar|mini-bar)\b/,
    /\b(hairdryer|hair dryer|shampoo|conditioner|towel|iron|ironing|laundry)\b/,
    /\b(air condition|heating|balcony|terrace|grab rail|shower|bathtub|toilet|wc )\b/,
    /\b(doorman|bellhop|reception|front desk|housekeeping|room service|wake-up)\b/,
    // Navigation/business info
    /\b(booking|reservation|phone|call us|contact|email|address|directions|located)\b/,
    /\b(close to|near |subway|bus stop|train station|airport)\b/,
    /\b(360°|virtual tour|gallery|photo|video|instagram|facebook|twitter)\b/,
    // Day names as standalone items
    /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i,
    // Phone numbers
    /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,
    // URLs
    /https?:\/\//,
    // ── Events & ambiance ──
    /\b(live music|dj night|karaoke|trivia night|open mic|comedy night)\b/,
    /\b(patio available|rooftop seating|indoor dining|outdoor dining)\b/,
    // ── Business services ──
    /\b(private events?|catering available|party room)\b/,
    // ── Time/hours-based ──
    /\b(happy hour \d|open daily \d|brunch hours|dinner hours|hours of operation|we are open|24-hour|24 hour)\b/,
    /\b\d{1,2}(?:am|pm)\s*[-–—]\s*\d{1,2}(?:am|pm)\b/i,
    // ── Promotional text ──
    /\b(coming soon|limited time|seasonal)\b/,
    /^new!?\s*$/i,
    // ── Generic section headers (standalone) ──
    /^(?:our specials|chef'?s? picks?|today'?s? selection)$/i,
    // ── Non-item notes ──
    /\b(ask your server|see blackboard|prices subject to change|market price)\b/,
    // ── Info/disclaimer text ──
    /\b(we use locally sourced|all items made fresh|consuming raw)\b/,
  ];

  if (JUNK_PATTERNS.some(p => p.test(lower))) return false;

  // Name too short or too long
  if (name.trim().length < 3 || name.trim().length > 80) return false;

  // Mostly numbers (likely a code or price)
  if (/^\d+[\s.,-]*\d*$/.test(name.trim())) return false;

  // Contains pipe (wine list format: "6002 | Syrah | ...")
  if (name.includes("|") && /\d{4}/.test(name)) return false;

  return true;
}

// ── Combo & Kids Detection ──────────────────────────────────────────

/**
 * Detect combo/meal deal items.
 * Matches: "combo", "meal deal", "value meal", "bundle", "2 for $",
 * "dinner for 2", "family meal", "prix fixe", "set menu"
 */
export function isComboOrMealDeal(name: string): boolean {
  const lower = name.toLowerCase();
  const comboPatterns = [
    /\bcombo\b/,
    /\bmeal deal\b/,
    /\bvalue meal\b/,
    /\bbundle\b/,
    /\b\d+\s+for\s+\$/,           // "2 for $20"
    /\bdinner for \d/,             // "dinner for 2"
    /\blunch for \d/,
    /\bfamily meal\b/,
    /\bprix fixe\b/,
    /\bset menu\b/,
  ];
  return comboPatterns.some((p) => p.test(lower));
}

/**
 * Detect kids menu items.
 * Matches: "kid's", "kids", "children's", "junior", "little ones",
 * "kiddie", "child's"
 */
export function isKidsMenuItem(name: string): boolean {
  const lower = name.toLowerCase();
  const kidsPatterns = [
    /\bkid'?s?\b/,
    /\bchildren'?s?\b/,
    /\bjunior\b/,
    /\blittle ones?\b/,
    /\bkiddie\b/,
    /\bchild'?s?\b/,
  ];
  return kidsPatterns.some((p) => p.test(lower));
}

/**
 * Detect dessert items by name or category (for pre-tagging at scrape time).
 * Used when the LLM auditor is unavailable (quota exhausted).
 */
export function isDessertItem(name: string, category?: string | null): boolean {
  const lower = name.toLowerCase();
  const catLower = (category || "").toLowerCase();

  // Category-based detection
  if (/\b(dessert|sweets?|pastry|pastries|bakery|dulce)\b/.test(catLower)) return true;

  // Name-based detection
  const dessertPatterns = /\b(cake|pie|ice cream|gelato|tiramisu|cheesecake|brownie|cookies?|pudding|flan|mochi|churros?|crème brûlée|creme brulee|sorbet|parfait|sundae|tart|tartes?|macaron|macaroon|baklava|doughnut|donut|crêpe|crepe|cupcake|panna cotta|cannoli|profiterole|eclair|éclair|beignet|cobbler|strudel|meringue|mousse|pavlova|bread pudding|bananas? foster|banana split|s'?mores|chocolate lava|chocolate cake|carrot cake|tres leches|affogato|semifreddo|soufflé|souffle|kulfi|gulab jamun|knafeh|kunafa|halva|halvah)\b/;
  return dessertPatterns.test(lower);
}

/**
 * Detect cocktails and special non-alcoholic drinks by name or category.
 * Used for pre-tagging at scrape time (supplements isWineOrSpirit which catches wine/beer/spirits).
 */
export function isCocktailOrSpecialDrink(name: string, category?: string | null): boolean {
  const lower = name.toLowerCase();
  const catLower = (category || "").toLowerCase();

  // Category-based
  if (/\b(cocktail|mocktail|mixolog|bar|signature drink|specialty drink|craft beverage|limonada|lemonade)\b/.test(catLower)) return true;
  if (/\b(after\s*dinner|digestif|digestivo|aperitif|aperitivo|cordials?|liqueurs?)\b/.test(catLower)) return true;

  // Cocktail name patterns
  const cocktailPatterns = /\b(martini|margarita|mojito|negroni|spritz|old fashioned|manhattan|cosmopolitan|daiquiri|gimlet|paloma|mule|sour|fizz|collins|punch|toddy|colada|caipirinha|sangria|bellini|mimosa|aperol|campari|highball)\b/;
  if (cocktailPatterns.test(lower)) return true;

  // Interesting non-alcoholic
  return isInterestingBeverage(lower);
}

// ── Wine & Spirit Filter ────────────────────────────────────────────

/**
 * Words that indicate a food dish even when a spirit keyword is present.
 * "Vodka Rigatoni" = dish, "Ketel One Vodka" = spirit listing.
 */
const FOOD_CONTEXT_WORDS = new Set([
  // Pasta/grains
  "rigatoni", "pasta", "penne", "spaghetti", "linguine", "fettuccine",
  "noodles", "rice", "risotto", "gnocchi", "orzo", "couscous",
  "lumache", "orecchiette", "bucatini", "cavatelli", "fusilli",
  "ravioli", "tortellini", "lasagna", "macaroni",
  // Proteins
  "chicken", "shrimp", "salmon", "steak", "pork", "beef", "lamb",
  "fish", "lobster", "crab", "duck", "tofu", "tempeh",
  "scallop", "squid", "octopus", "mussel", "clam", "oyster",
  // Cooking methods / dish types
  "sauce", "pesto", "ragu", "bolognese", "alla",
  "glazed", "braised", "grilled", "roasted", "fried",
  "baked", "sauteed", "marinated", "crusted", "infused",
  "burger", "pizza", "sandwich", "taco", "burrito", "wrap",
  "soup", "stew", "curry", "salad", "bowl", "plate",
  "wings", "ribs", "chops", "cutlet", "meatball",
  "eggs", "omelette", "benedict", "frittata",
  "square", "slice", "flatbread", "calzone",
  // Desserts with spirit names
  "cake", "tiramisu", "mousse", "pudding", "sorbet",
  "pie", "tart", "cheesecake", "brownie", "flan",
  // Food context for dessert wine / fortified wine words
  // "Port Wine Reduction", "Marsala Sauce", "Sherry Vinegar Glaze"
  "reduction", "vinegar", "vinaigrette", "demi-glace",
  "demiglace", "jus", "compote", "zabaglione",
]);

/** Well-known wine grape varieties and wine terms. */
const WINE_GRAPES = new Set([
  "cabernet", "merlot", "pinot", "chardonnay", "sauvignon",
  "riesling", "syrah", "shiraz", "malbec", "tempranillo",
  "grenache", "zinfandel", "sangiovese", "nebbiolo", "barbera",
  "prosecco", "champagne", "cava", "moscato", "gewurztraminer",
  "viognier", "gruner", "albarino", "vermentino", "trebbiano",
  "montepulciano", "primitivo", "garnacha", "mourvedre",
  "beaujolais", "burgundy", "bordeaux", "chianti", "barolo",
  "brunello", "amarone", "valpolicella", "chablis", "sancerre",
  "rioja", "manzanilla", "fino", "amontillado", "oloroso",
  // Dessert / fortified wines
  "port", "tawny", "madeira", "sherry", "marsala",
  "sauternes", "tokaji", "muscat", "banyuls",
  "pedro ximenez", "vin santo", "ice wine",
]);

/** Wine-related category names. */
const WINE_CATEGORIES = new Set([
  "wine", "wines", "red wine", "red wines", "white wine", "white wines",
  "rose", "rosé", "sparkling", "sparkling wine", "sparkling wines",
  "by the glass", "by the bottle", "glass pours", "bottle list",
  "wine list", "wine menu", "wine selection", "reds", "whites",
  "spirits", "liquor", "liquors", "whiskey", "whisky",
  "tequila", "mezcal", "bourbon", "scotch", "rum",
  "beer", "beers", "draft beer", "draft beers", "craft beer",
  "on tap", "bottles & cans", "bottled beer",
  // Common typos and alternate category names
  "champage", "champagne", "champagnes",
  // After-dinner / digestif / aperitif categories
  "after dinner", "after dinner menu", "after dinner drinks",
  "digestif", "digestifs", "digestivo",
  "aperitif", "aperitifs", "aperitivo",
  "cordials", "cordial", "liqueurs", "liqueur",
  // Dessert / fortified wine categories
  "port", "ports", "port wine", "port wines",
  "sherry", "sherries", "madeira", "sauternes",
  "dessert wine", "dessert wines", "fortified wine", "fortified wines",
]);

/** Spirit brand names / types (when NOT followed by food context). */
const SPIRIT_KEYWORDS = new Set([
  "vodka", "bourbon", "whiskey", "whisky", "tequila", "mezcal",
  "rum", "gin", "scotch", "cognac", "brandy", "absinthe",
  "grappa", "amaro", "aperol", "campari", "vermouth",
  "grand marnier", "cointreau", "chartreuse", "sambuca",
  "kahlua", "baileys", "limoncello", "ouzo", "arak",
  "soju", "shochu", "baijiu", "sake",
  // Brandies / eaux de vie / regional spirits
  "calvados", "armagnac", "marc", "eau de vie",
  "schnapps", "raki", "pastis", "pisco", "slivovitz",
  "kirsch", "drambuie", "frangelico", "fernet",
  "triple sec", "bénédictine", "benedictine",
  // Cachaça (with and without cedilla)
  "cachaça", "cachaca",
  // Aging / style terms that confirm it's a spirit listing
  "añejo", "anejo", "reposado", "blanco", "joven", "cristalino",
  "single malt", "cask strength", "aged",
  // Quality / age designators common on spirit lists
  "hors d'age", "xo", "vsop", "vs", "napoleon",
]);

/**
 * Detect if a menu item is a wine, beer, or neat spirit listing
 * (not a food dish that happens to contain a spirit word in its name).
 *
 * "Pinot Noir" → true (wine)
 * "Vodka Rigatoni" → false (dish)
 * "Don Julio 1942 Añejo" → true (spirit)
 * "Bourbon Glazed Ribs" → false (dish)
 * "Mezcal Me Maybe" → false (cocktail — handled by isInterestingBeverage)
 */
export function isWineOrSpirit(name: string, category?: string | null): boolean {
  const lower = name.toLowerCase();
  const catLower = (category || "").toLowerCase();

  // ── Category-based detection (strongest signal) ──
  // (cocktails already escaped above via isInterestingBeverage check)
  if (WINE_CATEGORIES.has(catLower)) {
    return true;
  }
  // Fuzzy category matches for misspellings and partial names
  // "Champage" (typo), "Champagne Selections", "After Dinner Menu", etc.
  if (catLower.includes("champ") && /champ(?:agne|age)/i.test(catLower)) return true;
  if (/\b(?:after\s*dinner|digestif|digestivo|aperitif|aperitivo|cordials?|liqueurs?)\b/i.test(catLower)) return true;
  if (/\b(?:fortified|dessert)\s*wines?\b/i.test(catLower)) return true;
  if (/\b(?:ports?|sherr(?:y|ies)|madeira|sauternes)\b/i.test(catLower)) return true;

  // ── Early cocktail escape ──
  // Check before wine/spirit detection — cocktails containing wine/spirit words should pass
  const words = lower.split(/\s+/);
  if (isInterestingBeverage(lower)) return false;

  // ── Wine grape / region detection ──
  const hasWineGrape = words.some((w) => WINE_GRAPES.has(w));
  if (hasWineGrape) {
    // Has food context? → it's a dish ("Cabernet Braised Short Ribs")
    if (words.some((w) => FOOD_CONTEXT_WORDS.has(w))) return false;
    // Has vintage year? → definitely wine
    if (/\b(19|20)\d{2}\b/.test(lower)) return true;
    // Short name with grape variety → wine listing
    if (words.length <= 5) return true;
    // Longer name with grape variety but no food context → still likely wine
    return true;
  }

  // ── Spirit detection ──
  // Multi-word spirit keywords need substring matching
  const MULTI_WORD_SPIRIT_KEYWORDS = [
    "grand marnier", "triple sec", "eau de vie", "single malt",
    "cask strength", "hors d'age", "hors d\u2019age",
  ];
  const hasMultiWordSpirit = MULTI_WORD_SPIRIT_KEYWORDS.some((kw) => lower.includes(kw));
  const hasSpirit = words.some((w) => SPIRIT_KEYWORDS.has(w))
    || hasMultiWordSpirit;
  if (hasSpirit) {
    // Has food context? → it's a dish
    if (words.some((w) => FOOD_CONTEXT_WORDS.has(w))) return false;
    // Cocktails already escaped above via early isInterestingBeverage check
    // Distinguish spirit listings ("Ketel One Vodka") from creative cocktail names
    // ("Mezcal Me Maybe", "Rum Tum Punch").
    //
    // Spirit listing patterns:
    //   - Spirit word is LAST or FIRST: "Ketel One Vodka", "Vodka Stolichnaya"
    //   - Has brand/vintage/aging indicator: "Don Julio 1942", "Mezcal Union Joven"
    //   - Multiple spirit keywords: "Mezcal Union Uno Joven" (mezcal + joven)
    //
    // Cocktail patterns:
    //   - Spirit word + playful/descriptive words: "Mezcal Me Maybe", "Gin & Juice"
    //   - Spirit word at start, rest isn't a brand: creative drink name

    const spiritWordCount = words.filter((w) => SPIRIT_KEYWORDS.has(w)).length;

    // Multiple spirit keywords → definitely a spirit listing
    if (spiritWordCount >= 2) return true;

    // Check for brand/vintage indicators
    const hasBrandIndicator = /\b(19|20)\d{2}\b/.test(lower);
    if (hasBrandIndicator) return true;

    // Spirit word as last word ("Ketel One Vodka") → spirit listing
    if (SPIRIT_KEYWORDS.has(words[words.length - 1])) return true;

    // Spirit word as second word ("Julius Marc de Galilee", "Busnel Calvados")
    // → "Brand Spirit [Region]" pattern common for brandies/eaux de vie
    if (words.length >= 2 && SPIRIT_KEYWORDS.has(words[1])) return true;

    // 2-word name with spirit word → spirit listing ("Patron Tequila")
    if (words.length <= 2) return true;

    // ≥3 words, spirit at start, no brand indicator → likely cocktail
    return false;
  }

  // ── Beer detection (by common patterns) ──
  // Exclude "porter house" (steak), "ginger ale" (already a basic drink)
  const beerPattern = /\b(?:ipa|lager|(?<!ginger )ale|stout|(?<!porter )pilsner|wheat beer|hefe|saison)\b/i;
  if (beerPattern.test(lower) && !/\bporter\s*house\b/i.test(lower)) {
    if (words.some((w) => FOOD_CONTEXT_WORDS.has(w))) return false;
    return true;
  }
  // "X% abv" pattern → almost certainly a beer/wine/spirit listing
  if (/\d+(?:\.\d+)?%\s*abv/i.test(lower)) return true;

  return false;
}

// ── Pipeline ─────────────────────────────────────────────────────────

/**
 * Clean and standardize a raw dish name from a menu.
 *
 * Applies a series of transforms in a specific order to handle:
 * - ALL CAPS → Title Case
 * - Leading item numbers (1. , A2) , #12)
 * - Trailing prices ($12.99)
 * - HTML entities
 * - Footnote markers (*, †, (v), (gf))
 * - Stray punctuation
 * - Whitespace normalization
 * - Unicode normalization
 * - Category prefixes leaked into names
 * - Embedded calorie info
 *
 * Returns the cleaned name, or null if the name is garbage after cleaning.
 */
export function cleanDishName(raw: string): string | null {
  let name = raw;

  // Order matters — decode entities first so regex can match clean text
  name = decodeHtmlEntities(name);
  name = normalizeUnicode(name);
  name = normalizeWhitespace(name);
  name = stripCategoryPrefix(name);
  name = stripLeadingNumbers(name);
  name = stripTrailingPrice(name);
  name = stripEmbeddedCalories(name);
  name = stripServingInfo(name);
  name = stripFootnoteMarkers(name);
  name = stripStrayPunctuation(name);
  name = normalizeWhitespace(name); // re-collapse after removals
  name = normalizeCasing(name);

  // Reject garbage: too short, too long, or no letters
  if (name.length < 2 || name.length > 150 || !/[a-zA-Z]/.test(name)) {
    return null;
  }

  return name;
}

/**
 * Clean a dish description from a menu.
 *
 * Lighter touch than name cleaning — descriptions are freeform text,
 * so we mostly normalize formatting without changing content.
 *
 * Handles:
 * - "None" / "N/A" / empty placeholders → null
 * - Description that just duplicates the dish name → null
 * - ALL CAPS → sentence case
 * - HTML entities & unicode normalization
 * - Whitespace collapse (newlines mid-sentence → spaces)
 * - Trailing add-on pricing ("Add: Chicken $8 | Shrimp $10")
 * - Trailing ellipsis from truncated menus
 * - Leading/trailing punctuation cleanup
 */
export function cleanDescription(
  raw: string,
  dishName?: string
): string | null {
  let desc = raw;

  // Null-like placeholders
  if (/^\s*(?:none|n\/a|na|tbd|no description|--|\.+)\s*$/i.test(desc)) {
    return null;
  }

  desc = decodeHtmlEntities(desc);
  desc = normalizeUnicode(desc);
  desc = normalizeWhitespace(desc);

  // If description just duplicates the dish name (case-insensitive), discard it
  if (dishName && desc.toLowerCase() === dishName.toLowerCase()) {
    return null;
  }

  // Strip trailing add-on lines: "Add: Chicken $8 | Shrimp $10 | Beef $10"
  desc = desc.replace(/\s*(?:add|substitute|upgrade|sub)[:\s].*\$\d+.*$/i, "").trim();

  // Strip trailing price references: "...$12.99" or "...starting at $10"
  desc = desc.replace(/\s*(?:starting\s+at\s+)?\$\d+(?:\.\d{2})?\s*$/i, "").trim();

  // Strip embedded calorie counts
  desc = desc
    .replace(/\s*\(\s*\d+\s*(?:cal|kcal|calories?)\s*\)/gi, "")
    .replace(/\s*[-–—]\s*\d+\s*(?:cal|kcal|calories?)\s*$/gi, "")
    .trim();

  // Normalize ALL CAPS descriptions to sentence case
  // (only if the ENTIRE description is uppercase)
  if (desc === desc.toUpperCase() && /[A-Z]/.test(desc) && desc.length > 1) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1).toLowerCase();
  }

  // Strip trailing ellipsis from truncated descriptions
  desc = desc.replace(/\.{2,}\s*$/, "").trim();

  // Clean stray leading/trailing punctuation
  desc = desc.replace(/^[\s\-–—•·,;:]+/, "").trim();
  desc = desc.replace(/[\s\-–—,;:]+$/, "").trim();

  // Final whitespace pass
  desc = desc.replace(/  +/g, " ").trim();

  // Reject if too short after cleaning or no letters
  if (desc.length < 2 || !/[a-zA-Z]/.test(desc)) {
    return null;
  }

  return desc;
}

/**
 * Clean a menu category name (similar pipeline but fewer transforms).
 */
export function cleanCategoryName(raw: string): string | null {
  let name = raw;

  name = decodeHtmlEntities(name);
  name = normalizeUnicode(name);
  name = normalizeWhitespace(name);
  name = stripLeadingNumbers(name);
  name = stripStrayPunctuation(name);
  name = normalizeWhitespace(name);
  name = normalizeCasing(name);

  if (name.length < 2 || name.length > 100 || !/[a-zA-Z]/.test(name)) {
    return null;
  }

  return name;
}
