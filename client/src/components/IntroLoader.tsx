import { useState, useEffect } from "react";

// Module-level singleton: guarantees the intro executes strictly ONCE per browser session
let hasPlayedSessionIntro = false;

export function IntroLoader() {
  const [visible, setVisible] = useState(() => {
    if (hasPlayedSessionIntro) return false;
    // Check prefers-reduced-motion accessibility setting
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hasPlayedSessionIntro = true;
      return false;
    }
    return true;
  });

  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!visible) return;

    // Sequence timer: hold full bloom then fade out
    const holdTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1850);

    // Unmount timer: remove overlay completely after 400ms fade-out
    const unmountTimer = setTimeout(() => {
      hasPlayedSessionIntro = true;
      setVisible(false);
    }, 2250);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(unmountTimer);
    };
  }, [visible]);

  const handleSkip = () => {
    hasPlayedSessionIntro = true;
    setFadeOut(true);
    setTimeout(() => {
      setVisible(false);
    }, 150);
  };

  if (!visible) return null;

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background transition-opacity duration-400 ease-out select-none cursor-pointer overflow-hidden ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ transitionDuration: "400ms" }}
    >
      {/* Soft Ambient Organic Emerald Halo */}
      <div className="absolute w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none animate-pulse" />

      {/* Main Sprout Container */}
      <div className="relative flex flex-col items-center justify-center p-6 text-center space-y-5">
        {/* Animated Sprouting SVG Logo Emblem */}
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/25 rounded-full blur-2xl animate-pulse" />
          
          <svg
            viewBox="0 0 500 500"
            className="w-full h-full object-contain filter drop-shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
          >
            {/* 1. Growing Main Rice Stalk & Stem */}
            <path
              d="M 140 440 C 140 300, 160 200, 240 140 C 290 100, 360 80, 440 120"
              fill="none"
              stroke="#10b981"
              strokeWidth="18"
              strokeLinecap="round"
              className="animate-sprout-stem"
            />

            {/* 2. Uncurling Organic Leaf on Left */}
            <g className="animate-leaf-uncurl">
              <path
                d="M 140 380 C 60 340, 40 240, 100 200 C 160 240, 160 330, 140 380 Z"
                fill="#10b981"
              />
              <path
                d="M 140 380 C 110 300, 95 240, 100 200"
                fill="none"
                stroke="#047857"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </g>

            {/* 3. Double F Letterform Stalk Arches */}
            <path
              d="M 180 340 C 190 280, 250 240, 330 240 C 400 240, 430 200, 440 180 M 240 280 H 310"
              fill="none"
              stroke="#059669"
              strokeWidth="16"
              strokeLinecap="round"
              className="animate-sprout-stem"
              style={{ animationDelay: "0.2s" }}
            />
            <path
              d="M 280 380 C 290 320, 350 280, 410 280 C 460 280, 470 240, 475 220 M 340 320 H 400"
              fill="none"
              stroke="#10b981"
              strokeWidth="16"
              strokeLinecap="round"
              className="animate-sprout-stem"
              style={{ animationDelay: "0.4s" }}
            />

            {/* 4. Golden Rice Grains Blossoming Along Arch */}
            <g>
              <ellipse cx="280" cy="115" rx="14" ry="7" fill="#fbbf24" transform="rotate(-30 280 115)" className="animate-grain-pop-1" />
              <ellipse cx="320" cy="98" rx="14" ry="7" fill="#fbbf24" transform="rotate(-20 320 98)" className="animate-grain-pop-2" />
              <ellipse cx="360" cy="90" rx="14" ry="7" fill="#fbbf24" transform="rotate(-5 360 90)" className="animate-grain-pop-3" />
              <ellipse cx="400" cy="95" rx="14" ry="7" fill="#34d399" transform="rotate(15 400 95)" className="animate-grain-pop-4" />
              <ellipse cx="435" cy="110" rx="14" ry="7" fill="#34d399" transform="rotate(30 435 110)" className="animate-grain-pop-5" />
              <ellipse cx="460" cy="135" rx="13" ry="6" fill="#10b981" transform="rotate(45 460 135)" className="animate-grain-pop-6" />
            </g>
          </svg>
        </div>

        {/* Brand Name & Customer Tagline Unfold */}
        <div className="animate-text-reveal">
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            FarmFresh<span className="text-emerald-500">Farmer</span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center justify-center gap-1.5">
            <span>🌾</span>
            <span>Organic · Farm to Home Delivery</span>
          </p>
        </div>

        {/* Skip Hint */}
        <div className="pt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
          Tap anywhere to skip
        </div>
      </div>
    </div>
  );
}
