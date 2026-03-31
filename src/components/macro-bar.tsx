"use client";

interface MacroBarProps {
  calories: { min: number | null; max: number | null } | null;
  protein_g: { min: number | null; max: number | null } | null;
  carbs_g: { min: number | null; max: number | null } | null;
  fat_g: { min: number | null; max: number | null } | null;
  highlight?: "protein" | "calories" | "carbs" | "fat";
  compact?: boolean;
}

function avg(range: { min: number | null; max: number | null } | null): number {
  if (!range || range.min == null || range.max == null) return 0;
  return (range.min + range.max) / 2;
}

export function MacroBar({ calories, protein_g, carbs_g, fat_g, highlight, compact }: MacroBarProps) {
  const cal = Math.round(avg(calories));
  const pro = Math.round(avg(protein_g));
  const carb = Math.round(avg(carbs_g));
  const fat = Math.round(avg(fat_g));
  const total = pro + carb + fat || 1;

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="bg-ns-protein transition-all duration-300" style={{ width: `${(pro / total) * 100}%` }} />
          <div className="bg-ns-carbs transition-all duration-300" style={{ width: `${(carb / total) * 100}%` }} />
          <div className="bg-ns-fat transition-all duration-300" style={{ width: `${(fat / total) * 100}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
          {cal} cal · {pro}p · {carb}c · {fat}f
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Segmented bar */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`bg-ns-protein transition-all duration-300 ${highlight === "protein" ? "brightness-110" : ""}`}
          style={{ width: `${(pro / total) * 100}%` }}
        />
        <div
          className={`bg-ns-carbs transition-all duration-300 ${highlight === "carbs" ? "brightness-110" : ""}`}
          style={{ width: `${(carb / total) * 100}%` }}
        />
        <div
          className={`bg-ns-fat transition-all duration-300 ${highlight === "fat" ? "brightness-110" : ""}`}
          style={{ width: `${(fat / total) * 100}%` }}
        />
      </div>

      {/* Labeled breakdown */}
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-muted-foreground font-mono tabular-nums">{cal} cal</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-ns-protein" />
          <span className={`font-mono tabular-nums ${highlight === "protein" ? "text-ns-protein font-semibold" : "text-muted-foreground"}`}>{pro}g</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-ns-carbs" />
          <span className={`font-mono tabular-nums ${highlight === "carbs" ? "text-ns-carbs font-semibold" : "text-muted-foreground"}`}>{carb}g</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-ns-fat" />
          <span className={`font-mono tabular-nums ${highlight === "fat" ? "text-ns-fat font-semibold" : "text-muted-foreground"}`}>{fat}g</span>
        </span>
      </div>
    </div>
  );
}
