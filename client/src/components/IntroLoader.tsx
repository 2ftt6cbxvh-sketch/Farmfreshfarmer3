import { useState, useEffect } from "react";
import { imgUrl } from "@/lib/queryClient";

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

    // Fast, crisp timing: ~1.1s hold then fade out (slick & non-boring for returning customers)
    const holdTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1100);

    // Unmount timer: remove overlay completely after 300ms fade-out
    const unmountTimer = setTimeout(() => {
      hasPlayedSessionIntro = true;
      setVisible(false);
    }, 1400);

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
    }, 120);
  };

  if (!visible) return null;

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background transition-opacity ease-out select-none cursor-pointer overflow-hidden ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ transitionDuration: "300ms" }}
    >
      {/* Dynamic Ambient Emerald Radial Aura */}
      <div className="absolute w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none animate-pulse" />

      {/* Main Content Container */}
      <div className="relative flex flex-col items-center justify-center p-6 text-center space-y-4">
        {/* Exact Official Logo Image with Shimmer & 3D Pop */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center overflow-hidden rounded-2xl p-1">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
          
          {/* Official Logo Asset */}
          <img
            src={imgUrl("/images/logo-icon.png")}
            alt="FarmFreshFarmer Official Logo"
            className="w-full h-full object-contain filter drop-shadow-[0_4px_20px_rgba(16,185,129,0.4)] animate-logo-sleek-pop"
          />

          {/* Shimmer Light Flare Sweep Across Logo */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent -translate-x-full animate-logo-shimmer pointer-events-none" />
        </div>

        {/* Brand Name & Tagline Unfold */}
        <div className="animate-logo-text-fade">
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            FarmFresh<span className="text-emerald-500">Farmer</span>
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center justify-center gap-1.5">
            <span>🌿</span>
            <span>Fresh Harvest · Direct To Your Doorstep</span>
          </p>
        </div>

        {/* Fast Skip Hint */}
        <div className="pt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">
          Tap anywhere to skip
        </div>
      </div>
    </div>
  );
}
