export interface RawMenuItem {
  name: string;
  description: string;
  price: string | null;
  category: string | null;
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
