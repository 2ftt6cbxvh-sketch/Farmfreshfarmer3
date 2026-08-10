/**
 * LockdownOverlay — Fullscreen Dark Siren Overlay with Flashy Police Red/Blue Strobe Lights,
 * Web Audio API Police Siren Generator, and Legal Notices (IT Act 2000 Sec 43/66 & BNS 2023 Sec 318).
 */
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldAlert, Volume2, VolumeX, Lock } from "lucide-react";

interface LockdownOverlayProps {
  reason?: string;
  active: boolean;
}

export default function LockdownOverlay({ active, reason }: LockdownOverlayProps) {
  const [strobeState, setStrobeState] = useState<"red" | "blue">("red");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<any>(null);

  // Strobe Light Timer (alternates red/blue every 300ms)
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setStrobeState((prev) => (prev === "red" ? "blue" : "red"));
    }, 300);
    return () => clearInterval(interval);
  }, [active]);

  // Web Audio API Police Siren Sound Effect
  const toggleSirenAudio = () => {
    if (audioPlaying) {
      stopSirenAudio();
    } else {
      startSirenAudio();
    }
  };

  const startSirenAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      gain.gain.setValueAtTime(0.15, ctx.currentTime); // Low volume siren

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();

      let highFreq = false;
      sirenIntervalRef.current = setInterval(() => {
        if (!ctx || ctx.state === "closed") return;
        const targetFreq = highFreq ? 900 : 500;
        osc.frequency.linearRampToValueAtTime(targetFreq, ctx.currentTime + 0.3);
        highFreq = !highFreq;
      }, 400);

      setAudioPlaying(true);
    } catch {
      // Audio context blocked by browser autoplay policy
    }
  };

  const stopSirenAudio = () => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioPlaying(false);
  };

  // Auto-play Web Audio API Police Siren Sound Effect on mount
  useEffect(() => {
    if (active) {
      startSirenAudio();
    }
    return () => {
      stopSirenAudio();
    };
  }, [active]);

  const { data: publicSettings } = useQuery<{ contact_email?: string; store_name?: string }>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      return res.json();
    },
  });

  const email = publicSettings?.contact_email || "admin@farmfreshfarmer.com";
  const storeName = publicSettings?.store_name || "FarmFreshFarmer";

  if (!active) return null;

  const isRed = strobeState === "red";
  const displayReason = reason || "Unauthorised activity detected";

  return (
    <div
      style={{ colorScheme: "dark" }}
      className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center text-white overflow-hidden select-none"
    >
      {/* Flashy Police Red / Blue Alternating Strobe Backdrop Glow */}
      <div
        className="absolute inset-0 transition-all duration-300 pointer-events-none opacity-25"
        style={{
          background: isRed
            ? "radial-gradient(circle, rgba(255, 0, 50, 0.8) 0%, rgba(0, 0, 0, 1) 80%)"
            : "radial-gradient(circle, rgba(0, 100, 255, 0.8) 0%, rgba(0, 0, 0, 1) 80%)",
        }}
      />

      {/* Outer Flashy Strobe Border */}
      <div
        className="absolute inset-0 border-8 transition-all duration-300 pointer-events-none"
        style={{
          borderColor: isRed ? "#ff0033" : "#0055ff",
          boxShadow: isRed
            ? "inset 0 0 50px rgba(255,0,50,0.8), 0 0 50px rgba(255,0,50,0.8)"
            : "inset 0 0 50px rgba(0,85,255,0.8), 0 0 50px rgba(0,85,255,0.8)",
        }}
      />

      <div className="max-w-xl text-center px-6 space-y-6 relative z-10">
        {/* Animated Police Siren Shield Icon */}
        <div className="flex justify-center">
          <div className="relative p-6 rounded-full bg-black/60 border border-gray-800 shadow-2xl">
            <ShieldAlert
              className="w-24 h-24 transition-colors duration-300 animate-pulse"
              style={{ color: isRed ? "#ff0033" : "#0055ff" }}
            />
            <Lock className="w-8 h-8 absolute bottom-4 right-4 text-amber-400 animate-bounce" />
          </div>
        </div>

        {/* Header Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/80 border border-red-600 text-red-400 font-mono text-xs font-bold tracking-widest uppercase animate-pulse">
            🚨 EMERGENCY PLATFORM LOCKDOWN ACTIVE
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-serif text-white">
            System Temporarily Locked
          </h1>
        </div>

        {/* Reason Card */}
        <div className="bg-gray-900/90 border border-red-900/60 rounded-xl p-4 text-sm text-gray-200 shadow-lg text-left">
          <p className="font-semibold text-red-400 mb-1 text-xs uppercase tracking-wider">
            Lockdown Reason:
          </p>
          <p className="font-mono text-gray-300">{displayReason}</p>
        </div>

        {/* Siren Sound Toggle */}
        <div className="flex justify-center">
          <button
            onClick={toggleSirenAudio}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 border border-gray-700 text-xs font-semibold hover:bg-gray-800 transition-colors shadow"
          >
            {audioPlaying ? (
              <>
                <Volume2 className="w-4 h-4 text-red-500 animate-pulse" />
                <span>Mute Police Siren Sound</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-gray-400" />
                <span>Play Police Siren Sound</span>
              </>
            )}
          </button>
        </div>

        {/* Legal Notice Box */}
        <div className="border border-red-950/80 bg-red-950/20 backdrop-blur rounded-xl p-4 text-xs text-gray-400 text-left space-y-2">
          <p className="font-bold text-red-400 flex items-center gap-1.5 uppercase tracking-wide">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Legal Notice & Activity Monitoring
          </p>
          <p className="text-gray-200 font-bold">
            All customer and Sub-admin API routes returning 423 (Locked) except Chief Admin.
          </p>
          <p className="text-gray-300">
            {storeName} platform is currently in restricted emergency mode. All requests, IP addresses, and session fingerprints are actively logged under IT Act 2000 & BNS 2023.
          </p>
        </div>

        <p className="text-gray-500 text-xs">
          Authorized owner query support:{" "}
          <a href={`mailto:${email}`} className="text-emerald-400 underline hover:text-emerald-300">
            {email}
          </a>
        </p>

        {/* 🔒 SECRET SUPER ADMIN PASSAGE TRIGGER (3-second long-press badge) */}
        <div className="pt-2 flex justify-center">
          <SecretPassageTrigger />
        </div>
      </div>
    </div>
  );
}

