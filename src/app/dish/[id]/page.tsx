"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { WaitBadge } from "@/components/wait-badge";
import { DishCard, type DishCardData } from "@/components/dish-card";
import { ExternalLink, ShieldCheck, FlaskConical, Database, Store } from "lucide-react";

interface MacroSourceDetail {
  tier: string;
  tier_label: string;
  tier_description: string;
  source_name: string | null;
  source_url: string | null;
  log_count: number | null;
  cross_validated: boolean;
  cross_validation_source: string | null;
  cross_validation_deviation_pct: number | null;
}

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
  macro_source_detail: MacroSourceDetail | null;
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

          // Fetch traffic and similar dishes in parallel
          const [tRes, sRes] = await Promise.all([
            fetch(`/api/restaurants/${data.restaurant.id}/traffic`).catch(() => null),
            fetch(`/api/dishes/${id}/similar?lat=40.7264&lng=-73.9878&limit=4`).catch(() => null),
          ]);

          if (tRes?.ok) setTraffic(await tRes.json());

          if (sRes?.ok) {
            const sData = await sRes.json();
            setSimilar((sData.dishes || []).map((d: { id: string; name: string; restaurant_name?: string; calories_min?: number; calories_max?: number; protein_max_g?: number }) => ({
              id: d.id, name: d.name,
              restaurant_name: d.restaurant_name || "",
              macros: {
                calories: d.calories_min != null ? { min: d.calories_min, max: d.calories_max } : null,
                protein_g: d.protein_max_g != null ? { min: 0, max: d.protein_max_g } : null,
                carbs_g: null, fat_g: null,
              },
              macro_confidence: null,
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
          <Image
            src={dish.photos[photoIndex]?.url}
            alt={dish.name}
            fill
            sizes="(max-width: 672px) 100vw, 672px"
            className="object-cover"
            priority
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

        {/* ─── Nutrition Facts Table ─── */}
        <NutritionFactsCard dish={dish} />

        {/* Dietary compliance */}
        {dish.dietary_flags && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(dish.dietary_flags).map(([key, val]) => {
              if (val == null) return null;
              return val ? (
                <Badge key={key} className="bg-ns-green-light text-ns-green border-ns-green/20">
                  {key.replace("_", " ")}
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

// ─── Nutrition Facts Card ─────────────────────────────────

function NutritionFactsCard({ dish }: { dish: DishDetail }) {
  const m = dish.macros;
  const source = dish.macro_source_detail;
  const confidence = dish.macro_confidence;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Nutrition Facts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {/* Nutrition table */}
        <div className="border rounded-lg overflow-hidden">
          <NutriRow label="Calories" min={m.calories.min} max={m.calories.max} unit="cal" bold />
          <NutriRow label="Protein" min={m.protein_g.min} max={m.protein_g.max} unit="g" color="text-ns-protein" />
          <NutriRow label="Carbohydrates" min={m.carbs_g.min} max={m.carbs_g.max} unit="g" color="text-ns-carbs" />
          <NutriRow label="Fat" min={m.fat_g.min} max={m.fat_g.max} unit="g" color="text-ns-fat" last />
        </div>

        {/* Source + Confidence line */}
        <div className="mt-3 space-y-1.5">
          <SourceLine source={source} confidence={confidence} />

          {/* Cross-validation info */}
          {source?.cross_validated && source.cross_validation_source && (
            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ns-green" />
              <span>
                Cross-validated against {source.cross_validation_source}
                {source.cross_validation_deviation_pct != null && (
                  <span className={source.cross_validation_deviation_pct > 25 ? "text-ns-amber" : ""}>
                    {" "}({source.cross_validation_deviation_pct.toFixed(0)}% deviation)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NutriRow({
  label,
  min,
  max,
  unit,
  bold,
  color,
  last,
}: {
  label: string;
  min: number | null;
  max: number | null;
  unit: string;
  bold?: boolean;
  color?: string;
  last?: boolean;
}) {
  const value = formatRange(min, max, unit);

  return (
    <div className={`flex justify-between items-center px-3 py-2 ${last ? "" : "border-b"} ${bold ? "bg-muted/50" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold" : ""} ${color || ""}`}>{label}</span>
      <span className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}>{value}</span>
    </div>
  );
}

function formatRange(min: number | null, max: number | null, unit: string): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null && min === max) return `${min} ${unit}`;
  if (min != null && max != null) return `${min}–${max} ${unit}`;
  if (min != null) return `${min}+ ${unit}`;
  return `≤${max} ${unit}`;
}

function SourceLine({
  source,
  confidence,
}: {
  source: MacroSourceDetail | null;
  confidence: number | null;
}) {
  const sourceIcon = getSourceIcon(source?.tier);
  const confColor = confidence != null
    ? confidence >= 0.8 ? "text-ns-green"
      : confidence >= 0.5 ? "text-ns-amber"
      : "text-ns-red"
    : "text-muted-foreground";

  const confLabel = confidence != null
    ? confidence >= 0.85 ? "High"
      : confidence >= 0.65 ? "Medium"
      : confidence >= 0.45 ? "Low"
      : "Very Low"
    : "Unknown";

  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
      {/* Source */}
      <span className="flex items-center gap-1">
        {sourceIcon}
        <span className="font-medium">Source:</span>{" "}
        {source?.source_url ? (
          <a
            href={source.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground inline-flex items-center gap-0.5"
          >
            {source.source_name || source.tier_label}
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        ) : (
          <span>{source?.source_name || source?.tier_label || "Menu analysis"}</span>
        )}
        {source?.log_count && source.log_count > 0 && (
          <span className="text-[10px]">({source.log_count} entries)</span>
        )}
      </span>

      <span className="text-border">|</span>

      {/* Confidence */}
      <span className="flex items-center gap-1">
        <span className="font-medium">Confidence:</span>
        <span className={confColor}>
          {confLabel}
          {confidence != null && ` (${Math.round(confidence * 100)}%)`}
        </span>
      </span>
    </div>
  );
}

function getSourceIcon(tier: string | undefined) {
  switch (tier) {
    case "restaurant_published": return <Store className="w-3.5 h-3.5 shrink-0" />;
    case "third_party_db":
    case "usda_match": return <Database className="w-3.5 h-3.5 shrink-0" />;
    case "vision_ai": return <FlaskConical className="w-3.5 h-3.5 shrink-0" />;
    default: return <FlaskConical className="w-3.5 h-3.5 shrink-0" />;
  }
}
