import { prisma } from "@/lib/db/client";
import { menuSources, extractRawAnnotations } from "./sources";
import { getAnthropicClient, CLAUDE_SONNET, getQwenClient, QWEN_3, getDeepSeekClient, DEEPSEEK_V4 } from "@/lib/ai/clients";
import { extractJson } from "@/lib/utils/parse-json";
import {
  cleanDishName, cleanCategoryName, cleanDescription,
  isLikelyFoodItem, isWineOrSpirit, isInterestingBeverageOrCategory,
  isComboOrMealDeal, isKidsMenuItem, isDessertItem, isCocktailOrSpecialDrink,
} from "./clean-dish-name";
import { normalizeName } from "@/lib/menu/archive";
import type {
  AnalyzedDish,
  CrawlResult,
  RawMenuItem,
  RestaurantInfo,
} from "./types";
import type { MenuItemType } from "@/generated/prisma/client";

const INGREDIENT_ANALYSIS_PROMPT = `You are a food ingredient analyst specializing in dietary restriction detection.

For each dish below, analyze the name and description to:
1. List the likely ingredients (include cooking oils, garnishes, sauces)
2. Flag dietary compliance. Be CONSERVATIVE — if unsure, mark as null (unknown), not true.
   - vegan: no animal products whatsoever (check for butter, cream, cheese, honey, fish sauce, oyster sauce, egg)
   - vegetarian: no meat/fish (dairy and eggs OK)
   - gluten_free: no wheat, barley, rye, or likely cross-contamination
   - dairy_free: no milk, butter, cream, cheese, whey
   - nut_free: no tree nuts or peanuts
   - halal: no pork, no alcohol in cooking
   - kosher: no pork/shellfish, no meat-dairy mixing
3. Note any hidden ingredients that are commonly missed (e.g., Worcestershire sauce contains anchovies, many Asian dishes use fish sauce, Caesar dressing contains anchovies)
4. Detect GLP-1 labels: set glp1_labeled=true ONLY if the restaurant explicitly labels the dish as "GLP-1 Friendly", "GLP-1 Support", or equivalent in the dish name or description. Do NOT infer this — only set true if the restaurant themselves labeled it.

CRITICAL: Err on the side of caution. A false "safe" flag for someone with allergies is dangerous. If you cannot determine compliance with reasonable confidence, set the flag to null.

IMPORTANT: Some dishes include "menu_allergens", "menu_dietary_tags", or "menu_ingredients" fields.
These are RESTAURANT-STATED — the restaurant itself printed this on their menu. Treat as authoritative:
- If menu_allergens says "contains peanuts", set nut_free=false with HIGH confidence
- If menu_dietary_tags includes "GF", set gluten_free=true with HIGH confidence
- If menu_ingredients lists specific items, use those as your primary ingredient source
Your analysis should confirm and expand on restaurant-stated data, never contradict it unless clearly erroneous.

Dishes to analyze:
{dishes_json}

Return as JSON array:
[{
  "dish_name": "string",
  "ingredients_parsed": [{"name": "string", "is_primary": boolean}],
  "dietary_flags": {"vegan": true|false|null, "vegetarian": true|false|null, "gluten_free": true|false|null, "dairy_free": true|false|null, "nut_free": true|false|null, "halal": true|false|null, "kosher": true|false|null, "glp1_labeled": true|false},
  "dietary_confidence": 0.0-1.0,
  "dietary_warnings": ["string"]
}]

Return ONLY valid JSON, no markdown fences or extra text.`;

// Uses Claude Sonnet 4.6 for dietary flag analysis (safety-critical)

/**
 * Regex patterns for GLP-1 labeled menu items.
 * Covers both the generic "GLP-1 Friendly" label AND chain-specific marketing terms:
 * - Shake Shack: "Good Fit Menu" / "Good Fit"
 * - Chipotle: "High Protein Menu" / "Protein Cup"
 * - Cheesecake Factory: "Skinnylicious"
 * - Subway: "Protein Pocket"
 * - Smoothie King: "GLP-1 Menu" / "GLP-1 Support Menu"
 * - Factor (meal kits): "GLP-1 Balance"
 * - Conagra/Nestle: USDA-approved "GLP-1 Friendly" label (no standard yet)
 * Only matches explicit restaurant labeling — never inferred from macros.
 */
