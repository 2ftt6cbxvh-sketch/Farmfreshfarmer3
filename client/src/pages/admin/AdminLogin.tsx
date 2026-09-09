import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import {
  ShieldCheck, Smartphone, ArrowLeft, RefreshCw, ShieldAlert, KeyRound,
  Crown, Clock, Eye, EyeOff, Copy, Check, Sparkles, HelpCircle, Lock
} from "lucide-react";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

export default function AdminLogin() {
  const { user, login, setUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("admin@farmfreshfarmer.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [highlightTotp, setHighlightTotp] = useState(false);
  const [totpRequiredMessage, setTotpRequiredMessage] = useState<string | null>(null);

  // Auto-redirect if already authenticated as admin
  useEffect(() => {
    if (user) {
      const allowedRoles = [
        "admin", "superadmin", "warehouse_admin", "manager_admin", "subadmin",
        "custom_subadmin", "customer_rep", "local_grievance_officer",
        "zonal_grievance_officer", "chief_grievance_officer"
      ];
      if (
        user.isPrimaryAdmin ||
        user.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
        allowedRoles.includes(user.role)
      ) {
        navigate("/admin");
      }
    }
  }, [user, navigate]);

  // 3-Layer Super Admin Temp Token State
  const [superAdminTempToken, setSuperAdminTempToken] = useState("");

  // Passkey State
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [passkeyOptions, setPasskeyOptions] = useState<any>(null);
  const [passkeyToken, setPasskeyToken] = useState("");

  // 2FA Challenge State for Staff (Telegram / SMS)
  const [step2fa, setStep2fa] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [maskedTelegram, setMaskedTelegram] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffOtpCode, setStaffOtpCode] = useState("");
  const [resending, setResending] = useState(false);

  // Break-Glass Emergency Login State
  const [isEmergency, setIsEmergency] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  // Authenticator Secret Helper Tooltip/Modal
  const [showSecretGuide, setShowSecretGuide] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const totpInputRef = useRef<HTMLInputElement>(null);

  async function triggerPasskeyVerification(options: any, tempAuthToken: string) {
    setPasskeyPending(true);
    setPasskeyOptions(options);
    setPasskeyToken(tempAuthToken);

    toast({
      title: "🔑 Layer 3: Hardware Passkey Verification",
      description: "Touch your Mac Touch ID / Face ID sensor to complete login...",
    });

    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const asseResp = await startAuthentication(options);

      const verifyRes = await apiRequest("POST", "/api/login/verify-passkey", {
        tempAuthToken,
        response: asseResp,
      });
      const verifyData = await verifyRes.json();

      if (verifyData.accessToken) localStorage.setItem("accessToken", verifyData.accessToken);
      if (verifyData.refreshToken) localStorage.setItem("refreshToken", verifyData.refreshToken);
      if (verifyData.user) {
        setUser(verifyData.user);
        localStorage.setItem("adminUser", JSON.stringify(verifyData.user));
        localStorage.setItem("user", JSON.stringify(verifyData.user));
        sessionStorage.setItem("admin_mfa_verified", "true");
      }
      toast({ title: "✨ 3-Layer Security Verified! Welcome back, Chief Super Admin." });
      navigate("/admin");
    } catch (passkeyErr: any) {
      console.warn("[Passkey Verification]", passkeyErr?.message);
      toast({
        title: "Passkey Verification Cancelled or Timed Out",
        description: "You can retry Touch ID below.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      return toast({ title: "Password required", description: "Please enter your password.", variant: "destructive" });
    }

    setBusy(true);
    setTotpRequiredMessage(null);

    try {
      // If we already have a superAdminTempToken and the user is entering TOTP:
      if (superAdminTempToken && totpCode.trim().length === 6) {
        const verifyRes = await apiRequest("POST", "/api/login/admin-verify-totp", {
          tempToken: superAdminTempToken,
          totpCode: totpCode.trim(),
        });
        const data = await verifyRes.json();

        if (!verifyRes.ok) {
          if (data.message?.toLowerCase().includes("expired")) {
            setSuperAdminTempToken("");
          }
          throw new Error(data.message || "Invalid 6-digit TOTP code. Please check your Authenticator app.");
        }

        if (data.requirePasskey) {
          await triggerPasskeyVerification(data.webauthnOptions, data.tempAuthToken);
          return;
        }

        if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
        if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
        if (data.user) {
          setUser(data.user);
          localStorage.setItem("adminUser", JSON.stringify(data.user));
          localStorage.setItem("user", JSON.stringify(data.user));
          sessionStorage.setItem("admin_mfa_verified", "true");
        }
        toast({ title: "✨ Welcome back, Chief Admin!" });
        navigate("/admin");
        return;
      }

      // Initial login attempt (with optional totpCode if entered upfront)
      const res: any = await login(email.trim().toLowerCase(), password, {
        isStealthGateway: true,
        totpCode: totpCode.trim() || undefined,
      });

      // Layer 2: Authenticator TOTP required
      if (res?.requireLayer2Totp) {
        setSuperAdminTempToken(res.tempToken || "");
        setHighlightTotp(true);
        setTotpRequiredMessage("🔐 2FA Active: Please enter the 6-digit Authenticator TOTP code from Google Authenticator or Apple Passwords.");
        toast({
          title: "🔐 Authenticator TOTP Code Required",
          description: "Enter your 6-digit code below and click Sign In.",
        });
        setTimeout(() => totpInputRef.current?.focus(), 150);
        return;
      }

      // Layer 3: Passkey required
      if (res?.requirePasskey) {
        await triggerPasskeyVerification(res.webauthnOptions, res.tempAuthToken);
        return;
      }

      // Staff 2FA (Telegram OTP)
      if (res?.require2fa) {
        setStep2fa(true);
        setTempToken(res.tempToken);
        setMaskedTelegram(res.maskedTelegram || "your Telegram");
        setStaffName(res.staffName || "Staff Member");
        toast({
          title: "🔐 2FA Telegram OTP Dispatched",
          description: `Enter the 6-digit code sent to Telegram (${res.maskedTelegram}).`,
        });
        return;
      }

      // Successful direct login
      const u = res;
      if (u && u.role === "delivery_partner") {
        toast({ title: "Welcome back, Delivery Partner!" });
        navigate("/partner-portal");
        return;
      }

      const allowedRoles = [
        "admin", "superadmin", "warehouse_admin", "manager_admin", "subadmin",
        "custom_subadmin", "customer_rep", "local_grievance_officer",
        "zonal_grievance_officer", "chief_grievance_officer"
      ];

      if (u && !allowedRoles.includes(u.role) && !u.isPrimaryAdmin) {
        toast({
          title: "Access Restricted",
          description: "This portal is reserved for authorized administrative staff.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: `Welcome back, ${u?.name || "Admin"}!` });
      navigate("/admin");
    } catch (err: any) {
      console.error("[Admin Login Error]", err);
      toast({
        title: "Login Failed",
        description: err?.message || "Invalid credentials or code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleEmergencyLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !recoveryCode) {
      toast({ title: "Email and Emergency Code required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/admin/emergency-login", {
        email: email.trim().toLowerCase(),
        recoveryCode: recoveryCode.trim().toUpperCase(),
      });
      const data = await res.json();
      if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      if (data.user) {
        localStorage.setItem("adminUser", JSON.stringify(data.user));
        localStorage.setItem("user", JSON.stringify(data.user));
        sessionStorage.setItem("admin_mfa_verified", "true");
        setUser(data.user);
      }
      toast({
        title: "🛡️ Emergency Recovery Granted!",
        description: "Welcome back, Chief Super Admin. Redirecting to Security Center...",
      });
      navigate("/admin/security");
    } catch (err: any) {
      toast({
        title: "Emergency Login Failed",
        description: err?.message || "Invalid or already consumed Recovery Code.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify2fa(e: React.FormEvent) {
    e.preventDefault();
    if (!staffOtpCode || staffOtpCode.trim().length !== 6) {
      toast({ title: "Invalid Code", description: "Please enter the 6-digit code from Telegram.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/login/verify-otp", {
        tempToken,
        otp: staffOtpCode.trim(),
      });
      const data = await res.json();
      if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      if (data.user) {
        localStorage.setItem("adminUser", JSON.stringify(data.user));
        localStorage.setItem("user", JSON.stringify(data.user));
        sessionStorage.setItem("admin_mfa_verified", "true");
        setUser(data.user);
      }
      toast({ title: "✨ 2FA Verified!", description: `Welcome back, ${data.user?.name || staffName}!` });
      navigate("/admin");
    } catch (err: any) {
      toast({ title: "2FA Verification Failed", description: err?.message || "Invalid or expired OTP code.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleResend2fa() {
    setResending(true);
    try {
      const res = await apiRequest("POST", "/api/login/resend-otp", { tempToken });
      const data = await res.json();
      toast({ title: "✨ OTP Resent", description: data?.message || "New 6-digit code dispatched to Telegram." });
    } catch (err: any) {
      toast({ title: "Resend Failed", description: err?.message || "Could not resend OTP.", variant: "destructive" });
    } finally {
      setResending(false);
    }
  }

  const copySecretToClipboard = () => {
    navigator.clipboard.writeText("2ANFJJ553AGVMYWS7CZJLG3XJXU3CVSB");
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
    toast({ title: "Secret Copied!", description: "Paste this key into Google Authenticator or Apple Passwords." });
  };

  // If already authenticated
  if (
    user &&
    (user.isPrimaryAdmin ||
      user.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
      ["admin", "superadmin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin", "customer_rep", "local_grievance_officer", "zonal_grievance_officer", "chief_grievance_officer"].includes(user.role))
  ) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto" />
        <p className="text-sm font-bold text-white">Authenticated as {user.name || user.email}. Opening Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-emerald-500/20 bg-card/95 backdrop-blur-xl p-8 shadow-2xl space-y-6">

        {/* ── MODE 1: EMERGENCY BREAK-GLASS RECOVERY ── */}
        {isEmergency ? (
          <>
            <div className="flex justify-center mb-2">
              <span className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-lg">
                <ShieldAlert size={28} />
              </span>
            </div>
            <div className="text-center space-y-1">
              <h1 className="font-serif text-2xl font-bold text-amber-400">Emergency Break-Glass Login</h1>
              <p className="text-xs text-muted-foreground">
                Single-Use Zero-Knowledge Recovery Protocol. Use if you lost your phone or hardware passkey.
              </p>
            </div>

            <form onSubmit={handleEmergencyLogin} className="space-y-4">
              <div>
                <Label htmlFor="emergency-email" className="text-xs font-bold text-muted-foreground">
                  Master Email Address *
                </Label>
                <Input
                  id="emergency-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-xl mt-1 font-mono text-sm"
                />
              </div>

              <div>
                <Label htmlFor="emergency-code" className="text-xs font-bold text-amber-400">
                  Offline Emergency Recovery Code *
                </Label>
                <Input
                  id="emergency-code"
                  type="text"
                  placeholder="FFF-XXXX-XXXX-XXXX"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  required
                  autoFocus
                  className="rounded-xl mt-1 font-mono text-center text-base tracking-widest font-bold uppercase border-amber-500/40"
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-center">
                  Enter 1 code from your printed backup kit. Each code is invalidated after use.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 font-extrabold text-white shadow-lg"
                disabled={busy || !recoveryCode.trim()}
              >
                {busy ? "Authenticating Recovery Token…" : "🛡️ Verify Code & Unlock Root Access"}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsEmergency(false)}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold"
                >
                  ← Back to Standard Admin Login
                </button>
              </div>
            </form>
          </>
        ) : step2fa ? (
          /* ── MODE 2: STAFF TELEGRAM OTP ── */
          <>
            <div className="flex justify-center mb-2">
              <span className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-sky-500/20 border border-sky-500/40 text-sky-400 shadow-lg">
                <Smartphone size={28} />
              </span>
            </div>
            <div className="text-center space-y-1">
              <h1 className="font-serif text-2xl font-bold text-foreground">Telegram 2FA Verification</h1>
              <p className="text-xs text-muted-foreground">
                Hello <b>{staffName}</b>, a 6-digit one-time passcode was dispatched to your Telegram account ({maskedTelegram}).
              </p>
            </div>

            <form onSubmit={handleVerify2fa} className="space-y-4">
              <div>
                <Label htmlFor="otp-input" className="text-xs font-bold text-sky-300 flex items-center justify-between">
                  <span>Enter 6-Digit OTP Code</span>
                  <span className="text-[10px] text-muted-foreground">Expires in 3 mins</span>
                </Label>
                <Input
                  id="otp-input"
                  type="text"
                  maxLength={6}
                  value={staffOtpCode}
                  onChange={(e) => setStaffOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="• • • • • •"
                  required
                  autoFocus
                  className="rounded-xl mt-1 text-center font-mono text-xl tracking-widest font-black border-sky-500/40 focus:ring-sky-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 font-extrabold text-white shadow-lg"
                disabled={busy || staffOtpCode.length !== 6}
              >
                {busy ? "Verifying Token…" : "🔐 Unlock Dashboard Access"}
              </Button>

              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep2fa(false);
                    setStaffOtpCode("");
                  }}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft size={13} /> Back to login
                </button>

                <button
                  type="button"
                  onClick={handleResend2fa}
                  disabled={resending}
                  className="text-sky-400 hover:underline flex items-center gap-1 font-bold"
                >
                  <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
                  <span>{resending ? "Resending…" : "Resend OTP"}</span>
                </button>
              </div>
            </form>
          </>
        ) : passkeyPending ? (
          /* ── MODE 3: TOUCH ID / PASSKEY STEP ── */
          <>
            <div className="flex justify-center mb-2">
              <span className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 shadow-lg animate-pulse">
                <ShieldCheck size={28} />
              </span>
            </div>
            <div className="text-center space-y-1">
              <span className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Layer 3 of 3 • Hardware Biometrics
              </span>
              <h1 className="font-serif text-2xl font-bold text-foreground">Touch ID / Passkey</h1>
              <p className="text-xs text-muted-foreground">
                Touch your Mac Touch ID sensor or Apple Face ID to complete authentication.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Button
                onClick={() => triggerPasskeyVerification(passkeyOptions, passkeyToken)}
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-xl gap-2 shadow-lg"
              >
                <Sparkles size={16} />
                <span>Trigger Touch ID Sensor Now</span>
              </Button>

              <button
                type="button"
                onClick={() => setPasskeyPending(false)}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold text-center"
              >
                ← Back to Password &amp; TOTP
              </button>
            </div>
          </>
        ) : (
          /* ── MODE 4: UNIFIED FLUID LOGIN FORM (PASSWORD + TOTP VISIBLE) ── */
          <>
            <div className="flex justify-center mb-2">
              <span className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-lg">
                <Crown size={28} />
              </span>
            </div>

            <div className="text-center space-y-1">
              <h1 className="font-serif text-2xl font-bold text-foreground">Chief Executive Super Admin</h1>
              <p className="text-xs text-muted-foreground">Master Portal • 3-Factor Multi-Authentication Gateway</p>
            </div>

            {totpRequiredMessage && (
              <div className="p-3 rounded-2xl bg-purple-500/15 border border-purple-500/40 text-purple-200 text-xs font-medium text-center animate-in fade-in flex items-center justify-center gap-2">
                <KeyRound size={15} className="text-purple-400 shrink-0" />
                <span>{totpRequiredMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Address */}
              <div>
                <Label htmlFor="admin-email" className="text-xs font-bold text-muted-foreground">
                  Email Address
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@farmfreshfarmer.com"
                  className="rounded-xl mt-1 font-medium"
                  data-testid="input-admin-email"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-password" className="text-xs font-bold text-muted-foreground">
                    Password
                  </Label>
                  <Link href="/forgot-password" className="text-[11px] text-emerald-400 hover:underline font-semibold">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative mt-1">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="rounded-xl pr-10"
                    data-testid="input-admin-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* ── 6-DIGIT TOTP CODE (PROMINENTLY VISIBLE) ── */}
              <div className={`p-4 rounded-2xl border transition-all ${
                highlightTotp
                  ? "bg-purple-500/15 border-purple-500 shadow-xl shadow-purple-950/50 ring-2 ring-purple-500/40 animate-pulse"
                  : "bg-secondary/60 border-card-border shadow-sm"
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="admin-totp-code" className="text-xs font-extrabold flex items-center gap-1.5 text-foreground">
                    <KeyRound size={15} className="text-emerald-400" />
                    <span>6-Digit Authenticator Code (TOTP)</span>
                  </Label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Google Auth / Apple Passwords
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground mb-2">
                  Enter the 6 digits generated by your Authenticator app. You can submit it now together with your password.
                </p>

                <Input
                  ref={totpInputRef}
                  id="admin-totp-code"
                  type="text"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="0 0 0 0 0 0"
                  className="rounded-xl font-mono text-center text-2xl tracking-[0.4em] font-black h-12 bg-background/90 border-emerald-500/40 focus:border-emerald-500 focus:ring-emerald-500"
                  data-testid="input-admin-totp"
                />

                <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock size={11} className="text-muted-foreground" />
                    <span>30s Rolling Token</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSecretGuide(!showSecretGuide)}
                    className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <HelpCircle size={11} />
                    <span>{showSecretGuide ? "Hide Secret Key" : "Need Secret Key?"}</span>
                  </button>
                </div>

                {/* Secret Key Quick Guide */}
                {showSecretGuide && (
                  <div className="mt-3 p-3 rounded-xl bg-card border border-card-border text-xs space-y-2 animate-in fade-in">
                    <p className="text-[11px] text-muted-foreground">
                      To pair Google Authenticator or Apple Passwords: tap <b>Add Account</b>, choose <b>Manual Key</b>, and paste:
                    </p>
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/80 font-mono text-[11px] text-emerald-300 select-all break-all">
                      <span>2ANFJJ553AGVMYWS7CZJLG3XJXU3CVSB</span>
                      <button
                        type="button"
                        onClick={copySecretToClipboard}
                        className="shrink-0 text-muted-foreground hover:text-white cursor-pointer"
                      >
                        {copiedSecret ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 font-extrabold text-white shadow-lg cursor-pointer transition-transform active:scale-[0.99]"
                disabled={busy}
                data-testid="button-admin-login"
              >
                {busy ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Authenticating Master Gateway…</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Lock size={15} />
                    <span>Sign In to Super Admin Portal</span>
                  </span>
                )}
              </Button>
            </form>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-card-border flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsEmergency(true)}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldAlert size={14} />
                <span>Lost authenticator? Use Offline Recovery Code</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
