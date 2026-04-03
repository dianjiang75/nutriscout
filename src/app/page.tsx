"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ChefHat, Store, Sparkles, MapPin, Star, Clock, Heart } from "lucide-react";
import { SearchTypeahead } from "@/components/search-typeahead";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DishCard, type DishCardData } from "@/components/dish-card";
import { BottomNav, type NavTab } from "@/components/bottom-nav";
import { CategoryPills } from "@/components/category-pills";
import { FilterDrawer, type FilterState } from "@/components/filter-drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import { RestaurantCard, type RestaurantCardData } from "@/components/restaurant-card";

const SORT_OPTIONS = [
  { value: "macro_match", label: "Best Match", icon: Sparkles },
  { value: "distance", label: "Nearest", icon: MapPin },
  { value: "rating", label: "Top Rated", icon: Star },
  { value: "wait_time", label: "Shortest Wait", icon: Clock },
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
        const raw = await res.json();
        const data = raw.data || raw; // Handle both {data: {dishes}} and {dishes} formats
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: DishCardData[] = (data.dishes || []).map((d: any) => {
          const rest = d.restaurant || {};
          return {
            id: d.id,
            name: d.name,
            description: d.description,
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
            warnings: d.warnings || [],
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
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-2.5 space-y-2.5">
          {/* Search row */}
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black tracking-tight shrink-0">
              <span className="text-primary">Food</span><span className="bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent">Claw</span>
            </h1>
            <SearchTypeahead
              value={search.q}
              onChange={(v) => handleSearchInput(v)}
              onSelect={(v) => {
                setSearch((s) => ({ ...s, q: v, offset: 0 }));
              }}
              placeholder={activeTab === "dishes" ? "What are you craving?" : "Find a restaurant..."}
            />
            <FilterDrawer filters={filters} onChange={setFilters} />
            <NotificationBell />
            <Link href="/favorites" className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center hover:bg-rose-500/20 transition-colors" aria-label="Favorites">
              <Heart className="w-4 h-4 text-rose-500" />
            </Link>
            <ThemeToggle />
            <Link href="/profile">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm hover:bg-primary/20 transition-colors">
                P
              </div>
            </Link>
          </div>

          {/* Category pills — inline filters */}
          <CategoryPills
            selected={search.categories}
            onSelect={(cats) => setSearch((s) => ({ ...s, categories: cats, offset: 0 }))}
          />

          {/* Sort options (dishes only) */}
          {activeTab === "dishes" && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
              {SORT_OPTIONS.map((opt) => {
                const SortIcon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    aria-label={`Sort by ${opt.label}`}
                    aria-pressed={search.sort === opt.value}
                    className={`inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 min-h-[44px] rounded-full transition-all duration-200 whitespace-nowrap font-semibold ${
                      search.sort === opt.value
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    onClick={() => setSearch((s) => ({ ...s, sort: opt.value, offset: 0 }))}
                  >
                    <SortIcon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-5 space-y-6">
        {activeTab === "dishes" && (
          <DishesView
            dishes={dishes}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            sortBy={search.sort}
            searchQuery={search.q}
          />
        )}

        {activeTab === "restaurants" && (
          <RestaurantsView
            restaurants={restaurants}
            loading={loading}
          />
        )}

        {activeTab === "cook" && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
              <ChefHat className="w-10 h-10 text-orange-500" />
            </div>
            <div>
              <p className="text-lg font-bold">Cook It Myself</p>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
                Found a dish you love? Get the recipe with exact macros tailored to your dietary needs. AI generates step-by-step instructions.
              </p>
            </div>
            <div className="grid gap-3 text-left w-full max-w-xs">
              {[
                { icon: "🎯", text: "Macro-matched recipes from any dish" },
                { icon: "🔄", text: "Ingredient swaps for dietary needs" },
                { icon: "📊", text: "Exact nutrition per serving" },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-2.5 text-sm">
                  <span className="text-base shrink-0">{item.icon}</span>
                  <span className="text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
            <Link href="/waitlist">
              <Button className="mt-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold px-6">
                Join Waitlist for Early Access
              </Button>
            </Link>
            <p className="text-[11px] text-muted-foreground">
              Premium feature. Free during beta for waitlist members.
            </p>
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
  sortBy,
  searchQuery,
}: {
  dishes: DishCardData[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  sortBy?: string;
  searchQuery?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingTriggeredRef = useRef(false);

  // Reset the guard when loading finishes
  useEffect(() => {
    if (!loading) {
      loadingTriggeredRef.current = false;
    }
  }, [loading]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingTriggeredRef.current) {
          loadingTriggeredRef.current = true;
          onLoadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (loading && dishes.length === 0) {
    return (
      <div className="space-y-6">
        {/* Carousel skeleton */}
        <div>
          <div className="h-4 w-36 rounded skeleton-shimmer mb-3" />
          <div className="flex gap-3 overflow-hidden -mx-4 px-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`cs-${i}`} className="w-[280px] shrink-0 rounded-2xl overflow-hidden border border-border/30">
                <div className="aspect-[3/2] w-full skeleton-shimmer" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 rounded skeleton-shimmer" />
                  <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                  <div className="h-1.5 w-full rounded-full skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`gs-${i}`} className="rounded-2xl overflow-hidden border border-border/30">
              <div className="aspect-[3/2] w-full skeleton-shimmer" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 rounded skeleton-shimmer" />
                <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                <div className="h-1.5 w-full rounded-full skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (dishes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-muted/80 flex items-center justify-center mb-4">
          <span className="text-3xl">🍽️</span>
        </div>
        <p className="text-base font-bold">No dishes found</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
          Try broadening your search, removing some dietary filters, or expanding the radius.
        </p>
      </div>
    );
  }

  // Show curated carousels only on default browse (Best Match, no search)
  const showCarousels = sortBy === "macro_match" && !searchQuery?.trim();

  const topRated = showCarousels
    ? [...dishes].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8)
    : [];
  const highProtein = showCarousels
    ? [...dishes].sort((a, b) => avg(b.macros.protein_g) - avg(a.macros.protein_g)).slice(0, 8)
    : [];

  // Sort label for non-default sorts
  const sortLabels: Record<string, string> = {
    distance: "📍 Nearest First",
    rating: "⭐ Top Rated",
    wait_time: "⏱ Shortest Wait",
  };

  return (
    <div className="space-y-6">
      {/* Sort label when not on default Best Match */}
      {sortBy && sortBy !== "macro_match" && sortLabels[sortBy] && (
        <h2 className="text-base font-bold flex items-center gap-2">
          {sortLabels[sortBy]}
        </h2>
      )}

      {/* Horizontal carousels only on default browse (Best Match, no search) */}
      {showCarousels && topRated.length > 0 && (
        <>
          {/* Top Rated carousel */}
          <section>
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <span className="text-amber-500">★</span> Top Rated Near You
            </h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 snap-x snap-mandatory">
              {topRated.map((dish) => (
                <div key={`top-${dish.id}`} className="w-[280px] shrink-0 snap-start">
                  <DishCard dish={dish} />
                </div>
              ))}
            </div>
          </section>

          {/* High Protein carousel */}
          <section>
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <span className="text-indigo-500">💪</span> High Protein
            </h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 snap-x snap-mandatory">
              {highProtein.map((dish) => (
                <div key={`hp-${dish.id}`} className="w-[280px] shrink-0 snap-start">
                  <DishCard dish={dish} />
                </div>
              ))}
            </div>
          </section>

          {/* Section divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">All Dishes</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>
        </>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 gap-3">
        {dishes.map((dish) => (
          <DishCard key={dish.id} dish={dish} />
        ))}
      </div>
      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading && dishes.length > 0 && (
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          )}
        </div>
      )}
    </div>
  );
}

function avg(range: { min: number | null; max: number | null } | null): number {
  if (!range || range.min == null || range.max == null) return 0;
  return (range.min + range.max) / 2;
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
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Store className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold">No restaurants found</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Try expanding your search radius, removing cuisine filters, or searching in a different area.
        </p>
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
