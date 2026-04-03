import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { authenticateRequest } from "@/lib/auth/jwt";
import { checkApiRateLimit } from "@/lib/middleware/rate-limiter";
import { apiSuccess, apiBadRequest, apiUnauthorized, apiRateLimited, apiError } from "@/lib/utils/api-response";

const favoriteSchema = z.object({
  dish_id: z.string().uuid("Invalid dish_id"),
});

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return apiUnauthorized();
  }

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: auth.sub },
    include: {
      dish: {
        include: {
          restaurant: true,
          photos: { take: 1, orderBy: { createdAt: "desc" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess({
    favorites: favorites.map((f) => ({
      id: f.dish.id,
      name: f.dish.name,
      photo_url: f.dish.photos?.[0]?.sourceUrl ?? null,
      restaurant_name: f.dish.restaurant.name,
      calories_min: f.dish.caloriesMin,
      protein_max_g: f.dish.proteinMaxG ? Number(f.dish.proteinMaxG) : null,
      savedAt: f.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rl = await checkApiRateLimit(ip, "write");
  if (!rl.allowed) {
    return apiRateLimited(rl.retryAfterSeconds ?? 60);
  }

  const auth = await authenticateRequest(request);
  if (!auth) {
    return apiUnauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsed = favoriteSchema.safeParse(body);
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message || "dish_id is required");
  }
  const { dish_id } = parsed.data;

  try {
    await prisma.userFavorite.create({
      data: { userId: auth.sub, dishId: dish_id },
    });
    return apiSuccess({ saved: true }, 201);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      // Already favorited — remove it (toggle behavior)
      await prisma.userFavorite.deleteMany({
        where: { userId: auth.sub, dishId: dish_id },
      });
      return apiSuccess({ saved: false });
    }
    return apiError("Failed to save favorite");
  }
}
