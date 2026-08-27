/**
 * Star Theme Colors Utility
 * Enforces exact tier color themes:
 * - 0, 1 & 2 Stars: Green (#22c55e)
 * - 3 Stars: Bronze (#cd7f32)
 * - 4 Stars: Silver (#c0c0c0)
 * - 5 Stars: Blue (#3b82f6) for all customers and admins
 * - 6 Stars (Super Admin): Gold & Yellow Glow (#fbbf24)
 *
 * Supports Admin Panel ON/OFF toggle state (`enable_star_tier_colors`).
 */

export interface StarTheme {
  tierName: "green" | "bronze" | "silver" | "blue" | "gold";
  starColor: string;       // Tailwind text color e.g. text-emerald-500
  fillColor: string;       // Hex fill e.g. #22c55e
  glowClass: string;       // Tailwind drop-shadow glow
  badgeClass: string;      // Badge background, border, text
  borderClass: string;     // Border color for cards
  bgClass: string;         // Light/Dark background for active card
  label: string;           // Human readable tier label
  btnClass: string;        // Button gradient, shadow, text, hover for action buttons
  btnSecondaryClass: string; // Secondary button styling
  ambientGlowClass: string;// Ambient background sphere glow
  heroBadgeClass: string;  // Hero badge background & border
  accentTextClass: string; // Accent text color (e.g. text-amber-400 / text-emerald-500)
  logoColorClass: string;  // Logo accent text color
  mobileColor: string;     // Hex for React Native
  mobileBadgeBg: string;   // Hex badge bg for React Native
  mobileBorder: string;    // Hex border for React Native
}

