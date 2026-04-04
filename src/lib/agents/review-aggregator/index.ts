import { prisma } from "@/lib/db/client";
import { getQwenClient, QWEN_3 } from "@/lib/ai/clients";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { extractJson } from "@/lib/utils/parse-json";
import type {
  DishReviewSummary,
  RawReview,
  ReviewAggregationResult,
} from "./types";

// Uses Qwen 3 for client-facing review summaries (migrated from Claude Sonnet — 97% cheaper, 92% theme coverage per A/B test 2026-04-03)

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
    // Google Places API v2 (New) — Place Details with reviews
    const { getPlaceDetails } = await import("@/lib/google-places/client");
    const placeData = await getPlaceDetails(googlePlaceId, "reviews");
    const reviews = placeData.reviews || [];

    return reviews.map(
      (r) => ({
        text: r.text?.text || "",
        rating: r.rating,
        author: r.authorAttribution?.displayName || "Anonymous",
        date: r.relativePublishTimeDescription || "",
        source: "google" as const,
      })
    );
  } catch {
    return [];
  }
}

/**
 * Fetch reviews from Yelp GraphQL API.
 * Note: REST /reviews endpoint is deprecated; GraphQL returns up to 3 reviews.
 * Requires Yelp developer beta enrollment + Accept-Language header.
 */
