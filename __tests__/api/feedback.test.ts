jest.mock("@/lib/db/client", () => ({
  prisma: {
    communityFeedback: { create: jest.fn() },
  },
}));

jest.mock("@/lib/middleware/rate-limiter", () => ({
  checkApiRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 99, retryAfterSeconds: null }),
}));

import { POST } from "@/app/api/feedback/route";
import { prisma } from "@/lib/db/client";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/feedback", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates feedback and returns 201", async () => {
    (prisma.communityFeedback.create as jest.Mock).mockResolvedValue({ id: "fb1" });

    const res = await POST(jsonRequest({
      dish_id: "d1",
      user_id: "u1",
      feedback_type: "portion_bigger",
      details: "Huge portion",
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("fb1");
  });

  it("returns 400 when required fields missing", async () => {
    const res = await POST(jsonRequest({ dish_id: "d1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid feedback_type", async () => {
    const res = await POST(jsonRequest({
      dish_id: "d1",
      user_id: "u1",
      feedback_type: "invalid_type",
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid feedback_type/);
  });
});