export function getStarTheme(count: number, enabled: boolean = true): StarTheme {
  const stars = Math.max(0, Math.min(6, count));

  if (!enabled) {
    // Default theme when admin toggle is turned OFF
    return {
      tierName: "green",
      starColor: "text-amber-400 dark:text-amber-400",
      fillColor: "#fbbf24",
      glowClass: "drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]",
      badgeClass: "bg-amber-500/15 border-amber-400/30 text-amber-600 dark:text-amber-400",
      borderClass: "border-amber-500/50",
      bgClass: "bg-amber-500/10",
      label: `${stars} Star${stars === 1 ? '' : 's'}`,
      btnClass: "bg-gradient-to-r from-emerald-600 via-primary to-green-500 text-white shadow-lg shadow-emerald-900/30 border border-emerald-400/40 hover:brightness-110",
      btnSecondaryClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25",
      ambientGlowClass: "bg-emerald-500/15",
      heroBadgeClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300",
      accentTextClass: "text-emerald-500 dark:text-emerald-400",
      logoColorClass: "text-emerald-500",
      mobileColor: "#fbbf24",
      mobileBadgeBg: "rgba(251,191,36,0.15)",
      mobileBorder: "rgba(251,191,36,0.4)",
    };
  }

  // Tier-based Star Color Themes (when enabled)
  if (stars <= 2) {
    // 0, 1 & 2 Stars = Green
    return {
      tierName: "green",
      starColor: "text-emerald-500 dark:text-emerald-400",
      fillColor: "#22c55e",
      glowClass: "drop-shadow-[0_0_8px_rgba(34,197,94,0.75)]",
      badgeClass: "bg-emerald-500/20 border-emerald-400/40 text-emerald-700 dark:text-emerald-300 font-extrabold",
      borderClass: "border-emerald-500/60 ring-2 ring-emerald-500/30",
      bgClass: "bg-emerald-500/15",
      label: stars === 0 ? "Green Tier (0 Stars)" : stars === 1 ? "1 Star (Green Tier)" : "2 Stars (Green Tier)",
      btnClass: "bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-900/30 border border-emerald-400/40 hover:brightness-110",
      btnSecondaryClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25",
      ambientGlowClass: "bg-emerald-500/15",
      heroBadgeClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300",
      accentTextClass: "text-emerald-500 dark:text-emerald-400",
      logoColorClass: "text-emerald-500",
      mobileColor: "#22c55e",
      mobileBadgeBg: "rgba(34,197,94,0.18)",
      mobileBorder: "rgba(34,197,94,0.45)",
    };
  } else if (stars === 3) {
    // 3 Stars = Deep Metallic Bronze (#854d0e / #78350f) - distinctly darker than Gold
    return {
      tierName: "bronze",
      starColor: "text-[#92400e] dark:text-[#d97706]",
      fillColor: "#78350f",
      glowClass: "drop-shadow-[0_0_8px_rgba(120,53,15,0.85)]",
      badgeClass: "bg-[#78350f]/25 border-[#92400e]/50 text-[#78350f] dark:text-[#d97706] font-extrabold",
      borderClass: "border-[#78350f]/80 ring-2 ring-[#78350f]/30",
      bgClass: "bg-[#78350f]/15",
      label: "3 Stars (Bronze Tier)",
      btnClass: "bg-gradient-to-r from-[#451a03] via-[#78350f] to-[#92400e] text-amber-100 font-bold shadow-lg shadow-[#451a03]/50 border border-[#92400e]/60 hover:brightness-110",
      btnSecondaryClass: "bg-[#78350f]/20 border-[#92400e]/40 text-[#78350f] dark:text-[#d97706] hover:bg-[#78350f]/30",
      ambientGlowClass: "bg-[#78350f]/25",
      heroBadgeClass: "bg-[#78350f]/20 border-[#92400e]/40 text-[#78350f] dark:text-[#d97706]",
      accentTextClass: "text-[#92400e] dark:text-[#d97706]",
      logoColorClass: "text-[#92400e] dark:text-[#d97706]",
      mobileColor: "#78350f",
      mobileBadgeBg: "rgba(120,53,15,0.25)",
      mobileBorder: "rgba(146,64,14,0.65)",
    };
  } else if (stars === 4) {
    // 4 Stars = Silver (#c0c0c0)
    return {
      tierName: "silver",
      starColor: "text-slate-300 dark:text-slate-200",
      fillColor: "#c0c0c0",
      glowClass: "drop-shadow-[0_0_9px_rgba(192,192,192,0.9)]",
      badgeClass: "bg-slate-400/25 border-slate-300/50 text-slate-900 dark:text-slate-100 font-extrabold",
      borderClass: "border-slate-300/80 ring-2 ring-slate-300/30",
      bgClass: "bg-slate-400/15",
      label: "4 Stars (Silver Tier)",
      btnClass: "bg-gradient-to-r from-slate-400 via-slate-200 to-zinc-300 text-slate-950 font-black shadow-lg shadow-slate-300/30 border border-slate-100 hover:brightness-110",
      btnSecondaryClass: "bg-slate-400/20 border-slate-300/40 text-slate-800 dark:text-slate-200 hover:bg-slate-400/30",
      ambientGlowClass: "bg-slate-300/20",
      heroBadgeClass: "bg-slate-400/20 border-slate-300/40 text-slate-900 dark:text-slate-100",
      accentTextClass: "text-slate-300 dark:text-slate-200",
      logoColorClass: "text-slate-300 dark:text-slate-200",
      mobileColor: "#c0c0c0",
      mobileBadgeBg: "rgba(192,192,192,0.22)",
      mobileBorder: "rgba(192,192,192,0.55)",
    };
  } else if (stars === 5) {
    // 5 Stars = Blue (#3b82f6) for all customers and admins
    return {
      tierName: "blue",
      starColor: "text-blue-500 dark:text-blue-400",
      fillColor: "#3b82f6",
      glowClass: "drop-shadow-[0_0_10px_rgba(59,130,246,0.85)]",
      badgeClass: "bg-blue-500/20 border-blue-400/40 text-blue-700 dark:text-blue-300 font-extrabold",
      borderClass: "border-blue-500/70 ring-2 ring-blue-500/30",
      bgClass: "bg-blue-500/15",
      label: "5 Stars (Blue Tier)",
      btnClass: "bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 text-white shadow-lg shadow-blue-900/40 border border-blue-400/50 hover:brightness-110",
      btnSecondaryClass: "bg-blue-500/15 border-blue-500/35 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25",
      ambientGlowClass: "bg-blue-500/20",
      heroBadgeClass: "bg-blue-500/15 border-blue-500/35 text-blue-800 dark:text-blue-300",
      accentTextClass: "text-blue-500 dark:text-blue-400",
      logoColorClass: "text-blue-500 dark:text-blue-400",
      mobileColor: "#3b82f6",
      mobileBadgeBg: "rgba(59,130,246,0.2)",
      mobileBorder: "rgba(59,130,246,0.45)",
    };
  } else {
    // 6 Stars (Super Admin) = Gold & Yellow Glow (#fbbf24)
    return {
      tierName: "gold",
      starColor: "text-amber-400 dark:text-yellow-400",
      fillColor: "#fbbf24",
      glowClass: "drop-shadow-[0_0_12px_rgba(251,191,36,0.95)]",
      badgeClass: "bg-amber-500/25 border-amber-400/60 text-amber-700 dark:text-yellow-300 font-black",
      borderClass: "border-amber-400 ring-2 ring-amber-400/40",
      bgClass: "bg-amber-500/20",
      label: "6 Stars (Executive Gold)",
      btnClass: "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-[0_0_18px_rgba(251,191,36,0.6)] border border-amber-300 hover:brightness-110",
      btnSecondaryClass: "bg-amber-500/20 border-amber-400/50 text-amber-800 dark:text-yellow-300 hover:bg-amber-500/30",
      ambientGlowClass: "bg-amber-500/25",
      heroBadgeClass: "bg-amber-500/20 border-amber-400/50 text-amber-800 dark:text-yellow-300 shadow-[0_0_12px_rgba(251,191,36,0.3)]",
      accentTextClass: "text-amber-400 dark:text-yellow-400",
      logoColorClass: "text-amber-400 dark:text-yellow-400",
      mobileColor: "#fbbf24",
      mobileBadgeBg: "rgba(251,191,36,0.22)",
      mobileBorder: "rgba(251,191,36,0.6)",
    };
  }
}
