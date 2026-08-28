import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiGet } from "@/lib/queryClient";
import { useAuth } from "@/lib/store";

export function ChiefExecutiveExclusiveControls() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isPrimaryAdmin = Boolean(
    user?.isPrimaryAdmin === true ||
    user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    (user?.role === "admin" && (user?.id === 1 || user?.id === 0))
  );

  // 1. Stealth Admin Lockdown Setting
  const { data: settingsData, isLoading: settingsLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/settings"],
    queryFn: () => apiGet<Record<string, string>>("/api/admin/settings"),
    enabled: isPrimaryAdmin,
  });

  const isLockdownActive = settingsData?.stealth_admin_lockdown === "true";

  const toggleLockdownMutation = useMutation({
    mutationFn: async (enable: boolean) => {
      const res = await apiRequest("POST", "/api/admin/settings", {
        stealth_admin_lockdown: enable ? "true" : "false",
      });
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/settings/public"] });
      toast({
        title: vars ? "🔒 Production Hardened Mode Active" : "🛠️ Testing Mode (Relaxed) Active",
        description: vars
          ? "Direct /admin and /admin/login URLs are now strictly intercepted with threat quarantine. Super Admins can only log in via your Private Stealth Gateway."
          : "Direct admin access is now relaxed for testing without requiring the secret gateway URL.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update lockdown mode", description: err.message, variant: "destructive" });
    },
  });

  // 2. Staff 2FA Configuration
  const { data: staff2faConfig, isLoading: staff2faLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/admin/staff/2fa-config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/staff/2fa-config");
      return res.json();
    },
    enabled: isPrimaryAdmin,
  });

  const isStaff2faActive = staff2faConfig?.enabled === true;

  const toggleStaff2faMutation = useMutation({
    mutationFn: async (enable: boolean) => {
      const res = await apiRequest("POST", "/api/admin/staff/2fa-config", { enabled: enable });
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/staff/2fa-config"] });
      toast({
        title: vars ? "🛡️ Staff Production 2FA Active" : "🛠️ Staff Testing Mode Active",
        description: vars
          ? "All Sub-Admins and Staff must verify 2FA OTP (TOTP Authenticator or Mobile SMS) on login."
          : "Staff 2FA OTP verification is relaxed for testing.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update staff 2FA mode", description: err.message, variant: "destructive" });
    },
  });

  if (!isPrimaryAdmin) return null;

  return (
    <Card className="border-2 border-amber-500/50 bg-gradient-to-br from-card via-card to-amber-950/20 shadow-2xl overflow-hidden rounded-3xl">
      <CardHeader className="bg-amber-500/10 border-b border-amber-500/30 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-inner">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg font-serif font-black text-foreground">
                  Chief Executive Admin Exclusive Platform Controls
                </CardTitle>
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                  Root Admin Only
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Master toggle switches for environment testing mode vs. hardened production security lockdown.
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* Unified Master 1-Click Platform Mode Switch */}
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-md ${
          isLockdownActive && isStaff2faActive
            ? "bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-card border-emerald-500/50"
            : "bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-card border-amber-500/50"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              isLockdownActive && isStaff2faActive
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}>
              {isLockdownActive && isStaff2faActive ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-foreground font-serif">
                  {isLockdownActive && isStaff2faActive
                    ? "🛡️ Production Ready Mode (All Hardened Protections Active)"
                    : "🛠️ Testing Mode (Relaxed for Development)"}
                </h3>
                <Badge className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                  isLockdownActive && isStaff2faActive
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                }`}>
                  {isLockdownActive && isStaff2faActive ? "🟢 PRODUCTION READY" : "🟡 TESTING MODE"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isLockdownActive && isStaff2faActive
                  ? "Stealth Gateway isolation + 2FA OTP for all staff members are fully active."
                  : "Direct /admin access & staff sign-in are relaxed for quick local/staging testing."}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={async () => {
              const targetState = !(isLockdownActive && isStaff2faActive);
              await toggleLockdownMutation.mutateAsync(targetState);
              await toggleStaff2faMutation.mutateAsync(targetState);
            }}
            disabled={toggleLockdownMutation.isPending || toggleStaff2faMutation.isPending}
            className={`font-extrabold text-xs rounded-xl shadow-lg cursor-pointer h-10 px-5 shrink-0 ${
              isLockdownActive && isStaff2faActive
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-gradient-to-r from-emerald-600 via-primary to-green-500 text-white"
            }`}
          >
            {toggleLockdownMutation.isPending || toggleStaff2faMutation.isPending
              ? "Switching Platform Mode..."
              : isLockdownActive && isStaff2faActive
              ? "Switch to Testing Mode 🛠️"
              : "Turn On Production Ready Mode 🔒"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* TOGGLE 1: Stealth Gateway & Private Admin URL Lockdown */}
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
            isLockdownActive
              ? "bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/20"
              : "bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20"
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className={`w-5 h-5 ${isLockdownActive ? "text-emerald-400" : "text-amber-400"}`} />
                  <h4 className="text-sm font-extrabold text-foreground">
                    1. Stealth Gateway &amp; URL Lockdown
                  </h4>
                </div>
                <Badge className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                  isLockdownActive
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                }`}>
                  {isLockdownActive ? "🔒 PRODUCTION HARDENED" : "🛠️ TESTING (RELAXED)"}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {isLockdownActive ? (
                  <>
                    <strong className="text-emerald-400">Active Protection:</strong> Direct access to <code>/admin</code> and <code>/admin/login</code> is strictly blocked by a full-screen threat interceptor. Super Admins authenticate exclusively via your secret <strong className="text-foreground">Private Stealth Gateway URL</strong>.
                  </>
                ) : (
                  <>
                    <strong className="text-amber-400">Testing Mode:</strong> Direct visits to <code>/admin</code> and <code>/admin/login</code> display the standard admin login screen for rapid development testing.
                  </>
                )}
              </p>
            </div>

            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold text-muted-foreground">
                {isLockdownActive ? "Strict Private Gateway Enforced" : "Direct Admin URLs Allowed"}
              </span>
              <Button
                size="sm"
                onClick={() => toggleLockdownMutation.mutate(!isLockdownActive)}
                disabled={toggleLockdownMutation.isPending || settingsLoading}
                className={`font-extrabold text-xs rounded-xl shadow-md cursor-pointer h-9 px-4 ${
                  isLockdownActive
                    ? "bg-amber-600 hover:bg-amber-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {toggleLockdownMutation.isPending
                  ? "Updating..."
                  : isLockdownActive
                  ? "Switch to Testing Mode 🛠️"
                  : "Turn On Production Mode 🔒"}
              </Button>
            </div>
          </div>

          {/* TOGGLE 2: Staff & Sub-Admin Production 2FA Security Mode */}
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
            isStaff2faActive
              ? "bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/20"
              : "bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20"
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-5 h-5 ${isStaff2faActive ? "text-emerald-400" : "text-amber-400"}`} />
                  <h4 className="text-sm font-extrabold text-foreground">
                    2. Staff Production 2FA Enforcement
                  </h4>
                </div>
                <Badge className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                  isStaff2faActive
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                }`}>
                  {isStaff2faActive ? "🟢 2FA ENFORCED" : "🟡 TESTING (RELAXED)"}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {isStaff2faActive ? (
                  <>
                    <strong className="text-emerald-400">Active Protection:</strong> All Sub-Admins, Managers, and Staff members are strictly required to verify 2FA OTP (TOTP Authenticator or Mobile SMS OTP) on every login attempt.
                  </>
                ) : (
                  <>
                    <strong className="text-amber-400">Testing Mode:</strong> Staff can log in with password only for quick local and staging testing.
                  </>
                )}
              </p>
            </div>

            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold text-muted-foreground">
                {isStaff2faActive ? "MFA OTP Required for All Staff" : "Password-Only Sign-In Allowed"}
              </span>
              <Button
                size="sm"
                onClick={() => toggleStaff2faMutation.mutate(!isStaff2faActive)}
                disabled={toggleStaff2faMutation.isPending || staff2faLoading}
                className={`font-extrabold text-xs rounded-xl shadow-md cursor-pointer h-9 px-4 ${
                  isStaff2faActive
                    ? "bg-amber-600 hover:bg-amber-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {toggleStaff2faMutation.isPending
                  ? "Updating..."
                  : isStaff2faActive
                  ? "Switch Staff to Testing Mode 🛠️"
                  : "Enforce Production 2FA 🛡️"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
