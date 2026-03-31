"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MacroBar } from "@/components/macro-bar";
import { ConfidenceDot } from "@/components/confidence-dot";
import { WaitBadge } from "@/components/wait-badge";

export interface DishCardData {
  id: string;
  name: string;
  restaurant_name: string;
  photo_url?: string | null;
  macros: {
    calories: { min: number | null; max: number | null } | null;
    protein_g: { min: number | null; max: number | null } | null;
    carbs_g: { min: number | null; max: number | null } | null;
    fat_g: { min: number | null; max: number | null } | null;
  };
  macro_confidence: number | null;
  macro_source: string | null;
  rating: number | null;
  distance_miles?: number | null;
  wait_minutes?: number | null;
  delivery_platforms?: string[];
  highlight?: "protein" | "calories" | "carbs" | "fat";
}

export function DishCard({ dish }: { dish: DishCardData }) {
  return (
    <Link href={`/dish/${dish.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        {dish.photo_url && (
          <div className="aspect-video w-full bg-muted overflow-hidden relative">
            <Image
              src={dish.photo_url}
              alt={dish.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
          </div>
        )}
        {!dish.photo_url && (
          <div className="aspect-video w-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
            No photo
          </div>
        )}
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{dish.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{dish.restaurant_name}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ConfidenceDot confidence={dish.macro_confidence} source={dish.macro_source} />
              {dish.rating != null && (
                <span className="text-xs font-medium">{dish.rating.toFixed(1)}</span>
              )}
            </div>
          </div>

          <MacroBar {...dish.macros} highlight={dish.highlight} />

          <div className="flex items-center gap-2 flex-wrap">
            {dish.distance_miles != null && (
              <span className="text-xs text-muted-foreground">{dish.distance_miles.toFixed(1)} mi</span>
            )}
            <WaitBadge minutes={dish.wait_minutes ?? null} />
            {dish.delivery_platforms?.map((p) => (
              <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">
                {p}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
