"use client";

import { useEffect, useState, useCallback } from "react";

interface AuditItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  menuItemType: string;
  auditConfidence: number | null;
  restaurantName: string;
}

const MENU_TYPES = [
  { value: "dish", label: "Dish", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  { value: "dessert", label: "Dessert", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  { value: "drink", label: "Drink", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "side", label: "Side", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "condiment", label: "Condiment", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "addon", label: "Add-on", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "combo", label: "Combo", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  { value: "kids", label: "Kids", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
] as const;

function getTypeBadge(type: string) {
  const found = MENU_TYPES.find((t) => t.value === type);
  if (!found) return { label: type, color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" };
  return found;
}

export default function ClassifierAuditPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reviewed, setReviewed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const fetchItems = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit/classifier?page=${p}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setItems(data.items || []);
        setTotal(data.total || 0);
        setPage(data.page || p);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(1);
  }, [fetchItems]);

  async function handleClassify(itemId: string, correctType: string) {
    setSubmitting(itemId);
    try {
      const res = await fetch("/api/admin/audit/classifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId: itemId, correctType }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setReviewed((r) => r + 1);
        setTotal((t) => Math.max(0, t - 1));
      }
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <a href="/admin/audit" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
            &larr; Back to Audit Dashboard
          </a>
          <h1 className="text-2xl font-bold">Classifier Audit</h1>
          <p className="text-muted-foreground mt-1">
            Review items where the classifier is uncertain. Click the correct type to classify.
          </p>
          <div className="flex gap-4 mt-3 text-sm">
            <span className="font-semibold text-primary">{reviewed} reviewed</span>
            <span className="text-muted-foreground">{total} remaining</span>
          </div>
        </div>

        {/* Loading state */}
        {loading && items.length === 0 && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">&#10003;</div>
            <p className="text-lg font-semibold">All caught up!</p>
            <p className="text-muted-foreground mt-1">No items need classification review right now.</p>
          </div>
        )}

        {/* Item cards */}
        <div className="space-y-4">
          {items.map((item) => {
            const badge = getTypeBadge(item.menuItemType);
            const isSubmitting = submitting === item.id;
            return (
              <div
                key={item.id}
                className={`border border-border rounded-xl p-5 bg-card transition-opacity ${isSubmitting ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.price != null && (
                      <span className="text-sm font-medium">${item.price.toFixed(2)}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span>{item.restaurantName}</span>
                  {item.category && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                      <span>{item.category}</span>
                    </>
                  )}
                  {item.auditConfidence != null && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                      <span>Confidence: {(item.auditConfidence * 100).toFixed(0)}%</span>
                    </>
                  )}
                </div>

                {/* Type buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {MENU_TYPES.map((type) => (
                    <button
                      key={type.value}
                      disabled={isSubmitting}
                      onClick={() => handleClassify(item.id, type.value)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                        item.menuItemType === type.value
                          ? `${type.color} border-transparent ring-2 ring-primary/30`
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {total > 50 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              disabled={page <= 1 || loading}
              onClick={() => fetchItems(page - 1)}
              className="px-4 py-2 text-sm rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-muted-foreground">
              Page {page} of {Math.ceil(total / 50)}
            </span>
            <button
              disabled={page >= Math.ceil(total / 50) || loading}
              onClick={() => fetchItems(page + 1)}
              className="px-4 py-2 text-sm rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
