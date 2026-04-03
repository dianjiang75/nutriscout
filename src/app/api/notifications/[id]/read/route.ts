import { prisma } from "@/lib/db/client";
import { authenticateRequest } from "@/lib/auth/jwt";
import { apiSuccess, apiUnauthorized, apiNotFound } from "@/lib/utils/api-response";

/**
 * PATCH /api/notifications/[id]/read — mark single notification as read
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiUnauthorized();

  const { id } = await params;

  const notification = await prisma.notificationLog.findFirst({
    where: { id, userId: auth.sub as string },
  });

  if (!notification) return apiNotFound("Notification not found");

  const updated = await prisma.notificationLog.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return apiSuccess({ read_at: updated.readAt?.toISOString() });
}
