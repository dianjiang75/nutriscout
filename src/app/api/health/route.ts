import { prisma } from "@/lib/db/client";
import { redis } from "@/lib/cache/redis";
import { apiSuccess, apiError } from "@/lib/utils/api-response";
import { healthCheck as googlePlacesHealthCheck } from "@/lib/google-places/client";

export const dynamic = "force-dynamic";

/** Run a check with a timeout. Returns "ok", "error", or "timeout". */
async function timedCheck(name: string, fn: () => Promise<void>, timeoutMs = 3000): Promise<string> {
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${name} timeout`)), timeoutMs)
      ),
    ]);
    return "ok";
  } catch {
    return "error";
  }
}

export async function GET() {
  const start = Date.now();

  // Run all checks in parallel with 3s timeout each
  const [database, redisStatus, googleApi, usdaApi] = await Promise.all([
    timedCheck("database", async () => { await prisma.$queryRaw`SELECT 1`; }),
    timedCheck("redis", async () => { await redis.ping(); }),
    timedCheck("google_places", async () => {
      const key = process.env.GOOGLE_PLACES_API_KEY;
      if (!key || key === "placeholder") throw new Error("not configured");
      // Google Places API v2 health check
      const ok = await googlePlacesHealthCheck();
      if (!ok) throw new Error("API check failed");
    }),
    timedCheck("usda", async () => {
      const key = process.env.USDA_API_KEY;
      if (!key || key === "placeholder") throw new Error("not configured");
      const res = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}&query=test&pageSize=1`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
    }),
  ]);

  const checks = { database, redis: redisStatus, google_places: googleApi, usda: usdaApi };
  const durationMs = Date.now() - start;

  // Core services (DB + Redis) must be healthy; external APIs are "degraded" if down
  const coreHealthy = database === "ok" && redisStatus === "ok";
  const allHealthy = coreHealthy && googleApi === "ok" && usdaApi === "ok";

  const healthData = {
    status: allHealthy ? "healthy" : coreHealthy ? "degraded" : "unhealthy",
    checks,
    durationMs,
  };

  if (!coreHealthy) {
    // Return same shape as success but with 503 status — health data is the payload
    return apiSuccess(healthData, 503);
  }

  return apiSuccess(healthData);
}
