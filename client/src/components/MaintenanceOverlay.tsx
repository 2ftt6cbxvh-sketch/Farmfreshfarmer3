/**
 * MaintenanceOverlay — Customer-Facing Scheduled Maintenance Experience
 * Displays an elegant, agricultural-themed maintenance screen with live countdown timer,
 * rotating status updates, WhatsApp support, and staff secret bypass link.
 */
import { useState, useEffect } from "react";
import { Wrench, Sparkles, Clock, MessageSquare, Mail, ShieldAlert, ArrowRight, RefreshCw, KeyRound } from "lucide-react";
import { Logo } from "@/components/Logo";

interface MaintenanceOverlayProps {
  headline?: string;
  message?: string;
  estimatedEnd?: string | null;
  estimatedMinutes?: number | null;
  allowAdminBypass?: boolean;
}

const ROTATING_STATUS_UPDATES = [
  "🌾 Upgrading organic farm-fresh inventory catalog & fresh harvests...",
  "🚜 Optimizing ultrafast 2-hour doorstep delivery routing engine...",
  "✨ Calibrating fresh cold-chain quality assurance checkpoints...",
  "💳 Enhancing secure UPI & 1-tap checkout infrastructure...",
  "🌱 Syncing with local regional organic farm partners...",
];

export default function MaintenanceOverlay({
  headline = "Scheduled Maintenance Underway",
  message = "We are currently optimizing our farm-fresh catalog and ultrafast delivery infrastructure. We will be back shortly!",
  estimatedEnd,
  estimatedMinutes = 30,
  allowAdminBypass = true,
}: MaintenanceOverlayProps) {
  const [tickerIndex, setTickerIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [showAdminBypassModal, setShowAdminBypassModal] = useState(false);

  // Status message rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % ROTATING_STATUS_UPDATES.length);
    }, 4000);
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
    const text = encodeURIComponent("Hello FarmFreshFarmer team, I noticed the website is under maintenance. I have an urgent query.");
    window.open(`https://wa.me/917989793669?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[99999] min-h-screen w-screen bg-gradient-to-b from-[#031508] via-[#051f0c] to-[#010b04] text-white flex flex-col justify-between overflow-y-auto p-4 sm:p-6 md:p-10 font-sans select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between max-w-5xl w-full mx-auto pb-4">
        <div className="flex items-center gap-2">
          <Logo size="md" />
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Maintenance Mode Active
          </span>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 max-w-2xl w-full mx-auto my-auto py-8 text-center space-y-6">
        {/* Animated Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-500 p-0.5 shadow-2xl shadow-emerald-500/20 animate-pulse">
            <div className="w-full h-full bg-[#072410] rounded-[22px] flex items-center justify-center text-emerald-400">
              <Wrench size={48} className="animate-spin" style={{ animationDuration: "8s" }} />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-amber-500 text-black font-black text-xs px-2.5 py-1 rounded-xl shadow-lg flex items-center gap-1">
            <Sparkles size={12} /> Upgrading
          </div>
        </div>

        {/* Headline & Description */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-4xl font-serif font-black tracking-tight text-white drop-shadow-md">
            {headline}
          </h1>
          <p className="text-sm sm:text-base text-emerald-200/80 max-w-lg mx-auto leading-relaxed">
            {message}
          </p>
        </div>

        {/* Countdown / Duration Ticker */}
        {timeLeft ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-emerald-500/30 backdrop-blur-md max-w-md mx-auto shadow-inner space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <Clock size={14} /> Estimated Store Reopen In
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
              <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/20">
                <span className="font-mono text-2xl sm:text-3xl font-black text-white">
                  {String(timeLeft.hours).padStart(2, "0")}
                </span>
                <p className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">Hours</p>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/20">
                <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-400">
                  {String(timeLeft.minutes).padStart(2, "0")}
                </span>
                <p className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">Mins</p>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/20">
                <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400">
                  {String(timeLeft.seconds).padStart(2, "0")}
                </span>
                <p className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">Secs</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-emerald-500/30 backdrop-blur-md text-xs font-bold text-emerald-300">
            <Clock size={14} className="text-amber-400" />
            <span>Estimated Duration: ~{estimatedMinutes || 30} minutes</span>
          </div>
        )}

        {/* Live Status Ticker */}
        <div className="h-10 flex items-center justify-center px-4">
          <p className="text-xs sm:text-sm font-medium text-emerald-300/90 italic transition-all duration-500 animate-in fade-in">
            {ROTATING_STATUS_UPDATES[tickerIndex]}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-900/40 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw size={15} />
            <span>Check If We're Back ➔</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsAppContact}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 text-white font-extrabold text-xs shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageSquare size={15} />
            <span>Chat On WhatsApp (+91 7989793669)</span>
          </button>
        </div>
      </main>

      {/* Footer & Admin Secret Bypass */}
      <footer className="relative z-10 max-w-5xl w-full mx-auto pt-6 border-t border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-emerald-300/60">
        <p>© {new Date().getFullYear()} FarmFreshFarmer Inc. All organic produce orders preserved.</p>

        {allowAdminBypass && (
          <div className="flex items-center gap-3">
            <a
              href="mailto:admin@farmfreshfarmer.com"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <Mail size={13} /> Support
            </a>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/admin/login";
              }}
              className="hover:text-emerald-300 font-bold underline flex items-center gap-1 cursor-pointer transition-colors"
            >
              <KeyRound size={13} /> Executive Staff &amp; Admin Portal
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
