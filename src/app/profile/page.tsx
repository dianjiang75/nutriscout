"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

const DIETARY_OPTIONS = [
  "vegan", "vegetarian", "gluten_free", "dairy_free", "nut_free", "halal", "kosher",
] as const;

const GOAL_OPTIONS = [
  { value: "max_protein", label: "Maximize Protein" },
  { value: "min_calories", label: "Minimize Calories" },
  { value: "min_fat", label: "Minimize Fat" },
  { value: "min_carbs", label: "Minimize Carbs" },
  { value: "balanced", label: "Balanced" },
] as const;

interface UserProfile {
  id: string;
  email: string;
  name: string;
  dietary_restrictions: Record<string, boolean> | null;
  nutritional_goals: { priority?: string } | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [dietary, setDietary] = useState<string[]>([]);
  const [goal, setGoal] = useState("balanced");
  const [maxWait, setMaxWait] = useState([30]);
  const [searchRadius, setSearchRadius] = useState([2]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem("nutriscout_user_id");
    if (!userId) {
      router.push("/onboarding");
      return;
    }

    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "" }), // will use stored ID flow
    }).catch(() => {});

    // For now, just load from localStorage or a simple fetch
    setUser({ id: userId, email: "", name: "", dietary_restrictions: null, nutritional_goals: null });
  }, [router]);

  function toggleDietary(d: string) {
    setDietary((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      const flags: Record<string, boolean> = {};
      for (const d of dietary) flags[d] = true;

      await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          dietary_restrictions: flags,
          nutritional_goals: { priority: goal },
          max_wait_minutes: maxWait[0],
          search_radius_miles: searchRadius[0],
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Profile</h1>
        <a href="/">
          <Button variant="ghost" size="sm" className="text-xs">Home</Button>
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Dietary Restrictions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map((d) => (
              <Badge
                key={d}
                variant={dietary.includes(d) ? "default" : "outline"}
                className={`cursor-pointer text-xs py-1 px-2.5 ${
                  dietary.includes(d) ? "bg-ns-green hover:bg-ns-green/90" : ""
                }`}
                onClick={() => toggleDietary(d)}
              >
                {d.replace("_", " ")}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Nutritional Goal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g.value}
              className={`w-full text-left px-3 py-2 rounded-md text-sm border transition-colors ${
                goal === g.value
                  ? "border-ns-green bg-ns-green-light text-ns-green font-medium"
                  : "border-border hover:bg-muted"
              }`}
              onClick={() => setGoal(g.value)}
            >
              {g.label}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Max wait: {maxWait[0]} min</p>
            <Slider value={maxWait} onValueChange={(v) => setMaxWait(Array.isArray(v) ? [...v] : [v])} min={5} max={60} step={5} />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Search radius: {searchRadius[0]} mi</p>
            <Slider value={searchRadius} onValueChange={(v) => setSearchRadius(Array.isArray(v) ? [...v] : [v])} min={0.5} max={10} step={0.5} />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
      </Button>

      <Button
        variant="outline"
        className="w-full text-xs"
        onClick={() => {
          localStorage.removeItem("nutriscout_user_id");
          router.push("/onboarding");
        }}
      >
        Reset Profile
      </Button>
    </div>
  );
}
