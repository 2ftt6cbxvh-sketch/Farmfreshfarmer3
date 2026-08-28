import { useEffect, useRef } from "react";
import { ShieldAlert, Mail, Phone, LogOut, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function BlockedUserOverlay() {
  const { user, logout } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  const isBlocked = Boolean(
    user && (user.status === "blocked" || user.status === "locked" || user.isPermanentlyLocked)
  );

  // Anti-tampering DevTools / Inspector Watchdog
  useEffect(() => {
    if (!isBlocked) return;

    // Prevent body scrolling and background clicks
    document.body.style.overflow = "hidden";

    const observer = new MutationObserver(() => {
      const el = document.getElementById("farmfresh-blocked-overlay");
      if (!el && isBlocked) {
        // If an attacker removed the overlay element in devtools, force window reload or recreate
        window.location.reload();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.body.style.overflow = "";
      observer.disconnect();
    };
  }, [isBlocked]);

  if (!isBlocked || !user) return null;

  const mailtoUrl = `mailto:support@farmfreshfarmer.com?subject=Account%20Suspension%20Appeal%20-%20${encodeURIComponent(
    user.email || ""
  )}&body=Hello%20FarmFreshFarmer%20Admin,%0A%0AMy%20account%20(${encodeURIComponent(
    user.email || ""
  )})%20was%20suspended.%20Please%20review%20my%20case.%0A%0AThank%20you,%0A${encodeURIComponent(
    user.name || ""
  )}`;

  return (
    <div
      id="farmfresh-blocked-overlay"
      ref={overlayRef}
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200 select-none"
      style={{ pointerEvents: "auto" }}
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-[#090d16] border-2 border-red-500/60 shadow-[0_0_80px_rgba(239,68,68,0.35)] overflow-hidden animate-in zoom-in-95 duration-200 text-slate-100">
        {/* Top Warning Banner Stripe */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-950 via-red-900/60 to-red-950 border-b border-red-500/40 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center shrink-0 shadow-inner animate-pulse">
            <ShieldAlert size={26} className="text-red-500" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-red-600 text-white shadow-sm">
              Account Suspended
            </span>
            <h2 className="text-lg font-black text-white mt-1">
              Access Blocked by Administration
            </h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* User badge */}
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="font-bold text-white truncate">{user.name}</p>
              <p className="text-slate-400 truncate text-[11px]">{user.email}</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-extrabold text-[10px] uppercase tracking-wider shrink-0">
              Status: Blocked
            </span>
          </div>

          {/* Explanation Text */}
          <div className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              Your account has been <strong>suspended or restricted</strong> by the FarmFreshFarmer administration.
            </p>
            <p className="text-slate-400 text-xs">
              While your account is suspended, browsing privileges, cart management, and order placement are disabled.
            </p>
          </div>

          {/* Appeal / Contact Admin Notice */}
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <AlertTriangle size={15} />
              <span>Need Assistance or Believe this is an Error?</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Please contact our Super Admin or customer support team to request an account review and unblock.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <a
              href={mailtoUrl}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
            >
              <Mail size={15} />
              <span>Email Support Team</span>
            </a>

            <a
              href="tel:+918886366669"
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
            >
              <Phone size={15} />
              <span>Call Helpline</span>
            </a>

            <Button
              variant="outline"
              onClick={async () => {
                await logout();
                window.location.href = "/";
              }}
              className="w-full sm:w-auto py-3 px-4 rounded-xl border-red-500/40 bg-red-950/20 text-red-300 hover:bg-red-950/60 font-bold text-xs gap-1.5 shrink-0"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
