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
      <Card className="overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-md">
        {dish.photo_url ? (
          <div className="aspect-[16/10] w-full bg-muted overflow-hidden relative group">
            <Image
              src={dish.photo_url}
              alt={dish.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {/* Rating overlay on photo */}
            {dish.rating != null && (
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-1.5 py-0.5 rounded-md">
                {dish.rating.toFixed(1)}
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-[16/10] w-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
            No photo
          </div>
        )}
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{dish.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{dish.restaurant_name}</p>
            </div>
            <ConfidenceDot confidence={dish.macro_confidence} source={dish.macro_source} />
          </div>

          <MacroBar {...dish.macros} highlight={dish.highlight} compact />

          <div className="flex items-center gap-2 flex-wrap">
            {dish.distance_miles != null && (
              <span className="text-[11px] text-muted-foreground font-mono tabular-nums">{dish.distance_miles.toFixed(1)} mi</span>
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
