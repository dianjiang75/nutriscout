/**
 * Photo Audit API
 * GET — Returns DishPhotos needing human review
 * POST — Approve or reject a photo
 */
import { prisma } from "@/lib/db/client";
import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { apiSuccess, apiBadRequest, apiError, apiNotFound } from "@/lib/utils/api-response";

export const GET = withRateLimit("read", async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const filter = searchParams.get("filter") || "unreviewed";
  const limit = 50;
  const skip = (page - 1) * limit;

  try {
    // "unreviewed" = photos without analyzedAt (not yet processed/reviewed)
    // "low-confidence" = photos that have been analyzed but may be poor matches
    // We use analyzedAt as the review indicator — null means unreviewed
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
              restaurant: { select: { name: true } },
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
      dishName: item.dish.name,
      photoUrl: item.sourceUrl,
      restaurantName: item.dish.restaurant.name,
      sourcePlatform: item.sourcePlatform,
      analyzedAt: item.analyzedAt,
    }));

    return apiSuccess({ items: mapped, total, page });
  } catch (err) {
    return apiError((err as Error).message);
  }
});

export const POST = withRateLimit("write", async (request: Request) => {
  try {
    const body = await request.json();
    const { dishId, photoId, action } = body;

    if (!photoId || typeof photoId !== "string") {
      return apiBadRequest("photoId is required");
    }

    if (!action || !["approve", "reject"].includes(action)) {
      return apiBadRequest('action must be "approve" or "reject"');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(photoId)) {
      return apiBadRequest("Invalid photoId format");
    }

    if (action === "reject") {
      const deleted = await prisma.dishPhoto.delete({
        where: { id: photoId },
      }).catch(() => null);

      if (!deleted) {
        return apiNotFound("DishPhoto not found");
      }

      return apiSuccess({ action: "rejected", photoId });
    }

    // Approve — mark as reviewed by setting analyzedAt
    const updated = await prisma.dishPhoto.update({
      where: { id: photoId },
      data: { analyzedAt: new Date() },
    }).catch(() => null);

    if (!updated) {
      return apiNotFound("DishPhoto not found");
    }

    return apiSuccess({ action: "approved", photoId });
  } catch (err) {
    return apiError((err as Error).message);
  }
});
