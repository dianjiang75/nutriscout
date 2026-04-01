import type { Queue } from "bullmq";

// Mock IORedis
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    status: "ready",
    disconnect: jest.fn(),
  }));
});

// Mock BullMQ Queue
jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation((name: string) => ({
    name,
    add: jest.fn().mockResolvedValue({ id: "job-1", name }),
    close: jest.fn().mockResolvedValue(undefined),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    }),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

describe("Worker Queues", () => {
  it("creates menu-crawl queue", async () => {
    const { menuCrawlQueue } = await import("../../workers/queues");
    expect(menuCrawlQueue.name).toBe("menu-crawl");
  });

  it("creates logistics-update queue", async () => {
    const { logisticsQueue } = await import("../../workers/queues");
    expect(logisticsQueue.name).toBe("logistics-update");
  });

  it("can add a crawl job to the queue", async () => {
    const { menuCrawlQueue } = await import("../../workers/queues");
    const job = await menuCrawlQueue.add("crawl", {
      googlePlaceId: "ChIJtest123",
    });
    expect(job).toBeDefined();
    expect(menuCrawlQueue.add).toHaveBeenCalledWith("crawl", {
      googlePlaceId: "ChIJtest123",
    });
  });

  it("can add a logistics job to the queue", async () => {
    const { logisticsQueue } = await import("../../workers/queues");
    const job = await logisticsQueue.add("update", {
      restaurantId: "rest-1",
      restaurantName: "Test Restaurant",
      address: "123 Main St",
    });
    expect(job).toBeDefined();
  });
});
