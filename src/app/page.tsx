"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DishCard, type DishCardData } from "@/components/dish-card";
import { BottomNav, type NavTab } from "@/components/bottom-nav";
import { CategoryPills } from "@/components/category-pills";
import { FilterDrawer, type FilterState } from "@/components/filter-drawer";
import { RestaurantCard, type RestaurantCardData } from "@/components/restaurant-card";

const SORT_OPTIONS = [
  { value: "macro_match", label: "Best Match" },
  { value: "distance", label: "Nearest" },
  { value: "rating", label: "Top Rated" },
  { value: "wait_time", label: "Shortest Wait" },
] as const;

interface SearchState {
  lat: number | null;
  lng: number | null;
  q: string;
  categories: string[];
  goal: string;
  sort: string;
  limit: number;
  offset: number;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<NavTab>("dishes");
  const [dishes, setDishes] = useState<DishCardData[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    diets: [],
    allergens: [],
    customRestrictions: [],
  });
  const [search, setSearch] = useState<SearchState>({
    lat: null, lng: null,
    q: "", categories: [],
    goal: "", sort: "macro_match",
    limit: 20, offset: 0,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-detect location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSearch((s) => ({ ...s, lat: pos.coords.latitude, lng: pos.coords.longitude }));
          setLocating(false);
        },
        () => {
          setSearch((s) => ({ ...s, lat: 40.7264, lng: -73.9878 }));
          setLocating(false);
        }
      );
    } else {
      setSearch((s) => ({ ...s, lat: 40.7264, lng: -73.9878 }));
      setLocating(false);
    }
  }, []);

  const fetchDishes = useCallback(async (s: SearchState, f: FilterState, append = false) => {
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
      if (s.q.trim()) params.set("q", s.q.trim());
      if (s.categories.length) params.set("categories", s.categories.join(","));
      if (f.diets.length) params.set("diet", f.diets.join(","));
      if (f.allergens.length) params.set("allergens", f.allergens.join(","));
      if (f.customRestrictions.length) params.set("custom_restrictions", f.customRestrictions.join(","));
      if (s.goal) params.set("goal", s.goal);

      const res = await fetch(`/api/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: DishCardData[] = (data.dishes || []).map((d: any) => {
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
            highlight: goalToHighlight(s.goal),
          };
        });
        setDishes(append ? (prev) => [...prev, ...items] : items);
        setHasMore(items.length >= s.limit);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRestaurants = useCallback(async (s: SearchState, f: FilterState) => {
    if (s.lat == null || s.lng == null) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: String(s.lat),
        lng: String(s.lng),
      });
      if (s.q.trim()) params.set("q", s.q.trim());
      if (s.categories.length) params.set("categories", s.categories.join(","));
      if (f.diets.length) params.set("diet", f.diets.join(","));
      if (f.allergens.length) params.set("allergens", f.allergens.join(","));

      const res = await fetch(`/api/restaurants?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRestaurants(data.restaurants || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on search/filter change
  useEffect(() => {
    if (locating || search.lat == null) return;
    if (activeTab === "dishes") {
      fetchDishes(search, filters);
    } else if (activeTab === "restaurants") {
      fetchRestaurants(search, filters);
    }
  }, [locating, search, filters, activeTab, fetchDishes, fetchRestaurants]);

  function handleSearchInput(value: string) {
    clearTimeout(debounceRef.current);
    setSearch((s) => ({ ...s, q: value }));
    debounceRef.current = setTimeout(() => {
      setSearch((s) => ({ ...s, offset: 0 }));
    }, 300);
  }

  function loadMore() {
    const next = { ...search, offset: search.offset + search.limit };
    setSearch(next);
    fetchDishes(next, filters, true);
  }

  return (
    <div className="flex flex-col min-h-screen pb-16">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2.5">
          {/* Search row */}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-ns-green shrink-0">FoodClaw</h1>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={activeTab === "dishes" ? "Search dishes... e.g. udon, pad thai" : "Search restaurants..."}
                className="h-9 text-sm pl-8"
                value={search.q}
                onChange={(e) => handleSearchInput(e.target.value)}
              />
            </div>
            <FilterDrawer filters={filters} onChange={setFilters} />
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="shrink-0 text-xs px-2">
                Profile
              </Button>
            </Link>
          </div>

          {/* Category pills — each links to its own page */}
          <CategoryPills />

          {/* Sort options (dishes only) */}
          {activeTab === "dishes" && (
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
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">
        {activeTab === "dishes" && (
          <DishesView
            dishes={dishes}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        )}

        {activeTab === "restaurants" && (
          <RestaurantsView
            restaurants={restaurants}
            loading={loading}
          />
        )}

        {activeTab === "cook" && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Cook It Myself</p>
            <p className="text-sm mt-1">Coming soon for premium users.</p>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}

function DishesView({
  dishes,
  loading,
  hasMore,
  onLoadMore,
}: {
  dishes: DishCardData[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (loading && dishes.length === 0) {
    return (
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
    );
  }

  if (dishes.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">No dishes found</p>
        <p className="text-sm mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {dishes.map((dish) => (
          <DishCard key={dish.id} dish={dish} />
        ))}
      </div>
      {hasMore && (
        <div className="text-center mt-6">
          <Button variant="outline" onClick={onLoadMore} disabled={loading}>
            {loading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </>
  );
}

function RestaurantsView({
  restaurants,
  loading,
}: {
  restaurants: RestaurantCardData[];
  loading: boolean;
}) {
  if (loading && restaurants.length === 0) {
    return (
      <div className="grid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">No restaurants found</p>
        <p className="text-sm mt-1">Try adjusting your filters or expanding your search.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {restaurants.map((r) => (
        <RestaurantCard key={r.id} restaurant={r} />
      ))}
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
