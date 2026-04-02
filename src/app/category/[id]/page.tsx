"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DishCard, type DishCardData } from "@/components/dish-card";
import { CATEGORIES } from "@/components/category-pills";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDish(d: any): DishCardData {
  const rest = d.restaurant || {};
  return {
    id: d.id,
    name: d.name,
    restaurant_name: rest.name || "Unknown",
    photo_url: d.photo_url,
    macros: {
      calories: d.calories_min != null ? { min: d.calories_min, max: d.calories_max } : null,
      protein_g: d.protein_min_g != null ? { min: d.protein_min_g, max: d.protein_max_g } : null,
      carbs_g: d.carbs_min_g != null ? { min: d.carbs_min_g, max: d.carbs_max_g } : null,
      fat_g: d.fat_min_g != null ? { min: d.fat_min_g, max: d.fat_max_g } : null,
    },
    macro_confidence: d.macro_confidence ?? null,
    macro_source: d.macro_source ?? null,
    rating: d.review_summary?.average_rating ?? null,
    distance_miles: rest.distance_miles ?? null,
    wait_minutes: d.logistics?.estimated_wait_minutes ?? null,
    delivery_platforms: (d.delivery || []).map((del: { platform: string }) => del.platform).filter(Boolean),
  };
}

export default function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [topRated, setTopRated] = useState<DishCardData[]>([]);
  const [recommended, setRecommended] = useState<DishCardData[]>([]);
  const [allDishes, setAllDishes] = useState<DishCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const category = CATEGORIES.find((c) => c.id === id);
  const label = category?.label || id;

  // Get location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setCoords({ lat: 40.7264, lng: -73.9878 })
      );
    } else {
      setCoords({ lat: 40.7264, lng: -73.9878 });
    }
  }, []);

  // Fetch sectioned results
  useEffect(() => {
    if (!coords) return;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          lat: String(coords!.lat),
          lng: String(coords!.lng),
          categories: id,
        });

        // Fetch top rated (sort by rating, limit 5)
        const ratedRes = await fetch(`/api/search?${params}&sort=rating&limit=5`);
        if (ratedRes.ok) {
          const raw = await ratedRes.json();
          const data = raw.data || raw;
          setTopRated((data.dishes || []).map(mapDish));
        }

        // Fetch recommended (sort by macro_match which uses user goals, limit 10)
        const recRes = await fetch(`/api/search?${params}&sort=macro_match&limit=10`);
        if (recRes.ok) {
          const raw = await recRes.json();
          const data = raw.data || raw;
          setRecommended((data.dishes || []).map(mapDish));
        }

        // Fetch all (default sort, paginated)
        const allRes = await fetch(`/api/search?${params}&limit=20&offset=0`);
        if (allRes.ok) {
          const raw = await allRes.json();
          const data = raw.data || raw;
          const items = (data.dishes || []).map(mapDish);
          setAllDishes(items);
          setHasMore(items.length >= 20);
          setOffset(20);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [coords, id]);

  async function loadMore() {
    if (!coords) return;
    const params = new URLSearchParams({
      lat: String(coords.lat),
      lng: String(coords.lng),
      categories: id,
      limit: "20",
      offset: String(offset),
    });
    const res = await fetch(`/api/search?${params}`);
    if (res.ok) {
      const raw = await res.json();
      const data = raw.data || raw;
      const items = (data.dishes || []).map(mapDish);
      setAllDishes((prev) => [...prev, ...items]);
      setHasMore(items.length >= 20);
      setOffset((o) => o + 20);
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="px-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold">{label}</h1>
        </div>
      </div>

      <div className="px-4 space-y-6 mt-4">
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Top 5 Rated */}
            {topRated.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <span className="text-yellow-500">★</span> Top Rated
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {topRated.map((dish) => (
                    <div key={dish.id} className="w-[260px] shrink-0">
                      <DishCard dish={dish} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Top 10 Recommended */}
            {recommended.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <span className="text-ns-green">◆</span> Recommended for You
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {recommended.map((dish) => (
                    <div key={dish.id} className="w-[260px] shrink-0">
                      <DishCard dish={dish} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* All dishes */}
            <section>
              <h2 className="text-sm font-semibold mb-3">All {label} Dishes</h2>
              {allDishes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg font-medium">No dishes found</p>
                  <p className="text-sm mt-1">No {label.toLowerCase()} dishes available nearby.</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {allDishes.map((dish) => (
                      <DishCard key={dish.id} dish={dish} />
                    ))}
                  </div>
                  {hasMore && (
                    <div className="text-center mt-6">
                      <Button variant="outline" onClick={loadMore}>
                        Load more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-5 w-24 mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-[260px] shrink-0 space-y-2">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
