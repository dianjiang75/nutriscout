"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DishCard, type DishCardData } from "@/components/dish-card";

const SORT_OPTIONS = [
  { value: "macro_match", label: "Best Match" },
  { value: "distance", label: "Nearest" },
  { value: "rating", label: "Top Rated" },
  { value: "wait_time", label: "Shortest Wait" },
] as const;

interface SearchState {
  lat: number | null;
  lng: number | null;
  diet: string[];
  goal: string;
  sort: string;
  limit: number;
  offset: number;
}

export default function HomePage() {
  const [dishes, setDishes] = useState<DishCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState<SearchState>({
    lat: null, lng: null,
    diet: [], goal: "", sort: "macro_match",
    limit: 20, offset: 0,
  });

  // Auto-detect location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSearch((s) => ({ ...s, lat: pos.coords.latitude, lng: pos.coords.longitude }));
          setLocating(false);
        },
        () => {
          // Default to NYC East Village
          setSearch((s) => ({ ...s, lat: 40.7264, lng: -73.9878 }));
          setLocating(false);
        }
      );
    } else {
      setSearch((s) => ({ ...s, lat: 40.7264, lng: -73.9878 }));
      setLocating(false);
    }
  }, []);

  const fetchDishes = useCallback(async (s: SearchState, append = false) => {
    if (s.lat == null || s.lng == null) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: String(s.lat),
        lng: String(s.lng),
        sort: s.sort,
        limit: String(s.limit),
        offset: String(s.offset),
      });
      if (s.diet.length) params.set("diet", s.diet.join(","));
      if (s.goal) params.set("goal", s.goal);

      const res = await fetch(`/api/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        const items: DishCardData[] = (data.dishes || []).map((d: Record<string, unknown>) => ({
          id: d.id,
          name: d.name,
          restaurant_name: (d as { restaurant_name?: string }).restaurant_name || "Unknown",
          photo_url: (d as { photo_url?: string }).photo_url,
          macros: d.macros || { calories: null, protein_g: null, carbs_g: null, fat_g: null },
          macro_confidence: d.macro_confidence as number | null,
          macro_source: d.macro_source as string | null,
          rating: d.rating as number | null,
          distance_miles: d.distance_miles as number | null,
          wait_minutes: d.wait_minutes as number | null,
          delivery_platforms: (d as { delivery_platforms?: string[] }).delivery_platforms || [],
          highlight: goalToHighlight(s.goal),
        }));
        setDishes(append ? (prev) => [...prev, ...items] : items);
        setHasMore(items.length >= s.limit);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!locating && search.lat != null) {
      fetchDishes(search);
    }
  }, [locating, search, fetchDishes]);

  function toggleDiet(diet: string) {
    setSearch((s) => ({
      ...s,
      offset: 0,
      diet: s.diet.includes(diet) ? s.diet.filter((d) => d !== diet) : [...s.diet, diet],
    }));
  }

  function loadMore() {
    const next = { ...search, offset: search.offset + search.limit };
    setSearch(next);
    fetchDishes(next, true);
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-ns-green shrink-0">NutriScout</h1>
            <Input
              placeholder="Search dishes near you..."
              className="h-9 text-sm"
              readOnly
              value={search.lat ? `${search.lat.toFixed(3)}, ${search.lng?.toFixed(3)}` : "Locating..."}
            />
            <a href="/profile">
              <Button variant="ghost" size="sm" className="shrink-0 text-xs">Profile</Button>
            </a>
          </div>

          {/* Filter chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {["vegan", "vegetarian", "gluten_free", "dairy_free", "nut_free", "halal", "kosher"].map((d) => (
              <Badge
                key={d}
                variant={search.diet.includes(d) ? "default" : "outline"}
                className={`cursor-pointer text-xs whitespace-nowrap shrink-0 ${
                  search.diet.includes(d) ? "bg-ns-green hover:bg-ns-green/90" : ""
                }`}
                onClick={() => toggleDiet(d)}
              >
                {d.replace("_", "-")}
              </Badge>
            ))}
          </div>

          {/* Sort options */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ${
                  search.sort === opt.value
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:bg-muted"
                }`}
                onClick={() => setSearch((s) => ({ ...s, sort: opt.value, offset: 0 }))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Dish feed */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">
        {loading && dishes.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2.5 w-full" />
              </div>
            ))}
          </div>
        ) : dishes.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">No dishes found</p>
            <p className="text-sm mt-1">Try adjusting your filters or expanding your search radius.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {dishes.map((dish) => (
                <DishCard key={dish.id} dish={dish} />
              ))}
            </div>
            {hasMore && (
              <div className="text-center mt-6">
                <Button variant="outline" onClick={loadMore} disabled={loading}>
                  {loading ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function goalToHighlight(goal: string): DishCardData["highlight"] {
  switch (goal) {
    case "max_protein": return "protein";
    case "min_calories": return "calories";
    case "min_fat": return "fat";
    case "min_carbs": return "carbs";
    default: return undefined;
  }
}
