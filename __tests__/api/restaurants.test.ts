jest.mock("@/lib/db/client", () => ({
  prisma: {
    restaurant: { findUnique: jest.fn() },
    dish: { findMany: jest.fn() },
    restaurantLogistics: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/agents/logistics-poller", () => ({
  estimateWaitMinutes: jest.fn((pct: number) => Math.round(pct * 0.4)),
}));

import { GET as getRestaurant } from "@/app/api/restaurants/[id]/route";
import { GET as getMenu } from "@/app/api/restaurants/[id]/menu/route";
import { GET as getTraffic } from "@/app/api/restaurants/[id]/traffic/route";
import { prisma } from "@/lib/db/client";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const VALID_UUID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const VALID_UUID2 = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

const mockRestaurant = {
  id: VALID_UUID,
  name: "Thai House",
  address: "123 Main St",
  latitude: 40.7,
  longitude: -74.0,
  cuisineType: ["Thai"],
  priceLevel: 2,
  googleRating: 4.5,
  yelpRating: 4.0,
  phone: "555-1234",
  websiteUrl: "https://thai.example.com",
  acceptsReservations: true,
  deliveryOptions: [
    {
      platform: "UBER_EATS",
      isAvailable: true,
      deliveryFeeMin: 2.99,
      deliveryFeeMax: 5.99,
      estimatedDeliveryMinutesMin: 25,
      estimatedDeliveryMinutesMax: 40,
      platformUrl: "https://ubereats.com/thai",
    },
  ],
};

describe("GET /api/restaurants/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns restaurant detail", async () => {
    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(mockRestaurant);

    const res = await getRestaurant(new Request("http://localhost"), makeParams(VALID_UUID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("Thai House");
    expect(body.latitude).toBe(40.7);
    expect(body.delivery).toHaveLength(1);
    expect(body.delivery[0].platform).toBe("UBER_EATS");
  });

  it("returns 404 when not found", async () => {
    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await getRestaurant(new Request("http://localhost"), makeParams(VALID_UUID2));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/restaurants/[id]/menu", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns grouped menu", async () => {
    (prisma.dish.findMany as jest.Mock).mockResolvedValue([
      { id: "d1", name: "Pad Thai", description: "Noodles", price: 12.5, category: "Mains", dietaryFlags: {}, caloriesMin: 400, caloriesMax: 550, proteinMaxG: 20 },
      { id: "d2", name: "Spring Rolls", description: "Fried rolls", price: 6, category: "Appetizers", dietaryFlags: {}, caloriesMin: 200, caloriesMax: 280, proteinMaxG: 5 },
    ]);

    const res = await getMenu(new Request("http://localhost"), makeParams(VALID_UUID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.restaurant_id).toBe(VALID_UUID);
    expect(body.categories).toHaveLength(2);
    const mains = body.categories.find((c: { name: string }) => c.name === "Mains");
    expect(mains.dishes[0].name).toBe("Pad Thai");
  });
});

describe("GET /api/restaurants/[id]/traffic", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns traffic data when available", async () => {
    (prisma.restaurantLogistics.findUnique as jest.Mock).mockResolvedValue({
      typicalBusynessPct: 75,
      updatedAt: new Date("2024-01-01"),
    });

    const res = await getTraffic(new Request("http://localhost"), makeParams(VALID_UUID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data_available).toBe(true);
    expect(body.busyness_pct).toBe(75);
    expect(body.estimated_wait_minutes).toBe(30);
  });

  it("returns null data when not available", async () => {
    (prisma.restaurantLogistics.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await getTraffic(new Request("http://localhost"), makeParams(VALID_UUID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data_available).toBe(false);
    expect(body.busyness_pct).toBeNull();
  });
});
