import { prisma } from "@/lib/db/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        restaurant: true,
        photos: true,
        reviewSummary: true,
      },
    });

    if (!dish) {
      return Response.json({ error: "Dish not found" }, { status: 404 });
    }

    // Build source info object
    const sourceInfo = buildSourceInfo(dish);

    return Response.json({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      price: dish.price ? Number(dish.price) : null,
      category: dish.category,
      ingredients_raw: dish.ingredientsRaw,
      ingredients_parsed: dish.ingredientsParsed,
      dietary_flags: dish.dietaryFlags,
      dietary_confidence: dish.dietaryConfidence ? Number(dish.dietaryConfidence) : null,
      macros: {
        calories: { min: dish.caloriesMin, max: dish.caloriesMax },
        protein_g: { min: dish.proteinMinG ? Number(dish.proteinMinG) : null, max: dish.proteinMaxG ? Number(dish.proteinMaxG) : null },
        carbs_g: { min: dish.carbsMinG ? Number(dish.carbsMinG) : null, max: dish.carbsMaxG ? Number(dish.carbsMaxG) : null },
        fat_g: { min: dish.fatMinG ? Number(dish.fatMinG) : null, max: dish.fatMaxG ? Number(dish.fatMaxG) : null },
      },
      macro_confidence: dish.macroConfidence ? Number(dish.macroConfidence) : null,
      macro_source: dish.macroSource,
      macro_source_detail: sourceInfo,
      photo_count: dish.photoCountAnalyzed,
      restaurant: {
        id: dish.restaurant.id,
        name: dish.restaurant.name,
        address: dish.restaurant.address,
        google_rating: dish.restaurant.googleRating ? Number(dish.restaurant.googleRating) : null,
      },
      review_summary: dish.reviewSummary ? {
        average_rating: dish.reviewSummary.averageDishRating ? Number(dish.reviewSummary.averageDishRating) : null,
        summary: dish.reviewSummary.summaryText,
        review_count: dish.reviewSummary.totalReviewsAnalyzed,
        praises: dish.reviewSummary.commonPraises,
        complaints: dish.reviewSummary.commonComplaints,
      } : null,
      photos: dish.photos.map(p => ({
        id: p.id,
        url: p.sourceUrl,
        source: p.sourcePlatform,
        macros: p.macroEstimate,
      })),
    });
  } catch {
    return Response.json({ error: "Failed to fetch dish" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSourceInfo(dish: any) {
  const macroSource = dish.macroSource;
  const macroSourceName = dish.macroSourceName;
  const macroSourceUrl = dish.macroSourceUrl;
  const macroSourceLogCount = dish.macroSourceLogCount;
  const crossValidated = dish.crossValidated ?? false;
  const crossValidationSource = dish.crossValidationSource;
  const crossValidationDeviation = dish.crossValidationDeviation
    ? Number(dish.crossValidationDeviation)
    : null;

  // Determine tier label
  let tierLabel = "Unknown";
  let tierDescription = "";

  switch (macroSource) {
    case "restaurant_published":
      tierLabel = "Restaurant Published";
      tierDescription = "Nutrition facts provided directly by the restaurant";
      break;
    case "third_party_db":
      tierLabel = "Third-Party Database";
      tierDescription = macroSourceLogCount
        ? `From ${macroSourceName || "nutrition database"} (${macroSourceLogCount} user entries)`
        : `From ${macroSourceName || "nutrition database"}`;
      break;
    case "vision_ai":
      tierLabel = "AI Estimated";
      tierDescription = crossValidated
        ? `Estimated by NutriScout AI, cross-validated against ${crossValidationSource || "external database"}`
        : "Estimated by NutriScout AI from menu and photo analysis";
      break;
    case "usda_match":
      tierLabel = "USDA Database";
      tierDescription = "Matched to USDA FoodData Central entry";
      break;
    case "community_verified":
      tierLabel = "Community Verified";
      tierDescription = "Verified by community feedback";
      break;
    default:
      tierLabel = "Estimated";
      tierDescription = "Based on menu and photo analysis";
  }

  return {
    tier: macroSource || "vision_ai",
    tier_label: tierLabel,
    tier_description: tierDescription,
    source_name: macroSourceName || null,
    source_url: macroSourceUrl || null,
    log_count: macroSourceLogCount || null,
    cross_validated: crossValidated,
    cross_validation_source: crossValidationSource || null,
    cross_validation_deviation_pct: crossValidationDeviation,
  };
}
