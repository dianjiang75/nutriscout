"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Star,
  MapPin,
  Phone,
  Globe,
  Clock,
  ChevronRight,
} from "lucide-react";

interface RestaurantDetail {
  id: string;
  name: string;
  address: string;
  cuisine_type: string[];
  price_level: number | null;
  google_rating: number | null;
  phone: string | null;
  website: string | null;
  delivery: {
    platform: string;
    available: boolean;
    fee: { min: number; max: number };
    minutes: { min: number; max: number };
    url: string | null;
  }[];
}

interface MenuCategory {
  name: string;
  dishes: {
    id: string;
    name: string;
    description: string | null;
    price: number | null;
    dietary_flags: Record<string, boolean | null> | null;
    calories: { min: number; max: number } | null;
    protein_g: number | null;
  }[];
}

function PriceLevel({ level }: { level: number | null }) {
  if (level == null) return null;
  return (
    <span className="text-sm text-muted-foreground">
      {"$".repeat(level)}
      <span className="opacity-30">{"$".repeat(4 - level)}</span>
    </span>
  );
}

export default function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [rRes, mRes] = await Promise.all([
          fetch(`/api/restaurants/${id}`),
          fetch(`/api/restaurants/${id}/menu`),
        ]);
        if (rRes.ok) { const rRaw = await rRes.json(); setRestaurant(rRaw.data || rRaw); }
        if (mRes.ok) {
          const mRaw = await mRes.json();
          const data = mRaw.data || mRaw;
          setMenu(data.categories || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">Restaurant not found</p>
        <Link href="/" className="text-green-700 text-sm mt-2 inline-block">
          Back to home
        </Link>
      </div>
    );
  }

  const totalDishes = menu.reduce((sum, cat) => sum + cat.dishes.length, 0);

  const jsonLd = restaurant ? {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    address: { "@type": "PostalAddress", streetAddress: restaurant.address },
    servesCuisine: restaurant.cuisine_type,
    priceRange: "$".repeat(restaurant.price_level || 2),
    aggregateRating: restaurant.google_rating ? {
      "@type": "AggregateRating",
      ratingValue: restaurant.google_rating,
      bestRating: 5,
    } : undefined,
    telephone: restaurant.phone,
    url: restaurant.website,
  } : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-5">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      {/* Header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-xl font-bold">{restaurant.name}</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {restaurant.google_rating != null && (
            <span className="flex items-center gap-0.5 text-sm font-medium">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              {restaurant.google_rating.toFixed(1)}
            </span>
          )}
          <PriceLevel level={restaurant.price_level} />
          <span className="text-sm text-muted-foreground">
            {totalDishes} dishes
          </span>
        </div>
        <div className="flex gap-1 flex-wrap mt-2">
          {restaurant.cuisine_type.map((c) => (
            <Badge key={c} variant="outline" className="text-xs">
              {c}
            </Badge>
          ))}
        </div>
      </div>

      {/* Info row */}
      <Card>
        <CardContent className="p-3 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
            <span>{restaurant.address}</span>
          </div>
          {restaurant.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 shrink-0 text-muted-foreground" />
              <a href={`tel:${restaurant.phone}`} className="text-green-700">
                {restaurant.phone}
              </a>
            </div>
          )}
          {restaurant.website && (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 shrink-0 text-muted-foreground" />
              <a
                href={restaurant.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 truncate"
              >
                {new URL(restaurant.website).hostname}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery */}
      {restaurant.delivery.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Delivery
          </h2>
          <div className="flex gap-2">
            {restaurant.delivery
              .filter((d) => d.available)
              .map((d) => (
                <Card key={d.platform} className="flex-1">
                  <CardContent className="p-3 text-xs space-y-1">
                    <p className="font-semibold capitalize">{d.platform}</p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {d.minutes.min}–{d.minutes.max} min
                    </p>
                    <p className="text-muted-foreground">
                      ${d.fee.min.toFixed(2)}–${d.fee.max.toFixed(2)} fee
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Menu by category */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Menu
        </h2>
        {menu.map((category) => (
          <div key={category.name} className="space-y-1.5">
            <h3 className="text-sm font-semibold">{category.name}</h3>
            {category.dishes.map((dish) => (
              <Link
                key={dish.id}
                href={`/dish/${dish.id}`}
                className="block"
              >
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {dish.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {dish.calories && (
                          <span className="text-xs text-muted-foreground">
                            {dish.calories.min}
                            {dish.calories.max !== dish.calories.min
                              ? `–${dish.calories.max}`
                              : ""}{" "}
                            cal
                          </span>
                        )}
                        {dish.protein_g != null && (
                          <span className="text-xs text-muted-foreground">
                            {dish.protein_g}g protein
                          </span>
                        )}
                        {dish.price != null && (
                          <span className="text-xs font-medium">
                            ${dish.price.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {dish.dietary_flags && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {Object.entries(dish.dietary_flags)
                            .filter(([, v]) => v === true)
                            .slice(0, 3)
                            .map(([k]) => (
                              <Badge
                                key={k}
                                variant="outline"
                                className="text-[9px] px-1 py-0"
                              >
                                {k.replace(/_/g, " ")}
                              </Badge>
                            ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ))}

        {menu.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No menu available yet
          </p>
        )}
      </div>
    </div>
  );
}
