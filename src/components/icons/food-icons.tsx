/**
 * Custom illustrated food icons for NutriScout category pills.
 * 16 icons: 10 cuisines + 6 popular dish types.
 *
 * Style: warm fills, rounded strokes, simplified food illustrations.
 * Each icon uses currentColor for strokes and warm accent fills.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

// ─── Cuisines ────────────────────────────────────────

/** Thai — curry bowl with steam */
export function ThaiIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 15c0 3 3.1 5 7 5s7-2 7-5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 15h16" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 15c.5-2.5 2-4 4-5s3.5-1 4.5-3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <ellipse cx="12" cy="12" rx="5" ry="2.5" fill="#F59E0B" opacity="0.3" />
      {/* Steam */}
      <path d="M9 7c0-1 .5-2 1-2.5M12 6c0-1.5.5-2.5 1-3M15 7c0-1-.5-2-1-2.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </Icon>
  );
}

/** Japanese — sushi nigiri with chopsticks */
export function JapaneseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Sushi rice base */}
      <ellipse cx="10" cy="15" rx="5" ry="3" fill="#FEF3C7" stroke="currentColor" strokeWidth="1.5" />
      {/* Fish on top */}
      <path d="M6 13c1-2 3.5-3 5-3s3 1 4 3" fill="#F97316" stroke="#EA580C" strokeWidth="1" />
      {/* Chopsticks */}
      <line x1="17" y1="4" x2="20" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="19" y1="4" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5" />
    </Icon>
  );
}

/** Italian — pasta fork */
export function ItalianIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Plate */}
      <ellipse cx="12" cy="16" rx="7" ry="3" fill="#FEF3C7" stroke="currentColor" strokeWidth="1.5" />
      {/* Pasta swirl */}
      <path d="M9 14c1-3 2-5 3-5s2 2 3 5" stroke="#EAB308" strokeWidth="2" fill="none" />
      <path d="M8 13c2-2 3-4 4-4s2 2 4 4" stroke="#F59E0B" strokeWidth="1.5" fill="none" />
      {/* Fork */}
      <line x1="12" y1="3" x2="12" y2="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 3v4M12 3v4M14 3v4" stroke="currentColor" strokeWidth="1" />
    </Icon>
  );
}

/** Mexican — taco */
export function MexicanIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Taco shell */}
      <path d="M4 16c2-7 5-10 8-10s6 3 8 10" fill="#FDE68A" stroke="currentColor" strokeWidth="1.5" />
      {/* Filling — lettuce */}
      <path d="M7 13c1-2 2.5-3 5-3s4 1 5 3" fill="#86EFAC" stroke="#22C55E" strokeWidth="0.75" />
      {/* Filling — meat */}
      <path d="M8 11c1-1.5 2-2.5 4-2.5s3 1 4 2.5" fill="#F97316" opacity="0.7" />
      {/* Tomato bits */}
      <circle cx="9" cy="12" r="0.8" fill="#EF4444" />
      <circle cx="13" cy="11.5" r="0.8" fill="#EF4444" />
      <circle cx="15" cy="12.5" r="0.7" fill="#EF4444" />
    </Icon>
  );
}

/** Indian — curry pot / bowl with spice */
export function IndianIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Bowl */}
      <path d="M4 12h16v1c0 3.5-3.5 6-8 6s-8-2.5-8-6v-1z" fill="#FDE68A" stroke="currentColor" strokeWidth="1.5" />
      {/* Curry surface */}
      <ellipse cx="12" cy="12" rx="8" ry="2" fill="#F59E0B" stroke="currentColor" strokeWidth="1.5" />
      {/* Spice garnish */}
      <circle cx="10" cy="11.5" r="0.7" fill="#DC2626" />
      <circle cx="14" cy="11.8" r="0.6" fill="#16A34A" />
      <circle cx="12" cy="11" r="0.5" fill="#DC2626" />
      {/* Steam */}
      <path d="M9 8c0-1.5 1-2.5 1.5-3M12 7c0-1.5.5-2 1-2.5M15 8c0-1-.5-2-1-2.5" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </Icon>
  );
}

/** Chinese — takeout box / wok */
export function ChineseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Wok/pan */}
      <path d="M4 13c0 4 3.5 7 8 7s8-3 8-7" stroke="currentColor" strokeWidth="1.5" fill="#FEF3C7" />
      <line x1="3" y1="13" x2="21" y2="13" stroke="currentColor" strokeWidth="1.5" />
      {/* Stir fry contents */}
      <circle cx="9" cy="11" r="1.2" fill="#F97316" />
      <circle cx="12" cy="10.5" r="1" fill="#22C55E" />
      <circle cx="15" cy="11" r="1.1" fill="#EF4444" />
      {/* Handle */}
      <line x1="20" y1="13" x2="22" y2="10" stroke="currentColor" strokeWidth="1.5" />
      {/* Steam */}
      <path d="M10 8c0-1 .5-2 1-2.5M14 8c0-1-.5-2-1-2.5" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </Icon>
  );
}

