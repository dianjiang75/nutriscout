"use client";

import { UtensilsCrossed, Store, ChefHat, Lock } from "lucide-react";

export type NavTab = "dishes" | "restaurants" | "cook";

interface BottomNavProps {
  active: NavTab;
  onChange: (tab: NavTab) => void;
}

const tabs = [
  { id: "dishes" as const, label: "Dishes", icon: UtensilsCrossed },
  { id: "restaurants" as const, label: "Restaurants", icon: Store },
  { id: "cook" as const, label: "Cook It Myself", icon: ChefHat, locked: true },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t safe-area-bottom">
      <div className="max-w-2xl mx-auto flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          const isLocked = tab.locked;

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 pt-3 transition-all duration-200 relative ${
                isLocked
                  ? "opacity-40"
                  : isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-primary rounded-full transition-all duration-300" />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? "scale-110" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
                {isLocked && (
                  <Lock className="w-2.5 h-2.5 absolute -top-1 -right-2.5 text-muted-foreground" />
                )}
              </div>
              <span className={`text-[10px] transition-all duration-200 ${isActive ? "font-bold" : "font-medium"}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
