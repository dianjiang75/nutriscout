import { redis } from "@/lib/cache/redis";
import { prisma } from "@/lib/db/client";
import type {
  BestTimeAnalysis,
  BestTimeLiveResponse,
  DeliveryInfo,
  FootTrafficData,
} from "./types";

const LIVE_CACHE_TTL = 15 * 60; // 15 minutes
const FORECAST_CACHE_TTL = 24 * 60 * 60; // 24 hours

/**
 * Translate busyness percentage to estimated wait minutes.
 */
export function estimateWaitMinutes(busynessPct: number): number {
  if (busynessPct <= 30) return Math.round((busynessPct / 30) * 5);
  if (busynessPct <= 50) return Math.round(5 + ((busynessPct - 30) / 20) * 10);
  if (busynessPct <= 70) return Math.round(15 + ((busynessPct - 50) / 20) * 10);
  if (busynessPct <= 85) return Math.round(25 + ((busynessPct - 70) / 15) * 15);
  return Math.round(40 + ((busynessPct - 85) / 15) * 20);
}

/**
 * Get foot traffic data for a venue via BestTime.app API.
 */
export async function getFootTraffic(
  restaurantName: string,
  address: string
): Promise<FootTrafficData> {
  const apiKey = process.env.BESTTIME_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    throw new Error("BESTTIME_API_KEY is not configured");
  }

  const cacheKey = `traffic:${restaurantName}:${address}`;

  // Check live cache
  const cachedLive = await redis.get(`${cacheKey}:live`);
  if (cachedLive) {
    return JSON.parse(cachedLive);
  }

  // Get weekly forecast (cached for 24h)
  let forecast: BestTimeAnalysis | null = null;
  const cachedForecast = await redis.get(`${cacheKey}:forecast`);

  if (cachedForecast) {
    forecast = JSON.parse(cachedForecast);
  } else {
    try {
      const forecastRes = await fetch(
        "https://besttime.app/api/v1/forecasts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key_private: apiKey,
            venue_name: restaurantName,
            venue_address: address,
          }),
        }
      );

      if (forecastRes.ok) {
        forecast = await forecastRes.json();
        await redis.set(
          `${cacheKey}:forecast`,
          JSON.stringify(forecast),
          "EX",
          FORECAST_CACHE_TTL
        );
      }
    } catch {
      // Forecast unavailable
    }
  }

  // Get live busyness
  let liveBusyness: number | null = null;
  try {
    const liveRes = await fetch(
      `https://besttime.app/api/v1/forecasts/live?api_key_private=${apiKey}&venue_name=${encodeURIComponent(restaurantName)}&venue_address=${encodeURIComponent(address)}`
    );

    if (liveRes.ok) {
      const liveData: BestTimeLiveResponse = await liveRes.json();
      if (liveData.venue_info.venue_live_busyness_available) {
        liveBusyness = liveData.venue_info.venue_live_busyness;
      }
    }
  } catch {
    // Live data unavailable
  }

  // Build response from forecast + live data
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sunday
  const currentHour = now.getHours();

  const todayForecast = forecast?.analysis?.find(
    (d) => d.day_info.day_int === dayOfWeek
  );

  const currentBusyness = liveBusyness ?? getForecastBusyness(todayForecast, currentHour);

  const peakHours = todayForecast?.busy_hours?.map((h) => ({
    start: `${h}:00`,
    end: `${h + 1}:00`,
  })) ?? [];

  const quietHours = todayForecast?.quiet_hours?.map((h) => ({
    start: `${h}:00`,
    end: `${h + 1}:00`,
  })) ?? [];

  const rawHourly = todayForecast?.hour_analysis?.map((h) => ({
    hour: h.hour,
    busyness_pct: Math.round(h.intensity_nr * 10), // BestTime uses 0-10 scale
  })) ?? [];

  // Determine if busier than usual
  const forecastedNow = getForecastBusyness(todayForecast, currentHour);
  const isBusier = liveBusyness !== null && forecastedNow !== null
    ? liveBusyness > forecastedNow
    : false;

  const result: FootTrafficData = {
    current_busyness_pct: currentBusyness ?? 0,
    is_busier_than_usual: isBusier,
    estimated_wait_minutes: currentBusyness !== null
      ? estimateWaitMinutes(currentBusyness)
      : null,
    peak_hours_today: peakHours,
    quiet_hours_today: quietHours,
    raw_hourly_forecast: rawHourly,
  };

  // Cache live result
  await redis.set(`${cacheKey}:live`, JSON.stringify(result), "EX", LIVE_CACHE_TTL);

  return result;
}

function getForecastBusyness(
  dayForecast: BestTimeAnalysis["analysis"][0] | undefined,
  hour: number
): number | null {
  if (!dayForecast) return null;
  const hourData = dayForecast.hour_analysis?.find((h) => h.hour === hour);
  return hourData ? Math.round(hourData.intensity_nr * 10) : null;
}

/**
 * Store foot traffic data in the logistics table for pattern analysis.
 */
export async function storeTrafficData(
  restaurantId: string,
  trafficData: FootTrafficData
): Promise<void> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  await prisma.restaurantLogistics.upsert({
    where: {
      restaurantId_dayOfWeek_hour: {
        restaurantId,
        dayOfWeek,
        hour,
      },
    },
    update: {
      typicalBusynessPct: trafficData.current_busyness_pct,
      estimatedWaitMinutes: trafficData.estimated_wait_minutes,
      updatedAt: now,
    },
    create: {
      restaurantId,
      dayOfWeek,
      hour,
      typicalBusynessPct: trafficData.current_busyness_pct,
      estimatedWaitMinutes: trafficData.estimated_wait_minutes,
    },
  });

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { lastTrafficUpdate: now },
  });
}

/**
 * Check delivery availability (stub — returns realistic mock data).
 *
 * Future implementation options:
 * - Option A: Unified Food Delivery API (KitchenHub, Documenu)
 * - Option B: Stealth scraping with SeleniumBase UC Mode or Camoufox
 */
export async function checkDeliveryAvailability(
  _restaurantName: string,
  _address: string
): Promise<DeliveryInfo[]> {
  // Not yet implemented — return empty array instead of fake data
  // TODO: Integrate delivery platform APIs (KitchenHub, Documenu, or direct scraping)
  return [];
}

export type { FootTrafficData, DeliveryInfo } from "./types";
