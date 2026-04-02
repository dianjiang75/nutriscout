import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { searchNearby } from "@/lib/google-places/client";

export const POST = withRateLimit("crawl", async (request) => {
  try {
    const { latitude, longitude, radius_miles } = await request.json();

    if (latitude == null || longitude == null) {
      return Response.json({ error: "latitude and longitude are required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey || apiKey === "placeholder") {
      return Response.json({ error: "Google Places API not configured" }, { status: 503 });
    }

    const radiusMeters = Math.round((radius_miles || 0.5) * 1609.34);

    // Google Places API v2 (New) — POST-based nearby search
    const places = await searchNearby(latitude, longitude, radiusMeters, {
      type: "restaurant",
    });

    const { menuCrawlQueue } = await import("@/../workers/queues");

    // Also lookup Yelp business IDs for each restaurant
    const yelpKey = process.env.YELP_API_KEY;

    let queued = 0;
    for (const place of places) {
      let yelpBusinessId: string | null = null;

      // Auto-lookup Yelp business ID using Yelp Business Match API
      if (yelpKey && yelpKey !== "placeholder") {
        try {
          const yelpRes = await fetchWithRetry(
            `https://api.yelp.com/v3/businesses/matches?name=${encodeURIComponent(place.displayName?.text || "")}&address1=${encodeURIComponent(place.formattedAddress || "")}&city=New York&state=NY&country=US&limit=1`,
            { headers: { Authorization: `Bearer ${yelpKey}` } },
            { maxRetries: 2 }
          );
          if (yelpRes.ok) {
            const yelpData = await yelpRes.json();
            yelpBusinessId = yelpData.businesses?.[0]?.id || null;
          }
        } catch {
          // Yelp lookup failed — continue without it
        }
      }

      await menuCrawlQueue.add(
        "area-crawl",
        { googlePlaceId: place.id, yelpBusinessId },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );
      queued++;
    }

    return Response.json({
      restaurants_found: places.length,
      jobs_queued: queued,
    }, { status: 202 });
  } catch {
    return Response.json({ error: "Failed to trigger area crawl" }, { status: 500 });
  }
});
