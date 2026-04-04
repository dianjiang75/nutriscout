import { prisma } from "@/lib/db/client";
import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { apiSuccess, apiBadRequest, apiNotFound, apiError } from "@/lib/utils/api-response";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withRateLimit("read", async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  try {
    const { id } = await context!.params;

    if (!UUID_REGEX.test(id)) {
      return apiBadRequest("Invalid restaurant ID format");
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: { deliveryOptions: true },
    });

    if (!restaurant) {
      return apiNotFound("Restaurant not found");
    }

    return apiSuccess({
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      latitude: Number(restaurant.latitude),
      longitude: Number(restaurant.longitude),
      cuisine_type: restaurant.cuisineType,
      price_level: restaurant.priceLevel,
      google_rating: restaurant.googleRating ? Number(restaurant.googleRating) : null,
      yelp_rating: restaurant.yelpRating ? Number(restaurant.yelpRating) : null,
      phone: restaurant.phone,
      website: restaurant.websiteUrl,
      accepts_reservations: restaurant.acceptsReservations,
      delivery: restaurant.deliveryOptions.map((d) => ({
        platform: d.platform,
        available: d.isAvailable,
        fee: { min: Number(d.deliveryFeeMin), max: Number(d.deliveryFeeMax) },
        minutes: { min: d.estimatedDeliveryMinutesMin, max: d.estimatedDeliveryMinutesMax },
        url: d.platformUrl,
      })),
    });
  } catch {
    return apiError("Failed to fetch restaurant");
  }
});
