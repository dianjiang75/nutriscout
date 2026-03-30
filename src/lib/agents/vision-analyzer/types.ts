export interface IngredientEstimate {
  name: string;
  estimated_grams: number;
  is_primary: boolean;
  usda_match?: string;
  macros?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
}

export interface MacroRange {
  min: number;
  max: number;
  best_estimate: number;
}

export interface VisionAnalysis {
  dish_name: string;
  cuisine_type: string;
  ingredients: IngredientEstimate[];
  preparation_method: string;
  macros: {
    calories: MacroRange;
    protein_g: MacroRange;
    carbs_g: MacroRange;
    fat_g: MacroRange;
  };
  confidence: number;
  usda_references: string[];
}

export interface EnsembleAnalysis extends VisionAnalysis {
  num_photos_analyzed: number;
  outlier_indices: number[];
}

export interface ClaudeVisionResponse {
  dish_name: string;
  cuisine_type: string;
  ingredients: {
    name: string;
    estimated_grams: number;
    is_primary: boolean;
  }[];
  total_portion_grams: number;
  preparation_method: string;
  confidence: number;
}

export interface BatchJob {
  dishId: string;
  imageUrl: string;
}
