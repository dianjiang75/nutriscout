"use client";

interface MacroBarProps {
  calories: { min: number | null; max: number | null } | null;
  protein_g: { min: number | null; max: number | null } | null;
  carbs_g: { min: number | null; max: number | null } | null;
  fat_g: { min: number | null; max: number | null } | null;
  highlight?: "protein" | "calories" | "carbs" | "fat";
}

function avg(range: { min: number | null; max: number | null } | null): number {
  if (!range || range.min == null || range.max == null) return 0;
  return (range.min + range.max) / 2;
}

export function MacroBar({ calories, protein_g, carbs_g, fat_g, highlight }: MacroBarProps) {
  const cal = Math.round(avg(calories));
  const pro = Math.round(avg(protein_g));
  const carb = Math.round(avg(carbs_g));
  const fat = Math.round(avg(fat_g));
  const total = pro + carb + fat || 1;

  return (
    <div className="space-y-1">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`bg-ns-protein transition-all ${highlight === "protein" ? "opacity-100" : "opacity-70"}`}
          style={{ width: `${(pro / total) * 100}%` }}
        />
        <div
          className={`bg-ns-carbs transition-all ${highlight === "carbs" ? "opacity-100" : "opacity-70"}`}
          style={{ width: `${(carb / total) * 100}%` }}
        />
        <div
          className={`bg-ns-fat transition-all ${highlight === "fat" ? "opacity-100" : "opacity-70"}`}
          style={{ width: `${(fat / total) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {cal} cal · {pro}g protein · {carb}g carbs · {fat}g fat
      </p>
    </div>
  );
}
