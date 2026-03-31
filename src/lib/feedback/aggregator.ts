/**
 * Feedback Aggregator — processes community feedback to improve dish data.
 *
 * Runs as a scheduled job to:
 * 1. Adjust macro ranges based on portion feedback (bigger/smaller)
 * 2. Flag dishes as unavailable when multiple users report it
 * 3. Queue user-submitted photos for vision analysis
 */
import { prisma } from "@/lib/db/client";
import { batchAnalyzePhotos } from "@/lib/agents/vision-analyzer";
import type { BatchJob } from "@/lib/agents/vision-analyzer/types";

const PORTION_ADJUSTMENT_THRESHOLD = 3; // Min reports before adjusting
const UNAVAILABLE_THRESHOLD = 3; // Min reports to flag unavailable
const PORTION_SCALE_FACTOR = 0.12; // 12% adjustment per direction

export async function processFeedback(): Promise<{
  portionAdjustments: number;
  dishesMarkedUnavailable: number;
  photosQueued: number;
}> {
  let portionAdjustments = 0;
  let dishesMarkedUnavailable = 0;
  let photosQueued = 0;

  // Get all unprocessed feedback grouped by dish
  const feedbackByDish = await prisma.communityFeedback.groupBy({
    by: ["dishId", "feedbackType"],
    _count: { id: true },
    where: {
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
    },
  });

  // Build a map: dishId → { type → count }
  const dishFeedback = new Map<string, Map<string, number>>();
  for (const row of feedbackByDish) {
    if (!dishFeedback.has(row.dishId)) {
      dishFeedback.set(row.dishId, new Map());
    }
    dishFeedback.get(row.dishId)!.set(row.feedbackType, row._count.id);
  }

  for (const [dishId, typeCounts] of dishFeedback) {
    const bigger = typeCounts.get("portion_bigger") ?? 0;
    const smaller = typeCounts.get("portion_smaller") ?? 0;
    const accurate = typeCounts.get("portion_accurate") ?? 0;
    const unavailable = typeCounts.get("dish_unavailable") ?? 0;

    // 1. Portion adjustments — only if clear consensus (net direction)
    const netBigger = bigger - smaller;
    const totalPortionReports = bigger + smaller + accurate;

    if (totalPortionReports >= PORTION_ADJUSTMENT_THRESHOLD && Math.abs(netBigger) >= 2) {
      const dish = await prisma.dish.findUnique({
        where: { id: dishId },
        select: { caloriesMin: true, caloriesMax: true, proteinMaxG: true, carbsMaxG: true, fatMaxG: true },
      });

      if (dish && dish.caloriesMin != null) {
        const direction = netBigger > 0 ? 1 : -1;
        const factor = 1 + direction * PORTION_SCALE_FACTOR;

        await prisma.dish.update({
          where: { id: dishId },
          data: {
            caloriesMin: Math.round(dish.caloriesMin * factor),
            caloriesMax: dish.caloriesMax ? Math.round(dish.caloriesMax * factor) : undefined,
            proteinMaxG: dish.proteinMaxG ? Math.round(Number(dish.proteinMaxG) * factor * 10) / 10 : undefined,
            carbsMaxG: dish.carbsMaxG ? Math.round(Number(dish.carbsMaxG) * factor * 10) / 10 : undefined,
            fatMaxG: dish.fatMaxG ? Math.round(Number(dish.fatMaxG) * factor * 10) / 10 : undefined,
          },
        });
        portionAdjustments++;
      }
    }

    // 2. Unavailability flagging
    if (unavailable >= UNAVAILABLE_THRESHOLD) {
      await prisma.dish.update({
        where: { id: dishId },
        data: { isAvailable: false },
      });
      dishesMarkedUnavailable++;
    }
  }

  // 3. Queue user-submitted photos for vision analysis
  const photoSubmissions = await prisma.communityFeedback.findMany({
    where: {
      feedbackType: "photo_submission",
      photoUrl: { not: null },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    },
    select: { dishId: true, photoUrl: true },
  });

  const photoJobs: BatchJob[] = photoSubmissions
    .filter((s): s is { dishId: string; photoUrl: string } => s.photoUrl != null)
    .map((s) => ({ dishId: s.dishId, imageUrl: s.photoUrl }));

  if (photoJobs.length > 0) {
    batchAnalyzePhotos(photoJobs).catch((err) =>
      console.error("Feedback photo analysis failed:", (err as Error).message)
    );
    photosQueued = photoJobs.length;
  }

  return { portionAdjustments, dishesMarkedUnavailable, photosQueued };
}
