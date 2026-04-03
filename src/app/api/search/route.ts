import { search } from "@/lib/orchestrator";
import { validateSearchParams, DIETARY_OPTIONS } from "@/lib/validation/search";
import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { apiSuccess, apiBadRequest, apiError } from "@/lib/utils/api-response";
import type { DietaryFlags } from "@/types";

export const dynamic = "force-dynamic";

export const GET = withRateLimit("search", async (request) => {
  try {
    const { searchParams } = new URL(request.url);

    // Validate all input params
    const parsed = validateSearchParams(searchParams);
    if (!parsed.success) {
      return apiBadRequest("Invalid search parameters", parsed.error.flatten().fieldErrors as Record<string, unknown>);
    }

    const p = parsed.data;

    // Build dietary flags from comma-separated string
    const dietaryRestrictions: DietaryFlags = {} as DietaryFlags;
    for (const option of DIETARY_OPTIONS) {
      dietaryRestrictions[option] = p.diet.includes(option) ? true : null;
    }

    const results = await search({
      latitude: p.lat,
      longitude: p.lng,
      radius_miles: p.radius,
      dietary_restrictions: dietaryRestrictions,
      nutritional_goal: p.goal,
      calorie_limit: p.calorie_limit || p.calories_max,
      protein_min_g: p.protein_min,
      cuisine_preferences: p.cuisines ? p.cuisines.split(",").filter(Boolean) : undefined,
      max_wait_minutes: p.max_wait,
      include_delivery: p.delivery === "true",
      sort_by: p.sort,
      limit: p.limit,
      offset: p.offset,
      query: p.q || undefined,
      categories: (p.categories || p.category) ? (p.categories || p.category)!.split(",").filter(Boolean) : undefined,
      allergens: p.allergens ? p.allergens.split(",").filter(Boolean) : undefined,
    });

    return apiSuccess(results);
  } catch (error) {
    const { logger } = await import("@/lib/utils/logger");
    logger.error("Search failed", {
      route: "/api/search",
      error: (error as Error).message,
      query: new URL(request.url).searchParams.get("q") || undefined,
    });
    return apiError("Search failed");
  }
});
