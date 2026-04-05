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
    const where = {
      archivedAt: null,
      OR: [
        { auditConfidence: { lt: 0.7 } },
        { menuItemType: "unknown" as const },
      ],
    };

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
    const { menuItemId, correctType, reason } = body;

    if (!menuItemId || typeof menuItemId !== "string") {
      return apiBadRequest("menuItemId is required");
    }

    if (!correctType || !VALID_TYPES.includes(correctType)) {
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
        menuItemType: correctType,
        auditConfidence: 1.0, // Human-verified = full confidence
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
