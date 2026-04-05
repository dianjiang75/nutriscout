/**
 * Menu Classifier Agent — classify MenuItems + promote to Dish.
 *
 * Extracted from crawlRestaurant() steps 3-4. This agent is responsible for:
 *   1. Reading unclassified MenuItems (menuItemType = 'unknown') for a restaurant
 *   2. Running the dish auditor (Gemini Flash) on items that aren't pre-tagged
 *   3. Updating menuItemType + auditConfidence on all items
 *   4. Archiving rejected items as 'junk_detected'
 *   5. Promoting dishes/desserts/interesting drinks to the Dish table
 *   6. Running dietary flag analysis (Claude Sonnet) on promoted items
 *   7. Linking MenuItem → Dish and writing back parsed ingredients
 *
 * Depends on: MenuItem records already stored by the Menu Scraper agent.
 */

import { prisma } from "@/lib/db/client";
import { analyzeIngredients } from "../menu-crawler";
import { auditMenuItems } from "../dish-auditor";
import { isInterestingBeverageOrCategory } from "../menu-crawler/clean-dish-name";
import { normalizeName } from "@/lib/menu/archive";
import type { RawMenuItem } from "../menu-crawler/types";
import type { MenuItemType } from "@/generated/prisma/client";

// ─── Types ──────────────────────────────────────────────

export interface ClassifyResult {
  restaurantId: string;
  itemsClassified: number;
  itemsPromoted: number;
  dishesAnalyzed: number;
}

// ─── Price parsing (same as menu-scraper) ───────────────

function parsePriceString(raw: string): number | null {
  if (
    /^[\s$]*$/.test(raw) ||
    /market\s*price/i.test(raw) ||
    /^\$+$/.test(raw.trim())
  ) {
    return null;
  }
  const numbers = raw.match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length === 0) return null;
  const value = parseFloat(numbers[0]);
  return isNaN(value) || value <= 0 ? null : value;
}

// ─── Main classify function ─────────────────────────────

/**
 * Classify unclassified MenuItems and promote eligible ones to Dish records.
 *
 * Reads all MenuItems where menuItemType = 'unknown' for the given restaurant,
 * runs the auditor, updates types, then promotes dishes/desserts/interesting
 * drinks to the Dish table with full dietary analysis.
 */
