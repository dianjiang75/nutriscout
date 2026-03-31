"use client";

import Link from "next/link";
import {
  Pizza,
  Soup,
  Sandwich,
  Beef,
  Salad,
  CookingPot,
  Coffee,
  UtensilsCrossed,
  Fish,
  Flame,
  Wheat,
  Leaf,
  Cherry,
  Sun,
  Moon,
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORIES = [
  // Cuisine types
  { id: "thai", label: "Thai", type: "cuisine" },
  { id: "japanese", label: "Japanese", type: "cuisine" },
  { id: "italian", label: "Italian", type: "cuisine" },
  { id: "mexican", label: "Mexican", type: "cuisine" },
  { id: "indian", label: "Indian", type: "cuisine" },
  { id: "chinese", label: "Chinese", type: "cuisine" },
  { id: "korean", label: "Korean", type: "cuisine" },
  { id: "mediterranean", label: "Mediterranean", type: "cuisine" },
  { id: "american", label: "American", type: "cuisine" },
  { id: "vietnamese", label: "Vietnamese", type: "cuisine" },
  // Meal / dish categories
  { id: "lunch", label: "Lunch", type: "meal" },
  { id: "dinner", label: "Dinner", type: "meal" },
  { id: "breakfast", label: "Breakfast", type: "meal" },
  { id: "pizza", label: "Pizza", type: "meal" },
  { id: "sushi", label: "Sushi", type: "meal" },
  { id: "bowls", label: "Bowls", type: "meal" },
  { id: "salads", label: "Salads", type: "meal" },
  { id: "sandwiches", label: "Sandwiches", type: "meal" },
  { id: "burgers", label: "Burgers", type: "meal" },
  { id: "noodles", label: "Noodles", type: "meal" },
  { id: "soup", label: "Soup", type: "meal" },
  { id: "tacos", label: "Tacos", type: "meal" },
] as const;

// Inline SVG icons for cuisines (simple, geometric, DoorDash-style)
function ThaiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14c0-4 3-8 6-10 3 2 6 6 6 10" />
      <path d="M7 14c0-2 1.5-4 3-5.5 1.5 1.5 3 3.5 3 5.5" />
      <line x1="10" y1="14" x2="10" y2="18" />
    </svg>
  );
}

function JapaneseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="6" />
      <path d="M7 10c0-1.5 1.3-3 3-3s3 1.5 3 3" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}

function MexicanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h14" />
      <path d="M5 12c0-4 2.2-7 5-7s5 3 5 7" />
      <path d="M6 12v3c0 1 1.8 2 4 2s4-1 4-2v-3" />
    </svg>
  );
}

function IndianIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="10" cy="12" rx="6" ry="4" />
      <path d="M6 12V9c0-2.2 1.8-4 4-4s4 1.8 4 4v3" />
      <path d="M10 5V3" />
      <path d="M8 6l-1-2" />
      <path d="M12 6l1-2" />
    </svg>
  );
}

function ChineseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h12" />
      <path d="M6 8l-1 8h10l-1-8" />
      <path d="M8 5c0-1 .9-2 2-2s2 1 2 2" />
      <line x1="10" y1="8" x2="10" y2="13" />
    </svg>
  );
}

function KoreanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M5 10c2.8 0 4.2-3 5-3s2.2 3 5 3" />
      <path d="M5 10c2.8 0 4.2 3 5 3s2.2-3 5-3" />
    </svg>
  );
}

function MediterraneanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="10" cy="12" rx="4" ry="5" />
      <path d="M10 7V3" />
      <path d="M7 5c1-1 2-1.5 3-1.5s2 .5 3 1.5" />
      <path d="M8 4c.6-.8 1.2-1 2-1s1.4.2 2 1" />
    </svg>
  );
}

function AmericanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h12l-.5 2H4.5z" />
      <ellipse cx="10" cy="11" rx="6" ry="1.5" />
      <path d="M5 11c0 2 2.2 4 5 4s5-2 5-4" />
      <path d="M5 8c0-1 2.2-3 5-3s5 2 5 3" />
    </svg>
  );
}

function VietnameseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13c0-3 2.7-8 6-8s6 5 6 8" />
      <line x1="3" y1="13" x2="17" y2="13" />
      <path d="M8 9c.5-1 1.2-1.5 2-1.5s1.5.5 2 1.5" />
      <path d="M7 11h6" />
    </svg>
  );
}

function TacoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13c0-5 3.1-9 7-9s7 4 7 9" />
      <path d="M5 13c.5-1.5 2.3-3 5-3s4.5 1.5 5 3" />
      <line x1="3" y1="13" x2="17" y2="13" />
    </svg>
  );
}

