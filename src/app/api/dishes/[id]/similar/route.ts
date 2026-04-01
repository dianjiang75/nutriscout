import { z } from "zod";
import { findSimilarDishes } from "@/lib/similarity";
import { apiSuccess, apiBadRequest, apiError } from "@/lib/utils/api-response";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const similarParamsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(0.1).max(50).default(2),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      return apiBadRequest("Invalid dish ID format");
    }

    const { searchParams } = new URL(request.url);
    const raw: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      raw[key] = value;
    }

    const parsed = similarParamsSchema.safeParse(raw);
    if (!parsed.success) {
      return apiBadRequest("Invalid parameters", parsed.error.flatten().fieldErrors as Record<string, unknown>);
    }

    const { lat, lng, radius, limit } = parsed.data;

    const similar = await findSimilarDishes(id, {
      latitude: lat,
      longitude: lng,
      radius_miles: radius,
      limit,
    });

    return apiSuccess({ dishes: similar });
  } catch (error) {
    return apiError((error as Error).message);
  }
}