/** Korean — bibimbap bowl */
export function KoreanIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Bowl */}
      <path d="M4 12c0 4 3.5 7 8 7s8-3 8-7" fill="#FEF3C7" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" />
      {/* Rice base visible */}
      <ellipse cx="12" cy="12" rx="6" ry="1.5" fill="white" opacity="0.5" />
      {/* Toppings arranged in sections */}
      <path d="M8 10.5c1-.5 1.5-1 2-1" stroke="#22C55E" strokeWidth="2" />
      <path d="M12 10c.5-.5 1.5-1 2.5-.5" stroke="#F97316" strokeWidth="2" />
      <path d="M14 10.5c.5 0 1.5-.5 2-.5" stroke="#DC2626" strokeWidth="2" />
      {/* Egg on top */}
      <ellipse cx="12" cy="9.5" rx="1.5" ry="1" fill="#FDE68A" stroke="#F59E0B" strokeWidth="0.75" />
      <circle cx="12" cy="9.5" r="0.5" fill="#F97316" />
    </Icon>
  );
}

/** Mediterranean — olive + leaf */
export function MediterraneanIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Plate */}
      <ellipse cx="12" cy="16" rx="7" ry="3" fill="#FEF3C7" stroke="currentColor" strokeWidth="1.5" />
      {/* Olive branch */}
      <path d="M7 8c3 1 5 3 8 6" stroke="#16A34A" strokeWidth="1.5" fill="none" />
      {/* Leaves */}
      <ellipse cx="9" cy="9" rx="1.5" ry="0.8" fill="#22C55E" transform="rotate(-30 9 9)" />
      <ellipse cx="12" cy="11" rx="1.5" ry="0.8" fill="#22C55E" transform="rotate(-20 12 11)" />
      {/* Olives */}
      <circle cx="8" cy="10.5" r="1" fill="#4B5563" stroke="#374151" strokeWidth="0.5" />
      <circle cx="14" cy="13" r="1" fill="#4B5563" stroke="#374151" strokeWidth="0.5" />
      {/* Feta */}
      <rect x="10" y="14" width="2.5" height="2" rx="0.5" fill="white" stroke="#D1D5DB" strokeWidth="0.5" />
    </Icon>
  );
}

/** American — classic burger */
export function AmericanIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Top bun */}
      <path d="M5 11c0-3 3-5 7-5s7 2 7 5z" fill="#F59E0B" stroke="currentColor" strokeWidth="1.5" />
      {/* Sesame seeds */}
      <ellipse cx="9" cy="8.5" rx="0.6" ry="0.4" fill="#FEF3C7" />
      <ellipse cx="12" cy="7.5" rx="0.6" ry="0.4" fill="#FEF3C7" />
      <ellipse cx="15" cy="8.5" rx="0.6" ry="0.4" fill="#FEF3C7" />
      {/* Lettuce */}
      <path d="M4.5 12c1 .5 2-.3 3.5 0s2.5.5 4 0 2.5-.5 4 0 2.5.3 3.5 0" stroke="#22C55E" strokeWidth="1.5" fill="#86EFAC" />
      {/* Patty */}
      <rect x="5" y="13" width="14" height="2.5" rx="1" fill="#92400E" stroke="currentColor" strokeWidth="1" />
      {/* Cheese */}
      <path d="M5 13l-0.5 1h15l-0.5-1" fill="#FDE68A" />
      {/* Bottom bun */}
      <path d="M5 16h14c0 2-3 3-7 3s-7-1-7-3z" fill="#F59E0B" stroke="currentColor" strokeWidth="1.5" />
    </Icon>
  );
}

/** Vietnamese — pho bowl */
export function VietnameseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Bowl */}
      <path d="M3 12c0 4.5 4 8 9 8s9-3.5 9-8" fill="#FEF3C7" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" />
      {/* Broth */}
      <ellipse cx="12" cy="12" rx="8" ry="2" fill="#FDE68A" opacity="0.6" />
      {/* Noodles */}
      <path d="M7 11c1.5 0 2 .5 3 .5s1.5-.5 3-.5 1.5.5 3 .5" stroke="#F5F5DC" strokeWidth="1.5" />
      {/* Herbs */}
      <circle cx="8" cy="10.5" r="0.8" fill="#22C55E" />
      <circle cx="15" cy="10.5" r="0.7" fill="#22C55E" />
      {/* Lime */}
      <path d="M16 10a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z" fill="#A3E635" stroke="#65A30D" strokeWidth="0.5" />
      {/* Chopsticks */}
      <line x1="17" y1="5" x2="14" y2="11" stroke="currentColor" strokeWidth="1.2" />
      <line x1="19" y1="5" x2="15.5" y2="11" stroke="currentColor" strokeWidth="1.2" />
    </Icon>
  );
}

// ─── Dish Types ──────────────────────────────────────

