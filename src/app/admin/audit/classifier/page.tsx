"use client";

import { useEffect, useState, useCallback } from "react";

interface AuditItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  menuItemType: string;
  isDishCard: boolean;
  dishCardConfidence: number | null;
  auditConfidence: number | null;
  restaurantName: string;
}

const MENU_TYPES = [
  { value: "dish", label: "Dish", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  { value: "dessert", label: "Dessert", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  { value: "drink", label: "Drink", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "alcohol", label: "Alcohol", color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200" },
  { value: "side", label: "Side", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "condiment", label: "Condiment", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "addon", label: "Add-on", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "combo", label: "Combo", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  { value: "kids", label: "Kids", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
] as const;

const FILTERS = [
  { value: "needs-review", label: "Needs Review" },
  { value: "dish-cards", label: "Dish Cards" },
  { value: "not-dish-cards", label: "Not Dish Cards" },
  { value: "all", label: "All Items" },
] as const;

function getTypeBadge(type: string) {
  const found = MENU_TYPES.find((t) => t.value === type);
  if (!found) return { label: type, color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" };
  return found;
}

function googleSearchUrl(name: string, restaurant: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} ${restaurant} dish`)}&tbm=isch`;
}

export default function ClassifierAuditPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reviewed, setReviewed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [filter, setFilter] = useState("needs-review");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState(false);

  const fetchItems = useCallback(async (p: number, f?: string) => {
    setLoading(true);
    try {
      const filterParam = f || filter;
      const res = await fetch(`/api/audit-classifier?page=${p}&filter=${filterParam}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setItems(data.items || []);
        setTotal(data.total || 0);
        setPage(data.page || p);
        setSelected(new Set());
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchItems(1, filter);
  }, [filter, fetchItems]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  async function handleClassify(itemId: string, correctType: string) {
    setSubmitting(itemId);
    try {
      const res = await fetch("/api/audit-classifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId: itemId, correctType }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setSelected((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
        setReviewed((r) => r + 1);
        setTotal((t) => Math.max(0, t - 1));
      }
    } finally {
      setSubmitting(null);
    }
  }

  async function handleReject(itemId: string) {
    if (!confirm("Remove this item from the menu? It will be archived as junk.")) return;
    setSubmitting(itemId);
    try {
      const res = await fetch("/api/audit-classifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId: itemId, action: "reject" }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setSelected((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
        setReviewed((r) => r + 1);
        setTotal((t) => Math.max(0, t - 1));
      }
    } finally {
      setSubmitting(null);
    }
  }

  async function handleBulkAction(action: string) {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const label = action === "reject" ? "reject" : `classify as ${action}`;
    if (!confirm(`${label} ${ids.length} selected items?`)) return;

    setBulkAction(true);
    let success = 0;
    for (const id of ids) {
      try {
        const body = action === "reject"
          ? { menuItemId: id, action: "reject" }
          : { menuItemId: id, correctType: action };
        const res = await fetch("/api/audit-classifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) success++;
      } catch { /* skip failed */ }
    }
    setItems((prev) => prev.filter((i) => !selected.has(i.id)));
    setReviewed((r) => r + success);
    setTotal((t) => Math.max(0, t - success));
    setSelected(new Set());
    setBulkAction(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <a href="/admin/audit" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
            &larr; Back to Audit Dashboard
          </a>
          <h1 className="text-2xl font-bold">Classifier Audit</h1>
          <p className="text-muted-foreground mt-1">
            Check items to select, then bulk-apply a type. Or click individual buttons. All corrections are saved as training data.
          </p>
          <div className="flex gap-4 mt-3 text-sm">
            <span className="font-semibold text-primary">{reviewed} reviewed</span>
            <span className="text-muted-foreground">{total} remaining</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-muted/50 rounded-lg w-fit">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setPage(1); }}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                filter === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="sticky top-0 z-10 bg-card border border-border rounded-xl p-3 mb-4 shadow-lg flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold mr-2">{selected.size} selected</span>
            <div className="w-px h-5 bg-border" />
            {MENU_TYPES.map((type) => (
              <button
                key={type.value}
                disabled={bulkAction}
                onClick={() => handleBulkAction(type.value)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium border border-border hover:bg-muted transition-all disabled:opacity-50`}
              >
                {type.label}
              </button>
            ))}
            <div className="w-px h-5 bg-border" />
            <button
              disabled={bulkAction}
              onClick={() => handleBulkAction("reject")}
              className="text-xs px-2.5 py-1 rounded-lg font-medium border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
            >
              Reject All
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs px-2.5 py-1 rounded-lg text-muted-foreground hover:text-foreground ml-auto"
            >
              Clear
            </button>
          </div>
        )}

        {/* Select all */}
        {items.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={selected.size === items.length && items.length > 0}
                onChange={selectAll}
                className="rounded border-border"
              />
              Select all on this page
            </label>
          </div>
        )}

        {/* Loading */}
        {loading && items.length === 0 && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">&#10003;</div>
            <p className="text-lg font-semibold">All caught up!</p>
            <p className="text-muted-foreground mt-1">No items need review in this filter.</p>
          </div>
        )}

        {/* Item cards */}
        <div className="space-y-3">
          {items.map((item) => {
            const badge = getTypeBadge(item.menuItemType);
            const isSubmitting = submitting === item.id;
            const isSelected = selected.has(item.id);
            return (
              <div
                key={item.id}
                className={`border rounded-xl p-4 bg-card transition-all ${
                  isSubmitting ? "opacity-50" : ""
                } ${isSelected ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
              >
                {/* Top row: checkbox + name + badges */}
                <div className="flex items-start gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(item.id)}
                    className="mt-1 rounded border-border shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base truncate">{item.name}</h3>
                      <a
                        href={googleSearchUrl(item.name, item.restaurantName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        Search
                      </a>
                    </div>
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
                    {item.isDishCard && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Card
                      </span>
                    )}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 ml-7">
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

                {/* Action buttons */}
                <div className="flex flex-wrap gap-1.5 items-center ml-7">
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
                  <div className="w-px h-5 bg-border mx-1" />
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleReject(item.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    Reject
                  </button>
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

        {/* Training data info */}
        <div className="mt-8 p-4 bg-muted/30 rounded-xl text-xs text-muted-foreground">
          <p><strong>Training data:</strong> Every correction is saved to <code>src/lib/agents/menu-classifier/corrections.json</code></p>
          <p className="mt-1">This file is read by the classifier evaluator and nightly improvement agent to learn from your corrections.</p>
        </div>
      </div>
    </div>
  );
}
