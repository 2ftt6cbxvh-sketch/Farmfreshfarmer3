/**
 * LockdownOverlay — Fullscreen Dark Siren Overlay with Flashy Police Red/Blue Strobe Lights,
 * Web Audio API Police Siren Generator, and Legal Notices (IT Act 2000 Sec 43/66 & BNS 2023 Sec 318).
 */
import { useEffect, useState, useRef } from "react";
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

  useEffect(() => {
    return () => {
      stopSirenAudio();
    };
  }, []);

  if (!active) return null;

  const isRed = strobeState === "red";

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

      {/* Top & Bottom Flashing Beacons */}
      <div className="absolute top-0 inset-x-0 flex justify-between px-6 py-2 z-20">
        <div
          className="w-16 h-4 rounded-full transition-all duration-300"
          style={{
            backgroundColor: isRed ? "#ff0033" : "#111",
            boxShadow: isRed ? "0 0 25px #ff0033" : "none",
          }}
        />
        <div
          className="w-16 h-4 rounded-full transition-all duration-300"
          style={{
            backgroundColor: !isRed ? "#0055ff" : "#111",
            boxShadow: !isRed ? "0 0 25px #0055ff" : "none",
          }}
        />
      </div>

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
        {reason && (
          <div className="bg-gray-900/90 border border-red-900/60 rounded-xl p-4 text-sm text-gray-200 shadow-lg text-left">
            <p className="font-semibold text-red-400 mb-1 text-xs uppercase tracking-wider">
              Lockdown Reason:
            </p>
            <p className="font-mono text-gray-300">{reason}</p>
          </div>
        )}

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
          <p className="text-gray-300">
            FarmFreshFarmer platform is currently in restricted emergency mode. All requests, IP addresses, and session fingerprints are actively logged.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 text-gray-400">
            <li>
              <span className="text-gray-200 font-semibold">Information Technology Act, 2000</span> (Sections 43 & 66 — Data Tampering & Unauthorized Access)
            </li>
            <li>
              <span className="text-gray-200 font-semibold">Bharatiya Nyaya Sanhita (BNS) 2023, Section 318</span> (Cheating & Criminal Breach)
            </li>
          </ul>
        </div>

        <p className="text-gray-500 text-xs">
          Authorized owner query support:{" "}
          <a href="mailto:admin@farmfreshfarmer.com" className="text-emerald-400 underline hover:text-emerald-300">
            admin@farmfreshfarmer.com
          </a>
        </p>
      </div>
    </div>
  );
}