const GLP1_LABEL_PATTERN = /\bglp-?1\s*(friendly|support|approved|label|section|choice|menu|balance)?\b|\bgood fit(\s*menu)?\b|\bhigh protein menu\b|\bskinnylicious\b|\bglp-?1\s*approved\b|\bprotein pocket\b|\bglp-?1\s*balance\b/i;

/**
 * Check if a raw menu item has an explicit GLP-1 label from the restaurant.
 * Returns true only for explicit restaurant labeling — never inferred.
 */
function hasGlp1Label(item: RawMenuItem): boolean {
  return GLP1_LABEL_PATTERN.test(item.name) || GLP1_LABEL_PATTERN.test(item.description ?? "");
}

/**
 * Analyze raw menu items for ingredients and dietary flags using an LLM.
 *
 * Fallback chain: Claude Sonnet → Qwen 3 → DeepSeek V4 → placeholder.
 * Claude Sonnet is preferred for safety-critical dietary analysis, but when
 * it's unavailable (billing, quota), cheaper models provide best-effort analysis.
 * The Apollo Evaluator does the actual safety gate at search time regardless.
 *
 * Menu-scraped allergens/dietary tags are passed as context to the LLM so
 * restaurant-stated allergen data takes priority over inference.
 */
export async function analyzeIngredients(
  rawItems: RawMenuItem[]
): Promise<AnalyzedDish[]> {
  if (rawItems.length === 0) return [];

  // Process in batches of 20 to avoid token limits
  const batchSize = 20;
  const results: AnalyzedDish[] = [];

  for (let i = 0; i < rawItems.length; i += batchSize) {
    const batch = rawItems.slice(i, i + batchSize);
    const dishesJson = JSON.stringify(
      batch.map((item) => ({
        name: item.name,
        description: item.description,
        category: item.category,
        // Pass menu-scraped allergens/tags as authoritative context
        menu_allergens: item.menuAllergens || [],
        menu_dietary_tags: item.menuDietaryTags || [],
        menu_ingredients: item.menuIngredients || null,
      }))
    );

    const prompt = INGREDIENT_ANALYSIS_PROMPT.replace(
      "{dishes_json}",
      dishesJson
    );

    let parsed: AnalyzedDish[] | null = null;
    let usedModel = "none";

    // Fallback chain: Claude Sonnet → Qwen → DeepSeek → placeholder
    parsed = await tryClaudeSonnet(prompt);
    if (parsed) { usedModel = "claude-sonnet"; }

    if (!parsed) {
      parsed = await tryOpenAICompatible(getQwenClient, QWEN_3, prompt);
      if (parsed) { usedModel = "qwen-3"; }
    }

    if (!parsed) {
      parsed = await tryOpenAICompatible(getDeepSeekClient, DEEPSEEK_V4, prompt);
      if (parsed) { usedModel = "deepseek-v4"; }
    }

    if (parsed) {
      // Apply GLP-1 pattern check as a confirmation layer
      for (const dishResult of parsed) {
        const rawItem = batch.find(
          (item) => item.name.toLowerCase() === dishResult.dish_name.toLowerCase()
        );
        if (rawItem && hasGlp1Label(rawItem)) {
          dishResult.dietary_flags.glp1_labeled = true;
        }
      }
      if (i === 0) {
        console.log(`[menu-crawler] Dietary analysis using ${usedModel}`);
      }
      results.push(...parsed);
    } else {
      // All models failed — push placeholders
      console.warn(`[menu-crawler] All LLM models failed for batch at index ${i}`);
      for (const item of batch) {
        results.push({
          dish_name: item.name,
          ingredients_parsed: [],
          dietary_flags: {
            vegan: null, vegetarian: null, gluten_free: null,
            dairy_free: null, nut_free: null, halal: null, kosher: null,
            glp1_labeled: false,
          },
          dietary_confidence: 0,
          dietary_warnings: ["Automated dietary analysis failed — manual review needed"],
        });
      }
    }
  }

  return results;
}

