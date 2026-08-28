import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Lock, Sparkles, KeyRound } from "lucide-react";

export default function StealthPassage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState("Authenticating Encrypted Gateway...");

  useEffect(() => {
    // 1. Authorize the browser session for Admin Portal entry
    sessionStorage.setItem("fff_stealth_gateway_unlocked", "true");
    localStorage.setItem("fff_stealth_gateway_unlocked", "true");

    const timer1 = setTimeout(() => {
      setStatus("Keycard Verified. Initializing Administrative Console...");
    }, 400);

    const timer2 = setTimeout(() => {
      navigate("/admin/login");
    }, 900);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [navigate]);

  return (
    <div style={{ colorScheme: "dark" }} className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-foreground select-none">
      <div className="max-w-sm w-full bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40 animate-pulse">
          <KeyRound size={32} />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-white tracking-tight">Stealth Gateway Passage</h2>
          <p className="text-xs text-emerald-400 font-mono animate-pulse">{status}</p>
        </div>

        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 animate-[progress_1s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
