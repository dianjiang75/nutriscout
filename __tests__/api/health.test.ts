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

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 and healthy when both services are up", async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
    (redis.ping as jest.Mock).mockResolvedValue("PONG");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.checks.database).toBe("ok");
    expect(body.checks.redis).toBe("ok");
  });

  it("returns 503 and degraded when database is down", async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(
      new Error("Connection refused")
    );
    (redis.ping as jest.Mock).mockResolvedValue("PONG");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("error");
    expect(body.checks.redis).toBe("ok");
  });

  it("returns 503 and degraded when redis is down", async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
    (redis.ping as jest.Mock).mockRejectedValue(
      new Error("Connection refused")
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("ok");
    expect(body.checks.redis).toBe("error");
  });
});
