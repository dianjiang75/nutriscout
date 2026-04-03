import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");

    if (isNaN(lat) || isNaN(lng)) {
      return Response.json({ error: "lat and lng are required" }, { status: 400 });
    }

    const q = searchParams.get("q") || "";
    const categoriesRaw = searchParams.get("categories") || searchParams.get("category") || "";
    const categories = categoriesRaw.split(",").filter(Boolean);
    const sort = searchParams.get("sort") || "distance";
    const maxWait = searchParams.get("max_wait") ? parseInt(searchParams.get("max_wait")!) : null;
    const radius = searchParams.get("radius") ? parseFloat(searchParams.get("radius")!) : null;

    // Cuisine-type categories for restaurant filter
    const cuisineIds = new Set([
      "thai", "japanese", "italian", "mexican", "indian",
      "chinese", "korean", "mediterranean", "american", "vietnamese",
    ]);
    const cuisineFilters = categories
      .filter((c) => cuisineIds.has(c.toLowerCase()))
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase());

    // Build restaurant where clause
    const where: Record<string, unknown> = { isActive: true };

    if (q) {
      where.name = { contains: q, mode: "insensitive" };
    }

    if (cuisineFilters.length) {
      where.cuisineType = { hasSome: cuisineFilters };
    }

    const restaurants = await prisma.restaurant.findMany({
      where,
      include: {
        dishes: {
          where: { isAvailable: true },
          take: 3,
          orderBy: { proteinMaxG: "desc" },
          select: {
            id: true,
            name: true,
            caloriesMin: true,
            caloriesMax: true,
            proteinMinG: true,
            proteinMaxG: true,
          },
        },
      },
      take: 20,
      orderBy: { googleRating: "desc" },
    });

    // Get current logistics
    const now = new Date();
    const restaurantIds = restaurants.map((r) => r.id);
    const logisticsRows = await prisma.restaurantLogistics.findMany({
      where: {
        restaurantId: { in: restaurantIds },
        dayOfWeek: now.getDay(),
        hour: now.getHours(),
      },
    });
    const logisticsMap = new Map(logisticsRows.map((l) => [l.restaurantId, l]));

    const result = restaurants.map((r) => {
      const logistics = logisticsMap.get(r.id);
      const rLat = Number(r.latitude);
      const rLng = Number(r.longitude);
      const dist = haversine(lat, lng, rLat, rLng);
      return {
        id: r.id,
        name: r.name,
        address: r.address,
        cuisineType: r.cuisineType,
        googleRating: r.googleRating ? Number(r.googleRating) : null,
        distanceMiles: dist,
        estimatedWait: logistics?.estimatedWaitMinutes ?? null,
        topDishes: r.dishes.map((d) => ({
          id: d.id,
          name: d.name,
          calories_min: d.caloriesMin,
          calories_max: d.caloriesMax,
          protein_min_g: d.proteinMinG ? Number(d.proteinMinG) : null,
          protein_max_g: d.proteinMaxG ? Number(d.proteinMaxG) : null,
        })),
      };
    });

    // Filter by radius
    let filtered = result;
    if (radius != null && !isNaN(radius)) {
      filtered = filtered.filter((r) => r.distanceMiles <= radius);
    }

    // Filter by max wait
    if (maxWait != null && !isNaN(maxWait)) {
      filtered = filtered.filter(
        (r) => r.estimatedWait == null || r.estimatedWait < maxWait
      );
    }

    // Sort
    if (sort === "rating") {
      filtered.sort((a, b) => (b.googleRating ?? 0) - (a.googleRating ?? 0));
    } else if (sort === "wait_time") {
      filtered.sort((a, b) => (a.estimatedWait ?? Infinity) - (b.estimatedWait ?? Infinity));
    } else {
      // Default: distance
      filtered.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
    }

    return Response.json({ restaurants: filtered });
  } catch (error) {
    console.error("Restaurants error:", error);
    return Response.json({ error: "Failed to fetch restaurants" }, { status: 500 });
  }
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}
