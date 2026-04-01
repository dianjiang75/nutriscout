import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
    retryStrategy(times: number) {
      // Exponential backoff: 100ms, 200ms, 400ms... max 30s
      return Math.min(times * 100, 30000);
    },
    reconnectOnError(err: Error) {
      return err.message.includes("READONLY");
    },
  });

  client.on("error", (err: Error) => {
    console.error("[redis] Connection error:", err.message);
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Check Redis connectivity. Returns latency in ms on success, throws on failure.
 * Use in health check endpoints and startup validation.
 */
export async function checkRedisHealth(): Promise<{ ok: true; latencyMs: number }> {
  const start = Date.now();
  const pong = await redis.ping();
  if (pong !== "PONG") {
    throw new Error(`Redis health check failed: expected PONG, got ${pong}`);
  }
  return { ok: true, latencyMs: Date.now() - start };
}
