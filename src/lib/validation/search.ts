import { z } from "zod";

const DIETARY_OPTIONS = [
  "vegan", "vegetarian", "gluten_free", "halal", "kosher",
  "dairy_free", "nut_free", "pescatarian", "keto", "paleo",
] as const;

const NUTRITIONAL_GOALS = [
  "max_protein", "min_calories", "min_fat", "min_carbs", "balanced",
] as const;

const SORT_OPTIONS = [
  "macro_match", "distance", "rating", "wait_time",
] as const;

export const searchParamsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(0.1).max(50).default(2),
  diet: z.string().max(200).default(""),
  goal: z.enum(NUTRITIONAL_GOALS).optional(),
  calorie_limit: z.coerce.number().int().min(0).max(10000).optional(),
  calories_max: z.coerce.number().int().min(0).max(10000).optional(), // alias for calorie_limit
  protein_min: z.coerce.number().int().min(0).max(500).optional(),
  cuisines: z.string().max(500).default(""),
  max_wait: z.coerce.number().int().min(0).max(180).optional(),
  delivery: z.enum(["true", "false"]).default("false"),
  sort: z.enum(SORT_OPTIONS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  q: z.string().max(200).default(""),
  categories: z.string().max(500).default(""),
  category: z.string().max(500).default(""), // alias for categories
  allergens: z.string().max(500).default(""),
});

export type ValidatedSearchParams = z.infer<typeof searchParamsSchema>;

/**
 * Parse and validate search params from a URL.
 * Returns validated data or a descriptive error message.
 */
export function validateSearchParams(searchParams: URLSearchParams) {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (searchParamsSchema.shape[key as keyof typeof searchParamsSchema.shape]) {
      raw[key] = value;
    }
  }

  return searchParamsSchema.safeParse(raw);
}

export { DIETARY_OPTIONS };
