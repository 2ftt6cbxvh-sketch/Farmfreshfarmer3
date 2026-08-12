import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface StaffPromotionOverlayProps {
  stars: number;
  title: string;
  role: string;
  onClose: () => void;
}

export function StaffPromotionOverlay({ stars, title, role, onClose }: StaffPromotionOverlayProps) {
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

    // Particle Fireworks Physics Engine (Vibrant Yellow & Red Palette)
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
    // Vibrant Yellow, Crimson Red, Gold, Ruby Sparkle Colors
    const colors = ["#facc15", "#eab308", "#f59e0b", "#ef4444", "#dc2626", "#b91c1c", "#fef08a", "#f43f5e"];

    const createExplosion = (x: number, y: number) => {
      const particleCount = 75;
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5);
        const speed = Math.random() * 9 + 4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colors[Math.floor(Math.random() * colors.length)],
          radius: Math.random() * 3.5 + 1.5,
          alpha: 1,
          decay: Math.random() * 0.014 + 0.007,
        });
      }
    };

    // Initial explosions
    createExplosion(width * 0.25, height * 0.3);
    createExplosion(width * 0.75, height * 0.3);
    createExplosion(width * 0.5, height * 0.2);

    // Periodic vibrant bursts
    const interval = setInterval(() => {
      const rx = Math.random() * width * 0.8 + width * 0.1;
      const ry = Math.random() * height * 0.45 + height * 0.1;
      createExplosion(rx, ry);
    }, 400);

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.085; // gravity
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
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

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-mobile-drawer select-none">
      {/* Canvas Fireworks Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Main Glassmorphism Celebration Card (Vibrant Yellow & Red Theme) */}
      <div className="relative z-10 w-full max-w-md bg-gradient-to-b from-amber-950/90 via-card/95 to-red-950/90 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_60px_rgba(245,158,11,0.5)] backdrop-blur-2xl space-y-5 animate-intro-pop">
        {/* Glowing Shield/Star Badge */}
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-500/35 blur-2xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-red-600 border-2 border-amber-200/60 shadow-2xl flex items-center justify-center text-4xl text-white font-black transform hover:scale-105 transition-transform">
            🛡️
          </div>
        </div>

        {/* Celebration Titles */}
        <div>
          <div className="inline-block px-3.5 py-1 rounded-full bg-amber-500/25 border border-amber-400/50 text-amber-300 font-black text-xs uppercase tracking-widest mb-2 shadow-md">
            🔥 SUB-ADMIN PROMOTION UNLOCKED!
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-foreground tracking-tight">
            Congratulations, <span className="text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.9)]">{title || "Sub-Admin"}</span>!
          </h2>
        </div>

        {/* Star Rating Display */}
        <div className="flex items-center justify-center gap-2 py-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          {Array.from({ length: Math.min(5, Math.max(1, stars)) }, (_, i) => (
            <span
              key={i}
              className="text-2xl sm:text-3xl text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)] animate-bounce"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              ★
            </span>
          ))}
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm font-bold text-amber-200/90 leading-relaxed px-2">
          Primary Admin has officially recognized your leadership and upgraded your staff credentials to{" "}
          <strong className="text-amber-400">{stars} Gold Star Staff Specialist</strong>.
        </p>

        {/* CTA Button */}
        <div className="pt-2">
          <Button
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 via-red-500 to-amber-600 hover:from-amber-400 hover:to-red-400 text-white font-extrabold text-sm shadow-xl shadow-amber-500/40 gap-2 cursor-pointer"
          >
            <span>🔥 Accept Promotion & Continue</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
