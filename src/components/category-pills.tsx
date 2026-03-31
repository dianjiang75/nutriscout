"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";

const CATEGORIES = [
  { id: "thai", label: "Thai", icon: "noto:curry-rice" },
  { id: "japanese", label: "Japanese", icon: "noto:sushi" },
  { id: "italian", label: "Italian", icon: "noto:spaghetti" },
  { id: "mexican", label: "Mexican", icon: "noto:taco" },
  { id: "indian", label: "Indian", icon: "noto:pot-of-food" },
  { id: "chinese", label: "Chinese", icon: "noto:takeout-box" },
  { id: "korean", label: "Korean", icon: "noto:fried-shrimp" },
  { id: "mediterranean", label: "Mediterranean", icon: "noto:green-salad" },
  { id: "american", label: "American", icon: "noto:hamburger" },
  { id: "vietnamese", label: "Vietnamese", icon: "noto:steaming-bowl" },
  { id: "lunch", label: "Lunch", icon: "noto:bento-box" },
  { id: "dinner", label: "Dinner", icon: "noto:fork-and-knife-with-plate" },
  { id: "breakfast", label: "Breakfast", icon: "noto:pancakes" },
  { id: "pizza", label: "Pizza", icon: "noto:pizza" },
  { id: "sushi", label: "Sushi", icon: "noto:sushi" },
  { id: "bowls", label: "Bowls", icon: "noto:bowl-with-spoon" },
  { id: "salads", label: "Salads", icon: "noto:leafy-green" },
  { id: "sandwiches", label: "Sandwiches", icon: "noto:sandwich" },
  { id: "burgers", label: "Burgers", icon: "noto:hamburger" },
  { id: "noodles", label: "Noodles", icon: "noto:steaming-bowl" },
  { id: "soup", label: "Soup", icon: "noto:shallow-pan-of-food" },
  { id: "tacos", label: "Tacos", icon: "noto:taco" },
] as const;

export function CategoryPills() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
      {CATEGORIES.map((cat) => (
        <Link
          key={cat.id}
          href={`/category/${cat.id}`}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
        >
          <div className="w-16 h-16 rounded-2xl bg-card border border-border/40 shadow-sm flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-md group-active:scale-95">
            <Icon icon={cat.icon} width={36} height={36} />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
            {cat.label}
          </span>
        </Link>
      ))}
    </div>
  );
}

export { CATEGORIES };
