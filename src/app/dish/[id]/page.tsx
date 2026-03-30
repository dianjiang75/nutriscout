"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { WaitBadge } from "@/components/wait-badge";
import { DishCard, type DishCardData } from "@/components/dish-card";

interface DishDetail {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  dietary_flags: Record<string, boolean | null> | null;
  dietary_confidence: number | null;
  macros: {
    calories: { min: number | null; max: number | null };
    protein_g: { min: number | null; max: number | null };
    carbs_g: { min: number | null; max: number | null };
    fat_g: { min: number | null; max: number | null };
  };
  macro_confidence: number | null;
  macro_source: string | null;
  photo_count: number;
  restaurant: {
    id: string;
    name: string;
    address: string;
    google_rating: number | null;
  };
  review_summary: {
    average_rating: number | null;
    summary: string | null;
    review_count: number;
    praises: string[];
    complaints: string[];
  } | null;
  photos: { id: string; url: string; source: string }[];
}

interface TrafficData {
  busyness_pct: number | null;
  estimated_wait_minutes: number | null;
  data_available: boolean;
}

function RangeBar({ label, min, max, color, unit }: {
  label: string; min: number | null; max: number | null; color: string; unit: string;
}) {
  if (min == null || max == null) return null;
  const maxScale = label === "Calories" ? 1200 : 100;
  const leftPct = (min / maxScale) * 100;
  const widthPct = ((max - min) / maxScale) * 100;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{min}-{max} {unit}</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative">
        <div
          className={`absolute h-full rounded-full ${color}`}
          style={{ left: `${Math.min(leftPct, 95)}%`, width: `${Math.max(widthPct, 2)}%` }}
        />
      </div>
    </div>
  );
}

