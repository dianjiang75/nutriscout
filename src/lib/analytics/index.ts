/**
 * Lightweight analytics tracker.
 * Sends events to a configurable endpoint. Falls back to console in dev.
 * Swap the endpoint for PostHog/Mixpanel/Amplitude when ready.
 */

type EventName =
  | "search"
  | "dish_view"
  | "restaurant_view"
  | "favorite_toggle"
  | "filter_change"
  | "signup"
  | "login"
  | "logout"
  | "category_click"
  | "load_more"
  | "photo_click";

interface AnalyticsEvent {
  event: EventName;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

const ANALYTICS_ENDPOINT = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;

export function track(event: EventName, properties?: Record<string, unknown>) {
  const payload: AnalyticsEvent = {
    event,
    properties: {
      ...properties,
      url: typeof window !== "undefined" ? window.location.pathname : undefined,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
    },
    timestamp: new Date().toISOString(),
  };

  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", payload.event, payload.properties);
    return;
  }

  // Fire-and-forget — never block the UI
  if (ANALYTICS_ENDPOINT) {
    fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }
}
