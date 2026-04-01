/**
 * Structured logger for NutriScout API routes.
 *
 * In production: outputs JSON for parsing by Datadog/Grafana/etc.
 * In development: readable formatted output.
 *
 * Lightweight — no external deps (Pino can be added later for perf).
 * Each log includes: timestamp, level, route, duration, context.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  userId?: string;
  ip?: string;
  query?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL = process.env.NODE_ENV === "production" ? "warn" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL as LogLevel];
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }

  // Dev: readable format
  const ctx = context
    ? " " + Object.entries(context)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")
    : "";
  const levelColor = { debug: "\x1b[36m", info: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" }[level];
  return `${levelColor}[${level.toUpperCase()}]\x1b[0m ${message}${ctx}`;
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog("debug")) console.debug(formatLog("debug", message, context));
  },
  info(message: string, context?: LogContext) {
    if (shouldLog("info")) console.info(formatLog("info", message, context));
  },
  warn(message: string, context?: LogContext) {
    if (shouldLog("warn")) console.warn(formatLog("warn", message, context));
  },
  error(message: string, context?: LogContext) {
    if (shouldLog("error")) console.error(formatLog("error", message, context));
  },
};

/**
 * Wrap an API route handler with request logging.
 * Logs: method, route, duration, status, and any errors.
 */
export function withLogging(
  route: string,
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const start = Date.now();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

    try {
      const response = await handler(request);
      const durationMs = Date.now() - start;

      if (response.status >= 400) {
        logger.warn("API request failed", {
          route,
          method: request.method,
          status: response.status,
          durationMs,
          ip,
        });
      } else {
        logger.debug("API request", {
          route,
          method: request.method,
          status: response.status,
          durationMs,
        });
      }

      return response;
    } catch (err) {
      const durationMs = Date.now() - start;
      logger.error("API unhandled error", {
        route,
        method: request.method,
        durationMs,
        ip,
        error: (err as Error).message,
      });
      throw err;
    }
  };
}