export async function fetchYelpReviews(
  yelpBusinessId: string
): Promise<RawReview[]> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey || apiKey === "placeholder") return [];

  try {
    const query = `{
      business(id: "${yelpBusinessId}") {
        reviews(limit: 3) {
          text
          rating
          user { name }
          time_created
        }
      }
    }`;

    const res = await fetchWithRetry(
      "https://api.yelp.com/v3/graphql",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/graphql",
          "Accept-Language": "en_US",
        },
        body: query,
      },
      { maxRetries: 2 }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const reviews = data.data?.business?.reviews || [];

    return reviews.map(
      (r: {
        text: string;
        rating: number;
        user: { name: string };
        time_created: string;
      }) => ({
        text: r.text,
        rating: r.rating,
        author: r.user?.name || "Anonymous",
        date: r.time_created || "",
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

/** Delivery platform rating data to include in review summaries. */
export interface DeliveryRatingContext {
  doordashThumbsUpPct?: number | null;
  doordashReviewCount?: number;
  ubereatsThumbsUpPct?: number | null;
  ubereatsReviewCount?: number;
  isMostLiked?: boolean;
}

/**
 * Summarize reviews for a specific dish using an LLM.
 * Optionally includes delivery platform rating data for richer summaries.
 */
export async function summarizeDishReviews(
  dishName: string,
  restaurantName: string,
  reviews: RawReview[],
  deliveryData?: DeliveryRatingContext
): Promise<DishReviewSummary> {
  // If we have NO text reviews AND no delivery data, return empty
  const hasDeliveryData = deliveryData && (
    (deliveryData.doordashReviewCount ?? 0) > 0 ||
    (deliveryData.ubereatsReviewCount ?? 0) > 0
  );

  if (reviews.length === 0 && !hasDeliveryData) {
    return {
      summary: "No reviews on this dish yet.",
      dish_rating: 0,
      common_praises: [],
      common_complaints: [],
      dietary_warnings: [],
      portion_perception: "unknown",
    };
  }

  const totalSources = reviews.length + (hasDeliveryData ? 1 : 0);

  const client = getQwenClient();
  const reviewTexts = reviews
    .map((r, i) => `Review ${i + 1} (${r.rating}/5 stars, ${r.source}): "${r.text}"`)
    .join("\n\n");

  // Build delivery data section for the prompt
  let deliverySection = "";
  if (hasDeliveryData) {
    const parts: string[] = [];
    if (deliveryData!.doordashReviewCount && deliveryData!.doordashReviewCount > 0) {
      parts.push(`DoorDash: ${deliveryData!.doordashThumbsUpPct}% thumbs up (${deliveryData!.doordashReviewCount} ratings)${deliveryData!.isMostLiked ? ", tagged as Most Liked" : ""}`);
    }
    if (deliveryData!.ubereatsReviewCount && deliveryData!.ubereatsReviewCount > 0) {
      parts.push(`Uber Eats: ${deliveryData!.ubereatsThumbsUpPct}% liked (${deliveryData!.ubereatsReviewCount} ratings)`);
    }
    if (parts.length > 0) {
      deliverySection = `\n\nDelivery platform ratings:\n${parts.map(p => `- ${p}`).join("\n")}\nFactor these popularity signals into your summary.`;
    }
  }

  const prompt = `Summarize what reviewers say about a specific dish. STRICT RULES:

- ONLY state things explicitly mentioned in the reviews below. NEVER infer, guess, or add details not in the reviews.
- Start the summary with "Based on ${reviews.length} review${reviews.length === 1 ? "" : "s"}${hasDeliveryData ? " and delivery platform data" : ""},"
- Be specific: name exact flavors, textures, ingredients reviewers mention — not vague praise like "delicious" or "great".
- NEVER say "customers say", "diners report", "patrons mention", or similar. Just state what the reviews say directly.
- If reviews disagree, say so (e.g., "opinions split on sweetness — 2 loved it, 1 found it too sweet").
- If delivery data shows high approval (>85% thumbs up) or Most Liked status, mention it concisely.
- Keep it 2-3 sentences max. Every word should carry information.

Dish: "${dishName}" at "${restaurantName}"

${reviews.length > 0 ? `Reviews:\n${reviewTexts}` : "No written reviews available."}${deliverySection}

Return JSON:
{
  "summary": "string (start with 'Based on N reviews,' — be specific about flavors, textures, preparation details mentioned)",
  "dish_rating": number (average of review ratings, 1 decimal; use 0 if no text reviews),
  "common_praises": ["short specific phrases from reviews, e.g. 'crispy batter' not 'good food'"],
  "common_complaints": ["short specific phrases from reviews, e.g. 'too salty' not 'could be better'"],
  "dietary_warnings": ["only if reviewers explicitly mention allergy/dietary info, e.g. 'spicier than menu suggests'"],
  "portion_perception": "generous" | "average" | "small" | "unknown"
}

Return ONLY valid JSON, no markdown fences or extra text.`;

  const response = await client.chat.completions.create({
    model: QWEN_3,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("No text response from review summarization");
  }

  return extractJson<DishReviewSummary>(text);
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

  // Get dishes for this restaurant (include existing delivery ratings)
  const dishes = await prisma.dish.findMany({
    where: { restaurantId },
    select: {
      id: true,
      name: true,
      reviewSummary: {
        select: {
          doordashThumbsUpPct: true,
          doordashReviewCount: true,
          ubereatsThumbsUpPct: true,
          ubereatsReviewCount: true,
          isMostLiked: true,
        },
      },
    },
  });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true },
  });

  const dishSummaries: ReviewAggregationResult["dishSummaries"] = [];
  const restaurantName = restaurant?.name || "Unknown";

  // Build delivery data map from existing ReviewSummary records
  // (populated by the delivery-scraper worker in a prior pipeline stage)
  const deliveryMap = new Map<string, DeliveryRatingContext>();
  for (const dish of dishes) {
    const rs = dish.reviewSummary;
    if (rs && ((rs.doordashReviewCount ?? 0) > 0 || (rs.ubereatsReviewCount ?? 0) > 0)) {
      deliveryMap.set(dish.id, {
        doordashThumbsUpPct: rs.doordashThumbsUpPct ? Number(rs.doordashThumbsUpPct) : null,
        doordashReviewCount: rs.doordashReviewCount ?? 0,
        ubereatsThumbsUpPct: rs.ubereatsThumbsUpPct ? Number(rs.ubereatsThumbsUpPct) : null,
        ubereatsReviewCount: rs.ubereatsReviewCount ?? 0,
        isMostLiked: rs.isMostLiked ?? false,
      });
    }
  }

  // Process dishes with concurrency limit of 3 — LLM calls are I/O-bound so
  // parallelism gives ~3x speedup for restaurants with many dishes.
  const CONCURRENCY = 3;

  // Include dishes that have text reviews OR delivery data (not just text reviews)
  const dishesWithData = dishes
    .map((dish) => ({
      dish: { id: dish.id, name: dish.name },
      dishReviews: filterReviewsForDish(dish.name, allReviews),
      deliveryData: deliveryMap.get(dish.id),
    }))
    .filter(({ dishReviews, deliveryData }) => dishReviews.length > 0 || !!deliveryData);

  for (let i = 0; i < dishesWithData.length; i += CONCURRENCY) {
    const batch = dishesWithData.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async ({ dish, dishReviews, deliveryData }) => {
        const summary = await summarizeDishReviews(dish.name, restaurantName, dishReviews, deliveryData);
        const positiveCount = summary.common_praises.length;
        const negativeCount = summary.common_complaints.length;
        const totalSentiment = Math.max(1, positiveCount + negativeCount);

        // Include delivery review counts in total
        const deliveryReviewTotal = (deliveryData?.doordashReviewCount ?? 0)
          + (deliveryData?.ubereatsReviewCount ?? 0);
        const totalReviews = dishReviews.length + deliveryReviewTotal;

        await prisma.reviewSummary.upsert({
          where: { dishId: dish.id },
          update: {
            totalReviewsAnalyzed: totalReviews,
            googleReviewCount: dishReviews.filter((r) => r.source === "google").length,
            yelpReviewCount: dishReviews.filter((r) => r.source === "yelp").length,
            averageDishRating: summary.dish_rating,
            summaryText: summary.summary,
            sentimentPositivePct: (positiveCount / totalSentiment) * 100,
            sentimentNegativePct: (negativeCount / totalSentiment) * 100,
            commonPraises: summary.common_praises,
            commonComplaints: summary.common_complaints,
            dietaryWarnings: summary.dietary_warnings,
            lastUpdated: new Date(),
          },
          create: {
            dishId: dish.id,
            totalReviewsAnalyzed: totalReviews,
            googleReviewCount: dishReviews.filter((r) => r.source === "google").length,
            yelpReviewCount: dishReviews.filter((r) => r.source === "yelp").length,
            averageDishRating: summary.dish_rating,
            summaryText: summary.summary,
            sentimentPositivePct: (positiveCount / totalSentiment) * 100,
            sentimentNegativePct: (negativeCount / totalSentiment) * 100,
            commonPraises: summary.common_praises,
            commonComplaints: summary.common_complaints,
            dietaryWarnings: summary.dietary_warnings,
          },
        });

        return { dishId: dish.id, dishName: dish.name, reviewCount: dishReviews.length, summary };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        dishSummaries.push(result.value);
      } else {
        console.warn("Review summarization failed for dish in batch:", result.reason);
      }
    }
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
