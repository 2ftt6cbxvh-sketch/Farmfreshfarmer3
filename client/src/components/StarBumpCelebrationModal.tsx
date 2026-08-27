import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/store";
import { getStarTheme, StarTheme } from "@/lib/starTheme";
import { Sparkles, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StarBumpDetail {
  stars: number;
  oldStars?: number;
  role?: string;
  name?: string;
}

export function StarBumpCelebrationModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [bumpInfo, setBumpInfo] = useState<StarBumpDetail | null>(null);
  const prevStarsRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isSuperAdmin = Boolean(
    user?.isPrimaryAdmin ||
    user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    user?.id === 1 ||
    (user?.role === "admin" && (user?.id === 0 || user?.isPrimaryAdmin))
  );
  const isStaff = Boolean(!isSuperAdmin && user && user.role !== "customer");
  const currentStars = user
    ? (isSuperAdmin
        ? 6
        : isStaff
        ? Math.max(0, Math.min(6, Number(user.starRating) ?? 5))
        : Math.max(0, Math.min(5, Number(user.customerStars) || 0)))
    : 0;

  useEffect(() => {
    if (!user) {
      prevStarsRef.current = null;
      return;
    }
    const storageKey = `fff_last_stars_${user.id}`;
    const storedStarsStr = localStorage.getItem(storageKey);
    const storedStars = storedStarsStr !== null ? parseInt(storedStarsStr, 10) : null;
    if (storedStars !== null && currentStars > storedStars) {
      setBumpInfo({ stars: currentStars, oldStars: storedStars, role: user.role, name: user.name || "Farmer Friend" });
      setIsOpen(true);
    }
    localStorage.setItem(storageKey, String(currentStars));
    prevStarsRef.current = currentStars;
  }, [currentStars, user]);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<StarBumpDetail>;
      if (customEvent.detail && customEvent.detail.stars > 0) {
        setBumpInfo(customEvent.detail);
        setIsOpen(true);
      }
    };
    window.addEventListener("star-bump-celebration", handler);
    return () => window.removeEventListener("star-bump-celebration", handler);
  }, []);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#fbbf24", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ffffff", "#d97706"];
    const particles: Array<{ x:number; y:number; vx:number; vy:number; size:number; color:string; rotation:number; rotSpeed:number; opacity:number }> = [];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.45 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 18 - 3,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }
    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35;
        p.vx *= 0.98;
        p.rotation += p.rotSpeed;
        p.opacity -= 0.008;
        if (p.opacity > 0 && p.y < canvas.height) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });
      if (alive) animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  if (!isOpen || !bumpInfo) return null;

  const starTheme: StarTheme = getStarTheme(bumpInfo.stars);
  const starCount = bumpInfo.stars;

  const getPerks = () => {
    if (starCount >= 6) return [
      { icon: "👑", title: "Master Super Admin Clearance", desc: "Full root administrative control and global platform governance." },
      { icon: "🪔", title: "Lakshmi VIP Executive Concierge", desc: "Priority Lakshmi AI operations & custom executive assistance." },
      { icon: "⚡", title: "Immediate Order Dispatch", desc: "Priority queue processing for test and demonstration deliveries." },
      { icon: "🌟", title: "Royal Gold Aura & Accents", desc: "Exclusive golden interface glow across web and mobile apps." },
    ];
    if (starCount === 5) return [
      { icon: "💎", title: "Elite 5-Star VIP Status", desc: "Maximum 15% tier discounts on fresh harvest baskets." },
      { icon: "🚚", title: "Zero Delivery Fee Threshold", desc: "Free delivery unlocked on all qualifying local farm orders." },
      { icon: "🪔", title: "VIP Lakshmi Support", desc: "Immediate human agent escalation & dedicated WhatsApp line." },
      { icon: "🎁", title: "Double Referral Rewards", desc: "Earn double bonus points on every successful friend referral." },
    ];
    if (starCount === 4) return [
      { icon: "🔷", title: "Silver Tier Rewards", desc: "10% tier discounts applied automatically at checkout." },
      { icon: "⚡", title: "Express Dispatch", desc: "Priority packing at local warehouse hub." },
      { icon: "🪔", title: "Enhanced Lakshmi Guidance", desc: "Instant seasonal recommendations & customized farm updates." },
    ];
    if (starCount === 3) return [
      { icon: "🥉", title: "Bronze Tier Privileges", desc: "Special weekly seasonal promotions and exclusive harvest coupons." },
      { icon: "🌾", title: "Local Hub Priority", desc: "Direct notifications when fresh fruits and vegetables arrive." },
    ];
    return [
      { icon: "🌱", title: "Farm Fresh Member", desc: "100% farm-direct natural produce delivered to your doorstep." },
      { icon: "🎁", title: "First Order Discount", desc: "Special welcome offers and referral benefits." },
    ];
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />
      <div
        className="relative z-20 w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black p-6 sm:p-8 text-white shadow-2xl animate-in zoom-in-95 duration-300"
        style={{ boxShadow: `0 0 50px ${starTheme.mobileBadgeBg || "rgba(251,191,36,0.3)"}, 0 20px 40px rgba(0,0,0,0.8)` }}
      >
        <button onClick={() => setIsOpen(false)} className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition" aria-label="Close modal">
          <X className="h-5 w-5" />
        </button>
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none opacity-40 blur-3xl" style={{ backgroundColor: starTheme.fillColor }} />
        <div className="text-center relative">
          <div className="inline-flex items-center justify-center mb-3">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-xl border relative" style={{ backgroundColor: starTheme.fillColor + "25", borderColor: starTheme.fillColor + "80", boxShadow: `0 0 25px ${starTheme.fillColor}50` }}>
              {starCount >= 6 ? "👑" : starCount === 5 ? "💎" : starCount === 4 ? "🔷" : starCount === 3 ? "🥉" : "🌱"}
              <div className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow">+{starCount} ★</div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
            {Array.from({ length: Math.max(0, Math.min(6, Math.floor(Number(starCount) || 0))) }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-current animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">🎉 Congratulations!</h2>
          <p className="text-sm font-semibold uppercase tracking-wider mt-1" style={{ color: starTheme.fillColor }}>🌟 {starTheme.label} Unlocked!</p>
          <p className="text-xs text-zinc-300 mt-2 max-w-sm mx-auto leading-relaxed">
            {bumpInfo.name ? `Namaste, ${bumpInfo.name}!` : "Welcome to your new status!"} You have been elevated to{" "}
            <span className="font-bold text-white">{starTheme.label}</span>. Enjoy your new perks!
          </p>
        </div>
        <div className="mt-5 space-y-2.5 bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Your Unlocked Tier Privileges:
          </p>
          {getPerks().map((perk, idx) => (
            <div key={idx} className="flex items-start gap-3 text-left">
              <span className="text-lg leading-none mt-0.5">{perk.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-100">{perk.title}</p>
                <p className="text-[11px] text-zinc-400 leading-snug">{perk.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Button
            onClick={() => setIsOpen(false)}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all ${starTheme.btnClass}`}
          >
            Claim My Rewards & Continue 🚀
          </Button>
        </div>
      </div>
    </div>
  );
}
