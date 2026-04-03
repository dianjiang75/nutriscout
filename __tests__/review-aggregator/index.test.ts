import type { RawReview } from "@/lib/agents/review-aggregator/types";

const mockCreate = jest.fn();
jest.mock("@/lib/ai/clients", () => ({
  getQwenClient: () => ({
    chat: { completions: { create: mockCreate } },
  }),
  QWEN_3: "qwen-plus",
}));

jest.mock("@/lib/db/client", () => ({
  prisma: {
    dish: { findMany: jest.fn().mockResolvedValue([]) },
    restaurant: {
      findUnique: jest.fn().mockResolvedValue({ name: "Test Restaurant" }),
      update: jest.fn().mockResolvedValue({}),
    },
    reviewSummary: { upsert: jest.fn().mockResolvedValue({}) },
  },
}));

jest.mock("@/lib/cache/redis", () => ({
  redis: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue("OK") },
}));

import {
  filterReviewsForDish,
  summarizeDishReviews,
} from "@/lib/agents/review-aggregator";

const mockReviews: RawReview[] = [
  {
    text: "The pad thai here is incredible! Generous portion, perfectly balanced flavors.",
    rating: 5,
    author: "Alice",
    date: "2 weeks ago",
    source: "google",
  },
  {
    text: "Ordered their Pad Thai and green curry. The pad thai was good but a bit too sweet.",
    rating: 4,
    author: "Bob",
    date: "1 month ago",
    source: "google",
  },
  {
    text: "Great ambiance and service. We loved the spring rolls.",
    rating: 5,
    author: "Carol",
    date: "3 weeks ago",
    source: "yelp",
  },
  {
    text: "The green curry was too spicy for me. The mango sticky rice was perfect though.",
    rating: 3,
    author: "Dave",
    date: "1 week ago",
    source: "yelp",
  },
  {
    text: "Best pad thai I've ever had. The shrimp were fresh and plentiful.",
    rating: 5,
    author: "Eve",
    date: "2 months ago",
    source: "google",
  },
];

describe("Review Aggregator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("filterReviewsForDish", () => {
    it("filters reviews mentioning 'pad thai' (case insensitive)", () => {
      const filtered = filterReviewsForDish("Pad Thai", mockReviews);

      expect(filtered).toHaveLength(3);
      expect(filtered.map((r) => r.author).sort()).toEqual(["Alice", "Bob", "Eve"]);
    });

    it("filters reviews for 'green curry'", () => {
      const filtered = filterReviewsForDish("Green Curry", mockReviews);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((r) => r.author).sort()).toEqual(["Bob", "Dave"]);
    });

    it("filters reviews for 'spring rolls'", () => {
      const filtered = filterReviewsForDish("Spring Rolls", mockReviews);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].author).toBe("Carol");
    });

    it("returns empty for dish not mentioned in any review", () => {
      const filtered = filterReviewsForDish("Tom Yum Soup", mockReviews);
      expect(filtered).toHaveLength(0);
    });

    it("handles fuzzy matching with possessives", () => {
      const filtered = filterReviewsForDish("Pad Thai", [
        {
          text: "Their pad thai is the best in town",
          rating: 5,
          author: "Test",
          date: "now",
          source: "google",
        },
      ]);
      expect(filtered).toHaveLength(1);
    });
  });

  describe("summarizeDishReviews", () => {
    it("returns empty summary for no reviews", async () => {
      const result = await summarizeDishReviews(
        "Pad Thai",
        "Test Restaurant",
        []
      );

      expect(result.summary).toBe("No reviews found for this dish.");
      expect(result.dish_rating).toBe(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("calls LLM and returns structured summary", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
              summary:
                "The Pad Thai at Test Restaurant is highly praised for its balanced flavors and generous portions. Multiple reviewers highlight the fresh shrimp, though some find it slightly too sweet.",
              dish_rating: 4.5,
              common_praises: [
                "generous portions",
                "balanced flavors",
                "fresh shrimp",
              ],
              common_complaints: ["slightly too sweet"],
              dietary_warnings: [],
              portion_perception: "generous",
            }),
            },
          },
        ],
      });

      const padThaiReviews = filterReviewsForDish("Pad Thai", mockReviews);
      const result = await summarizeDishReviews(
        "Pad Thai",
        "Test Restaurant",
        padThaiReviews
      );

      expect(result.dish_rating).toBe(4.5);
      expect(result.common_praises).toContain("generous portions");
      expect(result.common_complaints).toContain("slightly too sweet");
      expect(result.portion_perception).toBe("generous");
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });
});
