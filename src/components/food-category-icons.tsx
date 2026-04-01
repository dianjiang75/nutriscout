/**
 * Food category icons — Logaster style.
 * Bold dark outlines, flat color fills (coral, gold, teal, green), playful but clean.
 */

const S = { strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const S2 = { ...S, strokeWidth: 2.5 };
const S1 = { ...S, strokeWidth: 2 };
const C = "#2D3436"; // outline color

export function ThaiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <ellipse cx="32" cy="40" rx="22" ry="10" fill="#E0E0E0" stroke={C} {...S} />
      <ellipse cx="32" cy="38" rx="18" ry="7" fill="#F5F5F5" stroke={C} {...S1} />
      <path d="M18 36c4 4 8-3 12 1s8-3 12 1" stroke="#FFCC80" {...S} />
      <path d="M20 32c3 3 7-2 10 1s7-2 10 1" stroke="#FFE082" {...S2} />
      <path d="M40 30c2-1 4 0 4 2s-2 3-4 2" fill="#FF8A65" stroke={C} {...S1} />
      <path d="M20 28l4 2-1 4z" fill="#81C784" stroke={C} strokeWidth={1.5} />
      <line x1="46" y1="12" x2="36" y2="34" stroke={C} {...S2} />
      <line x1="50" y1="14" x2="38" y2="32" stroke={C} {...S2} />
      <circle cx="28" cy="34" r="1.5" fill="#FFAB91" />
      <circle cx="32" cy="32" r="1.5" fill="#FFAB91" />
    </svg>
  );
}

export function JapaneseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <rect x="14" y="22" width="36" height="24" rx="6" fill="#81C784" stroke={C} {...S} />
      <rect x="20" y="22" width="24" height="24" rx="4" fill="#FAFAFA" stroke={C} {...S} />
      <circle cx="32" cy="34" r="6" fill="#EF5350" stroke={C} {...S2} />
      <circle cx="28" cy="32" r="2" fill="#FF8A65" />
      <circle cx="35" cy="36" r="1.5" fill="#FF8A65" />
      <circle cx="32" cy="30" r="1.5" fill="#FFE082" />
    </svg>
  );
}

export function ItalianIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M32 8L10 52h44L32 8z" fill="#FFCC80" stroke={C} {...S} />
      <path d="M14 48h36L32 14 14 48z" fill="#FFE082" />
      <circle cx="26" cy="38" r="4" fill="#EF5350" stroke={C} {...S1} />
      <circle cx="36" cy="42" r="3.5" fill="#EF5350" stroke={C} {...S1} />
      <circle cx="30" cy="30" r="3" fill="#EF5350" stroke={C} {...S1} />
      <circle cx="22" cy="44" r="2" fill="#81C784" />
      <circle cx="38" cy="34" r="2" fill="#81C784" />
    </svg>
  );
}

export function MexicanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M8 40c0-14 10.7-26 24-26s24 12 24 26" fill="#FFE082" stroke={C} {...S} />
      <path d="M14 38c2-4 5-6 8-6 4 0 6 3 10 3s6-3 10-3c3 0 6 2 8 6" fill="#81C784" stroke={C} {...S1} />
      <circle cx="22" cy="34" r="3" fill="#EF5350" />
      <circle cx="32" cy="32" r="2.5" fill="#FF8A65" />
      <circle cx="40" cy="35" r="2.5" fill="#EF5350" />
      <path d="M8 40h48" stroke={C} {...S} />
      <ellipse cx="32" cy="46" rx="22" ry="4" fill="#FFD54F" stroke={C} {...S} />
    </svg>
  );
}

export function IndianIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M16 30h32v16c0 6-7 10-16 10S16 52 16 46V30z" fill="#FF8A65" stroke={C} {...S} />
      <ellipse cx="32" cy="30" rx="16" ry="5" fill="#FFAB91" stroke={C} {...S} />
      <path d="M12 30h4" stroke={C} {...S} />
      <path d="M48 30h4" stroke={C} {...S} />
      <path d="M26 18c0-4 2-6 2-10" stroke={C} {...S2} opacity={0.5} />
      <path d="M32 16c0-4 2-6 2-10" stroke={C} {...S2} opacity={0.5} />
      <path d="M38 18c0-4 2-6 2-10" stroke={C} {...S2} opacity={0.5} />
    </svg>
  );
}

