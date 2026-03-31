/**
 * Rate-limiting wrapper for API route handlers.
 * Usage: export const GET = withRateLimit("read", handler);
 */
import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit, getRouteCategory } from "./rate-limiter";

type RouteHandler = (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

export function withRateLimit(
  categoryOverride: string | null,
  handler: RouteHandler
): RouteHandler {
  return async (req, context) => {
    const category =
      categoryOverride ?? getRouteCategory(new URL(req.url).pathname);

    if (!category) return handler(req, context);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const result = await checkApiRateLimit(ip, category);

    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: result.retryAfterSeconds },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSeconds ?? 60),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const response = await handler(req, context);

    // Add rate limit headers to successful responses
    if (response instanceof NextResponse && result.remaining >= 0) {
      response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    }

    return response;
  };
}
