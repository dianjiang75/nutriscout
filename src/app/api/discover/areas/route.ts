import { z } from "zod";
import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { apiSuccess, apiBadRequest, apiUnavailable } from "@/lib/utils/api-response";
import { prisma } from "@/lib/db/client";

const createAreaSchema = z.object({
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius_miles: z.number().min(0.1).max(25).optional(),
  discovery_interval_days: z.number().int().min(1).max(90).optional(),
  priority: z.number().int().min(1).max(5).optional(),
});

/**
 * GET /api/discover/areas
 * List all discovery areas with stats.
 */
export const GET = withRateLimit("read", async (request) => {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";

  const areas = await prisma.discoveryArea.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ priority: "asc" }, { lastDiscoveredAt: "asc" }],
  });

  return apiSuccess({
    areas: areas.map((a) => ({
      id: a.id,
      name: a.name,
      latitude: Number(a.latitude),
      longitude: Number(a.longitude),
      radius_miles: Number(a.radiusMiles),
      discovery_interval_days: a.discoveryIntervalDays,
      priority: a.priority,
      is_active: a.isActive,
      last_discovered_at: a.lastDiscoveredAt?.toISOString() ?? null,
      restaurants_found_total: a.restaurantsFoundTotal,
      restaurants_found_last: a.restaurantsFoundLast,
    })),
    total: areas.length,
  });
});

/**
 * POST /api/discover/areas
 * Add a new discovery area for nightly clawing.
 */
export const POST = withRateLimit("crawl", async (request) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = createAreaSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || "Invalid area data");
    }

    const { name, latitude, longitude, radius_miles, discovery_interval_days, priority } = parsed.data;

    // Check for duplicate (same name or very close coordinates)
    const existing = await prisma.discoveryArea.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: "insensitive" } },
          {
            // Within ~0.01 degrees (~1km) of the same center
            latitude: { gte: latitude - 0.01, lte: latitude + 0.01 },
            longitude: { gte: longitude - 0.01, lte: longitude + 0.01 },
          },
        ],
      },
    });

    if (existing) {
      return apiBadRequest(`Discovery area already exists: "${existing.name}" (${existing.id})`);
    }

    const area = await prisma.discoveryArea.create({
      data: {
        name,
        latitude,
        longitude,
        radiusMiles: radius_miles ?? 0.5,
        discoveryIntervalDays: discovery_interval_days ?? 7,
        priority: priority ?? 3,
      },
    });

    return apiSuccess({
      id: area.id,
      name: area.name,
      latitude: Number(area.latitude),
      longitude: Number(area.longitude),
      radius_miles: Number(area.radiusMiles),
      discovery_interval_days: area.discoveryIntervalDays,
      priority: area.priority,
    }, 201);
  } catch {
    return apiUnavailable("Failed to create discovery area");
  }
});
