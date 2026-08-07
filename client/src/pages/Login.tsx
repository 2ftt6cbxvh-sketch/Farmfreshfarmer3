import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

export default function Login() {
  const { login, register, setUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [method, setMethod] = useState<"password" | "otp">("otp"); // Default to Email OTP
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);

  async function handleSendOtp() {
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/otp/send", { email: email.trim().toLowerCase() });
      const data = await res.json();
      setOtpSent(true);
      if (data.devOtp) setDevOtp(data.devOtp);
      toast({
        title: "🔑 Verification OTP Code Sent!",
        description: `Check your email inbox (${email}). ${data.devOtp ? `(DEV CODE: ${data.devOtp})` : ""}`,
      });
    } catch (err: any) {
      toast({ title: "Could not send OTP", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 6) {
      toast({ title: "Please enter the 6-digit OTP code", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/otp/verify", {
        email: email.trim().toLowerCase(),
        code: otpCode.trim(),
      });
      const data = await res.json();
      if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      setUser(data.user || data);
      toast({ title: "✨ Verification Successful!", description: `Welcome ${data.user?.name || "back"}!` });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Invalid or Expired OTP", description: err.message || "Please check the code and try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/google", {
        idToken: "demo_google_id_token",
        platform: "web",
      });
      const data = await res.json();
      if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      setUser(data.user || data);
      toast({ title: "✨ Signed in with Google!", description: `Welcome ${data.user?.name || ""}!` });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Google Sign-In Error", description: err.message || "Failed to sign in.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        await register({ name: name.trim(), email: email.trim().toLowerCase(), password, phone: phone.trim() || undefined });
        toast({ title: "Welcome to FarmFreshFarmer!" });
      } else {
        await login(email.trim().toLowerCase(), password);
        toast({ title: "Welcome back!" });
      }
      navigate("/");
    } catch (err: any) {
      const msg = String(err?.message || "");
      toast({
        title: mode === "signup" ? "Could not sign up" : "Could not log in",
        description: msg.includes("409") ? "This email is already registered." : msg.includes("401") ? "Wrong email or password." : "Please check your details.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-3xl border border-emerald-500/20 bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex justify-center"><Logo /></div>

          <div className="text-center space-y-1">
            <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-foreground">
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === "login" ? "Sign in to access your farm-fresh deliveries & orders" : "Sign up with Email OTP or Google in seconds"}
            </p>
          </div>

          {/* Google Sign-In Option */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="w-full py-6 rounded-2xl border-emerald-500/30 hover:bg-emerald-500/10 flex items-center justify-center gap-3 font-bold text-sm shadow-sm transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </Button>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-card-border w-full" />
              <span className="bg-card px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest absolute">Or</span>
            </div>
          </div>

          {/* Authentication Method Selector (OTP vs Password) */}
          <div className="grid grid-cols-2 p-1 bg-secondary/50 rounded-xl border border-card-border text-xs font-bold">
            <button
              type="button"
              onClick={() => setMethod("otp")}
              className={`py-2 rounded-lg transition-all ${method === "otp" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}
            >
              ✉️ Email OTP Code
            </button>
            <button
              type="button"
              onClick={() => setMethod("password")}
              className={`py-2 rounded-lg transition-all ${method === "password" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}
            >
              🔒 Password
            </button>
          </div>

          {/* Method 1: Email OTP Login Flow */}
          {method === "otp" ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <Label htmlFor="otp-email" className="text-xs font-bold">Email Address</Label>
                <Input
                  id="otp-email"
                  type="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={otpSent}
                  required
                  className="mt-1 rounded-xl"
                />
              </div>

              {!otpSent ? (
                <Button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={busy || !email}
                  className="w-full py-5 rounded-xl bg-gradient-to-r from-emerald-600 to-primary font-bold shadow-lg"
                >
                  {busy ? "Sending Code…" : "Send 6-Digit Verification OTP"}
                </Button>
              ) : (
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label htmlFor="otp-code" className="text-xs font-bold text-emerald-400">Enter 6-Digit OTP Code</Label>
                      <button
                        type="button"
                        onClick={() => setOtpSent(false)}
                        className="text-[11px] text-primary underline"
                      >
                        Change Email
                      </button>
                    </div>
                    <Input
                      id="otp-code"
                      type="text"
                      placeholder="e.g. 123456"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required
                      className="text-center font-mono text-xl tracking-[0.3em] font-extrabold rounded-xl border-emerald-500/50"
                    />
                    {devOtp && (
                      <p className="text-xs text-amber-400 mt-1 font-mono text-center bg-amber-500/10 py-1 rounded border border-amber-500/20">
                        DEV OTP CODE: {devOtp}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={busy || otpCode.length < 6}
                    className="w-full py-5 rounded-xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 font-bold shadow-lg shadow-emerald-900/30"
                  >
                    {busy ? "Verifying…" : "Verify OTP & Log In"}
                  </Button>
                </div>
              )}
            </form>
          ) : (
            /* Method 2: Standard Password Form */
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="name" className="text-xs font-bold">Full Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 rounded-xl" />
                </div>
              )}
              <div>
                <Label htmlFor="email" className="text-xs font-bold">Email Address</Label>
                <Input id="email" type="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 rounded-xl" />
              </div>
              {mode === "signup" && (
                <div>
                  <Label htmlFor="phone" className="text-xs font-bold">Phone (Optional)</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 rounded-xl" />
                </div>
              )}
              <div>
                <Label htmlFor="password" className="text-xs font-bold">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} className="mt-1 rounded-xl" />
              </div>
              <Button type="submit" className="w-full py-5 rounded-xl bg-primary font-bold shadow-lg" disabled={busy}>
                {busy ? "Please wait…" : mode === "login" ? "Log In with Password" : "Create Account"}
              </Button>
            </form>
          )}

          <p className="text-xs text-center text-muted-foreground pt-2 border-t border-card-border">
            {mode === "login" ? "Don't have an account? " : "Already registered? "}
            <button
              className="text-primary font-bold underline"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Sign up now" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    </Layout>
  );
}
