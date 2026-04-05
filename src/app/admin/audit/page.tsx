"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AuditCounts {
  classifierCount: number;
  photoCount: number;
}

export default function AuditDashboardPage() {
  const [counts, setCounts] = useState<AuditCounts>({ classifierCount: 0, photoCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      setLoading(true);
      try {
        const [classRes, photoRes] = await Promise.all([
          fetch("/api/admin/audit/classifier?page=1"),
          fetch("/api/admin/audit/photos?page=1&filter=unreviewed"),
        ]);

        let classifierCount = 0;
        let photoCount = 0;

        if (classRes.ok) {
          const json = await classRes.json();
          const data = json.data || json;
          classifierCount = data.total || 0;
        }
        if (photoRes.ok) {
          const json = await photoRes.json();
          const data = json.data || json;
          photoCount = data.total || 0;
        }

        setCounts({ classifierCount, photoCount });
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Audit Dashboard</h1>
        <p className="text-muted-foreground mb-8">
          Review and correct agent outputs to improve FoodClaw data quality.
        </p>

        <div className="grid gap-4">
          {/* Classifier audit card */}
          <Link
            href="/admin/audit/classifier"
            className="block border border-border rounded-xl p-6 bg-card hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold group-hover:text-primary transition-colors">
                  Classify Items
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Review menu items where the classifier is uncertain or marked as unknown.
                </p>
              </div>
              <div className="shrink-0 ml-4">
                {loading ? (
                  <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                ) : (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                    counts.classifierCount > 0
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                  }`}>
                    {counts.classifierCount}
                  </div>
                )}
              </div>
            </div>
          </Link>

          {/* Photo audit card */}
          <Link
            href="/admin/audit/photos"
            className="block border border-border rounded-xl p-6 bg-card hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold group-hover:text-primary transition-colors">
                  Review Photos
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Approve or reject dish photos matched by the photo pipeline.
                </p>
              </div>
              <div className="shrink-0 ml-4">
                {loading ? (
                  <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                ) : (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                    counts.photoCount > 0
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                  }`}>
                    {counts.photoCount}
                  </div>
                )}
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
