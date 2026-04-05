"use client";

import { useEffect, useState, useCallback } from "react";

interface PhotoItem {
  photoId: string;
  dishId: string;
  dishName: string;
  photoUrl: string;
  restaurantName: string;
  sourcePlatform: string;
  analyzedAt: string | null;
}

export default function PhotoAuditPage() {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reviewed, setReviewed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"unreviewed" | "low-confidence">("unreviewed");
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchItems = useCallback(async (p: number, f: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit/photos?page=${p}&filter=${f}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setItems(data.items || []);
        setTotal(data.total || 0);
        setPage(data.page || p);
        setCurrentIndex(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(1, filter);
  }, [fetchItems, filter]);

  // Keyboard shortcuts: left = reject, right = approve
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (items.length === 0 || submitting) return;
      const current = items[currentIndex];
      if (!current) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleAction(current.photoId, current.dishId, "approve");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleAction(current.photoId, current.dishId, "reject");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  async function handleAction(photoId: string, dishId: string, action: "approve" | "reject") {
    setSubmitting(photoId);
    try {
      const res = await fetch("/api/admin/audit/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, dishId, action }),
      });
      if (res.ok) {
        setItems((prev) => {
          const next = prev.filter((i) => i.photoId !== photoId);
          // Keep currentIndex in bounds
          if (currentIndex >= next.length && next.length > 0) {
            setCurrentIndex(next.length - 1);
          }
          return next;
        });
        setReviewed((r) => r + 1);
        setTotal((t) => Math.max(0, t - 1));
      }
    } finally {
      setSubmitting(null);
    }
  }

  const current = items[currentIndex] || null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <a href="/admin/audit" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
            &larr; Back to Audit Dashboard
          </a>
          <h1 className="text-2xl font-bold">Photo Audit</h1>
          <p className="text-muted-foreground mt-1">
            Review dish photos. Use arrow keys for fast review (Left = Reject, Right = Approve).
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

        {/* Loading state */}
        {loading && items.length === 0 && (
          <div className="space-y-4">
            <div className="h-80 rounded-xl bg-muted/50 animate-pulse" />
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">&#10003;</div>
            <p className="text-lg font-semibold">All photos reviewed!</p>
            <p className="text-muted-foreground mt-1">No photos need review right now.</p>
          </div>
        )}

        {/* Current photo card (focused view) */}
        {current && (
          <div className={`border border-border rounded-xl overflow-hidden bg-card transition-opacity ${submitting ? "opacity-50" : ""}`}>
            {/* Photo */}
            <div className="relative bg-muted aspect-[4/3] max-h-[500px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.photoUrl}
                alt={current.dishName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder-dish.svg";
                }}
              />
              <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
                {currentIndex + 1} / {items.length}
              </div>
            </div>

            {/* Info */}
            <div className="p-5">
              <h3 className="font-bold text-lg">{current.dishName}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {current.restaurantName} &middot; {current.sourcePlatform}
              </p>

              {/* Action buttons */}
              <div className="flex gap-3 mt-5">
                <button
                  disabled={!!submitting}
                  onClick={() => handleAction(current.photoId, current.dishId, "reject")}
                  className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 font-semibold text-sm hover:bg-red-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Reject (&larr;)
                </button>
                <button
                  disabled={!!submitting}
                  onClick={() => handleAction(current.photoId, current.dishId, "approve")}
                  className="flex-1 py-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-sm hover:bg-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Approve (&rarr;)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Thumbnail strip — show remaining items below */}
        {items.length > 1 && (
          <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar py-2">
            {items.map((item, idx) => (
              <button
                key={item.photoId}
                onClick={() => setCurrentIndex(idx)}
                className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === currentIndex ? "border-primary ring-2 ring-primary/30" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.photoUrl}
                  alt={item.dishName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder-dish.svg";
                  }}
                />
              </button>
            ))}
          </div>
        )}

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