/** Pizza slice */
export function PizzaIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Slice shape */}
      <path d="M12 3L3 19h18L12 3z" fill="#FDE68A" stroke="currentColor" strokeWidth="1.5" />
      {/* Sauce layer */}
      <path d="M12 6l-6.5 12h13L12 6z" fill="#EF4444" opacity="0.3" />
      {/* Cheese */}
      <path d="M12 7l-5.5 10h11L12 7z" fill="#FDE68A" opacity="0.5" />
      {/* Pepperoni */}
      <circle cx="10" cy="13" r="1.2" fill="#DC2626" />
      <circle cx="14" cy="14" r="1" fill="#DC2626" />
      <circle cx="12" cy="10" r="0.9" fill="#DC2626" />
      {/* Crust edge */}
      <path d="M5 17.5c2.5.8 4.5 1 7 1s4.5-.2 7-1" stroke="#D97706" strokeWidth="1.5" fill="none" />
    </Icon>
  );
}

/** Sushi maki roll */
export function SushiIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Maki piece 1 */}
      <rect x="3" y="9" width="8" height="8" rx="1.5" fill="#1F2937" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="13" r="2.5" fill="white" />
      <circle cx="7" cy="13" r="1.2" fill="#F97316" />
      {/* Maki piece 2 */}
      <rect x="13" y="9" width="8" height="8" rx="1.5" fill="#1F2937" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="13" r="2.5" fill="white" />
      <circle cx="17" cy="13" r="1.2" fill="#F97316" />
      {/* Rice dots */}
      <circle cx="5" cy="11" r="0.4" fill="#E5E7EB" />
      <circle cx="9" cy="15" r="0.4" fill="#E5E7EB" />
      <circle cx="15" cy="11" r="0.4" fill="#E5E7EB" />
      <circle cx="19" cy="15" r="0.4" fill="#E5E7EB" />
    </Icon>
  );
}

/** Poke/Acai bowl */
export function BowlsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Bowl */}
      <path d="M3 11c0 5 4 9 9 9s9-4 9-9" fill="#FEF3C7" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2" y1="11" x2="22" y2="11" stroke="currentColor" strokeWidth="1.5" />
      {/* Sections of toppings */}
      <path d="M6 10c2 0 3-1 3-1" stroke="#22C55E" strokeWidth="2.5" />
      <path d="M10 9.5c1.5 0 2-.5 3-.5" stroke="#F97316" strokeWidth="2.5" />
      <path d="M14 10c1.5 0 2.5-.5 3.5-.5" stroke="#8B5CF6" strokeWidth="2.5" />
      {/* Seeds/garnish */}
      <circle cx="8" cy="9" r="0.5" fill="#FDE68A" />
      <circle cx="12" cy="8.5" r="0.5" fill="#FDE68A" />
      <circle cx="16" cy="9" r="0.5" fill="#FDE68A" />
    </Icon>
  );
}

/** Burger */
export function BurgersIcon(props: IconProps) {
  return <AmericanIcon {...props} />;
}

/** Noodle/Ramen bowl */
export function NoodlesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Bowl */}
      <path d="M3 12c0 4.5 4 8 9 8s9-3.5 9-8" fill="#FEF3C7" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" />
      {/* Noodles */}
      <path d="M6 11c2 .5 3-.5 5 0s2.5.5 4 0 2-.5 3.5 0" stroke="#F5F5DC" strokeWidth="2" />
      <path d="M7 10c1.5.5 2.5-.5 4 0s2 .5 3.5 0" stroke="#FDE68A" strokeWidth="1.5" />
      {/* Egg */}
      <ellipse cx="15" cy="10" rx="1.8" ry="1.3" fill="white" stroke="#F59E0B" strokeWidth="0.75" />
      <circle cx="15" cy="10" r="0.6" fill="#F97316" />
      {/* Naruto/garnish */}
      <circle cx="8" cy="10" r="1.2" fill="white" stroke="#F472B6" strokeWidth="0.75" />
      {/* Chopsticks */}
      <line x1="17" y1="4" x2="14" y2="11" stroke="currentColor" strokeWidth="1.3" />
      <line x1="19" y1="4" x2="15.5" y2="11" stroke="currentColor" strokeWidth="1.3" />
    </Icon>
  );
}

/** Tacos */
export function TacosIcon(props: IconProps) {
  return <MexicanIcon {...props} />;
}

// ─── Mapping ─────────────────────────────────────────

export const FOOD_ICON_MAP: Record<string, (props: IconProps) => JSX.Element> = {
  thai: ThaiIcon,
  japanese: JapaneseIcon,
  italian: ItalianIcon,
  mexican: MexicanIcon,
  indian: IndianIcon,
  chinese: ChineseIcon,
  korean: KoreanIcon,
  mediterranean: MediterraneanIcon,
  american: AmericanIcon,
  vietnamese: VietnameseIcon,
  pizza: PizzaIcon,
  sushi: SushiIcon,
  bowls: BowlsIcon,
  burgers: BurgersIcon,
  noodles: NoodlesIcon,
  tacos: TacosIcon,
};
