"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Clock } from "lucide-react";

export interface RestaurantCardData {
  id: string;
  name: string;
  address: string;
  cuisineType: string[];
  googleRating: number | null;
  distanceMiles: number | null;
  topDishes: {
    id: string;
    name: string;
    calories_min: number | null;
    calories_max: number | null;
    protein_min_g: number | null;
    protein_max_g: number | null;
  }[];
  estimatedWait: number | null;
}

export function RestaurantCard({ restaurant }: { restaurant: RestaurantCardData }) {
  return (
    <Link href={`/restaurant/${restaurant.id}`} className="block">
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{restaurant.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {restaurant.googleRating != null && (
                <span className="flex items-center gap-0.5 text-xs font-medium">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  {restaurant.googleRating.toFixed(1)}
                </span>
              )}
              {restaurant.distanceMiles != null && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {restaurant.distanceMiles.toFixed(1)} mi
                </span>
              )}
              {restaurant.estimatedWait != null && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {restaurant.estimatedWait} min
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1 flex-wrap">
          {restaurant.cuisineType.slice(0, 3).map((c) => (
            <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">
              {c}
            </Badge>
          ))}
        </div>

        {restaurant.topDishes.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Matching Dishes
            </p>
            {restaurant.topDishes.slice(0, 3).map((dish) => (
              <div key={dish.id} className="flex items-center justify-between text-xs">
                <span className="truncate mr-2">{dish.name}</span>
                <span className="text-muted-foreground shrink-0">
                  {dish.calories_min != null
                    ? `${dish.calories_min}${dish.calories_max && dish.calories_max !== dish.calories_min ? `-${dish.calories_max}` : ""} cal`
                    : ""}
                  {dish.protein_min_g != null ? ` · ${dish.protein_min_g}g P` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </Link>
  );
}
