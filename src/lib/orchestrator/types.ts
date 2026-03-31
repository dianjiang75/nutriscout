import type { DietaryFlags } from "@/types";

export interface UserSearchQuery {
  user_id?: string;
  latitude: number;
  longitude: number;
  radius_miles: number;
  dietary_restrictions: DietaryFlags;
  nutritional_goal?: "max_protein" | "min_calories" | "min_fat" | "min_carbs" | "balanced";
  calorie_limit?: number;
  protein_min_g?: number;
  cuisine_preferences?: string[];
  max_wait_minutes?: number;
  include_delivery?: boolean;
  sort_by?: "macro_match" | "distance" | "rating" | "wait_time";
  limit?: number;
  offset?: number;
  /** Text search for dish name */
  query?: string;
  /** Category filters (cuisine types or meal categories) */
  categories?: string[];
  /** Allergens to exclude */
  allergens?: string[];
}

export interface DishResult {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  price: number | null;
  category: string | null;
  calories_min: number | null;
  calories_max: number | null;
  protein_min_g: number | null;
  protein_max_g: number | null;
  carbs_min_g: number | null;
  carbs_max_g: number | null;
  fat_min_g: number | null;
  fat_max_g: number | null;
  macro_confidence: number | null;
  dietary_flags: DietaryFlags | null;
  dietary_confidence: number | null;
  restaurant: {
    id: string;
    name: string;
    address: string;
    distance_miles: number | null;
    google_rating: number | null;
    cuisine_type: string[];
  };
  review_summary: {
    average_rating: number | null;
    summary_text: string | null;
    review_count: number;
  } | null;
  logistics: {
    current_busyness_pct: number | null;
    estimated_wait_minutes: number | null;
  } | null;
  delivery: {
    available: boolean;
    platforms: string[];
  } | null;
  warnings: string[];
}

export interface SearchResults {
  dishes: DishResult[];
  total_count: number;
  cached: boolean;
}
