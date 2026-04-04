import { prisma } from "@/lib/db/client";
import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { apiSuccess, apiError } from "@/lib/utils/api-response";

export const GET = withRateLimit("read", async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context!.params;
  try {
    const dishes = await prisma.dish.findMany({
      where: { restaurantId: id, isAvailable: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const grouped: Record<string, typeof dishes> = {};
    for (const dish of dishes) {
      const cat = dish.category || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(dish);
    }

    return apiSuccess({
      restaurant_id: id,
      categories: Object.entries(grouped).map(([category, items]) => ({
        name: category,
        dishes: items.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          price: d.price ? Number(d.price) : null,
          dietary_flags: d.dietaryFlags,
          calories: d.caloriesMin !== null ? { min: d.caloriesMin, max: d.caloriesMax } : null,
          protein_g: d.proteinMaxG ? Number(d.proteinMaxG) : null,
        })),
      })),
    });
  } catch {
    return apiError("Failed to fetch menu");
  }
});
