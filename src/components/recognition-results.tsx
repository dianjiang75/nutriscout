"use client";

import Image from "next/image";
import { MacroBar } from "@/components/macro-bar";

interface RecognitionData {
  dish_name: string;
  cuisine_type: string;
  confidence: number;
  preparation_method: string;
  macros: {
    calories: { min: number; max: number; best_estimate: number };
    protein_g: { min: number; max: number; best_estimate: number };
    carbs_g: { min: number; max: number; best_estimate: number };
    fat_g: { min: number; max: number; best_estimate: number };
  };
  ingredients: { name: string; estimated_grams: number; is_primary: boolean }[];
}

interface DbMatch {
  id: string;
  name: string;
  similarity_score: number;
  restaurant_name: string;
  distance_miles: number | null;
  calories_min: number | null;
  calories_max: number | null;
  photo_url: string | null;
}

interface RecognitionResultsProps {
  recognition: RecognitionData;
  dbMatches: DbMatch[];
}

function confidenceLabel(c: number): { text: string; color: string } {
  if (c >= 0.8) return { text: "High confidence", color: "text-green-600" };
  if (c >= 0.5) return { text: "Medium confidence", color: "text-yellow-600" };
  return { text: "Low confidence", color: "text-red-500" };
}

export function RecognitionResults({ recognition, dbMatches }: RecognitionResultsProps) {
  const conf = confidenceLabel(recognition.confidence);

  return (
    <div className="space-y-6">
      {/* AI Recognition Result */}
      <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{recognition.dish_name}</h2>
            <p className="text-sm text-muted-foreground">
              {recognition.cuisine_type} &middot; {recognition.preparation_method}
            </p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full bg-muted ${conf.color}`}>
            {Math.round(recognition.confidence * 100)}% {conf.text}
          </span>
        </div>

        {/* Macro estimates */}
        <MacroBar
          calories={{ min: recognition.macros.calories.min, max: recognition.macros.calories.max }}
          protein_g={{ min: recognition.macros.protein_g.min, max: recognition.macros.protein_g.max }}
          carbs_g={{ min: recognition.macros.carbs_g.min, max: recognition.macros.carbs_g.max }}
          fat_g={{ min: recognition.macros.fat_g.min, max: recognition.macros.fat_g.max }}
        />

        {/* Ingredients */}
        <div>
          <h3 className="text-sm font-medium mb-2">Detected Ingredients</h3>
          <div className="flex flex-wrap gap-1.5">
            {recognition.ingredients.map((ing) => (
              <span
                key={ing.name}
                className={`text-xs px-2 py-1 rounded-md ${
                  ing.is_primary
                    ? "bg-primary/10 text-primary font-medium"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {ing.name} ({ing.estimated_grams}g)
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Matching dishes in DB */}
      {dbMatches.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Similar dishes nearby
          </h3>
          <div className="space-y-2">
            {dbMatches.map((match) => (
              <a
                key={match.id}
                href={`/dish/${match.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:bg-accent transition-colors"
              >
                {match.photo_url && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted relative">
                    <Image src={match.photo_url} alt={match.name} fill sizes="48px" className="object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{match.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {match.restaurant_name}
                    {match.distance_miles != null && ` \u00b7 ${match.distance_miles} mi`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono text-muted-foreground">
                    {match.calories_min && match.calories_max
                      ? `${match.calories_min}-${match.calories_max} cal`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(match.similarity_score * 100)}% match
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
