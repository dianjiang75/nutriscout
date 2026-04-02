"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { UtensilsCrossed, MapPin, Clock, Heart } from "lucide-react";
import { ConfidenceDot } from "@/components/confidence-dot";
import { useAuth } from "@/lib/auth/context";

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
  warnings?: string[];
}

function avg(range: { min: number | null; max: number | null } | null): number {
  if (!range || range.min == null || range.max == null) return 0;
  return Math.round((range.min + range.max) / 2);
}

export function DishCard({ dish, initialFavorited = false }: { dish: DishCardData; initialFavorited?: boolean }) {
  const { user } = useAuth();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [toggling, setToggling] = useState(false);

  const toggleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || toggling) return;
    setToggling(true);
    setFavorited((prev) => !prev);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish_id: dish.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setFavorited(data.saved);
      } else {
        setFavorited((prev) => !prev);
      }
    } catch {
      setFavorited((prev) => !prev);
    } finally {
      setToggling(false);
    }
  }, [user, toggling, dish.id]);

  const cal = avg(dish.macros.calories);
  const pro = avg(dish.macros.protein_g);
  const carb = avg(dish.macros.carbs_g);
  const fat = avg(dish.macros.fat_g);
  const total = pro + carb + fat || 1;

  return (
    <Link href={`/dish/${dish.id}`} className="group block">
      <div className="rounded-2xl overflow-hidden bg-card shadow-sm border border-border/50 transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1 group-active:translate-y-0 group-active:shadow-md">
        {/* Photo */}
        <div className="aspect-[3/2] w-full relative overflow-hidden">
          {dish.photo_url ? (
            <>
              <Image
                src={dish.photo_url}
                alt={dish.name}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/20 flex flex-col items-center justify-center gap-1.5">
              <UtensilsCrossed className="w-8 h-8 text-orange-300/60 dark:text-orange-700/40" />
              <span className="text-[10px] text-orange-400/50 dark:text-orange-600/40 font-medium">No photo yet</span>
            </div>
          )}

          {/* Rating badge */}
          {dish.rating != null && (
            <div className="absolute top-2.5 left-2.5 bg-white/95 dark:bg-card/95 backdrop-blur-sm text-xs font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
              <span className="text-amber-500">★</span>
              <span>{dish.rating.toFixed(1)}</span>
            </div>
          )}

          {/* Favorite heart */}
          <button
            className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center shadow-sm transition-all duration-200 hover:scale-110 active:scale-95 ${
              favorited ? "bg-red-500/90" : "bg-white/80 dark:bg-card/80"
            }`}
            onClick={toggleFavorite}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={`w-4 h-4 transition-colors ${favorited ? "text-white fill-white" : "text-muted-foreground"}`} />
          </button>

          {/* Bottom info on photo */}
          {dish.photo_url && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-2">
              {dish.distance_miles != null && (
                <span className="bg-white/90 dark:bg-card/90 backdrop-blur-sm text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                  <MapPin className="w-2.5 h-2.5" />
                  {dish.distance_miles.toFixed(1)} mi
                </span>
              )}
              {dish.wait_minutes != null && (
                <span className="bg-white/90 dark:bg-card/90 backdrop-blur-sm text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                  <Clock className="w-2.5 h-2.5" />
                  ~{dish.wait_minutes} min
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-tight truncate">{dish.name}</h3>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{dish.restaurant_name}</p>
            </div>
            <ConfidenceDot confidence={dish.macro_confidence} source={dish.macro_source} />
          </div>

          {/* Macro bar — modern pill style */}
          <div className="space-y-1.5">
            <div className="flex h-1 w-full overflow-hidden rounded-full bg-muted/60">
              <div className="bg-indigo-500 transition-all duration-500" style={{ width: `${(pro / total) * 100}%` }} />
              <div className="bg-amber-400 transition-all duration-500" style={{ width: `${(carb / total) * 100}%` }} />
              <div className="bg-rose-400 transition-all duration-500" style={{ width: `${(fat / total) * 100}%` }} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold tabular-nums">{cal} cal</span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium tabular-nums">{pro}p</span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium tabular-nums">{carb}c</span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[10px] text-rose-500 dark:text-rose-400 font-medium tabular-nums">{fat}f</span>
            </div>
          </div>

          {/* Dietary warnings */}
          {dish.warnings && dish.warnings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 rounded-md px-2 py-1">
              <p className="text-[9px] text-amber-700 dark:text-amber-400 leading-tight">
                ⚠ {dish.warnings[0]}
              </p>
            </div>
          )}

          {/* Distance/wait when no photo */}
          {!dish.photo_url && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {dish.distance_miles != null && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" /> {dish.distance_miles.toFixed(1)} mi
                </span>
              )}
              {dish.wait_minutes != null && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> ~{dish.wait_minutes} min
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
