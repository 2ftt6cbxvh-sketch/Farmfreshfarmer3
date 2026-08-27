export interface MobileStarTheme {
  stars: number;
  color: string;           // Primary accent hex (e.g. #c0c0c0 for Silver, #fbbf24 for Gold)
  badgeBg: string;         // Translucent badge background
  border: string;          // Border hex
  heroBgDark: string;      // Hero card bg dark mode
  heroBgLight: string;     // Hero card bg light mode
  avatarBg: string;        // Avatar circle bg
  avatarBorder: string;    // Avatar circle border
  glowColor: string;       // Glow halo
  buttonBg: string;        // Button background
  buttonTextColor: string; // Button text color
  label: string;           // Label
  gradientColors: [string, string, string]; // 3-step gradient for Lakshmi & headers
}

export function getMobileStarTheme(count: number): MobileStarTheme {
  const stars = Math.max(0, Math.min(6, count));

  if (stars <= 2) {
    // 0, 1, 2 = Green Tier
    return {
      stars,
      color: '#22c55e',
      badgeBg: 'rgba(34, 197, 94, 0.2)',
      border: 'rgba(34, 197, 94, 0.45)',
      heroBgDark: '#062319',
      heroBgLight: '#ecfdf5',
      avatarBg: '#10b981',
      avatarBorder: '#34d399',
      glowColor: 'rgba(34, 197, 94, 0.3)',
      buttonBg: '#10b981',
      buttonTextColor: '#ffffff',
      label: stars === 0 ? 'Green Tier (0 Stars)' : `${stars} Star Green`,
      gradientColors: ['#065f46', '#059669', '#10b981'],
    };
  } else if (stars === 3) {
    // 3 = Deep Metallic Bronze Tier (Rich Warm Dark Brown - distinctly different from Gold)
    return {
      stars: 3,
      color: '#b45309',
      badgeBg: 'rgba(120, 53, 15, 0.3)',
      border: 'rgba(146, 64, 14, 0.65)',
      heroBgDark: '#200f05',
      heroBgLight: '#fffbeb',
      avatarBg: '#78350f',
      avatarBorder: '#92400e',
      glowColor: 'rgba(120, 53, 15, 0.5)',
      buttonBg: '#78350f',
      buttonTextColor: '#fef3c7',
      label: '3 Star Bronze',
      gradientColors: ['#451a03', '#78350f', '#92400e'],
    };
  } else if (stars === 4) {
    // 4 = Silver Tier
    return {
      stars: 4,
      color: '#e2e8f0',
      badgeBg: 'rgba(192, 192, 192, 0.25)',
      border: 'rgba(203, 213, 225, 0.6)',
      heroBgDark: '#0f172a',
      heroBgLight: '#f1f5f9',
      avatarBg: '#64748b',
      avatarBorder: '#cbd5e1',
      glowColor: 'rgba(192, 192, 192, 0.35)',
      buttonBg: '#cbd5e1',
      buttonTextColor: '#0f172a',
      label: '4 Star Silver',
      gradientColors: ['#334155', '#64748b', '#94a3b8'],
    };
  } else if (stars === 5) {
    // 5 = Blue Tier
    return {
      stars: 5,
      color: '#3b82f6',
      badgeBg: 'rgba(59, 130, 246, 0.22)',
      border: 'rgba(59, 130, 246, 0.55)',
      heroBgDark: '#0a192f',
      heroBgLight: '#eff6ff',
      avatarBg: '#2563eb',
      avatarBorder: '#60a5fa',
      glowColor: 'rgba(59, 130, 246, 0.35)',
      buttonBg: '#3b82f6',
      buttonTextColor: '#ffffff',
      label: '5 Star Blue',
      gradientColors: ['#1e3a8a', '#2563eb', '#60a5fa'],
    };
  } else {
    // 6 = Executive Gold Tier (Radiant Sunlight Gold)
    return {
      stars: 6,
      color: '#fbbf24',
      badgeBg: 'rgba(251, 191, 36, 0.25)',
      border: 'rgba(251, 191, 36, 0.65)',
      heroBgDark: '#231902',
      heroBgLight: '#fefce8',
      avatarBg: '#d97706',
      avatarBorder: '#fde047',
      glowColor: 'rgba(251, 191, 36, 0.4)',
      buttonBg: '#fbbf24',
      buttonTextColor: '#0f172a',
      label: '6 Star Gold',
      gradientColors: ['#78350f', '#d97706', '#fbbf24'],
    };
  }
}
