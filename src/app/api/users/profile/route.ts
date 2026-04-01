import { prisma } from "@/lib/db/client";
import { checkApiRateLimit } from "@/lib/middleware/rate-limiter";

export async function PATCH(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const rl = await checkApiRateLimit(ip, "write");
    if (!rl.allowed) {
      return Response.json(
        { error: "Too many requests", retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } }
      );
    }

    const body = await request.json();
    const { user_id, dietary_restrictions, nutritional_goals, max_wait_minutes, search_radius_miles, preferred_cuisines } = body;

    if (!user_id) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }

    const user = await prisma.userProfile.update({
      where: { id: user_id },
      data: {
        ...(dietary_restrictions !== undefined && { dietaryRestrictions: dietary_restrictions }),
        ...(nutritional_goals !== undefined && { nutritionalGoals: nutritional_goals }),
        ...(max_wait_minutes !== undefined && { maxWaitMinutes: max_wait_minutes }),
        ...(search_radius_miles !== undefined && { searchRadiusMiles: search_radius_miles }),
        ...(preferred_cuisines !== undefined && { preferredCuisines: preferred_cuisines }),
      },
    });

    return Response.json({
      id: user.id,
      dietary_restrictions: user.dietaryRestrictions,
      nutritional_goals: user.nutritionalGoals,
      max_wait_minutes: user.maxWaitMinutes,
      search_radius_miles: Number(user.searchRadiusMiles),
    });
  } catch {
    return Response.json({ error: "Profile update failed" }, { status: 500 });
  }
}
