"use client";

import Link from "next/link";
import { CATEGORY_ICON_MAP } from "@/components/food-category-icons";
import { UtensilsCrossed } from "lucide-react";

const CATEGORIES = [
  { id: "thai", label: "Thai" },
  { id: "japanese", label: "Japanese" },
  { id: "italian", label: "Italian" },
  { id: "mexican", label: "Mexican" },
  { id: "indian", label: "Indian" },
  { id: "chinese", label: "Chinese" },
  { id: "korean", label: "Korean" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "american", label: "American" },
  { id: "vietnamese", label: "Vietnamese" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "breakfast", label: "Breakfast" },
  { id: "pizza", label: "Pizza" },
  { id: "sushi", label: "Sushi" },
  { id: "bowls", label: "Bowls" },
  { id: "salads", label: "Salads" },
  { id: "sandwiches", label: "Sandwiches" },
  { id: "burgers", label: "Burgers" },
  { id: "noodles", label: "Noodles" },
  { id: "soup", label: "Soup" },
  { id: "tacos", label: "Tacos" },
] as const;

export function CategoryPills() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
      {CATEGORIES.map((cat) => {
        const Icon = CATEGORY_ICON_MAP[cat.id];
        return (
          <Link
            key={cat.id}
            href={`/category/${cat.id}`}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-card border border-border/40 shadow-sm flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-md group-active:scale-95">
              {Icon ? (
                <Icon className="w-9 h-9" />
              ) : (
                <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
              {cat.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export { CATEGORIES };
