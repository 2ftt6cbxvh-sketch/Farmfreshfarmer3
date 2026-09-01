/**
 * MaintenanceOverlay — Luxury Organic Scheduled Maintenance Experience
 * Displays a stunning, agricultural-themed maintenance screen with live countdown timer,
 * real-time status ticker, WhatsApp concierge, and staff bypass link.
 */
import { useState, useEffect } from "react";
import { Sparkles, Clock, MessageSquare, Mail, RefreshCw, KeyRound, ShieldCheck, HeartHandshake } from "lucide-react";
import { Logo } from "@/components/Logo";

interface MaintenanceOverlayProps {
  headline?: string;
  message?: string;
  estimatedEnd?: string | null;
  estimatedMinutes?: number | null;
  allowAdminBypass?: boolean;
}

const ROTATING_STATUS_UPDATES = [
  "🌾 Upgrading organic harvest catalog & fresh farm supplies...",
  "🚜 Calibrating ultrafast 2-hour express delivery routing engine...",
  "✨ Syncing live organic certifications & cold-chain checkpoints...",
  "💳 Upgrading 1-tap secure UPI & express checkout infrastructure...",
  "🌱 Onboarding fresh harvests from local Andhra Pradesh partner farms...",
];

export default function MaintenanceOverlay({
  headline = "Scheduled Maintenance Underway",
  message = "We are currently optimizing our farm-fresh catalog and ultrafast delivery infrastructure. We will be back shortly with fresh harvests!",
  estimatedEnd,
  estimatedMinutes = 30,
  allowAdminBypass = true,
}: MaintenanceOverlayProps) {
  const [tickerIndex, setTickerIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  // Status message rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % ROTATING_STATUS_UPDATES.length);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!estimatedEnd) {
      setTimeLeft(null);
      return;
    }

    const targetTime = new Date(estimatedEnd).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, targetTime - now);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [estimatedEnd]);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleWhatsAppContact = () => {
    const text = encodeURIComponent("Hello FarmFreshFarmer team, I noticed the website is under maintenance. I have an urgent produce order query.");
    window.open(`https://wa.me/917989793669?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[99999] min-h-screen w-screen bg-[#031107] text-white flex flex-col justify-between overflow-y-auto p-4 sm:p-6 md:p-10 font-sans select-none antialiased">
      {/* Background ambient lighting */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[450px] bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between max-w-5xl w-full mx-auto pb-4">
        <div className="flex items-center gap-3">
          <Logo size="md" />
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-500/15 text-amber-300 border border-amber-500/30 backdrop-blur-md shadow-md">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Scheduled Maintenance
          </span>
        </div>
      </header>

      {/* Main Glassmorphic Showcase Card */}
      <main className="relative z-10 max-w-2xl w-full mx-auto my-auto py-6 sm:py-10 text-center space-y-6">
        {/* Animated Organic Harvest Glyph */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-amber-400 p-[2px] shadow-2xl shadow-emerald-950/60 animate-pulse">
            <div className="w-full h-full bg-[#051c0d] rounded-[22px] flex items-center justify-center text-4xl sm:text-5xl">
              🌱
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-[11px] px-3 py-1 rounded-xl shadow-lg border border-amber-300/40 flex items-center gap-1.5">
            <Sparkles size={13} className="animate-spin" style={{ animationDuration: "6s" }} />
            <span>Upgrading</span>
          </div>
        </div>

        {/* Headline & Description */}
        <div className="space-y-3 px-2">
          <h1 className="text-2xl sm:text-4xl font-serif font-black tracking-tight text-white drop-shadow-md">
            {headline}
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-emerald-400/90 font-sans tracking-wide">
            సేవలు త్వరలోనే పునఃప్రారంభమవుతాయి · Organic Catalog Refresh
          </p>
          <p className="text-sm sm:text-base text-emerald-100/75 max-w-lg mx-auto leading-relaxed pt-1">
            {message}
          </p>
        </div>

        {/* Live Countdown Clock / Duration Ticker */}
        {timeLeft ? (
          <div className="p-4 sm:p-6 rounded-3xl bg-white/[0.04] border border-emerald-500/30 backdrop-blur-xl max-w-md mx-auto shadow-2xl shadow-emerald-950/40 space-y-3">
            <div className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-400 uppercase tracking-widest">
              <Clock size={14} className="text-amber-400 animate-pulse" />
              <span>Estimated Reopen In</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 text-center">
              <div className="p-3 rounded-2xl bg-black/50 border border-emerald-500/25 shadow-inner">
                <span className="font-mono text-2xl sm:text-3xl font-black text-white">
                  {String(timeLeft.hours).padStart(2, "0")}
                </span>
                <p className="text-[10px] uppercase font-black text-emerald-300/60 mt-0.5">Hours</p>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-emerald-500/25 shadow-inner">
                <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-400">
                  {String(timeLeft.minutes).padStart(2, "0")}
                </span>
                <p className="text-[10px] uppercase font-black text-emerald-300/60 mt-0.5">Minutes</p>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-emerald-500/25 shadow-inner">
                <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400">
                  {String(timeLeft.seconds).padStart(2, "0")}
                </span>
                <p className="text-[10px] uppercase font-black text-emerald-300/60 mt-0.5">Seconds</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.05] border border-emerald-500/30 backdrop-blur-md text-xs font-black text-emerald-300 shadow-lg">
            <Clock size={15} className="text-amber-400 animate-spin" style={{ animationDuration: "8s" }} />
            <span>Estimated Duration: ~{estimatedMinutes || 30} minutes</span>
          </div>
        )}

        {/* Live Rolling Status Bar */}
        <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 max-w-lg mx-auto backdrop-blur-md">
          <p className="text-xs sm:text-sm font-semibold text-emerald-300 transition-all duration-500 animate-in fade-in">
            {ROTATING_STATUS_UPDATES[tickerIndex]}
          </p>
        </div>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-4 text-xs font-bold text-emerald-300/80 pt-1 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" /> All Existing Orders Safe
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HeartHandshake size={14} className="text-teal-400" /> Live Concierge Available
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-950/50 hover:shadow-xl hover:shadow-emerald-900/60 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw size={15} />
            <span>Check If Live ➔</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsAppContact}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-800 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs border border-emerald-400/30 shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageSquare size={15} className="text-emerald-300" />
            <span>WhatsApp Support (+91 7989793669)</span>
          </button>
        </div>
      </main>

      {/* Footer & Admin Bypass Link */}
      <footer className="relative z-10 max-w-5xl w-full mx-auto pt-6 border-t border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-emerald-300/60">
        <p>© {new Date().getFullYear()} FarmFreshFarmer. Pure organic harvests delivered fresh daily.</p>

        {allowAdminBypass && (
          <div className="flex items-center gap-3">
            <a
              href="mailto:admin@farmfreshfarmer.com"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <Mail size={13} /> Support Email
            </a>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/admin/login";
              }}
              className="hover:text-emerald-300 font-bold underline flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <KeyRound size={13} /> Executive Staff &amp; Admin Portal
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
