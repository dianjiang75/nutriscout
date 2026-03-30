"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

const DIETARY_OPTIONS = [
  "Vegan", "Vegetarian", "Gluten-Free", "Dairy-Free", "Nut-Free", "Halal", "Kosher",
] as const;

const GOAL_OPTIONS = [
  { value: "max_protein", label: "Maximize Protein" },
  { value: "min_calories", label: "Minimize Calories" },
  { value: "min_fat", label: "Minimize Fat" },
  { value: "min_carbs", label: "Minimize Carbs" },
  { value: "balanced", label: "Balanced / No Preference" },
] as const;

const CUISINE_OPTIONS = [
  "Thai", "Mexican", "Italian", "Indian", "Japanese", "American", "Mediterranean",
  "Chinese", "Korean", "Vietnamese", "French", "Greek",
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [dietary, setDietary] = useState<string[]>([]);
  const [goal, setGoal] = useState("balanced");
  const [calorieCap, setCalorieCap] = useState("");
  const [proteinMin, setProteinMin] = useState("");
  const [maxWait, setMaxWait] = useState([30]);
  const [searchRadius, setSearchRadius] = useState([2]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleDietary(item: string) {
    setDietary((prev) =>
      prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]
    );
  }

  function toggleCuisine(item: string) {
    setCuisines((prev) =>
      prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item]
    );
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const dietaryFlags: Record<string, boolean> = {};
      for (const d of dietary) {
        const key = d.toLowerCase().replace("-", "_");
        dietaryFlags[key] = true;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          dietary_restrictions: dietaryFlags,
          nutritional_goals: {
            priority: goal,
            ...(calorieCap && { calorie_limit: parseInt(calorieCap) }),
            ...(proteinMin && { protein_min_g: parseInt(proteinMin) }),
          },
        }),
      });

      if (res.ok) {
        const user = await res.json();
        localStorage.setItem("nutriscout_user_id", user.id);

        await fetch("/api/users/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            max_wait_minutes: maxWait[0],
            search_radius_miles: searchRadius[0],
            preferred_cuisines: cuisines,
          }),
        });

        router.push("/");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-ns-green">NutriScout</h1>
          <p className="text-sm text-muted-foreground">Discover dishes that fit your goals</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-ns-green" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <Button className="w-full" disabled={!name || !email} onClick={() => setStep(2)}>
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dietary restrictions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((d) => (
                  <Badge
                    key={d}
                    variant={dietary.includes(d) ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-1.5 px-3 ${
                      dietary.includes(d) ? "bg-ns-green hover:bg-ns-green/90" : ""
                    }`}
                    onClick={() => toggleDietary(d)}
                  >
                    {d}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Select all that apply, or skip if none.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>Continue</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nutritional goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Calorie cap (optional)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 600"
                    value={calorieCap}
                    onChange={(e) => setCalorieCap(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Protein min (optional)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 30g"
                    value={proteinMin}
                    onChange={(e) => setProteinMin(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(4)}>Continue</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm">Max wait time: {maxWait[0]} min</Label>
                <Slider value={maxWait} onValueChange={(v) => setMaxWait(Array.isArray(v) ? [...v] : [v])} min={5} max={60} step={5} />
              </div>
              <div className="space-y-3">
                <Label className="text-sm">Search radius: {searchRadius[0]} mi</Label>
                <Slider value={searchRadius} onValueChange={(v) => setSearchRadius(Array.isArray(v) ? [...v] : [v])} min={0.5} max={10} step={0.5} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Preferred cuisines</Label>
                <div className="flex flex-wrap gap-2">
                  {CUISINE_OPTIONS.map((c) => (
                    <Badge
                      key={c}
                      variant={cuisines.includes(c) ? "default" : "outline"}
                      className={`cursor-pointer text-xs py-1 px-2.5 ${
                        cuisines.includes(c) ? "bg-ns-green hover:bg-ns-green/90" : ""
                      }`}
                      onClick={() => toggleCuisine(c)}
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
                <Button className="flex-1" onClick={handleFinish} disabled={saving}>
                  {saving ? "Setting up..." : "Start Exploring"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
