import { prisma } from "@/lib/db/client";
import { authenticateRequest } from "@/lib/auth/jwt";
import { checkApiRateLimit } from "@/lib/middleware/rate-limiter";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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

  return Response.json({
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
    return Response.json(
      { error: "Too many requests", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } }
    );
  }

  const auth = await authenticateRequest(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { dish_id } = await request.json();
  if (!dish_id) {
    return Response.json({ error: "dish_id is required" }, { status: 400 });
  }

  try {
    await prisma.userFavorite.create({
      data: { userId: auth.sub, dishId: dish_id },
    });
    return Response.json({ saved: true }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      // Already favorited — remove it (toggle behavior)
      await prisma.userFavorite.deleteMany({
        where: { userId: auth.sub, dishId: dish_id },
      });
      return Response.json({ saved: false });
    }
    return Response.json({ error: "Failed to save" }, { status: 500 });
  }
}
