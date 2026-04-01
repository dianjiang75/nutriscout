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

const DISH_UUID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const USER_UUID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

describe("POST /api/feedback", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates feedback and returns 201", async () => {
    (prisma.communityFeedback.create as jest.Mock).mockResolvedValue({ id: "fb1" });

    const res = await POST(jsonRequest({
      dish_id: DISH_UUID,
      user_id: USER_UUID,
      feedback_type: "portion_bigger",
      details: { text: "Huge portion" },
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("fb1");
  });

  it("returns 400 when required fields missing", async () => {
    const res = await POST(jsonRequest({ dish_id: DISH_UUID }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid feedback_type", async () => {
    const res = await POST(jsonRequest({
      dish_id: DISH_UUID,
      user_id: USER_UUID,
      feedback_type: "invalid_type",
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Validation failed/);
  });
});
