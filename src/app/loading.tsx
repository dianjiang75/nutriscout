/**
 * Global loading skeleton — shown during page navigation.
 * Uses shimmer animation matching the dish card layout.
 */
export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-6 w-24 rounded skeleton-shimmer" />
        <div className="flex-1 h-9 rounded-lg skeleton-shimmer" />
        <div className="h-9 w-9 rounded-full skeleton-shimmer" />
      </div>

      {/* Category pills skeleton */}
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="w-14 h-14 rounded-2xl skeleton-shimmer" />
            <div className="h-3 w-10 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Sort pills skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full skeleton-shimmer" />
        ))}
      </div>

      {/* Card grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border overflow-hidden">
            <div className="aspect-[16/10] w-full skeleton-shimmer" />
            <div className="p-3 space-y-2.5">
              <div className="h-4 w-3/4 rounded skeleton-shimmer" />
              <div className="h-3 w-1/2 rounded skeleton-shimmer" />
              <div className="h-2 w-full rounded-full skeleton-shimmer" />
              <div className="flex gap-2">
                <div className="h-3 w-14 rounded skeleton-shimmer" />
                <div className="h-3 w-10 rounded skeleton-shimmer" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