export function ChineseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M18 24l-4 28h36l-4-28H18z" fill="#EF5350" stroke={C} {...S} />
      <path d="M14 32h36" stroke={C} {...S} />
      <path d="M18 24h28l2-6H16l2 6z" fill="#FFCDD2" stroke={C} {...S} />
      <path d="M28 32v-4c0-2 1.8-3 4-3s4 1 4 3v4" stroke="#FFE082" {...S2} />
      <line x1="26" y1="12" x2="22" y2="4" stroke={C} {...S2} />
      <line x1="38" y1="12" x2="42" y2="4" stroke={C} {...S2} />
    </svg>
  );
}

export function KoreanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <ellipse cx="32" cy="38" rx="20" ry="12" fill="#455A64" stroke={C} {...S} />
      <ellipse cx="32" cy="36" rx="16" ry="9" fill="#616161" stroke={C} {...S1} />
      <line x1="20" y1="34" x2="44" y2="34" stroke="#424242" strokeWidth={1.5} />
      <line x1="20" y1="38" x2="44" y2="38" stroke="#424242" strokeWidth={1.5} />
      <line x1="22" y1="31" x2="42" y2="31" stroke="#424242" strokeWidth={1.5} />
      <ellipse cx="27" cy="33" rx="5" ry="3" fill="#EF5350" stroke={C} {...S1} transform="rotate(-10 27 33)" />
      <ellipse cx="38" cy="35" rx="5" ry="3" fill="#D32F2F" stroke={C} {...S1} transform="rotate(5 38 35)" />
      <ellipse cx="30" cy="38" rx="4" ry="2.5" fill="#FF8A65" stroke={C} strokeWidth={1.5} />
      <path d="M24 22c0-3 1.5-5 1.5-8" stroke={C} {...S1} opacity={0.35} />
      <path d="M32 20c0-3 1.5-5 1.5-8" stroke={C} {...S1} opacity={0.35} />
      <path d="M40 22c0-3 1.5-5 1.5-8" stroke={C} {...S1} opacity={0.35} />
    </svg>
  );
}

export function MediterraneanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <ellipse cx="32" cy="40" rx="20" ry="12" fill="#C8E6C9" stroke={C} {...S} />
      <ellipse cx="32" cy="38" rx="14" ry="8" fill="#E8F5E9" stroke={C} {...S1} />
      <ellipse cx="28" cy="36" rx="3.5" ry="5" fill="#7CB342" stroke={C} {...S1} transform="rotate(-15 28 36)" />
      <ellipse cx="36" cy="36" rx="3.5" ry="5" fill="#7CB342" stroke={C} {...S1} transform="rotate(15 36 36)" />
      <path d="M32 12v20" stroke="#558B2F" {...S2} />
      <ellipse cx="26" cy="18" rx="4" ry="2.5" fill="#81C784" stroke={C} {...S1} transform="rotate(-30 26 18)" />
      <ellipse cx="38" cy="18" rx="4" ry="2.5" fill="#81C784" stroke={C} {...S1} transform="rotate(30 38 18)" />
    </svg>
  );
}

export function AmericanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M12 30h40c0-12-9-18-20-18S12 18 12 30z" fill="#FFCC80" stroke={C} {...S} />
      <rect x="10" y="30" width="44" height="6" rx="2" fill="#81C784" stroke={C} {...S} />
      <rect x="10" y="36" width="44" height="6" rx="1" fill="#8D6E63" stroke={C} {...S} />
      <rect x="10" y="42" width="44" height="4" rx="1" fill="#EF5350" stroke={C} {...S1} />
      <path d="M10 46h44c0 4-9 8-22 8S10 50 10 46z" fill="#FFE082" stroke={C} {...S} />
      <circle cx="20" cy="24" r="1.5" fill="#FFE082" />
      <circle cx="32" cy="22" r="1.5" fill="#FFE082" />
      <circle cx="44" cy="24" r="1.5" fill="#FFE082" />
    </svg>
  );
}

