import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/client";
import type {
  DishReviewSummary,
  RawReview,
  ReviewAggregationResult,
} from "./types";

function getAnthropicClient(): Anthropic {
  return new Anthropic();
}

/**
 * Fetch reviews from Google Places API.
 * Note: Google returns max 5 reviews per request.
 */
export async function fetchGoogleReviews(
  googlePlaceId: string
): Promise<RawReview[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || apiKey === "placeholder") return [];

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(googlePlaceId)}&fields=reviews&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const reviews = data.result?.reviews || [];

    return reviews.map(
      (r: {
        text: string;
        rating: number;
        author_name: string;
        relative_time_description: string;
      }) => ({
        text: r.text,
        rating: r.rating,
        author: r.author_name,
        date: r.relative_time_description,
        source: "google" as const,
      })
    );
  } catch {
    return [];
  }
}

/**
 * Fetch reviews from Yelp Fusion API.
 * Note: Yelp returns max 3 review excerpts per business.
 */
export async function fetchYelpReviews(
  yelpBusinessId: string
): Promise<RawReview[]> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey || apiKey === "placeholder") return [];

  try {
    const url = `https://api.yelp.com/v3/businesses/${encodeURIComponent(yelpBusinessId)}/reviews?limit=3&sort_by=yelp_sort`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const reviews = data.reviews || [];

    return reviews.map(
      (r: {
        text: string;
        rating: number;
        user: { name: string };
        time_created: string;
      }) => ({
        text: r.text,
        rating: r.rating,
        author: r.user.name,
        date: r.time_created,
        source: "yelp" as const,
      })
    );
  } catch {
    return [];
  }
}

/**
 * Filter reviews that mention a specific dish using tiered matching.
 *
 * Tier 1: Full dish name appears in review (exact substring)
 * Tier 2: Word-boundary match for significant words (>=4 chars, not stop words)
 *   - Single significant word: requires exact word boundary match
 *   - Multi-word: requires 70%+ words matching with word boundaries
 *
 * Uses word boundaries (\b) instead of plain .includes() to prevent
 * false positives like "pad" matching "iPad" or "padded".
 */
