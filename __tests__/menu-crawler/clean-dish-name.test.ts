import { cleanDishName, cleanCategoryName, cleanDescription, isWineOrSpirit } from "@/lib/agents/menu-crawler/clean-dish-name";

describe("cleanDishName", () => {
  // ── Casing ──────────────────────────────────────────────────────
  it("converts ALL CAPS to title case", () => {
    expect(cleanDishName("CHICKEN PARMESAN")).toBe("Chicken Parmesan");
    expect(cleanDishName("GRILLED SALMON WITH RICE")).toBe("Grilled Salmon with Rice");
    expect(cleanDishName("PAD THAI")).toBe("Pad Thai");
  });

  it("preserves known acronyms when converting from ALL CAPS", () => {
    expect(cleanDishName("BBQ CHICKEN")).toBe("BBQ Chicken");
    expect(cleanDishName("CLASSIC BLT")).toBe("Classic BLT");
    expect(cleanDishName("NYC STYLE PIZZA")).toBe("NYC Style Pizza");
    expect(cleanDishName("XO SAUCE NOODLES")).toBe("XO Sauce Noodles");
  });

  it("converts all lowercase to title case", () => {
    expect(cleanDishName("chicken parmesan")).toBe("Chicken Parmesan");
  });

  it("preserves mixed case (already formatted)", () => {
    expect(cleanDishName("Chicken Parmesan")).toBe("Chicken Parmesan");
    expect(cleanDishName("Mac 'n' Cheese")).toBe("Mac 'n' Cheese");
  });

  it("handles small words correctly in title case", () => {
    expect(cleanDishName("FISH AND CHIPS")).toBe("Fish and Chips");
    expect(cleanDishName("CREAM OF MUSHROOM SOUP")).toBe("Cream of Mushroom Soup");
    expect(cleanDishName("STEAK WITH FRIES")).toBe("Steak with Fries");
  });

  it("capitalizes hyphenated words", () => {
    expect(cleanDishName("STIR-FRIED NOODLES")).toBe("Stir-Fried Noodles");
    expect(cleanDishName("HAND-PULLED NOODLES")).toBe("Hand-Pulled Noodles");
  });

  // ── Leading numbers ─────────────────────────────────────────────
  it("strips leading item numbers", () => {
    expect(cleanDishName("1. Chicken Parmesan")).toBe("Chicken Parmesan");
    expect(cleanDishName("12) Pad Thai")).toBe("Pad Thai");
    expect(cleanDishName("A1. Kung Pao Chicken")).toBe("Kung Pao Chicken");
    expect(cleanDishName("#12 Cheeseburger")).toBe("Cheeseburger");
    expect(cleanDishName("No. 5 Spring Rolls")).toBe("Spring Rolls");
    expect(cleanDishName("3 - Beef Tacos")).toBe("Beef Tacos");
    expect(cleanDishName("42: Miso Soup")).toBe("Miso Soup");
  });

  // ── Trailing prices ─────────────────────────────────────────────
  it("strips trailing prices", () => {
    expect(cleanDishName("Chicken Parmesan $12.99")).toBe("Chicken Parmesan");
    expect(cleanDishName("Pad Thai - $14.50")).toBe("Pad Thai");
    expect(cleanDishName("Caesar Salad 9.99")).toBe("Caesar Salad");
  });

  // ── Footnote markers ────────────────────────────────────────────
  it("strips footnote markers", () => {
    expect(cleanDishName("Chicken Parmesan*")).toBe("Chicken Parmesan");
    expect(cleanDishName("Spring Rolls**")).toBe("Spring Rolls");
    expect(cleanDishName("Pad Thai†")).toBe("Pad Thai");
  });

  it("strips dietary annotation tags", () => {
    expect(cleanDishName("Garden Salad (v)")).toBe("Garden Salad");
    expect(cleanDishName("Rice Bowl (vegan)")).toBe("Rice Bowl");
    expect(cleanDishName("Pasta (gf)")).toBe("Pasta");
    expect(cleanDishName("Pizza (gluten-free)")).toBe("Pizza");
    expect(cleanDishName("Brownie (contains nuts)")).toBe("Brownie");
    expect(cleanDishName("Burger (new)")).toBe("Burger");
  });

  // ── HTML entities ───────────────────────────────────────────────
  it("decodes HTML entities", () => {
    expect(cleanDishName("Mac &amp; Cheese")).toBe("Mac & Cheese");
    expect(cleanDishName("Chef&#39;s Special")).toBe("Chef's Special");
  });

  // ── Whitespace ──────────────────────────────────────────────────
  it("normalizes whitespace", () => {
    expect(cleanDishName("  Chicken   Parmesan  ")).toBe("Chicken Parmesan");
    expect(cleanDishName("Pad\tThai")).toBe("Pad Thai");
    expect(cleanDishName("Fried\nRice")).toBe("Fried Rice");
  });

  // ── Punctuation ─────────────────────────────────────────────────
  it("strips stray leading/trailing punctuation", () => {
    expect(cleanDishName("- Chicken Parmesan -")).toBe("Chicken Parmesan");
    expect(cleanDishName("• Spring Rolls")).toBe("Spring Rolls");
    expect(cleanDishName("Pad Thai...")).toBe("Pad Thai");
    expect(cleanDishName("...Steak")).toBe("Steak");
  });

  // ── Unicode ─────────────────────────────────────────────────────
  it("normalizes smart quotes", () => {
    expect(cleanDishName("Chef\u2019s Special")).toBe("Chef's Special");
  });

  // ── Category prefix ─────────────────────────────────────────────
  it("strips category prefixes leaked into names", () => {
    expect(cleanDishName("Appetizers: Spring Rolls")).toBe("Spring Rolls");
    expect(cleanDishName("Desserts - Tiramisu")).toBe("Tiramisu");
    expect(cleanDishName("Main Course: Grilled Salmon")).toBe("Grilled Salmon");
  });

  // ── Embedded calories ───────────────────────────────────────────
  it("strips embedded calorie info", () => {
    expect(cleanDishName("Grilled Salmon (450 cal)")).toBe("Grilled Salmon");
    expect(cleanDishName("Caesar Salad - 320 calories")).toBe("Caesar Salad");
  });

  // ── Serving info ────────────────────────────────────────────────
  it("strips serving info", () => {
    expect(cleanDishName("Party Platter (Serves 4)")).toBe("Party Platter");
    expect(cleanDishName("Wings (feeds 2)")).toBe("Wings");
  });

  // ── Combined transforms ─────────────────────────────────────────
  it("handles multiple issues at once", () => {
    expect(cleanDishName("12. CHICKEN PARMESAN* $14.99")).toBe("Chicken Parmesan");
    expect(cleanDishName("#3 PAD THAI (gf) - $12.50")).toBe("Pad Thai");
    expect(cleanDishName("  A1.  KUNG PAO CHICKEN†  ")).toBe("Kung Pao Chicken");
  });

  // ── Garbage rejection ───────────────────────────────────────────
  it("returns null for garbage names", () => {
    expect(cleanDishName("")).toBeNull();
    expect(cleanDishName("  ")).toBeNull();
    expect(cleanDishName("$")).toBeNull();
    expect(cleanDishName("12.99")).toBeNull();
    expect(cleanDishName("*")).toBeNull();
    expect(cleanDishName("a")).toBeNull(); // too short
  });

  // ── Edge cases ──────────────────────────────────────────────────
  it("preserves meaningful size/variant info in parens", () => {
    expect(cleanDishName("Pad Thai (Large)")).toBe("Pad Thai (Large)");
    expect(cleanDishName("Wings (12 pcs)")).toBe("Wings (12 pcs)");
  });

  it("preserves dish names that start with numbers when they're part of the name", () => {
    // "3-Cheese Pizza" — no separator after the number+letter combo
    expect(cleanDishName("3-Cheese Pizza")).toBe("3-Cheese Pizza");
  });
});

