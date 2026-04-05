export interface RawMenuItem {
  name: string;
  description: string;
  price: string | null;
  category: string | null;
  photoUrl?: string | null;
  /**
   * Source tag for elevated-confidence items.
   * "compliance_page" — items parsed from a restaurant's statutory allergen or
   *   nutrition disclosure page (e.g., California SB 478 / EU FIC compliance).
   *   These carry the highest dietary flag confidence (0.95) because the
   *   restaurant is legally obligated to be accurate.
   */
  source?: "compliance_page" | "menu";
  /** Original item name before cleanDishName() strips footnote markers */
  nameOriginal?: string;
  /** Calorie count extracted directly from menu HTML/photo */
  menuCalories?: number;
  /** Protein (g) extracted directly from menu HTML/photo */
  menuProteinG?: number;
  /** Carbs (g) extracted directly from menu HTML/photo */
  menuCarbsG?: number;
  /** Fat (g) extracted directly from menu HTML/photo */
  menuFatG?: number;
  /** Allergens listed on the menu for this item (e.g., ["nuts", "dairy"]) */
  menuAllergens?: string[];
  /** Dietary tags from menu annotations (e.g., ["V", "GF"]) */
  menuDietaryTags?: string[];
  /** Raw ingredients string if listed on the menu */
  menuIngredients?: string;
}

export interface AnalyzedDish {
  dish_name: string;
  ingredients_parsed: { name: string; is_primary: boolean }[];
  dietary_flags: {
    vegan: boolean | null;
    vegetarian: boolean | null;
    gluten_free: boolean | null;
    dairy_free: boolean | null;
    nut_free: boolean | null;
    halal: boolean | null;
    kosher: boolean | null;
    /** true when the restaurant explicitly labels this dish as GLP-1 Friendly */
    glp1_labeled?: boolean;
  };
  dietary_confidence: number;
  dietary_warnings: string[];
}

export interface MenuSourceStrategy {
  name: string;
  priority: number;
  fetch(restaurant: RestaurantInfo): Promise<RawMenuItem[] | null>;
}

export interface RestaurantInfo {
  googlePlaceId: string;
  name: string;
  address: string;
  websiteUrl: string | null;
  latitude: number;
  longitude: number;
}

export interface CrawlResult {
  restaurantId: string;
  restaurantName: string;
  menuSource: string;
  dishesFound: number;
  dishesAnalyzed: number;
  photosQueued: number;
}
