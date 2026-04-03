import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { authenticateRequest } from "@/lib/auth/jwt";
import { apiSuccess, apiBadRequest, apiUnauthorized } from "@/lib/utils/api-response";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/**
 * POST /api/notifications/push/subscribe — save push subscription
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiUnauthorized();

  const body = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message || "Invalid subscription");
  }

  const { endpoint, keys } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId: auth.sub as string,
        endpoint,
      },
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: request.headers.get("user-agent") || null,
    },
    create: {
      userId: auth.sub as string,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: request.headers.get("user-agent") || null,
    },
  });

  // Ensure push is enabled in preferences
  await prisma.notificationPreference.upsert({
    where: { userId: auth.sub as string },
    update: { pushEnabled: true },
    create: { userId: auth.sub as string, pushEnabled: true },
  });

  return apiSuccess({ subscribed: true });
}

/**
 * DELETE /api/notifications/push/subscribe — remove push subscription
 */
export async function DELETE(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiUnauthorized();

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (!endpoint) {
    return apiBadRequest("endpoint is required");
  }

  await prisma.pushSubscription.deleteMany({
    where: { userId: auth.sub as string, endpoint },
  });

  return apiSuccess({ unsubscribed: true });
}