describe("cleanDescription", () => {
  // ── Null-like placeholders ──────────────────────────────────────
  it("returns null for 'None' and similar placeholders", () => {
    expect(cleanDescription("None")).toBeNull();
    expect(cleanDescription("N/A")).toBeNull();
    expect(cleanDescription("na")).toBeNull();
    expect(cleanDescription("--")).toBeNull();
    expect(cleanDescription("...")).toBeNull();
  });

  // ── Duplicate of dish name ──────────────────────────────────────
  it("returns null when description duplicates the dish name", () => {
    expect(cleanDescription("WOK FRIED BOK CHOY", "Wok Fried Bok Choy")).toBeNull();
    expect(cleanDescription("Chicken Wings", "Chicken Wings")).toBeNull();
    expect(cleanDescription("CRISPY CHICK'N CUTLETS", "Crispy Chick'n Cutlets")).toBeNull();
  });

  // ── ALL CAPS → sentence case ───────────────────────────────────
  it("converts ALL CAPS descriptions to sentence case", () => {
    expect(cleanDescription("2 BIG SCOOPS")).toBe("2 big scoops");
    expect(cleanDescription("SERVED WITH RICE AND BEANS")).toBe("Served with rice and beans");
  });

  // ── Whitespace normalization ────────────────────────────────────
  it("collapses newlines into spaces", () => {
    expect(cleanDescription("breakfast potatoes, sourdough toast, choice of bacon or\nsausage"))
      .toBe("breakfast potatoes, sourdough toast, choice of bacon or sausage");
  });

  // ── Add-on pricing ─────────────────────────────────────────────
  it("strips trailing add-on pricing", () => {
    expect(
      cleanDescription(
        "Spinach creamy chipotle, Gouda cheese, guacamole, pico de gallo, crema, queso fresco Add: Grilled Chicken $8 | Shrimp $10 | Beef $10"
      )
    ).toBe("Spinach creamy chipotle, Gouda cheese, guacamole, pico de gallo, crema, queso fresco");
  });

  // ── Trailing ellipsis ──────────────────────────────────────────
  it("strips trailing ellipsis", () => {
    expect(
      cleanDescription("Buffalo sauce, BBQ, or sweet & spicy maple sriracha sauce... & ranch dip")
    ).toBe("Buffalo sauce, BBQ, or sweet & spicy maple sriracha sauce... & ranch dip");
    // Only trailing ellipsis at end of string
    expect(cleanDescription("A delicious dish...")).toBe("A delicious dish");
  });

  // ── Embedded calories ──────────────────────────────────────────
  it("strips embedded calorie info", () => {
    expect(cleanDescription("Grilled salmon with rice (450 cal)")).toBe("Grilled salmon with rice");
  });

  // ── Preserves good descriptions ────────────────────────────────
  it("preserves well-formatted descriptions", () => {
    expect(
      cleanDescription("Whipped carp roe dip with lemon, olive oil, and warm pita")
    ).toBe("Whipped carp roe dip with lemon, olive oil, and warm pita");
  });

  // ── HTML entities ──────────────────────────────────────────────
  it("decodes HTML entities in descriptions", () => {
    expect(cleanDescription("Mac &amp; cheese with jalape&#241;os")).toBe(
      "Mac & cheese with jalapeños"
    );
  });
});