/** Try Claude Sonnet for dietary analysis (preferred — most accurate for safety) */
async function tryClaudeSonnet(prompt: string): Promise<AnalyzedDish[] | null> {
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: CLAUDE_SONNET,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      const parsed = extractJson<AnalyzedDish[]>(textBlock.text);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    return null;
  } catch (err) {
    console.warn(`[menu-crawler] Claude Sonnet failed:`, (err as Error).message?.substring(0, 80));
    return null;
  }
}

/** Try OpenAI-compatible model (Qwen, DeepSeek) for dietary analysis */
async function tryOpenAICompatible(
  getClient: () => ReturnType<typeof getQwenClient>,
  model: string,
  prompt: string
): Promise<AnalyzedDish[] | null> {
  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model,
      max_tokens: 8192, // Higher limit for cheap models — avoids truncated JSON
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.choices[0]?.message?.content;
    if (text) {
      const parsed = extractJson<AnalyzedDish[]>(text);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    return null;
  } catch (err) {
    console.warn(`[menu-crawler] ${model} failed:`, (err as Error).message?.substring(0, 80));
    return null;
  }
}

/**
 * Full crawl pipeline for a restaurant.
 *
 * 5-step flow (post-refactor):
 *   1. Scrape — fetch raw items, clean names, filter junk via isLikelyFoodItem only
 *   2. Store in MenuItem — upsert every item into the menu archive
 *   3. Classify — run audit agent + pre-tag wines/combos/kids, set menuItemType
 *   4. Promote to Dish — only dishes + desserts + interesting drinks get Dish records
 *   5. Archive stale — items not seen this crawl get soft-archived (with circuit breaker)
 */
