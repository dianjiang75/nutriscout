/**
 * Classifier Audit API
 * GET — Returns MenuItems needing human review (low confidence or unknown type)
 * POST — Submit a classification correction
 */
import { prisma } from "@/lib/db/client";
import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { apiSuccess, apiBadRequest, apiError, apiNotFound } from "@/lib/utils/api-response";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const VALID_TYPES = [
  "dish", "dessert", "drink", "side", "condiment", "addon", "combo", "kids",
] as const;

const CORRECTIONS_PATH = join(
  process.cwd(),
  "src/lib/agents/menu-classifier/corrections.json",
);

export const GET = withRateLimit("read", async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = 50;
  const skip = (page - 1) * limit;

  try {
    const filter = searchParams.get("filter") || "needs-review";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any;
    if (filter === "all") {
      // Show all active items (useful for browsing)
      where = { archivedAt: null };
    } else if (filter === "dish-cards") {
      // Show only promoted dish card items
      where = { archivedAt: null, isDishCard: true };
    } else if (filter === "not-dish-cards") {
      // Show items NOT promoted (sides, drinks, etc.)
      where = { archivedAt: null, isDishCard: false, menuItemType: { not: "unknown" as const } };
    } else {
      // Default: items needing human review — fresh crawls with low confidence or unknown type.
      // Excludes backfill items (auditConfidence=null + source=backfill) to keep the queue manageable.
      where = {
        archivedAt: null,
        source: { not: "backfill" as const },
        OR: [
          { auditConfidence: { lt: 0.7 } },
          { menuItemType: "unknown" as const },
          { dishCardConfidence: { lt: 0.7 } },
          { dishCardConfidence: null, isDishCard: true }, // auto-promoted without confidence score
        ],
      };
    }

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          category: true,
          menuItemType: true,
          isDishCard: true,
          dishCardConfidence: true,
          auditConfidence: true,
          restaurant: { select: { name: true } },
        },
        orderBy: [
          { auditConfidence: { sort: "asc", nulls: "first" } },
          { lastSeenAt: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.menuItem.count({ where }),
    ]);

    const mapped = items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price ? Number(item.price) : null,
      category: item.category,
      menuItemType: item.menuItemType,
      isDishCard: item.isDishCard,
      dishCardConfidence: item.dishCardConfidence ? Number(item.dishCardConfidence) : null,
      auditConfidence: item.auditConfidence ? Number(item.auditConfidence) : null,
      restaurantName: item.restaurant.name,
    }));

    return apiSuccess({ items: mapped, total, page });
  } catch (err) {
    return apiError((err as Error).message);
  }
});

export const POST = withRateLimit("write", async (request: Request) => {
  try {
    const body = await request.json();
    const { menuItemId, correctType, isDishCard, reason } = body;

    if (!menuItemId || typeof menuItemId !== "string") {
      return apiBadRequest("menuItemId is required");
    }

    // Either correctType or isDishCard must be provided
    if (!correctType && isDishCard === undefined) {
      return apiBadRequest("correctType or isDishCard is required");
    }

    if (correctType && !VALID_TYPES.includes(correctType)) {
      return apiBadRequest(
        `correctType must be one of: ${VALID_TYPES.join(", ")}`,
      );
    }

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(menuItemId)) {
      return apiBadRequest("Invalid menuItemId format");
    }

    // Fetch the item first to capture previous type
    const existing = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      select: { name: true, menuItemType: true },
    });

    if (!existing) {
      return apiNotFound("MenuItem not found");
    }

    // Update the MenuItem
    await prisma.menuItem.update({
      where: { id: menuItemId },
      data: {
        ...(correctType ? { menuItemType: correctType, auditConfidence: 1.0 } : {}),
        ...(isDishCard !== undefined ? { isDishCard: !!isDishCard, dishCardConfidence: 1.0 } : {}),
      },
    });

    // Append to corrections.json
    try {
      const raw = readFileSync(CORRECTIONS_PATH, "utf-8");
      const data = JSON.parse(raw);
      data.corrections.push({
        menuItemId,
        name: existing.name,
        previousType: existing.menuItemType,
        correctType,
        reason: reason || null,
        addedBy: "human_audit",
        date: new Date().toISOString(),
      });
      writeFileSync(CORRECTIONS_PATH, JSON.stringify(data, null, 2) + "\n");
    } catch {
      // Non-critical — DB update already succeeded
    }

    return apiSuccess({ updated: true });
  } catch (err) {
    return apiError((err as Error).message);
  }
});
