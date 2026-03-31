import { prisma } from "@/lib/db/client";
import { checkApiRateLimit } from "@/lib/middleware/rate-limiter";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const rl = await checkApiRateLimit(ip, "write");
    if (!rl.allowed) {
      return Response.json(
        { error: "Too many requests", retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } }
      );
    }

    const body = await request.json();
    const { dish_id, user_id, feedback_type, details, photo_url } = body;

    if (!dish_id || !user_id || !feedback_type) {
      return Response.json(
        { error: "dish_id, user_id, and feedback_type are required" },
        { status: 400 }
      );
    }

    const validTypes = [
      "portion_bigger", "portion_smaller", "portion_accurate",
      "ingredient_correction", "dish_unavailable", "photo_submission",
    ];

    if (!validTypes.includes(feedback_type)) {
      return Response.json(
        { error: `Invalid feedback_type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const feedback = await prisma.communityFeedback.create({
      data: {
        dishId: dish_id,
        userId: user_id,
        feedbackType: feedback_type,
        details: details ?? undefined,
        photoUrl: photo_url ?? null,
      },
    });

    return Response.json({ id: feedback.id }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