export async function crawlRestaurant(
  googlePlaceId: string
): Promise<CrawlResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  }

  const crawlStart = new Date();

  // Fetch restaurant details from Google Places API v2 (New)
  const { getPlaceDetails, priceLevelToNumber } = await import("@/lib/google-places/client");
  const place = await getPlaceDetails(googlePlaceId, "core");

  if (!place) {
    throw new Error(`No result for place ID: ${googlePlaceId}`);
  }

  const priceLevelNum = priceLevelToNumber(place.priceLevel);

  const restaurantInfo: RestaurantInfo = {
    googlePlaceId,
    name: place.displayName?.text ?? "",
    address: place.formattedAddress ?? "",
    websiteUrl: place.websiteUri || null,
    latitude: place.location?.latitude ?? 0,
    longitude: place.location?.longitude ?? 0,
  };

  // Upsert restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { googlePlaceId },
    update: {
      name: restaurantInfo.name,
      address: restaurantInfo.address,
      latitude: restaurantInfo.latitude,
      longitude: restaurantInfo.longitude,
      websiteUrl: restaurantInfo.websiteUrl,
      priceLevel: priceLevelNum ?? null,
      googleRating: place.rating ?? null,
      phone: place.nationalPhoneNumber ?? null,
      lastMenuCrawl: crawlStart,
    },
    create: {
      googlePlaceId,
      name: restaurantInfo.name,
      address: restaurantInfo.address,
      latitude: restaurantInfo.latitude,
      longitude: restaurantInfo.longitude,
      websiteUrl: restaurantInfo.websiteUrl,
      priceLevel: priceLevelNum ?? null,
      googleRating: place.rating ?? null,
      phone: place.nationalPhoneNumber ?? null,
      cuisineType: extractCuisineTypes(place.types || []),
      lastMenuCrawl: crawlStart,
    },
  });

  // ═══════════════════════════════════════════════════════════
  // STEP 1: SCRAPE — fetch raw items, clean, filter only junk
  // ═══════════════════════════════════════════════════════════
  let rawItems: RawMenuItem[] = [];
  let usedSource: string = "none";

  for (const source of menuSources) {
    const result = await source.fetch(restaurantInfo);
    if (result && result.length > 0) {
      rawItems = result;
      usedSource = source.name;
      break;
    }
  }

  if (rawItems.length === 0) {
    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      menuSource: "none",
      dishesFound: 0,
      dishesAnalyzed: 0,
      photosQueued: 0,
    };
  }

  // Extract raw annotations (dietary tags, footnote markers) BEFORE cleaning strips them
  const annotatedItems: RawMenuItem[] = rawItems.map((item) => {
    const annotations = extractRawAnnotations(item.name, item.description);
    return {
      ...item,
      menuDietaryTags: [
        ...(item.menuDietaryTags || []),
        ...annotations.dietaryTags,
      ],
      menuAllergens: item.menuAllergens || [],
    };
  });

  // Clean names, filter only non-food junk. Everything real passes through:
  // sides, drinks, wine, add-ons, condiments — all stored in MenuItem.
  // Classification happens in Step 3, NOT here.
  const cleanedItems = annotatedItems.reduce<RawMenuItem[]>((acc, item) => {
    const cleaned = cleanDishName(item.name);
    if (!cleaned) return acc; // garbage name (null, too short, no letters)
    if (!isLikelyFoodItem(cleaned, item.description || "")) return acc; // "WiFi", "Saturday", "Live Music"

    const cleanedCategory = item.category ? cleanCategoryName(item.category) : null;
    const cleanedDescription = item.description
      ? cleanDescription(item.description, cleaned)
      : null;

    acc.push({
      ...item,
      name: cleaned,
      nameOriginal: cleaned !== item.name ? item.name : undefined,
      category: cleanedCategory,
      description: cleanedDescription ?? "",
    });
    return acc;
  }, []);

  // Deduplicate by normalized name within same crawl
  const seen = new Set<string>();
  const dedupedItems = cleanedItems.filter((item) => {
    const key = normalizeName(item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (dedupedItems.length === 0) {
    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      menuSource: usedSource,
      dishesFound: 0,
      dishesAnalyzed: 0,
      photosQueued: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: STORE IN MENUITEM — upsert every item into archive
  // ═══════════════════════════════════════════════════════════
  const sourceEnum = mapSourceToEnum(usedSource);

  // Pre-tag items at scrape time (skip LLM for obvious categories).
  // This is the fallback classification when Gemini auditor is unavailable.
  const preTagged = dedupedItems.map((item) => {
    let preType: MenuItemType = "unknown";
    if (isWineOrSpirit(item.name, item.category)) preType = "drink";
    else if (isCocktailOrSpecialDrink(item.name, item.category)) preType = "drink";
    else if (isDessertItem(item.name, item.category)) preType = "dessert";
    else if (isComboOrMealDeal(item.name)) preType = "combo";
    else if (isKidsMenuItem(item.name)) preType = "kids";
    return { item, preType };
  });

  // Upsert all items into MenuItem
  const menuItemIds: string[] = [];
  for (const { item, preType } of preTagged) {
    const nameNorm = normalizeName(item.name);
    try {
      const menuItem = await prisma.menuItem.upsert({
        where: {
          restaurantId_nameNormalized_source: {
            restaurantId: restaurant.id,
            nameNormalized: nameNorm,
            source: sourceEnum,
          },
        },
        create: {
          restaurantId: restaurant.id,
          name: item.name,
          nameNormalized: nameNorm,
          nameOriginal: item.nameOriginal || null,
          description: item.description || null,
          price: item.price ? parsePriceString(item.price) : null,
          category: item.category || null,
          menuItemType: preType,
          source: sourceEnum,
          photoUrl: item.photoUrl || null,
          menuCalories: item.menuCalories || null,
          menuProteinG: item.menuProteinG || null,
          menuCarbsG: item.menuCarbsG || null,
          menuFatG: item.menuFatG || null,
          menuAllergens: item.menuAllergens || [],
          menuDietaryTags: item.menuDietaryTags || [],
          menuIngredients: item.menuIngredients || null,
          lastSeenAt: crawlStart,
        },
        update: {
          name: item.name,
          description: item.description || null,
          price: item.price ? parsePriceString(item.price) : null,
          category: item.category || null,
          photoUrl: item.photoUrl || null,
          menuCalories: item.menuCalories || null,
          menuProteinG: item.menuProteinG || null,
          menuCarbsG: item.menuCarbsG || null,
          menuFatG: item.menuFatG || null,
          menuAllergens: item.menuAllergens || [],
          menuDietaryTags: item.menuDietaryTags || [],
          menuIngredients: item.menuIngredients || null,
          lastSeenAt: crawlStart,
          // Un-archive items that reappear on the menu
          archivedAt: null,
          archivedReason: null,
        },
      });
      menuItemIds.push(menuItem.id);
    } catch (err) {
      console.warn(`[menu-crawler] Failed to upsert MenuItem "${item.name}":`, (err as Error).message);
    }
  }

  console.log(`[menu-crawler] Step 2: Stored ${menuItemIds.length} MenuItems for ${restaurant.name}`);

  // ═══════════════════════════════════════════════════════════
  // STEP 3: CLASSIFY — audit non-pre-tagged items via LLM
  // ═══════════════════════════════════════════════════════════
  // Items pre-tagged as wine/combo/kids skip the LLM auditor (save cost)
  const itemsNeedingAudit = preTagged.filter(p => p.preType === "unknown").map(p => p.item);
  const preTaggedMap = new Map(preTagged.map(p => [normalizeName(p.item.name), p.preType]));

  let auditResults: Array<{ item: RawMenuItem; dishType: string; passed: boolean; rejectionReasons: string[]; auditConfidence?: number }> = [];

  if (itemsNeedingAudit.length > 0) {
    const { auditMenuItems } = await import("@/lib/agents/dish-auditor");
    const cuisineStr = (restaurant as Record<string, unknown>).cuisineType
      ? ((restaurant as Record<string, unknown>).cuisineType as string[]).join(", ")
      : "";
    auditResults = await auditMenuItems(itemsNeedingAudit, restaurant.id, cuisineStr);
  }

  // Update menuItemType on all MenuItems based on audit + pre-tag results
  let classifiedCount = 0;
  for (const { item, preType } of preTagged) {
    const nameNorm = normalizeName(item.name);

    let finalType: MenuItemType = preType;
    let confidence: number | null = null;

    if (preType === "unknown") {
      // Look up audit result
      const audit = auditResults.find(
        r => normalizeName(r.item.name) === nameNorm
      );
      if (audit) {
        if (!audit.passed) {
          // Rejected by auditor — archive as junk
          finalType = "unknown";
          confidence = audit.auditConfidence ?? null;
          await prisma.menuItem.updateMany({
            where: {
              restaurantId: restaurant.id,
              nameNormalized: nameNorm,
              source: sourceEnum,
            },
            data: {
              menuItemType: finalType,
              auditConfidence: confidence,
              archivedAt: new Date(),
              archivedReason: "junk_detected",
            },
          });
          continue;
        }
        finalType = audit.dishType as MenuItemType;
        confidence = audit.auditConfidence ?? null;
      }
    }

    await prisma.menuItem.updateMany({
      where: {
        restaurantId: restaurant.id,
        nameNormalized: nameNorm,
        source: sourceEnum,
      },
      data: {
        menuItemType: finalType,
        auditConfidence: confidence,
      },
    });
    classifiedCount++;
  }

  const rejected = auditResults.filter(r => !r.passed);
  if (rejected.length > 0) {
    console.log(`[menu-crawler] Step 3: Rejected ${rejected.length} junk items for ${restaurant.name}:`);
    rejected.slice(0, 5).forEach(r => console.log(`  ✗ "${r.item.name}" — ${r.rejectionReasons.join(", ")}`));
  }
  console.log(`[menu-crawler] Step 3: Classified ${classifiedCount} items for ${restaurant.name}`);

  // ═══════════════════════════════════════════════════════════
  // STEP 4: PROMOTE TO DISH — only dishes/desserts/interesting drinks
  // ═══════════════════════════════════════════════════════════
  // Promotion rules:
  //   dish    → always promoted
  //   dessert → always promoted
  //   drink + isInterestingBeverageOrCategory → promoted
  //   everything else → MenuItem only (full menu)
  const promotableItems = preTagged.filter(({ item, preType }) => {
    const nameNorm = normalizeName(item.name);
    // Get the final classified type (might have been updated by auditor)
    const auditResult = auditResults.find(r => normalizeName(r.item.name) === nameNorm);
    const finalType = (preType !== "unknown" ? preType : auditResult?.dishType) || "unknown";
    const passed = preType !== "unknown" || (auditResult?.passed ?? false);

    if (!passed) return false;
    if (finalType === "dish" || finalType === "dessert") return true;
    if (finalType === "drink" && isInterestingBeverageOrCategory(item.name, item.category)) return true;
    return false;
  });

  console.log(`[menu-crawler] Step 4: Promoting ${promotableItems.length} items to Dish cards`);

  // Analyze ingredients and dietary flags for promoted items only
  const promotableRaw = promotableItems.map(p => p.item);
  const analyzed = await analyzeIngredients(promotableRaw);

  // Upsert Dish records and link MenuItem → Dish
  const photoJobs: { dishId: string; photoUrl: string; restaurantName: string }[] = [];
  let dishesCreated = 0;

  for (const { item } of promotableItems) {
    const analysis = analyzed.find(
      (a) => a.dish_name.toLowerCase() === item.name.toLowerCase()
    );

    const price = item.price ? parsePriceString(item.price) : null;

    const isCompliancePage = item.source === "compliance_page";
    const dietaryConfidence = isCompliancePage
      ? Math.max(0.95, analysis?.dietary_confidence ?? 0.95)
      : (analysis?.dietary_confidence ?? null);

    // If menu already has calories/macros, use those as primary source
    const hasMenuCalories = item.menuCalories != null;

    const dishData = {
      name: item.name,
      description: item.description || null,
      price,
      category: item.category || null,
      ingredientsRaw: item.menuIngredients || item.description || null,
      ingredientsParsed: analysis?.ingredients_parsed ?? undefined,
      dietaryFlags: analysis?.dietary_flags ?? undefined,
      dietaryConfidence,
      ...(hasMenuCalories ? {
        caloriesMin: item.menuCalories,
        caloriesMax: item.menuCalories,
        macroSource: "restaurant_published" as const,
      } : {}),
      isAvailable: true,
    };

    const existing = await prisma.dish.findFirst({
      where: {
        restaurantId: restaurant.id,
        name: { equals: item.name, mode: "insensitive" as const },
      },
    });

    const dish = existing
      ? await prisma.dish.update({ where: { id: existing.id }, data: dishData })
      : await prisma.dish.create({
          data: { restaurantId: restaurant.id, ...dishData, macroSource: hasMenuCalories ? "restaurant_published" : null },
        });

    dishesCreated++;

    // Link MenuItem → Dish and write back parsed ingredients
    const nameNorm = normalizeName(item.name);
    const parsedIngredientList = analysis?.ingredients_parsed
      ?.map((i: { name: string }) => i.name)
      .join(", ") || null;

    await prisma.menuItem.updateMany({
      where: {
        restaurantId: restaurant.id,
        nameNormalized: nameNorm,
        source: sourceEnum,
      },
      data: {
        dishId: dish.id,
        // Write back LLM-parsed ingredients to MenuItem for full menu display
        ...(parsedIngredientList && !item.menuIngredients ? { menuIngredients: parsedIngredientList } : {}),
      },
    });

    if (item.photoUrl) {
      photoJobs.push({ dishId: dish.id, photoUrl: item.photoUrl, restaurantName: restaurant.name });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 5: ARCHIVE STALE — soft-delete items not seen this crawl
  // ═══════════════════════════════════════════════════════════
  // CIRCUIT BREAKER: if current crawl found < 20% of previous active items,
  // the scraper likely failed — don't archive the entire menu.
  const previousActiveCount = await prisma.menuItem.count({
    where: {
      restaurantId: restaurant.id,
      source: sourceEnum,
      archivedAt: null,
    },
  });

  const currentCount = dedupedItems.length;
  const archiveThreshold = Math.max(previousActiveCount * 0.2, 3); // at least 3

  if (previousActiveCount > 0 && currentCount < archiveThreshold) {
    console.warn(
      `[menu-crawler] CIRCUIT BREAKER: Found only ${currentCount} items vs ${previousActiveCount} previous active. ` +
      `Skipping stale archival for ${restaurant.name} — scraper may have failed.`
    );
  } else {
    // Archive items from this source that weren't seen in this crawl
    const { count: archivedCount } = await prisma.menuItem.updateMany({
      where: {
        restaurantId: restaurant.id,
        source: sourceEnum,
        archivedAt: null,
        lastSeenAt: { lt: crawlStart },
      },
      data: {
        archivedAt: new Date(),
        archivedReason: "menu_removed",
      },
    });
    if (archivedCount > 0) {
      console.log(`[menu-crawler] Step 5: Archived ${archivedCount} stale items for ${restaurant.name}`);
    }
  }

  // Update restaurant menu source
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      menuSource: usedSource === "none" ? undefined : usedSource as "website" | "google_photos" | "manual",
      lastMenuCrawl: crawlStart,
    },
  });

  // Queue photo analysis via BullMQ (unchanged from before)
  if (photoJobs.length > 0) {
    try {
      const { Queue } = await import("bullmq");
      const { redis } = await import("@/lib/cache/redis");
      const photoQueue = new Queue("photo-analysis", {
        connection: redis,
        defaultJobOptions: {
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      });
      const MAX_PHOTOS_PER_CRAWL = 20;
      const jobsToQueue = photoJobs.slice(0, MAX_PHOTOS_PER_CRAWL);

      await photoQueue.addBulk(
        jobsToQueue.map((job) => ({
          name: `analyze-${job.dishId}`,
          data: {
            dishId: job.dishId,
            photoUrl: job.photoUrl,
            restaurantName: job.restaurantName,
          },
          opts: {
            jobId: `photo-${job.dishId}`,
            priority: 2,
            attempts: 2,
            backoff: { type: "exponential" as const, delay: 5000 },
          },
        }))
      );
      console.log(`[menu-crawler] Queued ${jobsToQueue.length} photo analysis jobs for ${restaurant.name}`);
      await photoQueue.close();
    } catch (err) {
      console.error(`[menu-crawler] Failed to queue photo analysis:`, (err as Error).message);
    }
  }

  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    menuSource: usedSource,
    dishesFound: dedupedItems.length,
    dishesAnalyzed: analyzed.length,
    photosQueued: photoJobs.length,
  };
}

/** Map source string to Prisma MenuItemSource enum */
function mapSourceToEnum(source: string): "website" | "google_photos" | "delivery_platform" | "compliance_page" | "manual" | "backfill" {
  const map: Record<string, "website" | "google_photos" | "delivery_platform" | "compliance_page" | "manual" | "backfill"> = {
    website: "website",
    google_photos: "google_photos",
    delivery_platform: "delivery_platform",
    compliance_page: "compliance_page",
    manual: "manual",
  };
  return map[source] || "website";
}

/**
 * Parse a price string robustly. Handles "$12.99", "$10 - $15" (takes lower bound),
 * "Market Price" (returns null), "$$$" (returns null).
 */
function parsePriceString(raw: string): number | null {
  // Skip non-numeric price indicators
  if (/^[\s$]*$/.test(raw) || /market\s*price/i.test(raw) || /^\$+$/.test(raw.trim())) {
    return null;
  }

  // For ranges like "$10 - $15" or "10.99-15.99", take the first number
  const numbers = raw.match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length === 0) return null;

  const value = parseFloat(numbers[0]);
  return isNaN(value) || value <= 0 ? null : value;
}

function extractCuisineTypes(googleTypes: string[]): string[] {
  const cuisineMap: Record<string, string> = {
    chinese_restaurant: "Chinese",
    indian_restaurant: "Indian",
    italian_restaurant: "Italian",
    japanese_restaurant: "Japanese",
    korean_restaurant: "Korean",
    mexican_restaurant: "Mexican",
    thai_restaurant: "Thai",
    vietnamese_restaurant: "Vietnamese",
    french_restaurant: "French",
    greek_restaurant: "Greek",
    mediterranean_restaurant: "Mediterranean",
    american_restaurant: "American",
  };

  return googleTypes
    .filter((t) => t in cuisineMap)
    .map((t) => cuisineMap[t]);
}

export { parseHtmlMenu } from "./sources";
export { cleanDishName, cleanCategoryName, cleanDescription } from "./clean-dish-name";
export type {
  RawMenuItem,
  AnalyzedDish,
  CrawlResult,
  RestaurantInfo,
  MenuSourceStrategy,
} from "./types";
