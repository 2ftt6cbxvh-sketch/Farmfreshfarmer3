import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ShieldAlert, CheckCircle2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPassword() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [token, setToken] = useState("");
  const [step2faRequired, setStep2faRequired] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Extract token and step2fa flag from query parameters or hash
    const search = window.location.search || "";
    const params = new URLSearchParams(search);
    const rawToken = params.get("token") || "";
    const is2fa = params.get("step2fa") === "required";

    if (rawToken) setToken(rawToken);
    if (is2fa) setStep2faRequired(true);

    // Fallback hash check e.g. /#/reset-password?token=...
    if (!rawToken && window.location.hash.includes("token=")) {
      const hashQuery = window.location.hash.split("?")[1] || "";
      const hashParams = new URLSearchParams(hashQuery);
      const hashToken = hashParams.get("token") || "";
      if (hashToken) setToken(hashToken);
      if (hashParams.get("step2fa") === "required") setStep2faRequired(true);
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      return toast({ title: "Invalid or missing reset token", description: "Please request a new reset link from the login page.", variant: "destructive" });
    }
    if (newPassword.length < 8) {
      return toast({ title: "Password too short", description: "Password must be at least 8 characters long.", variant: "destructive" });
    }
    if (newPassword !== confirmPassword) {
      return toast({ title: "Passwords do not match", variant: "destructive" });
    }

    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        token: token.trim(),
        newPassword: newPassword.trim(),
        totpCode: totpCode.trim() || undefined,
        recoveryCode: recoveryCode.trim() || undefined,
      });
      await res.json();
      setSuccess(true);
      toast({
        title: "✨ Password Updated Successfully!",
        description: "You can now log in securely with your new password.",
      });
    } catch (err: any) {
      const errMsg = err?.message || "Failed to reset password.";
      if (errMsg.includes("step2faRequired") || errMsg.includes("2FA") || errMsg.includes("TOTP") || errMsg.includes("Emergency Recovery")) {
        setStep2faRequired(true);
      }
      toast({
        title: "Password Reset Failed",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-foreground">
        <Card className="w-full max-w-md bg-slate-900 border border-emerald-500/30 shadow-2xl rounded-3xl overflow-hidden p-6 sm:p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
            <CheckCircle2 size={36} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white">Password Reset Complete!</h2>
            <p className="text-xs text-slate-400">
              Your credentials have been updated. All previous active sessions across all devices have been securely invalidated.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-3">
            <Button
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl gap-2 shadow-lg"
              onClick={() => navigate("/login")}
            >
              <span>Go to Login</span>
              <ArrowRight size={16} />
            </Button>
            <Button
              variant="outline"
              className="w-full h-10 border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              onClick={() => navigate("/admin/login")}
            >
              <span>Staff / Super Admin Portal</span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-foreground">
      <Card className="w-full max-w-md bg-slate-900 border border-slate-800 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="text-center pt-8 pb-4 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 mb-1">
            <KeyRound size={22} />
          </div>
          <CardTitle className="text-xl font-black tracking-tight text-white">
            Set New Password
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Enter your new secure password below to regain access.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-8">
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">New Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="bg-slate-950/60 border-slate-800 focus:border-emerald-500 rounded-xl pr-10 text-white placeholder:text-slate-600 text-sm h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Confirm New Password</Label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="bg-slate-950/60 border-slate-800 focus:border-emerald-500 rounded-xl text-white placeholder:text-slate-600 text-sm h-11"
              />
            </div>

            {/* Stepped-Up Two-Lock Box Verification for Chief Super Admin */}
            {step2faRequired && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 mt-4">
                <div className="flex items-center gap-2 text-amber-400">
                  <ShieldAlert size={16} className="shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    Super Admin 2FA Verification
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  As Chief Super Admin, a second factor is strictly required to verify ownership before the password can be updated.
                </p>

                {!useRecoveryCode ? (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-300">
                      6-Digit Authenticator Code (Apple Passwords / Google Auth)
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="123456"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      className="bg-slate-950 border-slate-700 text-center font-mono tracking-widest text-lg font-bold text-emerald-400 h-11 rounded-xl"
                    />
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setUseRecoveryCode(true)}
                        className="text-[11px] text-amber-400 hover:underline font-semibold"
                      >
                        Use Offline Emergency Recovery Code instead
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-300">
                      Offline Emergency Backup Recovery Code (Break-Glass)
                    </Label>
                    <Input
                      type="text"
                      placeholder="FFF-XXXX-XXXX-XXXX"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                      className="bg-slate-950 border-slate-700 text-center font-mono uppercase tracking-wider text-sm font-bold text-amber-400 h-11 rounded-xl"
                    />
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setUseRecoveryCode(false)}
                        className="text-[11px] text-emerald-400 hover:underline font-semibold"
                      >
                        Use 6-digit TOTP Authenticator code instead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/50 mt-2"
            >
              {loading ? "Securing Credentials..." : "Update Password & Secure Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-xs text-slate-400 hover:text-white transition">
              ← Return to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
