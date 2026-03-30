// USDA FoodData Central API types

export interface USDASearchResponse {
  totalHits: number;
  currentPage: number;
  totalPages: number;
  foods: USDAFoodItem[];
}

export interface USDAFoodItem {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  score?: number;
  foodNutrients: USDAFoodNutrientSearch[];
}

export interface USDAFoodNutrientSearch {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  unitName: string;
  value: number;
}

export interface USDAFoodDetail {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: USDAFoodNutrientDetail[];
  foodPortions?: USDAFoodPortion[];
}

export interface USDAFoodNutrientDetail {
  nutrient: {
    id: number;
    number: string;
    name: string;
    unitName: string;
  };
  amount?: number;
}

export interface USDAFoodPortion {
  id: number;
  gramWeight: number;
  amount: number;
  measureUnit: {
    name: string;
    abbreviation: string;
  };
  portionDescription?: string;
}

export interface USDAMacroEstimate {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  serving_description: string;
  confidence: number;
  usda_fdc_id: number;
}

// USDA nutrient IDs
export const NUTRIENT_IDS = {
  ENERGY: 1008,
  PROTEIN: 1003,
  CARBS: 1005,
  FAT: 1004,
  FIBER: 1079,
} as const;
