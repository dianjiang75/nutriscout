import { PATCH } from "@/app/api/users/profile/route";

jest.mock("@/lib/db/client", () => ({
  prisma: {
    userProfile: {
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/middleware/rate-limiter", () => ({
  checkApiRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 99, retryAfterSeconds: null }),
}));

import { prisma } from "@/lib/db/client";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/users/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/users/profile", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates user preferences and returns 200", async () => {
    (prisma.userProfile.update as jest.Mock).mockResolvedValue({
      id: "u1",
      dietaryRestrictions: { vegan: true },
      nutritionalGoals: { goal: "max_protein" },
      maxWaitMinutes: 20,
      searchRadiusMiles: 3,
    });

    const res = await PATCH(jsonRequest({
      user_id: "u1",
      dietary_restrictions: { vegan: true },
      max_wait_minutes: 20,
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("u1");
    expect(body.max_wait_minutes).toBe(20);
    expect(body.search_radius_miles).toBe(3);
  });

  it("returns 400 when user_id is missing", async () => {
    const res = await PATCH(jsonRequest({ dietary_restrictions: { vegan: true } }));
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    (prisma.userProfile.update as jest.Mock).mockRejectedValue(new Error("DB error"));

    const res = await PATCH(jsonRequest({ user_id: "u1" }));
    expect(res.status).toBe(500);
  });
});
