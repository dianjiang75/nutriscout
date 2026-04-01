jest.mock("@/../workers/queues", () => ({
  menuCrawlQueue: {
    add: jest.fn().mockResolvedValue({ id: "job-1" }),
  },
}));

jest.mock("@/lib/middleware/rate-limiter", () => ({
  checkApiRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 10, retryAfterSeconds: null }),
}));

// Mock global fetch for area crawl
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { POST as crawlRestaurant } from "@/app/api/crawl/restaurant/route";
import { POST as crawlArea } from "@/app/api/crawl/area/route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/crawl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/crawl/restaurant", () => {
  beforeEach(() => jest.clearAllMocks());

  it("queues a crawl job and returns 202", async () => {
    const res = await crawlRestaurant(jsonRequest({ google_place_id: "place123" }));
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.success).toBe(true);
    expect(body.data.job_id).toBe("job-1");
    expect(body.data.status).toBe("queued");
  });

  it("returns 400 when google_place_id is missing", async () => {
    const res = await crawlRestaurant(jsonRequest({}));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/crawl/area", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GOOGLE_PLACES_API_KEY: "test-key" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns 400 when lat/lng missing", async () => {
    const res = await crawlArea(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  it("accepts latitude=0 and longitude=0 as valid", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    const res = await crawlArea(jsonRequest({ latitude: 0, longitude: 0 }));
    expect(res.status).toBe(202);
  });

  it("returns 503 when API key not configured", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "placeholder";
    const res = await crawlArea(jsonRequest({ latitude: 40.7, longitude: -74 }));
    expect(res.status).toBe(503);
  });

  it("discovers restaurants and queues jobs", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { place_id: "p1" },
          { place_id: "p2" },
        ],
      }),
    });

    const res = await crawlArea(jsonRequest({ latitude: 40.7, longitude: -74, radius_miles: 1 }));
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.restaurants_found).toBe(2);
    expect(body.jobs_queued).toBe(2);
  });

  it("returns 502 when Google Places API fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const res = await crawlArea(jsonRequest({ latitude: 40.7, longitude: -74 }));
    expect(res.status).toBe(502);
  });
});
