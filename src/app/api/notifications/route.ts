import { prisma } from "@/lib/db/client";
import { authenticateRequest } from "@/lib/auth/jwt";
import { apiSuccess, apiUnauthorized } from "@/lib/utils/api-response";

/**
 * GET /api/notifications — list user notifications
 * Query: ?unread_only=true&limit=20&offset=0
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiUnauthorized();

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread_only") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const offset = parseInt(searchParams.get("offset") || "0");

  const where = {
    userId: auth.sub as string,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notificationLog.count({
      where: { userId: auth.sub as string, readAt: null },
    }),
  ]);

  return apiSuccess({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      channel: n.channel,
      title: n.title,
      body: n.body,
      data: n.data,
      read: n.readAt !== null,
      created_at: n.createdAt.toISOString(),
    })),
    unread_count: unreadCount,
  });
}

/**
 * POST /api/notifications — mark all as read
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiUnauthorized();

  const result = await prisma.notificationLog.updateMany({
    where: { userId: auth.sub as string, readAt: null },
    data: { readAt: new Date() },
  });

  return apiSuccess({ updated_count: result.count });
}
