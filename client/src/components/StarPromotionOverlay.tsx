import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface StarPromotionOverlayProps {
  stars: number;
  onClose: () => void;
}

export function StarPromotionOverlay({ stars, onClose }: StarPromotionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle Fireworks Physics Engine
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      radius: number;
      alpha: number;
      decay: number;
    }

    const particles: Particle[] = [];
    const colors = ["#60a5fa", "#3b82f6", "#1d4ed8", "#fbbf24", "#34d399", "#f43f5e", "#a855f7"];

    const createExplosion = (x: number, y: number) => {
      const particleCount = 60;
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5);
        const speed = Math.random() * 8 + 3;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colors[Math.floor(Math.random() * colors.length)],
          radius: Math.random() * 3 + 1.5,
          alpha: 1,
          decay: Math.random() * 0.015 + 0.008,
        });
      }
    };

    // Trigger initial bursts
    createExplosion(width * 0.3, height * 0.35);
    createExplosion(width * 0.7, height * 0.35);
    createExplosion(width * 0.5, height * 0.25);

    // Periodic fireworks during overlay visibility
    const interval = setInterval(() => {
      const rx = Math.random() * width * 0.8 + width * 0.1;
      const ry = Math.random() * height * 0.5 + height * 0.1;
      createExplosion(rx, ry);
    }, 450);

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(interval);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const getTierDescription = (s: number) => {
    switch (s) {
      case 1:
        return "✨ Welcome to our VIP Customer Circle! You are officially a 1-Star Verified Loyalty Customer.";
      case 2:
        return "🌟 2-Star VIP Member! Enjoy fast-track packing and priority response times.";
      case 3:
        return "💫 3-Star Elite Customer! Unlocked priority harvest dispatch and exclusive seasonal perks.";
      case 4:
        return "🔥 4-Star SuperVIP Status! Dedicated customer concierge and express delivery routing.";
      case 5:
      default:
        return "👑 5-Star Highest Tier VIP! You hold our maximum customer honor with supreme priority & exclusive rewards.";
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-mobile-drawer">
      {/* Canvas Fireworks Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Main Glassmorphism Celebration Card */}
      <div className="relative z-10 w-full max-w-md bg-card/95 border-2 border-blue-500/50 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_50px_rgba(59,130,246,0.4)] backdrop-blur-2xl space-y-5 animate-intro-pop">
        {/* Glowing Star Badge */}
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-2xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-blue-300/50 shadow-xl flex items-center justify-center text-4xl text-white font-extrabold transform hover:rotate-6 transition-transform">
            ★
          </div>
        </div>

        {/* Celebration Titles */}
        <div>
          <div className="inline-block px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 font-black text-xs uppercase tracking-widest mb-2 shadow-xs">
            🎉 Loyalty Tier Promoted!
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-foreground tracking-tight">
            You are now our <span className="text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">{stars}-Star</span> Customer!
          </h2>
        </div>

        {/* Star Rating Display */}
        <div className="flex items-center justify-center gap-1.5 py-2">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`text-2xl transition-all duration-300 ${
                i < stars
                  ? "text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.9)] scale-110"
                  : "text-muted-foreground/30"
              }`}
            >
              ★
            </span>
          ))}
        </div>

        {/* Dynamic Tier Description */}
        <p className="text-xs sm:text-sm font-semibold text-muted-foreground leading-relaxed px-2">
          {getTierDescription(stars)}
        </p>

        {/* CTA Button */}
        <div className="pt-2">
          <Button
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-blue-500/30 gap-2 cursor-pointer"
          >
            <span>✨ Claim My VIP Status & Continue</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
