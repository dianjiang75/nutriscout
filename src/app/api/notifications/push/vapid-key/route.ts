import { apiSuccess } from "@/lib/utils/api-response";
import { getVapidPublicKey } from "@/lib/notifications/push";

/**
 * GET /api/notifications/push/vapid-key — returns VAPID public key for client-side subscription
 */
export async function GET() {
  return apiSuccess({ publicKey: getVapidPublicKey() });
}
