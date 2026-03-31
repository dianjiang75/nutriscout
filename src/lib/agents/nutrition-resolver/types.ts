export type MacroSourceTier = "restaurant_published" | "third_party_db" | "vision_ai";

export interface NutritionData {
  calories_min: number;
  calories_max: number;
  protein_min_g: number;
  protein_max_g: number;
  carbs_min_g: number;
  carbs_max_g: number;
  fat_min_g: number;
  fat_max_g: number;
}

export interface SourceResult {
  tier: MacroSourceTier;
  confidence: number;
  sourceName: string;
  sourceUrl: string | null;
  logCount?: number; // For third-party DB entries: how many users logged this
  nutrition: NutritionData;
}

export interface CrossValidation {
  source: string;
  deviation_pct: number; // % deviation from cross-validation reference
  reference_calories: number;
}

export interface ResolvedNutrition {
  nutrition: NutritionData;
  source: SourceResult;
  crossValidation: CrossValidation | null;
}

export interface ThirdPartyEntry {
  name: string;
  brand: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  log_count: number;
  source: string;
  url: string | null;
}
