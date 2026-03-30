import { parseHtmlMenu } from "@/lib/agents/menu-crawler/sources";
import { analyzeIngredients } from "@/lib/agents/menu-crawler";

// Mock Anthropic SDK
const mockCreate = jest.fn();
jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

// Mock Prisma
jest.mock("@/lib/db/client", () => ({
  prisma: {
    restaurant: {
      upsert: jest.fn().mockResolvedValue({ id: "rest-1", name: "Test" }),
      update: jest.fn().mockResolvedValue({}),
    },
    dish: { create: jest.fn().mockResolvedValue({}) },
  },
}));

// Mock Redis
jest.mock("@/lib/cache/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
  },
}));

describe("Menu Crawler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("parseHtmlMenu", () => {
    it("extracts dish names and prices from structured HTML menu", () => {
      const html = `
        <html><body>
          <div class="menu-item">
            <h3 class="item-name">Pad Thai</h3>
            <p class="description">Stir-fried rice noodles with shrimp</p>
            <span class="price">$14.99</span>
          </div>
          <div class="menu-item">
            <h3 class="item-name">Green Curry</h3>
            <p class="description">Coconut milk curry with vegetables</p>
            <span class="price">$12.99</span>
          </div>
          <div class="menu-item">
            <h3 class="item-name">Mango Sticky Rice</h3>
            <p class="description">Sweet sticky rice with fresh mango</p>
            <span class="price">$8.99</span>
          </div>
        </body></html>
      `;

      const items = parseHtmlMenu(html);

      expect(items.length).toBe(3);
      expect(items[0].name).toBe("Pad Thai");
      expect(items[0].description).toBe("Stir-fried rice noodles with shrimp");
      expect(items[0].price).toBe("$14.99");
      expect(items[1].name).toBe("Green Curry");
      expect(items[2].name).toBe("Mango Sticky Rice");
    });

    it("extracts dishes from heading + list HTML pattern", () => {
      const html = `
        <html><body>
          <h2>Appetizers</h2>
          <ul>
            <li>Spring Rolls</li>
            <li>Soup Dumplings</li>
          </ul>
          <h2>Mains</h2>
          <ul>
            <li>Kung Pao Chicken</li>
            <li>Mapo Tofu</li>
          </ul>
        </body></html>
      `;

      const items = parseHtmlMenu(html);

      expect(items.length).toBe(4);
      expect(items[0].name).toBe("Spring Rolls");
      expect(items[0].category).toBe("Appetizers");
      expect(items[2].name).toBe("Kung Pao Chicken");
      expect(items[2].category).toBe("Mains");
    });

    it("returns empty array for non-menu HTML", () => {
      const html = `<html><body><p>Welcome to our restaurant!</p></body></html>`;
      const items = parseHtmlMenu(html);
      expect(items).toEqual([]);
    });
  });

  describe("analyzeIngredients", () => {
    it('flags "Pan-seared salmon with lemon butter sauce" as NOT vegan and NOT dairy-free', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              {
                dish_name: "Pan-seared salmon with lemon butter sauce",
                ingredients_parsed: [
                  { name: "salmon fillet", is_primary: true },
                  { name: "butter", is_primary: true },
                  { name: "lemon juice", is_primary: false },
                  { name: "olive oil", is_primary: false },
                ],
                dietary_flags: {
                  vegan: false,
                  vegetarian: false,
                  gluten_free: true,
                  dairy_free: false,
                  nut_free: true,
                  halal: null,
                  kosher: null,
                },
                dietary_confidence: 0.9,
                dietary_warnings: [
                  "Contains fish (salmon) — not vegetarian or vegan",
                  "Contains dairy (butter) — not dairy-free",
                ],
              },
            ]),
          },
        ],
      });

      const results = await analyzeIngredients([
        {
          name: "Pan-seared salmon with lemon butter sauce",
          description: "Fresh Atlantic salmon pan-seared with lemon butter",
          price: "$24.99",
          category: "Mains",
        },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].dietary_flags.vegan).toBe(false);
      expect(results[0].dietary_flags.dairy_free).toBe(false);
      expect(results[0].dietary_flags.vegetarian).toBe(false);
    });

    it('flags "Garden salad with balsamic vinaigrette" as vegan', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              {
                dish_name: "Garden salad with balsamic vinaigrette",
                ingredients_parsed: [
                  { name: "mixed greens", is_primary: true },
                  { name: "tomatoes", is_primary: false },
                  { name: "cucumber", is_primary: false },
                  { name: "balsamic vinegar", is_primary: false },
                  { name: "olive oil", is_primary: false },
                ],
                dietary_flags: {
                  vegan: true,
                  vegetarian: true,
                  gluten_free: true,
                  dairy_free: true,
                  nut_free: true,
                  halal: true,
                  kosher: true,
                },
                dietary_confidence: 0.85,
                dietary_warnings: [],
              },
            ]),
          },
        ],
      });

      const results = await analyzeIngredients([
        {
          name: "Garden salad with balsamic vinaigrette",
          description: "Fresh mixed greens with house-made balsamic dressing",
          price: "$10.99",
          category: "Salads",
        },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].dietary_flags.vegan).toBe(true);
      expect(results[0].dietary_flags.vegetarian).toBe(true);
      expect(results[0].dietary_flags.dairy_free).toBe(true);
    });

    it("returns empty array for empty input", async () => {
      const results = await analyzeIngredients([]);
      expect(results).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
