"use client";

import { useEffect, useState, useCallback } from "react";

interface PhotoItem {
  photoId: string;
  dishId: string;
  menuItemId: string | null;
  dishName: string;
  photoUrl: string;
  restaurantName: string;
  cuisine: string;
  sourcePlatform: string;
  analyzedAt: string | null;
}

function googleSearchUrl(name: string, cuisine: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} ${cuisine} food dish`)}&tbm=isch`;
}

export default function PhotoAuditPage() {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reviewed, setReviewed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"unreviewed" | "low-confidence">("unreviewed");

  const fetchItems = useCallback(async (p: number, f: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit-photos?page=${p}&filter=${f}&limit=50`);
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
    fetchItems(1, filter);
  }, [fetchItems, filter]);

  async function handleAction(photoId: string, dishId: string, action: string) {
    setSubmitting(photoId);
    try {
      const res = await fetch("/api/audit-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, dishId, action }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.photoId !== photoId));
        setReviewed((r) => r + 1);
        setTotal((t) => Math.max(0, t - 1));
      }
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <a href="/admin/audit" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
            &larr; Back to Audit Dashboard
          </a>
          <h1 className="text-2xl font-bold">Photo Audit</h1>
          <p className="text-muted-foreground mt-1">
            Review dish photos in a grid. Approve, reject, remove from dish cards, or remove entirely.
          </p>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-sm font-semibold text-primary">{reviewed} reviewed</span>
            <span className="text-sm text-muted-foreground">{total} remaining</span>
            <div className="ml-auto flex gap-1.5">
              <button
                onClick={() => setFilter("unreviewed")}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  filter === "unreviewed"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                Unreviewed
              </button>
              <button
                onClick={() => setFilter("low-confidence")}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  filter === "low-confidence"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                Low Confidence
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && items.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">&#10003;</div>
            <p className="text-lg font-semibold">All photos reviewed!</p>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item) => {
            const isSubmitting = submitting === item.photoId;
            return (
              <div
                key={item.photoId}
                className={`border border-border rounded-xl overflow-hidden bg-card transition-opacity ${isSubmitting ? "opacity-40" : ""}`}
              >
                {/* Photo */}
                <div className="relative aspect-square bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.photoUrl}
                    alt={item.dishName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder-dish.svg";
                    }}
                  />
                </div>

                {/* Info */}
                <div className="p-2.5">
                  <h3 className="font-semibold text-xs leading-tight truncate" title={item.dishName}>
                    {item.dishName}
                  </h3>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {item.restaurantName}
                  </p>

                  {/* Action buttons — 2 rows */}
                  <div className="flex gap-1 mt-2">
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleAction(item.photoId, item.dishId, "approve")}
                      className="flex-1 py-1 text-[10px] font-semibold rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                      title="Approve this photo"
                    >
                      Approve
                    </button>
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleAction(item.photoId, item.dishId, "reject")}
                      className="flex-1 py-1 text-[10px] font-semibold rounded bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                      title="Remove this photo (keep dish)"
                    >
                      Reject
                    </button>
                    <a
                      href={googleSearchUrl(item.dishName, item.cuisine)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1 text-[10px] font-semibold rounded bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/25 transition-colors text-center"
                      title="Google search this dish"
                    >
                      Google
                    </a>
                  </div>
                  <div className="flex gap-1 mt-1">
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleAction(item.photoId, item.dishId, "demote")}
                      className="flex-1 py-1 text-[10px] font-medium rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 transition-colors disabled:opacity-50"
                      title="Remove from dish cards (keep in menu)"
                    >
                      Not a Card
                    </button>
                    <button
                      disabled={isSubmitting}
                      onClick={() => {
                        if (confirm(`Remove "${item.dishName}" from menu entirely?`)) {
                          handleAction(item.photoId, item.dishId, "remove-all");
                        }
                      }}
                      className="flex-1 py-1 text-[10px] font-medium rounded bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      title="Remove from both menu and dish cards"
                    >
                      Remove All
                    </button>
                  </div>
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
              onClick={() => fetchItems(page - 1, filter)}
              className="px-4 py-2 text-sm rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-muted-foreground">
              Page {page} of {Math.ceil(total / 50)}
            </span>
            <button
              disabled={page >= Math.ceil(total / 50) || loading}
              onClick={() => fetchItems(page + 1, filter)}
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
