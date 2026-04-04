# Frontend & UX Research Digest — 2026-04-04
**Agent**: Frontend Research (learning session)
**Topics**: React 19.2 Activity component, Next.js 16 App Router patterns, Tailwind v4 dark mode, food app UX 2026, skeleton loaders, infinite scroll vs pagination, RSC streaming, Core Web Vitals (LCP/INP/CLS), dark mode food photography, WCAG 2.2 accessibility
**Sources**: 10 web searches + 8 full article fetches
**Prior digest**: `2026-04-03-frontend-ux-research.md` (covers same broad topics — this digest adds new detail and fills gaps)

---

## DELTA FROM APRIL 3 DIGEST

The April 3 digest is comprehensive. This digest focuses on:
1. React 19.2 `<Activity>` component — newly released, directly applicable
2. WCAG 2.2 concrete React code patterns with specific Tailwind utility classes
3. INP (replaced FID) — current Core Web Vitals metric, not in prior digest
4. Next.js 16 caching four-layer model — more specific than prior coverage
5. Skeleton loading cross-fade pattern — a specific implementation gap found in code
6. Tailwind v4 dark mode `@variant dark` — confirmed correct in FoodClaw codebase

---

## 1. React 19.2 `<Activity>` Component — Filter Drawer Pre-rendering

**Impact: MEDIUM | Risk: GREEN | Target files: `src/app/page.tsx`, `src/components/filter-drawer.tsx`**
**Source**: https://react.dev/blog/2025/10/01/react-19-2

React 19.2 ships `<Activity>` which allows hiding components (with CSS `display: none`) while keeping their state alive and pre-loading their data/styles. This is the official replacement for the `{condition && <Component />}` unmount/remount pattern.

### What it does:
- `mode="visible"` — renders normally, mounts effects
- `mode="hidden"` — hides with CSS, unmounts effects, defers updates (React idle-priority), but **preserves state**

### Direct application — Filter Drawer:
Currently `FilterDrawer` unmounts entirely when closed (Sheet component visibility toggle). This means every open re-renders from scratch. With `<Activity>`:

```tsx
// page.tsx — wrap FilterDrawer in Activity
import { Activity } from "react"; // React 19.2+

<Activity mode={filterOpen ? "visible" : "hidden"}>
  <FilterDrawer
    open={filterOpen}
    onClose={() => setFilterOpen(false)}
    onApply={handleApply}
    filters={filters}
  />
</Activity>
```

