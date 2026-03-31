import { search } from "@/lib/orchestrator";
import { validateSearchParams, DIETARY_OPTIONS } from "@/lib/validation/search";
import { checkApiRateLimit } from "@/lib/middleware/rate-limiter";
import type { DietaryFlags } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Rate limit: 60 req/min per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const rl = await checkApiRateLimit(ip, "search");
    if (!rl.allowed) {
      return Response.json(
        { error: "Too many requests", retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } }
      );
    }
    const { searchParams } = new URL(request.url);

    // Validate all input params
    const parsed = validateSearchParams(searchParams);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid search parameters", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
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
      calorie_limit: p.calorie_limit,
      protein_min_g: p.protein_min,
      cuisine_preferences: p.cuisines ? p.cuisines.split(",").filter(Boolean) : undefined,
      max_wait_minutes: p.max_wait,
      include_delivery: p.delivery === "true",
      sort_by: p.sort,
      limit: p.limit,
      offset: p.offset,
      query: p.q || undefined,
      categories: p.categories ? p.categories.split(",").filter(Boolean) : undefined,
      allergens: p.allergens ? p.allergens.split(",").filter(Boolean) : undefined,
    });

    return Response.json(results);
  } catch (error) {
    console.error("Search error:", error);
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
