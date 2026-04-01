/**
 * Standardized API response helpers.
 * Ensures consistent shape across all routes:
 * { success: boolean, data?, error?, details? }
 */

interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: string;
  details?: Record<string, unknown>;
}

/** Return a success response with consistent shape. */
export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data } as ApiSuccessResponse<T>, { status });
}

/** Return an error response with consistent shape. */
export function apiError(
  message: string,
  status = 500,
  details?: Record<string, unknown>,
  headers?: Record<string, string>
): Response {
  const body: ApiErrorResponse = { success: false, error: message };
  if (details) body.details = details;
  return Response.json(body, { status, headers });
}

/** 400 Bad Request */
export function apiBadRequest(message: string, details?: Record<string, unknown>): Response {
  return apiError(message, 400, details);
}

/** 401 Unauthorized */
export function apiUnauthorized(message = "Authentication required"): Response {
  return apiError(message, 401);
}

/** 404 Not Found */
export function apiNotFound(message = "Resource not found"): Response {
  return apiError(message, 404);
}

/** 429 Rate Limited */
export function apiRateLimited(retryAfterSeconds: number | null): Response {
  return apiError("Too many requests", 429, { retryAfterSeconds }, {
    "Retry-After": String(retryAfterSeconds ?? 60),
  });
}

/** 503 Service Unavailable */
export function apiUnavailable(message = "Service temporarily unavailable"): Response {
  return apiError(message, 503);
}