export default function DishDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dish, setDish] = useState<DishDetail | null>(null);
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [similar, setSimilar] = useState<DishCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/dishes/${id}`);
        if (res.ok) {
          const data = await res.json();
          setDish(data);

          // Load traffic for the restaurant
          const tRes = await fetch(`/api/restaurants/${data.restaurant.id}/traffic`);
          if (tRes.ok) setTraffic(await tRes.json());

          // Load similar dishes
          const sRes = await fetch(`/api/dishes/${id}/similar?lat=40.7264&lng=-73.9878&limit=4`);
          if (sRes.ok) {
            const sData = await sRes.json();
            setSimilar((sData.dishes || []).map((d: Record<string, unknown>) => ({
              id: d.id, name: d.name,
              restaurant_name: (d as { restaurant_name?: string }).restaurant_name || "",
              macros: d.macros || { calories: null, protein_g: null, carbs_g: null, fat_g: null },
              macro_confidence: d.macro_confidence as number | null,
              macro_source: null, rating: null,
            })));
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Skeleton className="aspect-video w-full rounded-lg" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="max-w-2xl mx-auto p-4 text-center py-20">
        <p className="text-lg font-medium text-muted-foreground">Dish not found</p>
        <Link href="/"><Button variant="outline" className="mt-4">Back to search</Button></Link>
      </div>
    );
  }

  const waitMinutes = traffic?.estimated_wait_minutes ?? null;
  const showSimilarProminent = waitMinutes != null && waitMinutes > 20 && similar.length > 0;

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Back button */}
      <div className="px-4 py-3">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">&larr; Back</Link>
      </div>

      {/* Photo carousel */}
      {dish.photos.length > 0 ? (
        <div className="relative aspect-video bg-muted overflow-hidden">
          <img
            src={dish.photos[photoIndex]?.url}
            alt={dish.name}
            className="w-full h-full object-cover"
          />
          {dish.photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {dish.photos.map((_, i) => (
                <button
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === photoIndex ? "bg-white" : "bg-white/40"
                  }`}
                  onClick={() => setPhotoIndex(i)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground">
          No photos available
        </div>
      )}

      <div className="px-4 space-y-4 mt-4">
        {/* Title area */}
        <div>
          <h1 className="text-xl font-bold">{dish.name}</h1>
          <p className="text-sm text-muted-foreground">
            {dish.restaurant.name} · {dish.category}
            {dish.price != null && ` · $${dish.price.toFixed(2)}`}
          </p>
          {dish.description && <p className="text-sm mt-1">{dish.description}</p>}
        </div>

        {/* Long wait banner */}
        {showSimilarProminent && (
          <Card className="border-ns-amber bg-ns-amber-light/50">
            <CardContent className="p-3">
              <p className="text-sm font-medium text-ns-amber">
                Long wait at {dish.restaurant.name} (~{waitMinutes} min). Try similar dishes nearby:
              </p>
            </CardContent>
          </Card>
        )}

        {showSimilarProminent && (
          <div className="grid gap-3 sm:grid-cols-2">
            {similar.slice(0, 2).map((s) => <DishCard key={s.id} dish={s} />)}
          </div>
        )}

        {/* Macro ranges */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Nutrition Estimate
              {dish.macro_confidence != null && (
                <span className={`text-xs font-normal ${
                  dish.macro_confidence >= 0.8 ? "text-ns-green" :
                  dish.macro_confidence >= 0.5 ? "text-ns-amber" : "text-ns-red"
                }`}>
                  {Math.round(dish.macro_confidence * 100)}% confidence
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Based on {dish.photo_count} photo{dish.photo_count !== 1 ? "s" : ""} analyzed
              {dish.macro_source && ` · ${dish.macro_source}`}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <RangeBar label="Calories" min={dish.macros.calories.min} max={dish.macros.calories.max} color="bg-ns-calories" unit="cal" />
            <RangeBar label="Protein" min={dish.macros.protein_g.min} max={dish.macros.protein_g.max} color="bg-ns-protein" unit="g" />
            <RangeBar label="Carbs" min={dish.macros.carbs_g.min} max={dish.macros.carbs_g.max} color="bg-ns-carbs" unit="g" />
            <RangeBar label="Fat" min={dish.macros.fat_g.min} max={dish.macros.fat_g.max} color="bg-ns-fat" unit="g" />
          </CardContent>
        </Card>

        {/* Dietary compliance */}
        {dish.dietary_flags && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(dish.dietary_flags).map(([key, val]) => {
              if (val == null) return null;
              const conf = dish.dietary_confidence;
              const confLabel = conf != null ? ` (${Math.round(conf * 100)}%)` : "";
              return val ? (
                <Badge key={key} className="bg-ns-green-light text-ns-green border-ns-green/20">
                  {key.replace("_", " ")}{confLabel}
                </Badge>
              ) : (
                <Badge key={key} variant="outline" className="text-muted-foreground">
                  not {key.replace("_", " ")}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Reviews */}
        {dish.review_summary && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Reviews</CardTitle>
              <p className="text-xs text-muted-foreground">
                Based on {dish.review_summary.review_count} reviews mentioning this dish
                {dish.review_summary.average_rating != null &&
                  ` · ${dish.review_summary.average_rating.toFixed(1)} avg`}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {dish.review_summary.summary && (
                <p className="text-sm">{dish.review_summary.summary}</p>
              )}
              {dish.review_summary.praises?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dish.review_summary.praises.map((p) => (
                    <Badge key={p} className="bg-ns-green-light text-ns-green border-ns-green/20 text-xs">{p}</Badge>
                  ))}
                </div>
              )}
              {dish.review_summary.complaints?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dish.review_summary.complaints.map((c) => (
                    <Badge key={c} className="bg-ns-red-light text-ns-red border-ns-red/20 text-xs">{c}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Restaurant info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{dish.restaurant.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{dish.restaurant.address}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              {dish.restaurant.google_rating != null && (
                <span className="text-sm">{dish.restaurant.google_rating.toFixed(1)} rating</span>
              )}
              <WaitBadge minutes={waitMinutes} />
            </div>
            <Link href={`/restaurant/${dish.restaurant.id}`}>
              <Button variant="outline" size="sm" className="text-xs">View full menu</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Similar dishes */}
        {!showSimilarProminent && similar.length > 0 && (
          <>
            <Separator />
            <h2 className="text-sm font-semibold">Similar Dishes Nearby</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {similar.map((s) => <DishCard key={s.id} dish={s} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
