// Shared TypeScript types for NutriScout

export interface DietaryFlags {
  vegan: boolean | null;
  vegetarian: boolean | null;
  gluten_free: boolean | null;
  halal: boolean | null;
  kosher: boolean | null;
  dairy_free: boolean | null;
  nut_free: boolean | null;
}

export interface NutritionalGoals {
  priority: "max_protein" | "min_calories" | "min_fat" | "balanced";
  calorie_limit?: number;
  protein_min_g?: number;
  carbs_max_g?: number;
  fat_max_g?: number;
}

export interface MacroEstimate {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ParsedIngredient {
  name: string;
  is_primary: boolean;
}

export interface HealthCheckResponse {
  status: "healthy" | "degraded";
  checks: {
    database: "ok" | "error";
    redis: "ok" | "error";
  };
}
