/**
 * Google Places API (New) client — v2 endpoints.
 *
 * Replaces legacy `maps.googleapis.com/maps/api/place/` calls with
 * `places.googleapis.com/v1/places/` endpoints. Key differences:
 *   - API key via `X-Goog-Api-Key` header (not URL param)
 *   - Field masks required via `X-Goog-FieldMask` header
 *   - Nearby Search is POST (not GET)
 *   - Response field names changed (displayName, formattedAddress, etc.)
 *
 * @see https://developers.google.com/maps/documentation/places/web-service/op-overview
 */

import { fetchWithRetry } from "@/lib/utils/fetch-retry";

const API_KEY = () => process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

const BASE_URL = "https://places.googleapis.com/v1";

function headers(fieldMask: string) {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": API_KEY(),
    "X-Goog-FieldMask": fieldMask,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaceDetails {
  id: string;
  displayName: { text: string; languageCode?: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  websiteUri?: string;
  priceLevel?: string;
  rating?: number;
  types?: string[];
  nationalPhoneNumber?: string;
  photos?: PlacePhoto[];
  reviews?: PlaceReview[];
}

export interface PlacePhoto {
  name: string; // e.g. "places/ChIJ.../photos/AUG..."
  widthPx: number;
  heightPx: number;
  authorAttributions?: { displayName: string; uri: string }[];
}

export interface PlaceReview {
  name: string;
  relativePublishTimeDescription: string;
  rating: number;
  text?: { text: string; languageCode?: string };
  authorAttribution?: { displayName: string; uri: string };
}

export interface NearbyPlace {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  types?: string[];
}

// ---------------------------------------------------------------------------
// Place Details (New)
// ---------------------------------------------------------------------------

const DETAIL_FIELDS_CORE =
  "places.id,places.displayName,places.formattedAddress,places.location," +
  "places.websiteUri,places.priceLevel,places.rating,places.types,places.nationalPhoneNumber";

const DETAIL_FIELDS_PHOTOS = "places.photos";
const DETAIL_FIELDS_REVIEWS = "places.reviews";

export async function getPlaceDetails(
  placeId: string,
  fields: "core" | "photos" | "reviews" | string = "core"
): Promise<PlaceDetails> {
  let fieldMask: string;
  if (fields === "core") fieldMask = DETAIL_FIELDS_CORE;
  else if (fields === "photos") fieldMask = DETAIL_FIELDS_PHOTOS;
  else if (fields === "reviews") fieldMask = DETAIL_FIELDS_REVIEWS;
  else fieldMask = fields;

  // The v2 endpoint uses the place ID directly in the URL path
  const url = `${BASE_URL}/places/${encodeURIComponent(placeId)}`;

  const res = await fetchWithRetry(url, {
    headers: {
      "X-Goog-Api-Key": API_KEY(),
      "X-Goog-FieldMask": fieldMask.replace(/^places\./, "").replace(/,places\./g, ","),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Places API v2 details failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Nearby Search (New) — POST request
// ---------------------------------------------------------------------------

export async function searchNearby(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  options?: { type?: string; maxResults?: number }
): Promise<NearbyPlace[]> {
  const fieldMask =
    "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types";

  const body: Record<string, unknown> = {
    locationRestriction: {
      circle: {
        center: { latitude, longitude },
        radiusMeters: Math.min(radiusMeters, 50000), // API max 50km
      },
    },
    maxResultCount: options?.maxResults ?? 20,
  };

  if (options?.type) {
    body.includedTypes = [options.type];
  }

  const res = await fetchWithRetry(`${BASE_URL}/places:searchNearby`, {
    method: "POST",
    headers: headers(fieldMask),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Places API v2 nearbySearch failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.places ?? [];
}

// ---------------------------------------------------------------------------
// Place Photo URL (New)
// ---------------------------------------------------------------------------

/**
 * Build a photo URL from the v2 photo resource name.
 * @param photoName - e.g. "places/ChIJ.../photos/AUG..."
 * @param maxWidthPx - max width in pixels (default 1600)
 */
export function getPhotoUrl(photoName: string, maxWidthPx = 1600): string {
  return `${BASE_URL}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${API_KEY()}`;
}

// ---------------------------------------------------------------------------
// Health check — minimal API ping
// ---------------------------------------------------------------------------

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(
      `${BASE_URL}/places/ChIJN1t_tDeuEmsRUsoyG83frY4`,
      {
        headers: {
          "X-Goog-Api-Key": API_KEY(),
          "X-Goog-FieldMask": "displayName",
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Legacy → v2 field mapping helpers
// ---------------------------------------------------------------------------

/** Map legacy price_level (0-4 number) to v2 priceLevel string */
export function priceLevelToNumber(priceLevel?: string): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return priceLevel ? (map[priceLevel] ?? null) : null;
}
