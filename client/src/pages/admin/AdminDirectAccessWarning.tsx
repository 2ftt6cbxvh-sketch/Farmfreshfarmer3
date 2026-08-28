import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ArrowLeft, ShieldX, Terminal, Sparkles, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminDirectAccessWarning() {
  const [, navigate] = useLocation();
  const [incidentId, setIncidentId] = useState("");

  const { data: settings } = useQuery<{ stealth_admin_lockdown?: boolean }>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => (await fetch("/api/settings/public")).json(),
  });

  const isLockdownStrict = settings?.stealth_admin_lockdown === true;

  useEffect(() => {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    setIncidentId(`SEC-${randomHex}-${timestamp}`);
  }, []);

  return (
    <div style={{ colorScheme: "dark" }} className="min-h-screen bg-black flex flex-col items-center justify-center p-4 sm:p-6 text-foreground select-none">
      <div className="max-w-lg w-full bg-gradient-to-b from-red-950/40 via-slate-950 to-slate-950 border border-red-500/50 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6 relative overflow-hidden backdrop-blur-xl">
        {/* Top Warning Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-black uppercase tracking-widest mx-auto animate-pulse">
          <ShieldAlert size={14} />
          <span>{isLockdownStrict ? "Production Lockdown Active • Direct Access Prohibited" : "Testing Mode Active • Stealth Gateway Required"}</span>
        </div>

        {/* Big Alert Icon */}
        <div className="w-20 h-20 rounded-3xl bg-red-950/60 border border-red-500/40 text-red-500 flex items-center justify-center mx-auto shadow-xl shadow-red-950/50">
          <ShieldX size={44} />
        </div>

        {/* Warning Title & Message */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Direct Admin URL Intercepted
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
            Direct browser URL navigation to administrative routes is disabled. Access to the master control portal is restricted strictly to the encrypted Stealth Gateway.
          </p>
        </div>

        {/* Incident Box */}
        <div className="p-4 rounded-2xl bg-black/80 border border-red-500/30 text-left space-y-2 font-mono text-[11px]">
          <div className="flex items-center justify-between text-red-400 border-b border-red-500/20 pb-1.5">
            <span className="font-bold flex items-center gap-1.5">
              <Terminal size={13} /> THREAT DETECTION LOG
            </span>
            <span className="text-[10px] bg-red-500/20 px-1.5 py-0.5 rounded text-red-300">LOGGED</span>
          </div>
          <div className="space-y-1 text-slate-400">
            <p>• Incident Reference: <span className="text-red-300 font-bold">{incidentId || "SEC-SYS-LOG"}</span></p>
            <p>• Target Route: <span className="text-slate-200">/admin/*</span></p>
            <p>• Security Policy: <span className="text-amber-400">Stealth Gateway Keycard Enforced</span></p>
            <p>• System Response: <span className="text-emerald-400">Access Intercepted &amp; Quarantined</span></p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-3">
          <Button
            onClick={() => navigate("/")}
            className="w-full h-11 bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 text-white font-extrabold rounded-xl gap-2 shadow-lg shadow-red-950/60"
          >
            <ArrowLeft size={16} />
            <span>Return to FarmFreshFarmer Store</span>
          </Button>
        </div>

        <p className="text-[10px] text-slate-500">
          FarmFreshFarmer Autonomous Defense System • Enterprise Shield v9.4
        </p>
      </div>
    </div>
  );
}
