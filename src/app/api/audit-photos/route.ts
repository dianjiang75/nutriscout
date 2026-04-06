/**
 * Photo Audit API
 * GET — Returns DishPhotos needing human review (grid view)
 * POST — Approve, reject, demote (remove from dish cards), or remove entirely
 */
import { prisma } from "@/lib/db/client";
import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { apiSuccess, apiBadRequest, apiError, apiNotFound } from "@/lib/utils/api-response";

export const GET = withRateLimit("read", async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const filter = searchParams.get("filter") || "unreviewed";
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);
  const skip = (page - 1) * limit;

  try {
    const where =
      filter === "low-confidence"
        ? { analyzedAt: { not: null } }
        : { analyzedAt: null };

    const [items, total] = await Promise.all([
      prisma.dishPhoto.findMany({
        where,
        select: {
          id: true,
          dishId: true,
          sourceUrl: true,
          sourcePlatform: true,
          analyzedAt: true,
          createdAt: true,
          dish: {
            select: {
              name: true,
              restaurant: { select: { name: true, cuisineType: true } },
              menuItems: { select: { id: true }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.dishPhoto.count({ where }),
    ]);

    const mapped = items.map((item) => ({
      photoId: item.id,
      dishId: item.dishId,
      menuItemId: item.dish.menuItems[0]?.id || null,
      dishName: item.dish.name,
      photoUrl: item.sourceUrl,
      restaurantName: item.dish.restaurant.name,
      cuisine: item.dish.restaurant.cuisineType?.join(", ") || "",
      sourcePlatform: item.sourcePlatform,
      analyzedAt: item.analyzedAt,
    }));

    return apiSuccess({ items: mapped, total, page });
  } catch (err) {
    return apiError((err as Error).message);
  }
});

const VALID_ACTIONS = ["approve", "reject", "demote", "remove-all"] as const;

export const POST = withRateLimit("write", async (request: Request) => {
  try {
    const body = await request.json();
    const { dishId, photoId, action } = body;

    if (!photoId || typeof photoId !== "string") {
      return apiBadRequest("photoId is required");
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return apiBadRequest(`action must be one of: ${VALID_ACTIONS.join(", ")}`);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(photoId)) {
      return apiBadRequest("Invalid photoId format");
    }

    if (action === "approve") {
      // Mark as reviewed
      const updated = await prisma.dishPhoto.update({
        where: { id: photoId },
        data: { analyzedAt: new Date() },
      }).catch(() => null);
      if (!updated) return apiNotFound("DishPhoto not found");
      return apiSuccess({ action: "approved", photoId });
    }

    if (action === "reject") {
      // Remove photo but keep the dish
      await prisma.dishPhoto.delete({ where: { id: photoId } }).catch(() => null);
      return apiSuccess({ action: "rejected", photoId });
    }

    if (action === "demote") {
      // Remove from dish cards but keep in menu
      // Delete the photo, set isDishCard=false on linked MenuItem, mark Dish as unavailable
      await prisma.dishPhoto.delete({ where: { id: photoId } }).catch(() => null);

      if (dishId && uuidRegex.test(dishId)) {
        // Mark dish as unavailable (not a card anymore)
        await prisma.dish.update({
          where: { id: dishId },
          data: { isAvailable: false },
        }).catch(() => null);

        // Update linked MenuItems
        await prisma.menuItem.updateMany({
          where: { dishId },
          data: { isDishCard: false, dishCardConfidence: 1.0 },
        }).catch(() => null);
      }

      return apiSuccess({ action: "demoted", photoId, dishId });
    }

    if (action === "remove-all") {
      // Remove from EVERYTHING — archive MenuItem, disable Dish, delete photo
      await prisma.dishPhoto.delete({ where: { id: photoId } }).catch(() => null);

      if (dishId && uuidRegex.test(dishId)) {
        // Mark dish as unavailable
        await prisma.dish.update({
          where: { id: dishId },
          data: { isAvailable: false },
        }).catch(() => null);

        // Archive all linked MenuItems as junk
        await prisma.menuItem.updateMany({
          where: { dishId },
          data: {
            isDishCard: false,
            archivedAt: new Date(),
            archivedReason: "junk_detected",
            auditConfidence: 1.0,
          },
        }).catch(() => null);
      }

      return apiSuccess({ action: "removed-all", photoId, dishId });
    }

    return apiBadRequest("Unknown action");
  } catch (err) {
    return apiError((err as Error).message);
  }
});
