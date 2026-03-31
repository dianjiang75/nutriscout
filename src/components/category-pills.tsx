"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";

const CATEGORIES = [
  { id: "thai", label: "Thai", icon: "fluent-emoji-flat:curry-rice" },
  { id: "japanese", label: "Japanese", icon: "fluent-emoji-flat:sushi" },
  { id: "italian", label: "Italian", icon: "fluent-emoji-flat:spaghetti" },
  { id: "mexican", label: "Mexican", icon: "fluent-emoji-flat:taco" },
  { id: "indian", label: "Indian", icon: "fluent-emoji-flat:curry-rice" },
  { id: "chinese", label: "Chinese", icon: "fluent-emoji-flat:dumpling" },
  { id: "korean", label: "Korean", icon: "fluent-emoji-flat:bento-box" },
  { id: "mediterranean", label: "Mediterranean", icon: "fluent-emoji-flat:green-salad" },
  { id: "american", label: "American", icon: "fluent-emoji-flat:hamburger" },
  { id: "vietnamese", label: "Vietnamese", icon: "fluent-emoji-flat:steaming-bowl" },
  { id: "lunch", label: "Lunch", icon: "fluent-emoji-flat:fork-and-knife" },
  { id: "dinner", label: "Dinner", icon: "fluent-emoji-flat:fork-and-knife-with-plate" },
  { id: "breakfast", label: "Breakfast", icon: "fluent-emoji-flat:pancakes" },
  { id: "pizza", label: "Pizza", icon: "fluent-emoji-flat:pizza" },
  { id: "sushi", label: "Sushi", icon: "fluent-emoji-flat:sushi" },
  { id: "bowls", label: "Bowls", icon: "fluent-emoji-flat:bowl-with-spoon" },
  { id: "salads", label: "Salads", icon: "fluent-emoji-flat:green-salad" },
  { id: "sandwiches", label: "Sandwiches", icon: "fluent-emoji-flat:sandwich" },
  { id: "burgers", label: "Burgers", icon: "fluent-emoji-flat:hamburger" },
  { id: "noodles", label: "Noodles", icon: "fluent-emoji-flat:steaming-bowl" },
  { id: "soup", label: "Soup", icon: "fluent-emoji-flat:pot-of-food" },
  { id: "tacos", label: "Tacos", icon: "fluent-emoji-flat:taco" },
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
          <div className="w-14 h-14 rounded-2xl bg-card border border-border/40 shadow-sm flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-md group-active:scale-95">
            <Icon icon={cat.icon} width={32} height={32} />
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
