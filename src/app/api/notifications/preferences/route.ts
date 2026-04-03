import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { authenticateRequest } from "@/lib/auth/jwt";
import { apiSuccess, apiBadRequest, apiUnauthorized } from "@/lib/utils/api-response";

const prefsSchema = z.object({
  in_app_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  new_dish_match: z.boolean().optional(),
  favorite_updated: z.boolean().optional(),
  wait_time_drop: z.boolean().optional(),
  weekly_digest: z.boolean().optional(),
  quiet_hours_start: z.number().int().min(0).max(23).nullable().optional(),
  quiet_hours_end: z.number().int().min(0).max(23).nullable().optional(),
});

/**
 * GET /api/notifications/preferences
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiUnauthorized();

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: auth.sub as string },
  });

  return apiSuccess({
    in_app_enabled: prefs?.inAppEnabled ?? true,
    push_enabled: prefs?.pushEnabled ?? false,
    new_dish_match: prefs?.newDishMatch ?? true,
    favorite_updated: prefs?.favoriteUpdated ?? true,
    wait_time_drop: prefs?.waitTimeDrop ?? true,
    weekly_digest: prefs?.weeklyDigest ?? true,
    quiet_hours_start: prefs?.quietHoursStart ?? null,
    quiet_hours_end: prefs?.quietHoursEnd ?? null,
  });
}

/**
 * PUT /api/notifications/preferences — partial update
 */
export async function PUT(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiUnauthorized();

  const body = await request.json().catch(() => null);
  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message || "Invalid input");
  }

  const data = parsed.data;

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: auth.sub as string },
    update: {
      ...(data.in_app_enabled !== undefined && { inAppEnabled: data.in_app_enabled }),
      ...(data.push_enabled !== undefined && { pushEnabled: data.push_enabled }),
      ...(data.new_dish_match !== undefined && { newDishMatch: data.new_dish_match }),
      ...(data.favorite_updated !== undefined && { favoriteUpdated: data.favorite_updated }),
      ...(data.wait_time_drop !== undefined && { waitTimeDrop: data.wait_time_drop }),
      ...(data.weekly_digest !== undefined && { weeklyDigest: data.weekly_digest }),
      ...(data.quiet_hours_start !== undefined && { quietHoursStart: data.quiet_hours_start }),
      ...(data.quiet_hours_end !== undefined && { quietHoursEnd: data.quiet_hours_end }),
    },
    create: {
      userId: auth.sub as string,
      inAppEnabled: data.in_app_enabled ?? true,
      pushEnabled: data.push_enabled ?? false,
      newDishMatch: data.new_dish_match ?? true,
      favoriteUpdated: data.favorite_updated ?? true,
      waitTimeDrop: data.wait_time_drop ?? true,
      weeklyDigest: data.weekly_digest ?? true,
      quietHoursStart: data.quiet_hours_start ?? null,
      quietHoursEnd: data.quiet_hours_end ?? null,
    },
  });

  return apiSuccess({
    in_app_enabled: prefs.inAppEnabled,
    push_enabled: prefs.pushEnabled,
    new_dish_match: prefs.newDishMatch,
    favorite_updated: prefs.favoriteUpdated,
    wait_time_drop: prefs.waitTimeDrop,
    weekly_digest: prefs.weeklyDigest,
    quiet_hours_start: prefs.quietHoursStart,
    quiet_hours_end: prefs.quietHoursEnd,
  });
}