export function VietnameseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M10 34c0 10 9.8 18 22 18s22-8 22-18" fill="#FFAB91" stroke={C} {...S} />
      <ellipse cx="32" cy="34" rx="22" ry="7" fill="#FFE0B2" stroke={C} {...S} />
      <path d="M20 32c4-2 8 2 12 0s8 2 12 0" stroke="#8D6E63" {...S1} />
      <circle cx="26" cy="30" r="2" fill="#81C784" />
      <circle cx="38" cy="30" r="2" fill="#81C784" />
      <path d="M24 18c0-4 2-6 2-10" stroke={C} {...S1} opacity={0.4} />
      <path d="M32 16c0-4 2-6 2-10" stroke={C} {...S1} opacity={0.4} />
      <path d="M40 18c0-4 2-6 2-10" stroke={C} {...S1} opacity={0.4} />
    </svg>
  );
}

export function LunchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="36" r="18" fill="#E0E0E0" stroke={C} {...S} />
      <circle cx="32" cy="36" r="12" fill="#F5F5F5" stroke={C} {...S1} />
      <line x1="12" y1="20" x2="12" y2="52" stroke={C} {...S} />
      <path d="M8 20h8v10c0 2-1.8 3-4 3s-4-1-4-3V20z" stroke={C} {...S} fill="#FFE082" />
      <line x1="52" y1="20" x2="52" y2="52" stroke={C} {...S} />
      <path d="M49 20c0 6 3 8 3 12" stroke={C} {...S} />
      <path d="M55 20c0 6-3 8-3 12" stroke={C} {...S} />
    </svg>
  );
}

export function DinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <circle cx="36" cy="38" r="16" fill="#E0E0E0" stroke={C} {...S} />
      <circle cx="36" cy="38" r="10" fill="#F5F5F5" stroke={C} {...S1} />
      <path d="M14 14h12v8c0 4-2.7 7-6 7s-6-3-6-7v-8z" fill="#EF5350" stroke={C} {...S2} />
      <line x1="20" y1="29" x2="20" y2="48" stroke={C} {...S2} />
      <line x1="14" y1="48" x2="26" y2="48" stroke={C} {...S2} />
    </svg>
  );
}

export function BreakfastIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <rect x="28" y="14" width="24" height="28" rx="4" fill="#FFCC80" stroke={C} {...S} />
      <rect x="32" y="18" width="16" height="20" rx="2" fill="#FFE082" />
      <ellipse cx="24" cy="38" rx="14" ry="16" fill="#FAFAFA" stroke={C} {...S} />
      <ellipse cx="24" cy="36" rx="8" ry="9" fill="#FFE082" stroke={C} {...S2} />
      <ellipse cx="24" cy="34" rx="4" ry="4.5" fill="#FFC107" />
    </svg>
  );
}

export function PizzaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M32 6L6 56h52L32 6z" fill="#FFCC80" stroke={C} {...S} />
      <path d="M10 50h44L32 12 10 50z" fill="#FFE082" />
      <circle cx="24" cy="40" r="4.5" fill="#EF5350" stroke={C} {...S1} />
      <circle cx="36" cy="44" r="4" fill="#EF5350" stroke={C} {...S1} />
      <circle cx="32" cy="30" r="3.5" fill="#EF5350" stroke={C} {...S1} />
      <circle cx="20" cy="48" r="2" fill="#558B2F" />
      <circle cx="40" cy="36" r="2" fill="#558B2F" />
    </svg>
  );
}

export function SushiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <ellipse cx="32" cy="40" rx="18" ry="8" fill="#2D3436" stroke={C} {...S} />
      <rect x="14" y="24" width="36" height="16" rx="8" fill="#FAFAFA" stroke={C} {...S} />
      <rect x="20" y="20" width="24" height="10" rx="5" fill="#EF5350" stroke={C} {...S2} />
      <path d="M20 30h24" stroke={C} {...S1} />
    </svg>
  );
}

export function BowlsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M8 32c0 12 10.7 20 24 20s24-8 24-20" fill="#4FC3F7" stroke={C} {...S} />
      <ellipse cx="32" cy="32" rx="24" ry="8" fill="#81D4FA" stroke={C} {...S} />
      <circle cx="24" cy="30" r="3" fill="#EF5350" />
      <circle cx="32" cy="28" r="3" fill="#FFE082" />
      <circle cx="40" cy="30" r="3" fill="#81C784" />
    </svg>
  );
}

