import { GET } from "@/app/api/health/route";

// Mock Prisma
jest.mock("@/lib/db/client", () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

// Mock Redis
jest.mock("@/lib/cache/redis", () => ({
  redis: {
    ping: jest.fn(),
  },
}));

import { prisma } from "@/lib/db/client";
import { redis } from "@/lib/cache/redis";

// Mock global fetch for external API health checks
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: external APIs respond OK
    mockFetch.mockResolvedValue({ ok: true });
    // Set env vars so external checks don't skip
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    process.env.USDA_API_KEY = "test-key";
  });

  it("returns 200 and healthy when all services are up", async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
    (redis.ping as jest.Mock).mockResolvedValue("PONG");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.checks.database).toBe("ok");
    expect(body.checks.redis).toBe("ok");
    expect(body.durationMs).toBeDefined();
  });

  it("returns 503 and unhealthy when database is down", async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(
      new Error("Connection refused")
    );
    (redis.ping as jest.Mock).mockResolvedValue("PONG");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database).toBe("error");
    expect(body.checks.redis).toBe("ok");
  });

  it("returns 503 and unhealthy when redis is down", async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
    (redis.ping as jest.Mock).mockRejectedValue(
      new Error("Connection refused")
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database).toBe("ok");
    expect(body.checks.redis).toBe("error");
  });

  it("returns 200 degraded when external APIs are down but core is up", async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
    (redis.ping as jest.Mock).mockResolvedValue("PONG");
    mockFetch.mockRejectedValue(new Error("Network error"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("ok");
    expect(body.checks.redis).toBe("ok");
    expect(body.checks.google_places).toBe("error");
    expect(body.checks.usda).toBe("error");
  });
});
