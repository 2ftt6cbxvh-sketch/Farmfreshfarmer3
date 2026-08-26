/**
 * Star Theme Colors Utility
 * Enforces exact tier color themes:
 * - 1 & 2 Stars: Green (#22c55e)
 * - 3 Stars: Bronze (#cd7f32)
 * - 4 Stars: Silver (#c0c0c0)
 * - 5 Stars: Blue (#3b82f6) for all customers and admins
 * - 6 Stars (Super Admin): Gold & Yellow Glow (#fbbf24)
 * - 0 Stars: Neutral muted
 *
 * Supports Admin Panel ON/OFF toggle state (`enable_star_tier_colors`).
 */

export interface StarTheme {
  starColor: string;       // Tailwind text color e.g. text-emerald-500
  fillColor: string;       // Hex fill e.g. #22c55e
  glowClass: string;       // Tailwind drop-shadow glow
  badgeClass: string;      // Badge background, border, text
  borderClass: string;     // Border color for cards
  bgClass: string;         // Light/Dark background for active card
  label: string;           // Human readable tier label
  mobileColor: string;     // Hex for React Native
  mobileBadgeBg: string;   // Hex badge bg for React Native
  mobileBorder: string;    // Hex border for React Native
}

export function getStarTheme(count: number, enabled: boolean = true): StarTheme {
  const stars = Math.max(0, Math.min(6, count));

  if (!enabled) {
    // Default theme when admin toggle is turned OFF
    return {
      starColor: "text-amber-400 dark:text-amber-400",
      fillColor: "#fbbf24",
      glowClass: "drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]",
      badgeClass: "bg-amber-500/15 border-amber-400/30 text-amber-600 dark:text-amber-400",
      borderClass: "border-amber-500/50",
      bgClass: "bg-amber-500/10",
      label: `${stars} Star${stars === 1 ? '' : 's'}`,
      mobileColor: "#fbbf24",
      mobileBadgeBg: "rgba(251,191,36,0.15)",
      mobileBorder: "rgba(251,191,36,0.4)",
    };
  }

  // Tier-based Star Color Themes (when enabled)
  if (stars <= 2) {
    // 0, 1 & 2 Stars = Green
    return {
      starColor: "text-emerald-500 dark:text-emerald-400",
      fillColor: "#22c55e",
      glowClass: "drop-shadow-[0_0_8px_rgba(34,197,94,0.75)]",
      badgeClass: "bg-emerald-500/20 border-emerald-400/40 text-emerald-700 dark:text-emerald-300 font-extrabold",
      borderClass: "border-emerald-500/60 ring-2 ring-emerald-500/30",
      bgClass: "bg-emerald-500/15",
      label: stars === 0 ? "Green Tier (0 Stars)" : stars === 1 ? "1 Star (Green Tier)" : "2 Stars (Green Tier)",
      mobileColor: "#22c55e",
      mobileBadgeBg: "rgba(34,197,94,0.18)",
      mobileBorder: "rgba(34,197,94,0.45)",
    };
  } else if (stars === 3) {
    // 3 Stars = Bronze (#cd7f32)
    return {
      starColor: "text-[#cd7f32] dark:text-[#e59850]",
      fillColor: "#cd7f32",
      glowClass: "drop-shadow-[0_0_8px_rgba(205,127,50,0.85)]",
      badgeClass: "bg-[#cd7f32]/20 border-[#cd7f32]/45 text-[#9a5416] dark:text-[#f4aa64] font-extrabold",
      borderClass: "border-[#cd7f32]/70 ring-2 ring-[#cd7f32]/30",
      bgClass: "bg-[#cd7f32]/15",
      label: "3 Stars (Bronze Tier)",
      mobileColor: "#cd7f32",
      mobileBadgeBg: "rgba(205,127,50,0.18)",
      mobileBorder: "rgba(205,127,50,0.45)",
    };
  } else if (stars === 4) {
    // 4 Stars = Silver (#c0c0c0)
    return {
      starColor: "text-slate-300 dark:text-slate-200",
      fillColor: "#c0c0c0",
      glowClass: "drop-shadow-[0_0_9px_rgba(192,192,192,0.9)]",
      badgeClass: "bg-slate-400/25 border-slate-300/50 text-slate-900 dark:text-slate-100 font-extrabold",
      borderClass: "border-slate-300/80 ring-2 ring-slate-300/30",
      bgClass: "bg-slate-400/15",
      label: "4 Stars (Silver Tier)",
      mobileColor: "#c0c0c0",
      mobileBadgeBg: "rgba(192,192,192,0.22)",
      mobileBorder: "rgba(192,192,192,0.55)",
    };
  } else if (stars === 5) {
    // 5 Stars = Blue (#3b82f6) for all customers and admins
    return {
      starColor: "text-blue-500 dark:text-blue-400",
      fillColor: "#3b82f6",
      glowClass: "drop-shadow-[0_0_10px_rgba(59,130,246,0.85)]",
      badgeClass: "bg-blue-500/20 border-blue-400/40 text-blue-700 dark:text-blue-300 font-extrabold",
      borderClass: "border-blue-500/70 ring-2 ring-blue-500/30",
      bgClass: "bg-blue-500/15",
      label: "5 Stars (Blue Tier)",
      mobileColor: "#3b82f6",
      mobileBadgeBg: "rgba(59,130,246,0.2)",
      mobileBorder: "rgba(59,130,246,0.45)",
    };
  } else {
    // 6 Stars (Super Admin) = Gold & Yellow Glow (#fbbf24)
    return {
      starColor: "text-amber-400 dark:text-yellow-400",
      fillColor: "#fbbf24",
      glowClass: "drop-shadow-[0_0_12px_rgba(251,191,36,0.95)]",
      badgeClass: "bg-amber-500/25 border-amber-400/60 text-amber-700 dark:text-yellow-300 font-black",
      borderClass: "border-amber-400 ring-2 ring-amber-400/40",
      bgClass: "bg-amber-500/20",
      label: "6 Stars (Executive Gold)",
      mobileColor: "#fbbf24",
      mobileBadgeBg: "rgba(251,191,36,0.22)",
      mobileBorder: "rgba(251,191,36,0.6)",
    };
  }
}