// Map categories to icons
const ICON_MAP: Record<string, LucideIcon | (({ className }: { className?: string }) => React.ReactNode)> = {
  thai: ThaiIcon,
  japanese: JapaneseIcon,
  italian: Pizza,
  mexican: MexicanIcon,
  indian: IndianIcon,
  chinese: ChineseIcon,
  korean: KoreanIcon,
  mediterranean: MediterraneanIcon,
  american: AmericanIcon,
  vietnamese: VietnameseIcon,
  lunch: Sun,
  dinner: Moon,
  breakfast: Coffee,
  pizza: Pizza,
  sushi: Fish,
  bowls: CookingPot,
  salads: Salad,
  sandwiches: Sandwich,
  burgers: Beef,
  noodles: Wheat,
  soup: Soup,
  tacos: TacoIcon,
};

// Color palette for category circles
const ICON_COLORS: Record<string, { bg: string; fg: string }> = {
  thai: { bg: "bg-orange-100 dark:bg-orange-950/40", fg: "text-orange-600 dark:text-orange-400" },
  japanese: { bg: "bg-red-100 dark:bg-red-950/40", fg: "text-red-600 dark:text-red-400" },
  italian: { bg: "bg-green-100 dark:bg-green-950/40", fg: "text-green-600 dark:text-green-400" },
  mexican: { bg: "bg-amber-100 dark:bg-amber-950/40", fg: "text-amber-600 dark:text-amber-400" },
  indian: { bg: "bg-yellow-100 dark:bg-yellow-950/40", fg: "text-yellow-700 dark:text-yellow-400" },
  chinese: { bg: "bg-rose-100 dark:bg-rose-950/40", fg: "text-rose-600 dark:text-rose-400" },
  korean: { bg: "bg-pink-100 dark:bg-pink-950/40", fg: "text-pink-600 dark:text-pink-400" },
  mediterranean: { bg: "bg-emerald-100 dark:bg-emerald-950/40", fg: "text-emerald-600 dark:text-emerald-400" },
  american: { bg: "bg-blue-100 dark:bg-blue-950/40", fg: "text-blue-600 dark:text-blue-400" },
  vietnamese: { bg: "bg-lime-100 dark:bg-lime-950/40", fg: "text-lime-700 dark:text-lime-400" },
  lunch: { bg: "bg-sky-100 dark:bg-sky-950/40", fg: "text-sky-600 dark:text-sky-400" },
  dinner: { bg: "bg-indigo-100 dark:bg-indigo-950/40", fg: "text-indigo-600 dark:text-indigo-400" },
  breakfast: { bg: "bg-amber-100 dark:bg-amber-950/40", fg: "text-amber-700 dark:text-amber-400" },
  pizza: { bg: "bg-red-100 dark:bg-red-950/40", fg: "text-red-500 dark:text-red-400" },
  sushi: { bg: "bg-teal-100 dark:bg-teal-950/40", fg: "text-teal-600 dark:text-teal-400" },
  bowls: { bg: "bg-violet-100 dark:bg-violet-950/40", fg: "text-violet-600 dark:text-violet-400" },
  salads: { bg: "bg-green-100 dark:bg-green-950/40", fg: "text-green-600 dark:text-green-400" },
  sandwiches: { bg: "bg-orange-100 dark:bg-orange-950/40", fg: "text-orange-600 dark:text-orange-400" },
  burgers: { bg: "bg-amber-100 dark:bg-amber-950/40", fg: "text-amber-700 dark:text-amber-400" },
  noodles: { bg: "bg-yellow-100 dark:bg-yellow-950/40", fg: "text-yellow-700 dark:text-yellow-400" },
  soup: { bg: "bg-cyan-100 dark:bg-cyan-950/40", fg: "text-cyan-600 dark:text-cyan-400" },
  tacos: { bg: "bg-orange-100 dark:bg-orange-950/40", fg: "text-orange-600 dark:text-orange-400" },
};

const DEFAULT_COLOR = { bg: "bg-muted", fg: "text-muted-foreground" };

export function CategoryPills() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
      {CATEGORIES.map((cat) => {
        const Icon = ICON_MAP[cat.id] || UtensilsCrossed;
        const color = ICON_COLORS[cat.id] || DEFAULT_COLOR;
        return (
          <Link
            key={cat.id}
            href={`/category/${cat.id}`}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div className={`w-14 h-14 rounded-2xl ${color.bg} flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-md group-active:scale-95`}>
              <Icon className={`w-6 h-6 ${color.fg}`} />
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
