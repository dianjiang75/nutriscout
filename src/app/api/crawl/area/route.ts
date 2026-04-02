import { checkApiRateLimit } from "@/lib/middleware/rate-limiter";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const rl = await checkApiRateLimit(ip, "crawl");
    if (!rl.allowed) {
      return Response.json(
        { error: "Too many requests", retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } }
      );
    }

    const { latitude, longitude, radius_miles } = await request.json();

    if (latitude == null || longitude == null) {
      return Response.json({ error: "latitude and longitude are required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey || apiKey === "placeholder") {
      return Response.json({ error: "Google Places API not configured" }, { status: 503 });
    }

    const radiusMeters = Math.round((radius_miles || 0.5) * 1609.34);
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radiusMeters}&type=restaurant&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      return Response.json({ error: "Google Places API failed" }, { status: 502 });
    }

    const data = await res.json();
    const places = data.results || [];

    const { menuCrawlQueue } = await import("@/../workers/queues");

    // Also lookup Yelp business IDs for each restaurant
    const yelpKey = process.env.YELP_API_KEY;

    let queued = 0;
    for (const place of places) {
      let yelpBusinessId: string | null = null;

      // Auto-lookup Yelp business ID using Yelp Business Match API
      if (yelpKey && yelpKey !== "placeholder") {
        try {
          const yelpRes = await fetch(
            `https://api.yelp.com/v3/businesses/matches?name=${encodeURIComponent(place.name)}&address1=${encodeURIComponent(place.vicinity || "")}&city=New York&state=NY&country=US&limit=1`,
            { headers: { Authorization: `Bearer ${yelpKey}` } }
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
        { googlePlaceId: place.place_id, yelpBusinessId },
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
}
