import { prisma } from "@/lib/db/client";
import { estimateWaitMinutes } from "@/lib/agents/logistics-poller";
import { apiSuccess, apiBadRequest, apiError } from "@/lib/utils/api-response";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_REGEX.test(id)) return apiBadRequest("Invalid restaurant ID");
    const now = new Date();

    const logistics = await prisma.restaurantLogistics.findUnique({
      where: {
        restaurantId_dayOfWeek_hour: {
          restaurantId: id,
          dayOfWeek: now.getDay(),
          hour: now.getHours(),
        },
      },
    });

    if (!logistics) {
      return apiSuccess({
        busyness_pct: null,
        estimated_wait_minutes: null,
        data_available: false,
      });
    }

    return apiSuccess({
      busyness_pct: logistics.typicalBusynessPct,
      estimated_wait_minutes: logistics.typicalBusynessPct
        ? estimateWaitMinutes(logistics.typicalBusynessPct)
        : null,
      data_available: true,
      last_updated: logistics.updatedAt,
    });
  } catch {
    return apiError("Failed to fetch traffic");
  }
}