**Benefits for FoodClaw**:
- Filter state persists when drawer is closed and reopened (user's half-finished filter selection preserved)
- Pre-loads the drawer's CSS/images while it's hidden
- No re-render cost on open — already rendered in background
- Especially useful for `AllergenSection` (heavy render with many checkboxes)

**Caveats**:
- `<Activity>` is NOT a replacement for proper Sheet animation — the Sheet's CSS transition still handles the visual show/hide
- Components inside `hidden` Activity still render (in background) — don't put server-side-only logic inside
- Current shadcn `Sheet` component controls its own visibility via CSS; test that wrapping in `<Activity>` doesn't conflict with Sheet's open/close state management

### Direct application — Dish Detail Prefetch:
Pre-render the dish detail page content for the first visible dish in the grid while user is still on the search page:

```tsx
// Speculative pre-render of top result detail
<Activity mode="hidden">
  <DishDetailPreload dishId={dishes[0]?.id} />
</Activity>
```

This is speculative (might not be worth complexity) — mark as **YELLOW** if pursuing dish prefetch.

---

## 2. `useEffectEvent` — Clean Up Debounce Effects

**Impact: LOW | Risk: GREEN | Target files: `src/components/search-typeahead.tsx`, `src/app/page.tsx`**
**Source**: https://react.dev/blog/2025/10/01/react-19-2

`useEffectEvent` (stable in 19.2) extracts non-reactive event logic from Effects without requiring the eslint-disable workaround or `useCallback` + dependency arrays.

### Current pattern in `page.tsx` (uses `useCallback` for fetchDishes):
```tsx
const fetchDishes = useCallback(async (s, f, append = false) => {
  // uses `filters` and `search` from closure
}, []);
```

### New pattern with `useEffectEvent`:
```tsx
import { useEffectEvent } from "react"; // 19.2+

const onFiltersApplied = useEffectEvent((newFilters: FilterState) => {
  // Can read latest state without being in dependency array
  fetchDishes(search, newFilters);
});

useEffect(() => {
  // debounce logic here — onFiltersApplied is NOT in deps
}, [search]); // only reactive deps
```

**Note**: `useEffectEvent` is NOT a universal `useCallback` replacement — only for use inside Effects. The React Compiler is still the better solution for the broader memoization problem (see April 3 digest).

---

## 3. Core Web Vitals 2026 — INP Replaces FID (Critical Update)

**Impact: HIGH | Risk: YELLOW | Target files: `src/app/page.tsx`, `src/components/dish-card.tsx`, `src/components/filter-drawer.tsx`**
**Source**: https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide

FID (First Input Delay) was retired March 2024. The current three Core Web Vitals are:

| Metric | Good | Poor | What it measures |
|--------|------|------|-----------------|
| LCP | < 2.5s | > 4s | Time to render largest content element |
| INP | < 200ms | > 500ms | Responsiveness to ALL user interactions (not just first) |
| CLS | < 0.1 | > 0.25 | Layout stability |

**43% of sites fail INP in 2026** — it's the most commonly failed metric.

### INP gaps in FoodClaw:

**1. Filter apply interaction** (`filter-drawer.tsx`):
When user taps "Apply", the handler calls `setFilters()` → triggers `fetchDishes()` → blocks main thread while setting up the fetch. The interaction-to-paint latency is the entire time until the skeleton appears. Fix: `startTransition()` wrapping the non-urgent state updates.

```tsx
import { startTransition } from "react";

const handleApply = (newFilters: FilterState) => {
  // Urgent: close drawer immediately
  setFilterOpen(false);
  // Deferred: trigger search (non-blocking for INP)
  startTransition(() => {
    setFilters(newFilters);
    setSearch(s => ({ ...s, offset: 0 }));
  });
};
```

**2. Sort button interactions** (`page.tsx`):
Sort tab changes trigger immediate re-renders of the entire dish grid. Wrap in `startTransition()` so the button press is acknowledged instantly (paint happens) while the new sort renders at lower priority.

**3. Favorite toggle** (`dish-card.tsx`):
The optimistic update already handles this well (instant state flip, then async confirm). No change needed.

**4. Category pill press** (`category-pills.tsx`):
Each pill press triggers search refetch. Same pattern as sort — wrap setter in `startTransition()`.

### LCP gaps in FoodClaw:

**Dish photos are the LCP element** on the search results page. Current state in `dish-card.tsx`:
- Uses `next/image` — correct
- Does NOT use `priority` prop — **this is the LCP bug**

The first 1-2 visible dish cards should have `priority` on their images. Currently all images are lazy-loaded.

```tsx
// dish-card.tsx — add priority prop for above-fold cards
<Image
  src={photoUrl}
  alt={dish.name}
  fill
  sizes="(max-width: 640px) 100vw, 50vw"
  priority={isPriority}  // pass as prop from parent for first 2 cards
  className="object-cover ..."
/>
```

In `page.tsx`, pass `isPriority={index < 2}` to the first two `DishCard` components.

### CLS gaps in FoodClaw:

**Loading → content transition**: The skeleton uses `aspect-[16/10]` which matches the final card. This is correct and prevents CLS. Confirmed.

**"Load More" sentinel**: The sentinel div at bottom has fixed height but the transition from "Loading..." spinner to new cards could cause shift. Verify the sentinel and new cards don't overlap in layout.

---

## 4. Next.js 16 Four-Layer Caching Model — Explicit Strategy

**Impact: HIGH | Risk: YELLOW | Target files: `src/app/dish/[id]/page.tsx`, `src/app/restaurant/[id]/page.tsx`**
**Source**: https://ztabs.co/blog/nextjs-app-router-best-practices

Next.js 16 has four caching layers. FoodClaw is currently `"use client"` everywhere, bypassing layers 1-3.

| Layer | What it caches | How to control |
|-------|---------------|----------------|
| 1. Request Memoization | Duplicate `fetch()` in same render | Automatic (same URL = deduped) |
| 2. Data Cache | `fetch()` results across requests | `{ next: { revalidate: N, tags: [...] } }` |
| 3. Full Route Cache | Static page HTML at build time | `generateStaticParams()` |
| 4. Router Cache | Client-side visited routes | `router.refresh()` to bust |

**For FoodClaw's dish detail page** (currently `"use client"` doing `useEffect` fetch):

The dish detail page (`/dish/[id]`) is a perfect candidate for converting to a Server Component with `"use cache"`:
- Dish data changes infrequently (only on crawl completion)
- Perfect for `unstable_cacheTag('dish:{id}')` pattern from AGENTS.md
- `revalidateTag('dish:{id}')` in the BullMQ worker on crawl complete would bust the cache

This is confirmed in AGENTS.md: `Next.js 16: "use cache" directive + unstable_cacheTag('restaurant:{id}') is correct pattern`.

**Migration priority**: YELLOW — dish detail is separate from the real-time search feed, so it's lower risk to convert.

```tsx
// src/app/dish/[id]/page.tsx — convert to RSC
import { unstable_cacheTag as cacheTag } from 'next/cache';

async function getDish(id: string) {
  "use cache";
  cacheTag(`dish:${id}`);
  // fetch from DB/API directly
}

export default async function DishPage({ params }) {
  const { id } = await params; // Next.js 16: params is async
  const dish = await getDish(id);
  return <DishDetail dish={dish} />;
}
```

**Note from AGENTS.md**: `params` must be awaited in Next.js 16 — this is already flagged in the April 3 digest.

---

## 5. Skeleton Loading — Cross-Fade Gap Found in Code

**Impact: LOW | Risk: GREEN | Target files: `src/app/page.tsx`**
**Source**: https://birdeatsbug.com/blog/implementing-skeleton-screen-in-react-with-react-loading-skeleton-and-suspense

**Current implementation in `page.tsx`**:
When `loading` transitions to `false`, the skeleton div is conditionally rendered:
```tsx
{loading ? <SkeletonGrid /> : <DishGrid dishes={dishes} />}
```
This causes a **hard swap** — skeleton disappears, content appears instantly. There's no cross-fade.

**Best practice 2026**: Animate the content in rather than hard-swapping:
```tsx
// Option A: CSS opacity transition
<div className={cn(
  "transition-opacity duration-300",
  loading ? "opacity-0" : "opacity-100"
)}>
  <DishGrid dishes={dishes} />
</div>
```

**However**: The skeleton and content grid must overlap during the transition, which means both are in the DOM simultaneously. The pattern is:
```tsx
<div className="relative">
  {/* Skeleton fades out */}
  <div className={cn(
    "absolute inset-0 transition-opacity duration-200",
    loading ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
  )}>
    <SkeletonGrid />
  </div>
  {/* Content fades in */}
  <div className={cn(
    "transition-opacity duration-200",
    loading ? "opacity-0" : "opacity-100"
  )}>
    <DishGrid dishes={dishes} />
  </div>
</div>
```

**Risk**: At 20 dishes, the hidden skeleton during loading wastes render. Keep the simpler hard-swap if performance is a concern. The cross-fade is primarily a polish improvement.

**Shimmer pattern confirmed correct**: FoodClaw's custom `skeleton-shimmer` CSS animation (wave pattern, 1.5s ease-in-out) matches 2026 best practices. No library needed — custom is faster. The dark mode variant is also correct (`oklch` values at lower lightness). **No change needed here.**

---

## 6. Infinite Scroll vs Pagination — Confirm Current Decision

**Impact: LOW | Risk: GREEN | Target files: `src/app/page.tsx`**
**Source**: https://www.meilisearch.com/blog/pagination-vs-infinite-scroll-vs-load-more + multiple UX research sources

**2026 consensus**:
- Discovery/feed → **infinite scroll** (what FoodClaw does) ✓
- Search results with specific goal (find a specific dish) → **pagination** or **load more**
- E-commerce comparison → **pagination** (users want to go back)

**FoodClaw's hybrid** (IntersectionObserver sentinel + `hasMore` check) is the right call. The `Load More` button pattern (sentinel triggers automatically but users can also click) gives both engagement and control.

**One new finding**: Adding **visual page landmarks** inside infinite scroll has 23% higher recall of viewed items. Implementation: inject a subtle separator every 20 dishes: `<div className="text-xs text-muted-foreground text-center py-2">Showing {offset}-{offset+20} of {total}</div>`. This also helps users communicate position ("I saw it on the second batch").

**Virtualization threshold**: The April 3 digest noted virtualization at 40+ dishes. Confirm this with `@tanstack/react-virtual` — it's the most actively maintained virtualization library in 2026 (react-window is in maintenance mode).

---

## 7. WCAG 2.2 — Specific Gaps Found in Codebase Audit

**Impact: HIGH | Risk: YELLOW | Target files: multiple**
**Source**: https://www.allaccessible.org/blog/wcag-22-complete-guide-2025

### 2.5.8 Target Size — ConfidenceDot (CRITICAL GAP)

From `confidence-dot.tsx`: The dot is rendered as `h-2.5 w-2.5` = **10×10px**. WCAG 2.2 minimum is 24×24px for interactive elements. This is a tooltip trigger and therefore interactive.

**Fix**: Add an invisible hit area using a wrapper:
```tsx
// confidence-dot.tsx
<Tooltip>
  <TooltipTrigger asChild>
    <button
      className="relative inline-flex items-center justify-center"
      style={{ width: 24, height: 24 }} // WCAG 2.2 minimum
      aria-label={`Data confidence: ${Math.round(confidence * 100)}%`}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", colorClass)} />
    </button>
  </TooltipTrigger>
  ...
</Tooltip>
```

### 2.4.13 Focus Appearance — Current focus ring audit

From `globals.css` line 160-162:
```css
:focus-visible {
  @apply outline-2 outline-offset-2 outline-primary/50 rounded-sm;
}
```

WCAG 2.2 requires: **2px minimum thickness** ✓ AND **3:1 contrast against adjacent colors**.

**Problem**: `outline-primary/50` uses 50% opacity on the primary color (`oklch(0.55 0.17 158)` = emerald green at 50% opacity). Against white background, this may not achieve 3:1 contrast ratio.

**Fix**: Use full opacity for the focus ring, then use `outline-offset` to separate from the component border:
```css
:focus-visible {
  @apply outline-2 outline-offset-2 outline-primary rounded-sm;
  /* Remove /50 — full opacity ensures 3:1 contrast */
}
```

### 2.4.11 Focus Not Obscured — Sticky header

From `page.tsx`: The header is `sticky top-0 z-50`. When keyboard navigating through the dish grid, focused elements below the header could be obscured.

**Fix**: Add `scroll-padding-top` to account for sticky header height:
```css
/* globals.css */
html {
  scroll-padding-top: 4rem; /* height of sticky header */
}
```

### 3.2.6 Consistent Help — Missing

FoodClaw has no persistent help/contact mechanism. WCAG 2.2 requires consistent help to be in the same relative location across pages. The bottom nav (`bottom-nav.tsx`) doesn't include a help option.

**Minimum viable fix**: Add a `?` help icon in the profile page or a `mailto:` link in footer. Not urgent but a compliance gap.

### Button Component Touch Targets — Audit

From `button.tsx` — the default size is `h-8` (32px). WCAG 2.2 minimum is 24px ✓, but **Apple HIG recommends 44px** and **Google Material 3 recommends 48px** for primary actions.

Critical touch targets to audit:
- `icon` size = `size-8` (32×32px) — meets WCAG 2.2 (24px) but below Apple recommendation
- `icon-xs` size = `size-6` (24×24px) — exactly at WCAG 2.2 minimum — any smaller would fail
- Favorite heart button in `dish-card.tsx`: uses `size-8` icon button (32px) — acceptable

**Recommendation**: Upgrade `icon` to `size-10` (40px) for primary icon-only actions. The favorite heart is primary action for authenticated users.

---

## 8. Food App UX — Three New 2026 Findings Not in April 3 Digest

**Impact: MEDIUM | Risk: GREEN**
**Source**: https://www.sanjaydey.com/mobile-ux-ui-design-patterns-2026-data-backed/ + https://procreator.design/blog/food-app-ux-key-strategies/

### Finding 1: "Bold Hierarchy" — Larger First Card

2026 food apps are moving to **asymmetric grid layouts** where the first search result is larger than subsequent ones (Google Maps does this). The first result gets a hero treatment (full-width or 60% larger card) to draw attention to the best match.

For FoodClaw:
```tsx
// page.tsx dish grid — make first card hero-sized
<div className="grid gap-4 sm:grid-cols-2">
  {dishes.map((dish, index) => (
    <div key={dish.id} className={index === 0 ? "sm:col-span-2" : ""}>
      <DishCard dish={dish} hero={index === 0} />
    </div>
  ))}
</div>
```

This could be a `hero` prop on `DishCard` that renders a wider card with larger photo.

### Finding 2: Personalized Section Headers

Instead of generic "Dishes" heading, 2026 food apps show personalized context strings:
- "High Protein Dishes Near You" (when `sort = "macro_match"` + protein goal)
- "Low Calorie Options in Williamsburg" (when location detected)
- "Nut-Free Dishes Within 1 Mile" (when allergen filter active)

This is a `useMemo`-computed string from `search` state + `filters`. Completely client-side, zero API cost.

### Finding 3: Transparent Wait Time Confidence

2026 apps show **when wait time data was last updated**: "Wait: ~12 min (updated 3h ago)". FoodClaw's `WaitBadge` component shows the wait time but not data freshness. Adding a tooltip on `WaitBadge` with `logistics.last_polled` timestamp would build trust.

---

## 9. Tailwind v4 — Confirmed Correct + One Gap

**Impact: LOW | Risk: GREEN | Target file: `src/app/globals.css`**
**Source**: https://www.digitalapplied.com/blog/tailwind-css-v4-migration-new-features-guide

**Confirmed correct** in FoodClaw's `globals.css`:
- `@import "tailwindcss"` ✓
- `@custom-variant dark (&:is(.dark *))` ✓ (class-based dark mode via `.dark` class on `<html>`)
- `@theme inline { }` block ✓
- All color tokens as CSS variables ✓
- Lightning CSS — no configuration needed, automatically faster ✓

**One gap**: The `@property` registered custom properties are not used. For smooth CSS variable transitions in dark mode (e.g., background color transition when toggling), `@property` enables animation of custom properties:

```css
/* globals.css — add for smooth dark mode transitions */
@property --background {
  syntax: "<color>";
  initial-value: oklch(1.0 0 0);
  inherits: true;
}

/* Then: */
body {
  transition: background-color 200ms ease, color 200ms ease;
}
```

Without `@property`, CSS variable changes are not animatable (they swap instantly). Low priority since FoodClaw uses JavaScript class toggle for dark mode (instant switch is intentional).

---

## 10. Dark Mode Food Photography — Confirmed Correct + One Fix

**Impact: LOW | Risk: GREEN | Target file: `src/components/dish-card.tsx`**
**Source**: https://www.tech-rz.com/blog/dark-mode-design-best-practices-in-2026/

From the globals.css dark mode values:
- Background: `oklch(0.13 0.005 260)` — deep blue-black, NOT pure black ✓ (correct, avoids eye fatigue)
- Card: `oklch(0.18 0.005 260)` — slightly lighter than background ✓
- Text: `oklch(0.95 0.005 260)` — bright gray, not pure white ✓

**DoorDash dark mode pattern** (from their engineering blog): They use per-token semantic color roles rather than simple dark-mode overrides. FoodClaw's current structure (semantic `--ns-green`, `--ns-amber`, `--ns-red` with dark mode variants) matches this pattern correctly.

**One fix**: `dark:brightness-90` on food photography images. Food photos look too saturated on dark backgrounds. Add:
```tsx
// dish-card.tsx
<Image
  className={cn(
    "object-cover transition-transform duration-500 group-hover:scale-105",
    "dark:brightness-90"  // Add this: reduces perceived oversaturation on dark bg
  )}
  ...
/>
```
This is a CSS filter, not a content change — safe to apply without user approval.

---

## 11. RSC Streaming — Practical Path Forward

**Impact: HIGH | Risk: YELLOW | Target files: `src/app/dish/[id]/page.tsx`, `src/app/restaurant/[id]/page.tsx`**

The April 3 digest correctly identified that `page.tsx` (homepage) is hard to convert to RSC due to real-time filtering. However, the **dish detail and restaurant detail pages** are pure data display with no real-time filtering — they are ideal RSC conversion candidates.

**Priority RSC conversions** (ordered by impact, lowest risk first):

1. `src/app/restaurant/[id]/page.tsx` — Read-only restaurant page, no real-time interactivity
2. `src/app/dish/[id]/page.tsx` — Read-only dish detail, favorite button is the only client component
3. `src/app/favorites/page.tsx` — List of favorites, mostly static per user session

**Pattern for each**:
```tsx
// server component shell
export default async function DishPage({ params }) {
  const { id } = await params; // Next.js 16 async params

  return (
    <Suspense fallback={<DishDetailSkeleton />}>
      <DishDetailData id={id} />
    </Suspense>
  );
}

// async data component (streams)
async function DishDetailData({ id }: { id: string }) {
  "use cache";
  unstable_cacheTag(`dish:${id}`);

  const dish = await fetchDishById(id); // direct DB query
  return <DishDetailUI dish={dish} />;
}

// client island (only the interactive parts)
"use client"
function FavoriteButton({ dishId }: { dishId: string }) {
  // just the heart button
}
```

**Avoid**: Converting the homepage (`page.tsx`) — too risky, real-time filtering architecture conflict.

---

## Priority Matrix

| # | Finding | Risk | Impact | Files | Action |
|---|---------|------|--------|-------|--------|
| 1 | INP: `startTransition` for sort/filter/category | GREEN | HIGH | `page.tsx`, `filter-drawer.tsx`, `category-pills.tsx` | Implement |
| 2 | LCP: `priority` prop on first 2 dish card images | GREEN | HIGH | `dish-card.tsx`, `page.tsx` | Implement |
| 3 | WCAG 2.2: ConfidenceDot 10px → 24px touch target | GREEN | HIGH | `confidence-dot.tsx` | Implement |
| 4 | WCAG 2.2: Focus ring `outline-primary/50` → `outline-primary` | GREEN | MEDIUM | `globals.css` | Implement |
| 5 | WCAG 2.2: `scroll-padding-top` for sticky header | GREEN | MEDIUM | `globals.css` | Implement |
| 6 | React 19.2 `<Activity>` for FilterDrawer | GREEN | MEDIUM | `page.tsx`, `filter-drawer.tsx` | Implement |
| 7 | Dark mode: `dark:brightness-90` on dish photos | GREEN | LOW | `dish-card.tsx` | Implement |
| 8 | Skeleton cross-fade (opacity transition) | GREEN | LOW | `page.tsx` | Implement |
| 9 | Personalized section header strings | GREEN | MEDIUM | `page.tsx` | Implement |
| 10 | RSC conversion: dish + restaurant detail pages | YELLOW | HIGH | `dish/[id]/page.tsx`, `restaurant/[id]/page.tsx` | Plan carefully |
| 11 | `startTransition` for favorite toggle (already fast) | GREEN | LOW | `dish-card.tsx` | Skip — already optimistic |
| 12 | Infinite scroll page landmark dividers | GREEN | LOW | `page.tsx` | Implement |
| 13 | WaitBadge data freshness tooltip | GREEN | LOW | `wait-badge.tsx` | Implement |
| 14 | Hero first card in grid (asymmetric layout) | YELLOW | MEDIUM | `page.tsx`, `dish-card.tsx` | Design review first |
| 15 | `useEffectEvent` for debounce cleanup | GREEN | LOW | `page.tsx`, `search-typeahead.tsx` | Next cycle |

---

## Files Not Yet Audited (For Next Session)

- `src/components/search-typeahead.tsx` — recent search localStorage pattern
- `src/app/onboarding/page.tsx` — step animation, GLP-1 goal option
- `src/components/category-pills.tsx` — `startTransition` gap
- `src/components/macro-bar.tsx` — range display (min/max) vs avg()
- `src/app/recognize/page.tsx` — camera UX, mobile accessibility

---

*Written by: Frontend Research Agent | 2026-04-04*
