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

    // Sequence timer: hold for ~1.2s then fade out
    const holdTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1250);

    // Unmount timer: remove overlay completely after 400ms fade-out
    const unmountTimer = setTimeout(() => {
      hasPlayedSessionIntro = true;
      setVisible(false);
    }, 1650);

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
      {/* Background Soft Organic Glow */}
      <div className="absolute w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none animate-pulse" />

      {/* Main Content Container */}
      <div className="relative flex flex-col items-center justify-center p-6 text-center space-y-4">
        {/* Emblem with Radial Emerald Bloom */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
          <img
            src={imgUrl("/images/logo-icon.png")}
            alt="FarmFreshFarmer"
            className="w-full h-full object-contain filter drop-shadow-md animate-intro-pop"
          />
        </div>

        {/* Brand Name */}
        <div className="animate-intro-text-slide">
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            FarmFresh<span className="text-emerald-500">Farmer</span>
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center justify-center gap-1">
            <span>🌿</span>
            <span>Fresh Harvest · Direct To Your Doorstep</span>
          </p>
        </div>

        {/* Skip Hint */}
        <div className="pt-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
          Tap anywhere to skip
        </div>
      </div>
    </div>
  );
}