export function filterReviewsForDish(
  dishName: string,
  reviews: RawReview[]
): RawReview[] {
  const nameLower = dishName.toLowerCase().trim();

  const stopWords = new Set([
    "with", "and", "the", "their", "from", "style", "house",
    "special", "chef", "served", "fresh", "our", "new",
    "bowl", "plate", "sandwich", "wrap", "salad", "soup",
  ]);

  const words = nameLower
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));

  // If no significant words, require exact full-name match
  if (words.length === 0) {
    return reviews.filter((r) => r.text.toLowerCase().includes(nameLower));
  }

  // Pre-build word boundary regexes
  const fullNameRegex = new RegExp(`\\b${escapeRegex(nameLower)}\\b`, "i");
  const wordRegexes = words.map(
    (w) => new RegExp(`\\b${escapeRegex(w)}\\b`, "i")
  );

  return reviews.filter((review) => {
    // Tier 1: Full dish name with word boundaries (not plain substring)
    if (fullNameRegex.test(review.text)) return true;

    // Tier 2: Word boundary matching — require 85%+ for multi-word dishes
    const matches = wordRegexes.filter((rx) => rx.test(review.text)).length;

    if (words.length === 1) return matches === 1;
    return matches >= Math.ceil(words.length * 0.85);
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Summarize reviews for a specific dish using an LLM.
 */
export async function summarizeDishReviews(
  dishName: string,
  restaurantName: string,
  reviews: RawReview[]
): Promise<DishReviewSummary> {
  if (reviews.length === 0) {
    return {
      summary: "No reviews found for this dish.",
      dish_rating: 0,
      common_praises: [],
      common_complaints: [],
      dietary_warnings: [],
      portion_perception: "unknown",
    };
  }

  const client = getAnthropicClient();
  const reviewTexts = reviews
    .map((r, i) => `Review ${i + 1} (${r.rating}/5 stars, ${r.source}): "${r.text}"`)
    .join("\n\n");

  const prompt = `You are analyzing restaurant reviews to provide a dish-specific summary.

Dish: "${dishName}" at "${restaurantName}"
Number of reviews mentioning this dish: ${reviews.length}

Reviews:
${reviewTexts}

Provide:
1. A 2-3 sentence summary of what people say about THIS SPECIFIC DISH (not the restaurant in general). Focus on taste, portion size, preparation quality, and value.
2. Common praises (array of short phrases)
3. Common complaints (array of short phrases)
4. Any dietary warnings mentioned by reviewers (e.g., "several reviewers mention it's spicier than expected" or "reviewers note the portion is smaller than photos suggest")
5. Portion perception: Do reviewers generally say portions are generous, average, or small?

Return as JSON:
{
  "summary": "string",
  "dish_rating": number,
  "common_praises": ["string"],
  "common_complaints": ["string"],
  "dietary_warnings": ["string"],
  "portion_perception": "generous" | "average" | "small" | "unknown"
}

Return ONLY valid JSON, no markdown fences or extra text.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from review summarization");
  }

  return JSON.parse(textBlock.text);
}

/**
 * Full review aggregation pipeline for a restaurant.
 * Fetches reviews, matches them to dishes, summarizes, and writes to DB.
 */
export async function aggregateReviews(
  restaurantId: string,
  googlePlaceId: string,
  yelpBusinessId: string | null
): Promise<ReviewAggregationResult> {
  // Fetch reviews from all sources
  const googleReviews = await fetchGoogleReviews(googlePlaceId);
  const yelpReviews = yelpBusinessId
    ? await fetchYelpReviews(yelpBusinessId)
    : [];
  const allReviews = [...googleReviews, ...yelpReviews];

  // Get dishes for this restaurant
  const dishes = await prisma.dish.findMany({
    where: { restaurantId },
    select: { id: true, name: true },
  });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true },
  });

  const dishSummaries: ReviewAggregationResult["dishSummaries"] = [];

  for (const dish of dishes) {
    const dishReviews = filterReviewsForDish(dish.name, allReviews);

    if (dishReviews.length === 0) continue;

    const summary = await summarizeDishReviews(
      dish.name,
      restaurant?.name || "Unknown",
      dishReviews
    );

    // Upsert review summary
    await prisma.reviewSummary.upsert({
      where: { dishId: dish.id },
      update: {
        totalReviewsAnalyzed: dishReviews.length,
        googleReviewCount: dishReviews.filter((r) => r.source === "google").length,
        yelpReviewCount: dishReviews.filter((r) => r.source === "yelp").length,
        averageDishRating: summary.dish_rating,
        summaryText: summary.summary,
        sentimentPositivePct:
          summary.common_praises.length /
          Math.max(1, summary.common_praises.length + summary.common_complaints.length) *
          100,
        sentimentNegativePct:
          summary.common_complaints.length /
          Math.max(1, summary.common_praises.length + summary.common_complaints.length) *
          100,
        commonPraises: summary.common_praises,
        commonComplaints: summary.common_complaints,
        dietaryWarnings: summary.dietary_warnings,
        lastUpdated: new Date(),
      },
      create: {
        dishId: dish.id,
        totalReviewsAnalyzed: dishReviews.length,
        googleReviewCount: dishReviews.filter((r) => r.source === "google").length,
        yelpReviewCount: dishReviews.filter((r) => r.source === "yelp").length,
        averageDishRating: summary.dish_rating,
        summaryText: summary.summary,
        sentimentPositivePct:
          summary.common_praises.length /
          Math.max(1, summary.common_praises.length + summary.common_complaints.length) *
          100,
        sentimentNegativePct:
          summary.common_complaints.length /
          Math.max(1, summary.common_praises.length + summary.common_complaints.length) *
          100,
        commonPraises: summary.common_praises,
        commonComplaints: summary.common_complaints,
        dietaryWarnings: summary.dietary_warnings,
      },
    });

    dishSummaries.push({
      dishId: dish.id,
      dishName: dish.name,
      reviewCount: dishReviews.length,
      summary,
    });
  }

  // Update restaurant last review crawl timestamp
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { lastReviewCrawl: new Date() },
  });

  return {
    restaurantId,
    dishSummaries,
    totalReviewsFetched: allReviews.length,
    googleReviewCount: googleReviews.length,
    yelpReviewCount: yelpReviews.length,
  };
}

export { filterReviewsForDish as filterReviews };
export type {
  RawReview,
  DishReviewSummary,
  ReviewAggregationResult,
} from "./types";
