import { useState } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
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
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googlePhone, setGooglePhone] = useState("");

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

  async function handleGoogleSuccess(credentialResponse: any) {
    if (!credentialResponse.credential) return;
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/google", {
        idToken: credentialResponse.credential,
        platform: "web",
      });
      const data = await res.json();
      if (data.requiresPhone) {
        setGoogleUser(data.user);
        setShowPhoneModal(true);
        const token = data.tempToken || data.accessToken;
        if (token) {
          localStorage.setItem("accessToken", token);
          localStorage.setItem("tempToken", token);
        }
        return;
      }
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

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!googlePhone || googlePhone.length < 10) return;
    setBusy(true);
    try {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("tempToken") || "";
      if (token) localStorage.setItem("accessToken", token);
      const res = await apiRequest("PATCH", "/api/user/phone", { phone: googlePhone });
      const data = await res.json();
      localStorage.removeItem("tempToken");
      setUser(data.user || googleUser);
      setShowPhoneModal(false);
      toast({ title: "Phone number saved!", description: "Welcome to FarmFreshFarmer." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
        const u = await login(email.trim().toLowerCase(), password);
        toast({ title: "Welcome back!" });
        if (u?.role === "delivery_partner") {
          navigate("/partner-portal");
        } else if (u?.role && ["admin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin"].includes(u.role)) {
          navigate("/admin");
        } else {
          navigate("/");
        }
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
    <GoogleOAuthProvider clientId="983416661519-hd22kfa2kc02hnh5plea83bckfej3o95.apps.googleusercontent.com">
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
          <div className="space-y-3 flex flex-col items-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast({ title: "Google Sign-In Error", description: "Failed to sign in.", variant: "destructive" })}
              useOneTap
            />

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
                  <Label htmlFor="phone" className="text-xs font-bold">Mobile Number *</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">+91</span>
                    <input
                      id="phone"
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Required for delivery updates via SMS/WhatsApp</p>
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

          <div className="pt-2 border-t border-card-border space-y-2">
            <p className="text-xs text-center text-muted-foreground">
              {mode === "login" ? "Don't have an account? " : "Already registered? "}
              <button
                type="button"
                className="text-primary font-bold underline"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "Sign up now" : "Log in"}
              </button>
            </p>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => navigate("/admin/login")}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-extrabold bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/25 transition-all cursor-pointer"
              >
                <span>🚚 Delivery Partner Login</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-border">
            <h2 className="text-xl font-extrabold text-foreground mb-2">Almost done!</h2>
            <p className="text-xs text-muted-foreground mb-4">Enter your mobile number to complete sign-up. We need this to send delivery updates via SMS/WhatsApp.</p>
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">+91</span>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={googlePhone}
                  onChange={(e) => setGooglePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full rounded-2xl border border-input bg-background pl-11 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <Button type="submit" disabled={busy || googlePhone.length < 10} className="w-full py-5 rounded-xl bg-primary font-bold shadow-lg">
                {busy ? "Saving..." : "Complete Sign-up"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </Layout>
    </GoogleOAuthProvider>
  );
}
