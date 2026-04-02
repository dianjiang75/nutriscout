"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Plus, X, LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth/context";

const DIETARY_OPTIONS = [
  "vegan", "vegetarian", "pescatarian", "keto", "paleo",
  "gluten_free", "dairy_free", "nut_free", "halal", "kosher",
] as const;

const GOAL_OPTIONS = [
  { value: "max_protein", label: "Maximize Protein" },
  { value: "min_calories", label: "Minimize Calories" },
  { value: "min_fat", label: "Minimize Fat" },
  { value: "min_carbs", label: "Minimize Carbs" },
  { value: "balanced", label: "Balanced" },
] as const;

// FDA Big 9 + additional common allergens
const ALLERGEN_GROUPS = [
  {
    label: "FDA Big 9",
    items: [
      { id: "milk", label: "Milk" },
      { id: "eggs", label: "Eggs" },
      { id: "peanuts", label: "Peanuts" },
      { id: "tree_nuts", label: "Tree Nuts" },
      { id: "fish", label: "Fish" },
      { id: "shellfish", label: "Shellfish" },
      { id: "wheat", label: "Wheat" },
      { id: "soybeans", label: "Soybeans" },
      { id: "sesame", label: "Sesame" },
    ],
  },
  {
    label: "Other Common",
    items: [
      { id: "celery", label: "Celery" },
      { id: "mustard", label: "Mustard" },
      { id: "lupin", label: "Lupin" },
      { id: "molluscs", label: "Molluscs" },
      { id: "sulphites", label: "Sulphites" },
      { id: "gluten", label: "Gluten" },
    ],
  },
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
  const { user: authUser, logout } = useAuth();
  const [_user, setUser] = useState<UserProfile | null>(null);
  const [dietary, setDietary] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [customRestrictions, setCustomRestrictions] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [goal, setGoal] = useState("balanced");
  const [maxWait, setMaxWait] = useState([30]);
  const [searchRadius, setSearchRadius] = useState([2]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!authUser) {
      router.push("/login");
      return;
    }

    fetch("/api/users/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setUser(data);
        if (data.dietary_restrictions) {
          setDietary(Object.entries(data.dietary_restrictions).filter(([, v]) => v).map(([k]) => k));
        }
        if (data.nutritional_goals?.priority) {
          setGoal(data.nutritional_goals.priority);
        }
        if (data.max_wait_minutes) setMaxWait([data.max_wait_minutes]);
        if (data.search_radius_miles) setSearchRadius([data.search_radius_miles]);
      })
      .catch(() => {});
  }, [authUser, router]);

  function toggleDietary(d: string) {
    setDietary((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  function toggleAllergen(id: string) {
    setAllergens((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addCustom() {
    const trimmed = customInput.trim().toLowerCase();
    if (trimmed && !customRestrictions.includes(trimmed)) {
      setCustomRestrictions((prev) => [...prev, trimmed]);
      setCustomInput("");
    }
  }

  function removeCustom(item: string) {
    setCustomRestrictions((prev) => prev.filter((c) => c !== item));
  }

  async function handleSave() {
    if (!authUser) return;
    setSaving(true);
    setSaved(false);
    try {
      const flags: Record<string, boolean> = {};
      for (const d of dietary) flags[d] = true;

      await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
    <div className="max-w-md mx-auto p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Profile</h1>
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-xs">Home</Button>
        </Link>
      </div>

      {/* User info */}
      {authUser && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{authUser.name}</p>
              <p className="text-xs text-muted-foreground truncate">{authUser.email}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dietary Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Dietary Preferences</CardTitle>
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
                {d.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Allergen Exclusions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Allergen Exclusions</CardTitle>
          <p className="text-xs text-muted-foreground">Dishes containing these will always be hidden</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {ALLERGEN_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.items.map((a) => (
                  <Badge
                    key={a.id}
                    variant={allergens.includes(a.id) ? "default" : "outline"}
                    className={`cursor-pointer text-xs py-1 px-2.5 ${
                      allergens.includes(a.id) ? "bg-red-500/90 hover:bg-red-500/80 text-white border-red-500/90" : ""
                    }`}
                    onClick={() => toggleAllergen(a.id)}
                  >
                    {a.label}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Custom Restrictions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Other Restrictions</CardTitle>
          <p className="text-xs text-muted-foreground">Add any custom dietary needs</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="e.g. nightshades, FODMAPs..."
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={addCustom}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {customRestrictions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customRestrictions.map((item) => (
                <Badge key={item} variant="secondary" className="text-xs gap-1 pr-1">
                  {item}
                  <button onClick={() => removeCustom(item)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nutritional Goal */}
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

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Search Preferences</CardTitle>
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

      <Button className="w-full bg-ns-green hover:bg-ns-green/90 text-white" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
      </Button>

      <Button
        variant="outline"
        className="w-full text-xs text-destructive hover:text-destructive"
        onClick={() => {
          logout();
          router.push("/login");
        }}
      >
        <LogOut className="w-3.5 h-3.5 mr-1.5" />
        Log Out
      </Button>
    </div>
  );
}
