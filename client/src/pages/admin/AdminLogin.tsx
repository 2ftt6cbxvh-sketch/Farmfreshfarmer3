import { useState } from "react";
import { useLocation, Link } from "wouter";
import { ShieldCheck, Smartphone, ArrowLeft, RefreshCw, ShieldAlert, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

export default function AdminLogin() {
  const { login, setUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("admin@farmfreshfarmer.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // 2FA Challenge State
  const [step2fa, setStep2fa] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [maskedTelegram, setMaskedTelegram] = useState("");
  const [staffName, setStaffName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resending, setResending] = useState(false);

  // Break-Glass Emergency Login State
  const [isEmergency, setIsEmergency] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res: any = await login(email.trim().toLowerCase(), password);

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

      const u = res;
      if (u.role === "delivery_partner") {
        toast({ title: "Welcome back, Delivery Partner!" });
        navigate("/partner-portal");
        return;
      }
      if (!["admin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin", "customer_rep", "local_grievance_officer", "zonal_grievance_officer", "chief_grievance_officer"].includes(u.role)) {
        toast({ title: "Not an authorized staff account", description: "Use valid staff credentials to sign in.", variant: "destructive" });
        return;
      }
      toast({ title: "Welcome back, " + (u.name || "Admin") });
      navigate("/admin");
    } catch (err: any) {
      toast({ title: "Login failed", description: err?.message || "Wrong email or password.", variant: "destructive" });
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
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
      if (data.user) {
        localStorage.setItem("adminUser", JSON.stringify(data.user));
        setUser(data.user);
      }
      toast({
        title: "🛡️ Break-Glass Emergency Authentication Granted!",
        description: "Welcome back, Chief Super Admin. Redirecting to Security Center...",
      });
      navigate("/admin/security");
    } catch (err: any) {
      toast({
        title: "Emergency Authentication Failed",
        description: err?.message || "Invalid or already consumed Recovery Code.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify2fa(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      toast({ title: "Invalid Code", description: "Please enter the 6-digit code from Telegram.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/login/verify-otp", {
        tempToken,
        otp: otpCode.trim(),
      });
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
      if (data.user) {
        localStorage.setItem("adminUser", JSON.stringify(data.user));
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-md rounded-3xl border border-card-border bg-card p-8 shadow-2xl">
        {isEmergency ? (
          <>
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-lg">
                <ShieldAlert size={28} />
              </span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-center text-foreground">Break-Glass Master Login</h1>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Disaster Recovery Portal: Log in immediately using your offline single-use Emergency Backup Code.
            </p>

            <form onSubmit={handleEmergencyLogin} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="emergency-email" className="text-xs font-bold text-foreground">Chief Admin Email</Label>
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
                  Enter 1 code from your printed backup kit. Each code can only be used once.
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
        ) : !step2fa ? (
          <>
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-lg">
                <ShieldCheck size={26} />
              </span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-center">Staff & Admin Login</h1>
            <p className="text-sm text-muted-foreground text-center mt-1">FarmFreshFarmer Secure Gateway</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="admin-email">Email Address</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-xl mt-1"
                  data-testid="input-admin-email"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline font-semibold">
                    Forgot Password?
                  </Link>
                </div>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-xl mt-1"
                  data-testid="input-admin-password"
                />
              </div>
              <Button type="submit" className="w-full rounded-xl font-bold" disabled={busy} data-testid="button-admin-login">
                {busy ? "Authenticating…" : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border text-center">
              <button
                type="button"
                onClick={() => setIsEmergency(true)}
                className="text-xs text-amber-500 hover:text-amber-400 font-bold flex items-center justify-center gap-1.5 mx-auto"
              >
                <ShieldAlert size={14} />
                <span>Lost devices? Emergency Recovery Code Login</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-sky-500/20 border border-sky-500/40 text-sky-400 shadow-lg">
                <Smartphone size={28} />
              </span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-center">Telegram 2FA Verification</h1>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Hello <b>{staffName}</b>, a 6-digit one-time passcode was dispatched to your authenticated Telegram account ({maskedTelegram}).
            </p>

            <form onSubmit={handleVerify2fa} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="otp-input" className="text-xs font-bold text-sky-300 flex items-center justify-between">
                  <span>Enter 6-Digit OTP Code</span>
                  <span className="text-[10px] text-muted-foreground">Expires in 3 mins</span>
                </Label>
                <Input
                  id="otp-input"
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="• • • • • •"
                  required
                  autoFocus
                  className="rounded-xl mt-1 text-center font-mono text-xl tracking-widest font-black border-sky-500/40 focus:ring-sky-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 font-extrabold text-white shadow-lg"
                disabled={busy || otpCode.length !== 6}
              >
                {busy ? "Verifying Token…" : "🔐 Unlock Dashboard Access"}
              </Button>

              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep2fa(false);
                    setOtpCode("");
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
        )}
      </div>
    </div>
  );
}

