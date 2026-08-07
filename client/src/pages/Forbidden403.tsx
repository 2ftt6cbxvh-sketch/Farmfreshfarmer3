import React, { useEffect } from "react";
import { ShieldAlert, Lock, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Forbidden403() {
  useEffect(() => {
    // Notify server of unauthorized /admin attempt to fire Telegram alert
    fetch("/api/admin/security/unauthorized-attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  return (
    <div style={{ colorScheme: "dark" }} className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 select-none relative overflow-hidden">
      {/* Red ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-950/30 via-black to-black pointer-events-none" />

      <div className="max-w-lg w-full bg-gray-950 border border-red-900/60 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative z-10">
        <div className="flex justify-center">
          <div className="relative p-6 rounded-full bg-red-950/40 border border-red-800 shadow-2xl">
            <ShieldAlert className="w-20 h-20 text-red-500 animate-pulse" />
            <Lock className="w-7 h-7 absolute bottom-3 right-3 text-amber-400 animate-bounce" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border border-red-600 text-red-400 font-mono text-[10px] font-bold tracking-widest uppercase">
            🚨 403 FORBIDDEN — ACCESS DENIED
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-serif text-white">
            Unauthorised Admin Access Blocked
          </h1>
        </div>

        <div className="bg-gray-900/90 border border-red-900/50 rounded-xl p-4 text-xs text-gray-300 text-left space-y-2">
          <p className="font-bold text-red-400 flex items-center gap-1.5 uppercase">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Security Incident Logged & Telegram Alert Triggered
          </p>
          <p className="text-gray-400">
            Direct access to <code>/admin</code> without Chief Admin 2FA TOTP & Biometric authentication is strictly prohibited.
          </p>
          <p className="text-gray-400">
            Your IP address, browser fingerprint, and timestamp have been logged and reported to the system controller under <b>IT Act 2000 & BNS Section 318</b>.
          </p>
        </div>

        <div className="pt-2">
          <Button
            onClick={() => (window.location.href = "/")}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg gap-2 text-xs"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Customer Storefront
          </Button>
        </div>
      </div>
    </div>
  );
}