export function SaladsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <ellipse cx="32" cy="42" rx="20" ry="10" fill="#C8E6C9" stroke={C} {...S} />
      <ellipse cx="26" cy="32" rx="8" ry="12" fill="#66BB6A" stroke={C} {...S2} transform="rotate(-10 26 32)" />
      <ellipse cx="38" cy="32" rx="8" ry="12" fill="#81C784" stroke={C} {...S2} transform="rotate(10 38 32)" />
      <circle cx="30" cy="36" r="3" fill="#EF5350" />
      <circle cx="36" cy="34" r="2" fill="#FFE082" />
    </svg>
  );
}

export function SandwichesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M10 28h44l-4 8H14l-4-8z" fill="#81C784" stroke={C} {...S} />
      <path d="M8 28c0-8 10.7-16 24-16s24 8 24 16H8z" fill="#FFCC80" stroke={C} {...S} />
      <rect x="14" y="36" width="36" height="5" rx="1" fill="#EF5350" stroke={C} {...S1} />
      <rect x="14" y="41" width="36" height="5" rx="1" fill="#FFE082" stroke={C} {...S1} />
      <path d="M10 46h44c0 4-9.8 8-22 8S10 50 10 46z" fill="#FFCC80" stroke={C} {...S} />
    </svg>
  );
}

export function BurgersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M12 30h40c0-12-9-18-20-18S12 18 12 30z" fill="#FFCC80" stroke={C} {...S} />
      <rect x="10" y="30" width="44" height="5" rx="2" fill="#81C784" stroke={C} {...S2} />
      <rect x="10" y="35" width="44" height="6" rx="1" fill="#8D6E63" stroke={C} {...S2} />
      <rect x="10" y="41" width="44" height="3" rx="1" fill="#EF5350" stroke={C} {...S1} />
      <path d="M10 44h44c0 4-9 8-22 8S10 48 10 44z" fill="#FFE082" stroke={C} {...S} />
    </svg>
  );
}

export function NoodlesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M10 34c0 10 9.8 18 22 18s22-8 22-18" fill="#FFE082" stroke={C} {...S} />
      <ellipse cx="32" cy="34" rx="22" ry="7" fill="#FFF9C4" stroke={C} {...S} />
      <path d="M18 32c4 4 8-4 12 0s8-4 12 0" stroke="#FFAB91" {...S} />
      <path d="M20 28c3 3 6-3 9 0s6-3 9 0" stroke="#FFAB91" {...S2} />
      <line x1="24" y1="10" x2="20" y2="28" stroke={C} {...S} />
      <line x1="40" y1="10" x2="44" y2="28" stroke={C} {...S} />
    </svg>
  );
}

export function SoupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M10 34c0 10 9.8 18 22 18s22-8 22-18" fill="#EF5350" stroke={C} {...S} />
      <ellipse cx="32" cy="34" rx="22" ry="7" fill="#FFAB91" stroke={C} {...S} />
      <path d="M6 34h4" stroke={C} {...S} />
      <path d="M54 34h4" stroke={C} {...S} />
      <path d="M24 18c0-4 2-6 2-10" stroke={C} {...S2} opacity={0.4} />
      <path d="M32 16c0-4 2-6 2-10" stroke={C} {...S2} opacity={0.4} />
      <path d="M40 18c0-4 2-6 2-10" stroke={C} {...S2} opacity={0.4} />
    </svg>
  );
}

export function TacosIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <path d="M8 42c0-16 10.7-28 24-28s24 12 24 28" fill="#FFE082" stroke={C} {...S} />
      <path d="M16 38c2-4 5-7 8-7 4 0 6 4 10 4s6-4 10-4c3 0 6 3 8 7" fill="#81C784" stroke={C} {...S1} />
      <circle cx="24" cy="34" r="3" fill="#EF5350" />
      <circle cx="34" cy="32" r="2.5" fill="#FF8A65" />
      <circle cx="42" cy="35" r="2.5" fill="#FAFAFA" />
      <ellipse cx="32" cy="48" rx="22" ry="5" fill="#FFD54F" stroke={C} {...S} />
    </svg>
  );
}

// Icon map for use in CategoryPills
export const CATEGORY_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
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
  lunch: LunchIcon,
  dinner: DinnerIcon,
  breakfast: BreakfastIcon,
  pizza: PizzaIcon,
  sushi: SushiIcon,
  bowls: BowlsIcon,
  salads: SaladsIcon,
  sandwiches: SandwichesIcon,
  burgers: BurgersIcon,
  noodles: NoodlesIcon,
  soup: SoupIcon,
  tacos: TacosIcon,
};