export async function classifyAndPromote(
  restaurantId: string
): Promise<ClassifyResult> {
  // ── Load restaurant for cuisine context ──
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: { id: true, name: true, cuisineType: true },
  });

  const cuisineStr = Array.isArray(restaurant.cuisineType)
    ? (restaurant.cuisineType as string[]).join(", ")
    : "";

  // ── Load all active (non-archived) MenuItems for this restaurant ──
  const allMenuItems = await prisma.menuItem.findMany({
    where: {
      restaurantId,
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      nameNormalized: true,
      description: true,
      price: true,
      category: true,
      menuItemType: true,
      source: true,
      photoUrl: true,
      menuCalories: true,
      menuProteinG: true,
      menuCarbsG: true,
      menuFatG: true,
      menuAllergens: true,
      menuDietaryTags: true,
      menuIngredients: true,
      auditConfidence: true,
    },
  });

  // Split into pre-tagged (already classified) and unknown (needs audit)
  const preTaggedItems = allMenuItems.filter(
    (mi) => mi.menuItemType !== "unknown"
  );
  const unknownItems = allMenuItems.filter(
    (mi) => mi.menuItemType === "unknown"
  );

  // ═══════════════════════════════════════════════════════════
  // STEP 3: CLASSIFY — audit unknown items via LLM
  // ═══════════════════════════════════════════════════════════

  // Convert DB records to RawMenuItem for the auditor
  const rawItemsForAudit: RawMenuItem[] = unknownItems.map((mi) => ({
    name: mi.name,
    description: mi.description || "",
    price: mi.price != null ? `$${mi.price}` : null,
    category: mi.category || null,
    menuAllergens: (mi.menuAllergens as string[]) || [],
    menuDietaryTags: (mi.menuDietaryTags as string[]) || [],
    menuIngredients: (mi.menuIngredients as string) || undefined,
    menuCalories: mi.menuCalories ? Number(mi.menuCalories) : undefined,
    menuProteinG: mi.menuProteinG ? Number(mi.menuProteinG) : undefined,
    menuCarbsG: mi.menuCarbsG ? Number(mi.menuCarbsG) : undefined,
    menuFatG: mi.menuFatG ? Number(mi.menuFatG) : undefined,
  }));

  let auditResults: Array<{
    item: RawMenuItem;
    dishType: string;
    passed: boolean;
    rejectionReasons: string[];
    auditConfidence?: number;
  }> = [];

  if (rawItemsForAudit.length > 0) {
    auditResults = await auditMenuItems(
      rawItemsForAudit,
      restaurantId,
      cuisineStr
    );
  }

  // Update menuItemType on audited items
  let classifiedCount = 0;
  for (let i = 0; i < unknownItems.length; i++) {
    const mi = unknownItems[i];
    const audit = auditResults.find(
      (r) => normalizeName(r.item.name) === mi.nameNormalized
    );

    if (audit && !audit.passed) {
      // Rejected by auditor — archive as junk
      await prisma.menuItem.updateMany({
        where: { id: mi.id },
        data: {
          menuItemType: "unknown" as MenuItemType,
          auditConfidence: audit.auditConfidence ?? null,
          archivedAt: new Date(),
          archivedReason: "junk_detected",
        },
      });
      continue;
    }

    const finalType = (audit?.dishType as MenuItemType) || "unknown";
    const confidence = audit?.auditConfidence ?? null;

    await prisma.menuItem.updateMany({
      where: { id: mi.id },
      data: {
        menuItemType: finalType,
        auditConfidence: confidence,
      },
    });
    classifiedCount++;
  }

  const rejected = auditResults.filter((r) => !r.passed);
  if (rejected.length > 0) {
    console.log(
      `[menu-classifier] Rejected ${rejected.length} junk items for ${restaurant.name}:`
    );
    rejected
      .slice(0, 5)
      .forEach((r) =>
        console.log(
          `  x "${r.item.name}" — ${r.rejectionReasons.join(", ")}`
        )
      );
  }
  console.log(
    `[menu-classifier] Classified ${classifiedCount} items for ${restaurant.name}`
  );

  // ═══════════════════════════════════════════════════════════
  // STEP 4: PROMOTE TO DISH — only dishes/desserts/interesting drinks
  // ═══════════════════════════════════════════════════════════

  // Reload all active, non-archived items with their final types
  const classifiedItems = await prisma.menuItem.findMany({
    where: {
      restaurantId,
      archivedAt: null,
      menuItemType: { not: "unknown" },
    },
    select: {
      id: true,
      name: true,
      nameNormalized: true,
      description: true,
      price: true,
      category: true,
      menuItemType: true,
      source: true,
      photoUrl: true,
      menuCalories: true,
      menuProteinG: true,
      menuCarbsG: true,
      menuFatG: true,
      menuAllergens: true,
      menuDietaryTags: true,
      menuIngredients: true,
      dishId: true,
    },
  });

  // Promotion rules:
  //   dish    → always promoted
  //   dessert → always promoted
  //   drink + isInterestingBeverageOrCategory → promoted
  //   everything else → MenuItem only
  const promotableItems = classifiedItems.filter((mi) => {
    if (mi.menuItemType === "dish" || mi.menuItemType === "dessert")
      return true;
    if (
      mi.menuItemType === "drink" &&
      isInterestingBeverageOrCategory(mi.name, mi.category)
    )
      return true;
    return false;
  });

  console.log(
    `[menu-classifier] Promoting ${promotableItems.length} items to Dish cards for ${restaurant.name}`
  );

  // Convert to RawMenuItem for analyzeIngredients
  const promotableRaw: RawMenuItem[] = promotableItems.map((mi) => ({
    name: mi.name,
    description: mi.description || "",
    price: mi.price != null ? `$${mi.price}` : null,
    category: mi.category || null,
    source:
      mi.source === "compliance_page"
        ? ("compliance_page" as const)
        : undefined,
    menuAllergens: (mi.menuAllergens as string[]) || [],
    menuDietaryTags: (mi.menuDietaryTags as string[]) || [],
    menuIngredients: (mi.menuIngredients as string) || undefined,
    menuCalories: mi.menuCalories ? Number(mi.menuCalories) : undefined,
    menuProteinG: mi.menuProteinG ? Number(mi.menuProteinG) : undefined,
    menuCarbsG: mi.menuCarbsG ? Number(mi.menuCarbsG) : undefined,
    menuFatG: mi.menuFatG ? Number(mi.menuFatG) : undefined,
  }));

  // Analyze ingredients and dietary flags for promoted items only
  const analyzed = await analyzeIngredients(promotableRaw);

  // Upsert Dish records and link MenuItem → Dish
  let dishesPromoted = 0;

  for (const mi of promotableItems) {
    const analysis = analyzed.find(
      (a) => a.dish_name.toLowerCase() === mi.name.toLowerCase()
    );

    const price = mi.price != null ? Number(mi.price) : null;

    const isCompliancePage = mi.source === "compliance_page";
    const dietaryConfidence = isCompliancePage
      ? Math.max(0.95, analysis?.dietary_confidence ?? 0.95)
      : (analysis?.dietary_confidence ?? null);

    const hasMenuCalories = mi.menuCalories != null;

    const dishData = {
      name: mi.name,
      description: mi.description || null,
      price,
      category: mi.category || null,
      ingredientsRaw:
        (mi.menuIngredients as string) || mi.description || null,
      ingredientsParsed: analysis?.ingredients_parsed ?? undefined,
      dietaryFlags: analysis?.dietary_flags ?? undefined,
      dietaryConfidence,
      ...(hasMenuCalories
        ? {
            caloriesMin: Number(mi.menuCalories),
            caloriesMax: Number(mi.menuCalories),
            macroSource: "restaurant_published" as const,
          }
        : {}),
      isAvailable: true,
    };

    // Find existing Dish for this restaurant + name
    const existingDish = await prisma.dish.findFirst({
      where: {
        restaurantId,
        name: { equals: mi.name, mode: "insensitive" as const },
      },
    });

    const dish = existingDish
      ? await prisma.dish.update({
          where: { id: existingDish.id },
          data: dishData,
        })
      : await prisma.dish.create({
          data: {
            restaurantId,
            ...dishData,
            macroSource: hasMenuCalories ? "restaurant_published" : null,
          },
        });

    dishesPromoted++;

    // Link MenuItem → Dish and write back parsed ingredients
    const parsedIngredientList =
      analysis?.ingredients_parsed
        ?.map((ing: { name: string }) => ing.name)
        .join(", ") || null;

    await prisma.menuItem.update({
      where: { id: mi.id },
      data: {
        dishId: dish.id,
        isDishCard: true,
        dishCardConfidence: analysis?.dietary_confidence ?? 0.8,
        ...(parsedIngredientList && !mi.menuIngredients
          ? { menuIngredients: parsedIngredientList }
          : {}),
      },
    });
  }

  console.log(
    `[menu-classifier] Promoted ${dishesPromoted} dishes for ${restaurant.name}`
  );

  return {
    restaurantId,
    itemsClassified: classifiedCount + preTaggedItems.length,
    itemsPromoted: dishesPromoted,
    dishesAnalyzed: analyzed.length,
  };
}
