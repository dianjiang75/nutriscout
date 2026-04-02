import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { authenticateRequest } from "@/lib/auth/jwt";
import { checkApiRateLimit } from "@/lib/middleware/rate-limiter";
import { apiSuccess, apiError, apiBadRequest, apiUnauthorized, apiNotFound, apiRateLimited } from "@/lib/utils/api-response";

const profileUpdateSchema = z.object({
  dietary_restrictions: z.record(z.string(), z.boolean()).optional(),
  nutritional_goals: z.record(z.string(), z.any()).optional(),
  max_wait_minutes: z.number().int().min(1).max(120).optional(),
  search_radius_miles: z.number().min(0.1).max(50).optional(),
  preferred_cuisines: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
  custom_restrictions: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return apiUnauthorized();
  }

  const user = await prisma.userProfile.findUnique({
    where: { id: auth.sub as string },
  });

  if (!user) {
    return apiNotFound("User not found");
  }

  return apiSuccess({
    id: user.id,
    email: user.email,
    name: user.name,
    dietary_restrictions: user.dietaryRestrictions,
    nutritional_goals: user.nutritionalGoals,
    max_wait_minutes: user.maxWaitMinutes,
    search_radius_miles: user.searchRadiusMiles ? Number(user.searchRadiusMiles) : 2,
  });
}

export async function PATCH(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rl = await checkApiRateLimit(ip, "write");
  if (!rl.allowed) {
    return apiRateLimited(rl.retryAfterSeconds);
  }

  const auth = await authenticateRequest(request);
  if (!auth) {
    return apiUnauthorized();
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || "Invalid input");
    }
    const { dietary_restrictions, nutritional_goals, max_wait_minutes, search_radius_miles, preferred_cuisines, allergens, custom_restrictions } = parsed.data;

    const user = await prisma.userProfile.update({
      where: { id: auth.sub as string },
      data: {
        ...(dietary_restrictions !== undefined && { dietaryRestrictions: dietary_restrictions }),
        ...(nutritional_goals !== undefined && { nutritionalGoals: nutritional_goals }),
        ...(max_wait_minutes !== undefined && { maxWaitMinutes: max_wait_minutes }),
        ...(search_radius_miles !== undefined && { searchRadiusMiles: search_radius_miles }),
        ...(preferred_cuisines !== undefined && { preferredCuisines: preferred_cuisines }),
        ...(allergens !== undefined && { allergenExclusions: allergens }),
        ...(custom_restrictions !== undefined && { customRestrictions: custom_restrictions }),
      },
    });

    return apiSuccess({
      id: user.id,
      dietary_restrictions: user.dietaryRestrictions,
      nutritional_goals: user.nutritionalGoals,
      max_wait_minutes: user.maxWaitMinutes,
      search_radius_miles: Number(user.searchRadiusMiles),
    });
  } catch {
    return apiError("Profile update failed");
  }
}
