# UI Deep Research — 2026-03-31

## What's Wrong with Current UI

1. **Generic shadcn default look** — the app looks like every other Next.js starter template
2. **No warmth or food personality** — pure whites and grays feel clinical, not appetizing
3. **Geist font is too cold** — designed for developer tools, not food discovery
4. **Color system lacks vibrancy** — muted greens don't excite about food
5. **No visual hierarchy in cards** — all elements compete for attention
6. **No brand identity** — "FoodClaw" in plain text with no character
7. **Bottom nav feels basic** — no active indicators, too plain

## Research Findings — What Top Apps Do

### Color Psychology for Food Apps
- **Red/orange/warm tones stimulate appetite** — DoorDash (red), Swiggy (orange), Zomato (red)
- **Green = health/freshness** — but needs to be warm green, not clinical
- **Cream/off-white backgrounds** — never pure white, makes food photos pop
- **Deep navy/charcoal for dark mode** — not pure black

### Top Palettes from Research

**Sashimi Palette** (best for dish-first app):
- Primary: #F45F67 (warm coral-red)
- Secondary: #FC7100 (vibrant orange)
- Accent: #5CA135 (fresh green)
- Background: #F5DDC2 (warm cream)
- Highlight: #FB8818 (amber)

**Recommended NutriScout Palette**:
- Primary: Warm emerald green (health + freshness + not generic)
- Accent: Coral/salmon (appetizing, warm, food-associated)
- Background: Warm cream #FAFAF5 (not pure white)
- Cards: True white with subtle shadow
- Text: Charcoal #1A1A2E (not pure black — softer, warmer)
- Dark mode: Deep navy #0F1724 (premium feel)

### Typography
- **Plus Jakarta Sans** — modern geometric, designed for screens, warm personality
- Better than Geist for food apps (Geist is too technical/cold)
- Pairs well with monospace for data (macro values)
- Weights: 500 for body, 600 for labels, 700 for headings, 800 for hero

### Card Design (DoorDash/Deliveroo pattern)
- 16:10 aspect ratio for food photos (wider = more appetizing)
- Subtle shadow + hover lift animation
- Rating overlay on photo (top-right, dark blur background)
- Macro bar directly below name (the data users want fastest)
- Delivery badges as small pills at bottom

### Navigation
- Bottom nav with filled/outlined icon states
- Active tab: brand color + top indicator line
- Labels always visible (not icon-only)

### Micro-interactions
- Card hover: -2px translate + shadow increase + photo 3% scale
- Filter toggle: spring animation on select
- Loading: skeleton with shimmer (not plain pulse)
- Page transitions: subtle fade

## Implementation Plan

1. Switch font from Geist to Plus Jakarta Sans
2. Warm up the entire color palette
3. Add coral/salmon accent color for CTAs and highlights
4. Redesign dish card with better visual hierarchy
5. Add shimmer loading skeletons
6. Polish bottom nav with proper active states
7. Add subtle transitions everywhere
8. Dark mode with premium navy feel

Sources:
- [Color Meanings Food Palettes](https://www.color-meanings.com/food-color-palettes/)
- [UIStudioz Top 10 Food App Designs](https://uistudioz.com/blog/top-10-inspiring-food-delivery-app-ui-ux-designs/)
- [Behance AI Nutrition App](https://www.behance.net/gallery/224079641/AI-Nutrition-Calorie-Tracking-App-UI-UX-Design)
- [Netguru Food App Tips](https://www.netguru.com/blog/food-app-design-tips)
- [Beadaptify Food Delivery Trends](https://beadaptify.com/blog/future-trends-in-food-delivery-app-development/)
- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
- [Dominant Food Palettes 2025](https://palette.site/blog/2025-07-28-dominant-food-palettes/)
