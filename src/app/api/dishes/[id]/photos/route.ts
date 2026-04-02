import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { apiSuccess, apiError, apiBadRequest } from "@/lib/utils/api-response";

const uuidParam = z.string().uuid("Invalid dish ID");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!uuidParam.safeParse(id).success) {
      return apiBadRequest("Invalid dish ID format");
    }

    const photos = await prisma.dishPhoto.findMany({
      where: { dishId: id },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({
      photos: photos.map((p) => ({
        id: p.id,
        url: p.sourceUrl,
        source: p.sourcePlatform,
        macros: p.macroEstimate,
        analyzed_at: p.analyzedAt,
      })),
    });
  } catch {
    return apiError("Failed to fetch photos");
  }
}
