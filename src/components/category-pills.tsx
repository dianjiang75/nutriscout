"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

interface CategoryPillsProps {
  selected?: string[];
  onSelect?: (categories: string[]) => void;
}

export function CategoryPills({ selected = [], onSelect }: CategoryPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el?.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -200 : 200;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-background/90 border border-border/50 shadow-md flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 no-scrollbar px-4 -mx-4"
      >
        {CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICON_MAP[cat.id];
          const isSelected = selected.includes(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => {
                if (onSelect) {
                  onSelect(isSelected ? selected.filter(c => c !== cat.id) : [...selected, cat.id]);
                }
              }}
              aria-pressed={isSelected}
              aria-label={`Filter by ${cat.label}`}
              className="flex flex-col items-center gap-1.5 shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl"
            >
              <div className={`w-14 h-14 rounded-2xl border shadow-sm flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-md group-active:scale-95 ${
                isSelected ? "bg-primary/10 border-primary/40 ring-2 ring-primary/20" : "bg-card border-border/40"
              }`}>
                {Icon ? (
                  <Icon className="w-9 h-9" />
                ) : (
                  <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-background/90 border border-border/50 shadow-md flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Fade edges */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none z-[5]" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-[5]" />
      )}
    </div>
  );
}

export { CATEGORIES };
