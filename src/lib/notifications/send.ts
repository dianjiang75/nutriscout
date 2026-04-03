/**
 * Core notification sender: writes to NotificationLog + sends web push if enabled.
 */
import { prisma } from "@/lib/db/client";
import { sendWebPush, type PushPayload } from "./push";
import type { NotificationType, NotificationChannel } from "@/generated/prisma/client";

interface SendNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Send a notification to a user: writes in-app log + sends web push if subscribed.
 */
export async function sendNotification(opts: SendNotificationOptions): Promise<void> {
  const { userId, type, title, body, data } = opts;

  // Check user preferences
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  // Default: in-app enabled, push disabled
  const inAppEnabled = prefs?.inAppEnabled ?? true;
  const pushEnabled = prefs?.pushEnabled ?? false;

  // Check type-specific toggle
  const typeEnabled = checkTypeEnabled(prefs, type);
  if (!typeEnabled) return;

  // Check quiet hours
  if (prefs && isQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd)) return;

  // Write in-app notification log
  if (inAppEnabled) {
    await prisma.notificationLog.create({
      data: {
        userId,
        type,
        channel: "in_app" as NotificationChannel,
        title,
        body,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: (data ?? undefined) as any,
      },
    });
  }

  // Send web push
  if (pushEnabled) {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    const payload: PushPayload = {
      title,
      body,
      tag: type,
      data: { ...data, url: data?.url || "/" },
    };

    for (const sub of subscriptions) {
      const sent = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload
      );

      // Remove invalid subscriptions
      if (!sent) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }

    if (subscriptions.length > 0) {
      await prisma.notificationLog.create({
        data: {
          userId,
          type,
          channel: "web_push" as NotificationChannel,
          title,
          body,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: (data ?? undefined) as any,
        },
      });
    }
  }
}

function checkTypeEnabled(
  prefs: { newDishMatch: boolean; favoriteUpdated: boolean; waitTimeDrop: boolean; weeklyDigest: boolean } | null,
  type: NotificationType
): boolean {
  if (!prefs) return true; // no prefs = all enabled by default
  switch (type) {
    case "new_dish_match": return prefs.newDishMatch;
    case "favorite_updated": return prefs.favoriteUpdated;
    case "wait_time_drop": return prefs.waitTimeDrop;
    case "weekly_digest": return prefs.weeklyDigest;
    default: return true;
  }
}

function isQuietHours(start: number | null, end: number | null): boolean {
  if (start == null || end == null) return false;
  const hour = new Date().getHours();
  if (start <= end) {
    return hour >= start && hour < end;
  }
  // Wraps midnight (e.g., 22:00 - 07:00)
  return hour >= start || hour < end;
}