function SecretPassageTrigger() {
  const [modalOpen, setModalOpen] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<any>(null);
  const holdStartRef = useRef<number>(0);

  const startHold = () => {
    holdStartRef.current = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(100, Math.floor((elapsed / 3000) * 100));
      setHoldProgress(progress);
      if (elapsed >= 3000) {
        clearInterval(holdTimerRef.current);
        setHoldProgress(0);
        setModalOpen(true);
      }
    }, 100);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    setHoldProgress(0);
  };

  return (
    <>
      <button
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        className="relative px-3 py-1 rounded-full bg-black/40 border border-emerald-500/30 text-[10px] font-mono text-gray-400 hover:text-emerald-400 transition-all select-none overflow-hidden group cursor-pointer"
      >
        {holdProgress > 0 && (
          <div
            className="absolute inset-0 bg-emerald-500/30 transition-all"
            style={{ width: `${holdProgress}%` }}
          />
        )}
        <span className="relative z-10">v7.8.0</span>
      </button>

      {modalOpen && <SecretPassageModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

function SecretPassageModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"direct" | "telegram">("direct");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Telegram state
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramStatus, setTelegramStatus] = useState<"idle" | "sent" | "approved">("idle");

  const handleDirectUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/security/secret-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: password, totpCode: totp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid credentials");

      if (data.token) {
        localStorage.setItem("admin_token", data.token);
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user || { email: "admin@farmfreshfarmer.com", role: "superadmin" }));
        document.cookie = `token=${data.token}; path=/; max-age=604800`;
        window.location.href = "/admin";
      }
    } catch (err: any) {
      setError(err.message || "Failed to unlock session");
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramRequest = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/security/telegram-challenge", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send Telegram request");

      setTelegramToken(data.token);
      setTelegramStatus("sent");
    } catch (err: any) {
      setError(err.message || "Could not dispatch Telegram alert");
    } finally {
      setLoading(false);
    }
  };

  // Poll Telegram approval status
  useEffect(() => {
    if (telegramStatus !== "sent" || !telegramToken) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/security/check-telegram-approval/${telegramToken}`);
        const data = await res.json();
        if (data.approved && data.token) {
          setTelegramStatus("approved");
          clearInterval(interval);
          localStorage.setItem("admin_token", data.token);
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user || { email: "admin@farmfreshfarmer.com", role: "superadmin" }));
          document.cookie = `token=${data.token}; path=/; max-age=604800`;
          setTimeout(() => {
            window.location.href = "/admin";
          }, 800);
        }
      } catch {}
    }, 2000);

    return () => clearInterval(interval);
  }, [telegramStatus, telegramToken]);

  return (
    <div className="fixed inset-0 z-[100000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gray-950 border border-emerald-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-left relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-serif font-bold text-white">Super Admin Secret Passage</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-sm">✕</button>
        </div>

        {error && (
          <div className="bg-red-950/80 border border-red-500/50 p-3 rounded-xl text-xs text-red-300 font-mono">
            {error}
          </div>
        )}

        {/* Tab Buttons */}
        <div className="grid grid-cols-2 gap-2 bg-gray-900 p-1 rounded-xl border border-gray-800">
          <button
            onClick={() => setActiveTab("direct")}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "direct" ? "bg-emerald-600 text-white shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            🔑 Mode A: Direct Vault
          </button>
          <button
            onClick={() => setActiveTab("telegram")}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "telegram" ? "bg-emerald-600 text-white shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            📲 Mode B: Telegram Handshake
          </button>
        </div>

        {activeTab === "direct" ? (
          <form onSubmit={handleDirectUnlock} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-300">Current Super Admin Password *</label>
              <input
                type="password"
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-emerald-400">🔑 6-Digit Authenticator TOTP Code *</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-900 border border-emerald-500/50 text-emerald-400 text-center font-mono text-base font-bold tracking-widest focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password || totp.length < 6}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold text-xs shadow-lg disabled:opacity-50"
            >
              {loading ? "Validating Credentials..." : "Unlock Platform Master Session 🔑"}
            </button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            {telegramStatus === "idle" && (
              <>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Dispatches a 1-click <strong>Authorization Push Notification</strong> directly to your private Super Admin Telegram Bot.
                </p>
                <button
                  onClick={handleTelegramRequest}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold text-xs shadow-lg disabled:opacity-50"
                >
                  {loading ? "Sending Notification..." : "📲 Request 1-Click Telegram Approval"}
                </button>
              </>
            )}

            {telegramStatus === "sent" && (
              <div className="space-y-3 p-4 bg-gray-900 rounded-xl border border-emerald-500/40">
                <div className="animate-pulse text-emerald-400 font-bold text-xs">
                  📲 Telegram Approval Request Dispatched!
                </div>
                <div className="p-3 bg-black rounded-lg border border-gray-800">
                  <div className="text-[10px] text-gray-400">SESSION OVERRIDE TOKEN</div>
                  <div className="text-xl font-mono font-bold text-amber-400 tracking-widest">{telegramToken}</div>
                </div>
                <p className="text-[11px] text-gray-300">
                  Open Telegram on your phone and tap <strong>[✅ Authorize Super Admin Unlock]</strong>. This browser will unlock automatically!
                </p>
              </div>
            )}

            {telegramStatus === "approved" && (
              <div className="p-4 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-300 font-bold text-xs animate-bounce">
                ✅ Telegram Approval Confirmed! Redirecting to Super Admin Dashboard...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