describe("isWineOrSpirit", () => {
  // ── Wines (should be filtered) ─────────────────────────────────
  it("detects wine grape names as wine listings", () => {
    expect(isWineOrSpirit("Pinot Noir")).toBe(true);
    expect(isWineOrSpirit("Chardonnay")).toBe(true);
    expect(isWineOrSpirit("Cabernet Sauvignon")).toBe(true);
    expect(isWineOrSpirit("Barolo")).toBe(true);
    expect(isWineOrSpirit("Prosecco")).toBe(true);
  });

  it("detects wines with vintage years", () => {
    expect(isWineOrSpirit("Barolo Bussia 2021")).toBe(true);
    expect(isWineOrSpirit("Marchese Antinori Chianti 2019")).toBe(true);
  });

  it("detects items in wine categories", () => {
    expect(isWineOrSpirit("Some Random Name", "Red Wine")).toBe(true);
    expect(isWineOrSpirit("House Selection", "By the Glass")).toBe(true);
    expect(isWineOrSpirit("Reserve Blend", "Wine List")).toBe(true);
  });

  // ── Spirits (should be filtered) ───────────────────────────────
  it("detects spirit listings", () => {
    expect(isWineOrSpirit("Grand Marnier")).toBe(true);
    expect(isWineOrSpirit("Don Julio 1942 Añejo")).toBe(true);
    expect(isWineOrSpirit("Mezcal Union Uno Joven")).toBe(true);
    expect(isWineOrSpirit("Ketel One Vodka")).toBe(true);
  });

  it("detects items in spirit categories", () => {
    expect(isWineOrSpirit("Bulleit", "Bourbon")).toBe(true);
    expect(isWineOrSpirit("Patron Silver", "Tequila")).toBe(true);
  });

  // ── Beer (should be filtered) ──────────────────────────────────
  it("detects beer listings", () => {
    expect(isWineOrSpirit("Greenport IPA")).toBe(true);
    expect(isWineOrSpirit("Brooklyn Lager")).toBe(true);
    expect(isWineOrSpirit("6% abv – New York")).toBe(true);
  });

  it("detects items in beer categories", () => {
    expect(isWineOrSpirit("Stella Artois", "Draft Beer")).toBe(true);
    expect(isWineOrSpirit("Blue Moon", "On Tap")).toBe(true);
  });

  // ── Real dishes with spirit words (should NOT be filtered) ─────
  it("preserves dishes with spirit words + food context", () => {
    expect(isWineOrSpirit("Vodka Rigatoni")).toBe(false);
    expect(isWineOrSpirit("Spicy Shrimp Vodka Rigatoni")).toBe(false);
    expect(isWineOrSpirit("Bourbon Glazed Ribs")).toBe(false);
    expect(isWineOrSpirit("Baked Eggs Alla Vodka")).toBe(false);
    expect(isWineOrSpirit("Tequila Lime Shrimp")).toBe(false);
    expect(isWineOrSpirit("Rum Cake")).toBe(false);
    expect(isWineOrSpirit("Whiskey Burger")).toBe(false);
  });

  it("preserves dishes with wine grape words + food context", () => {
    expect(isWineOrSpirit("Cabernet Braised Short Ribs")).toBe(false);
  });

  // ── Cocktails (should NOT be filtered) ─────────────────────────
  it("preserves cocktails", () => {
    expect(isWineOrSpirit("Mezcal Me Maybe")).toBe(false);
    expect(isWineOrSpirit("Basil Gimlet")).toBe(false);
    expect(isWineOrSpirit("Tequila Sunrise", "Mimosas")).toBe(false);
    expect(isWineOrSpirit("Vodka Martini")).toBe(false);
  });
});

describe("cleanCategoryName", () => {
  it("converts ALL CAPS categories", () => {
    expect(cleanCategoryName("APPETIZERS")).toBe("Appetizers");
    expect(cleanCategoryName("MAIN COURSES")).toBe("Main Courses");
  });

  it("strips leading numbers from categories", () => {
    expect(cleanCategoryName("1. Appetizers")).toBe("Appetizers");
  });

  it("returns null for garbage", () => {
    expect(cleanCategoryName("")).toBeNull();
    expect(cleanCategoryName("---")).toBeNull();
  });
});
