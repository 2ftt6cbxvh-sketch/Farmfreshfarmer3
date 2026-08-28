import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, Phone, User as UserIcon, ShieldCheck } from "lucide-react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, apiGet } from "@/lib/queryClient";

export default function Login() {
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: authMethods } = useQuery<{ emailEnabled: boolean; googleEnabled: boolean }>({
    queryKey: ["/api/auth/methods"],
    queryFn: () => apiGet<{ emailEnabled: boolean; googleEnabled: boolean }>("/api/auth/methods"),
  });

  const emailEnabled = authMethods?.emailEnabled !== false;
  const googleEnabled = authMethods?.googleEnabled !== false;

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);

  // ===================== LOGIN STATE =====================
  const [loginStep, setLoginStep] = useState<"credentials" | "otp">("credentials");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginToken, setLoginToken] = useState("");
  const [loginOtpCode, setLoginOtpCode] = useState("");
  const [loginDevOtp, setLoginDevOtp] = useState<string | null>(null);

  // ===================== SIGNUP STATE =====================
  const [signupStep, setSignupStep] = useState<"form" | "otp">("form");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [signupToken, setSignupToken] = useState("");
  const [signupOtpCode, setSignupOtpCode] = useState("");
  const [signupDevOtp, setSignupDevOtp] = useState<string | null>(null);

  // ===================== GOOGLE AUTH PHONE MODAL =====================
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googlePhone, setGooglePhone] = useState("");

  // ===================== FORGOT PASSWORD MODAL =====================
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "otp">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtpCode, setForgotOtpCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotNewPwd, setShowForgotNewPwd] = useState(false);
  const [showForgotConfirmPwd, setShowForgotConfirmPwd] = useState(false);
  const [forgotDevOtp, setForgotDevOtp] = useState<string | null>(null);

  // ----------------------------------------------------
  // LOGIN FLOW
  // ----------------------------------------------------
  async function handleLoginInitiate(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (!loginPassword) {
      toast({ title: "Please enter your password", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login/initiate", {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      const data = await res.json();

      setLoginToken(data.loginToken || "");
      setLoginStep("otp");
      setLoginOtpCode("");
      if (data.devOtp) setLoginDevOtp(data.devOtp);

      toast({
        title: "🔑 Verification OTP Code Sent!",
        description: `Check your inbox (${loginEmail}). If not found in Primary, please check your Spam / Junk folder!`,
      });
    } catch (err: any) {
      const errorMsg = String(err?.message || "");
      if (errorMsg.includes("sign up first") || errorMsg.includes("No account found") || errorMsg.includes("404")) {
        toast({
          title: "Account Not Found",
          description: "No account is registered with this email. Switching to Sign Up!",
        });
        setSignupEmail(loginEmail.trim().toLowerCase());
        setSignupPassword(loginPassword);
        setSignupConfirmPassword(loginPassword);
        setMode("signup");
        setSignupStep("form");
      } else if (errorMsg.includes("Incorrect password") || errorMsg.includes("401")) {
        toast({
          title: "Incorrect Password",
          description: "Please check your password or use 'Forgot Password' below.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Could Not Sign In",
          description: errorMsg || "Please check your credentials and try again.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLoginVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!loginOtpCode.trim() || loginOtpCode.length < 6) {
      toast({ title: "Please enter the 6-digit OTP code", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login/verify-otp", {
        loginToken,
        email: loginEmail.trim().toLowerCase(),
        code: loginOtpCode.trim(),
        platform: "web",
      });
      const data = await res.json();

      if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      setUser(data.user || data);

      toast({
        title: "✨ Verification Successful!",
        description: `Welcome back, ${data.user?.name || "Customer"}!`,
      });

      const role = data.user?.role;
      if (role === "delivery_partner") {
        navigate("/partner-portal");
      } else if (role && ["admin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin", "customer_rep", "local_grievance_officer", "zonal_grievance_officer", "chief_grievance_officer"].includes(role)) {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err: any) {
      toast({
        title: "Invalid or Expired OTP",
        description: err.message || "Please check your code (and Spam folder) and try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  // ----------------------------------------------------
  // SIGNUP FLOW
  // ----------------------------------------------------
  async function handleSignupInitiate(e: React.FormEvent) {
    e.preventDefault();

    if (!signupName.trim() || signupName.trim().length < 2) {
      toast({ title: "Please enter your full name (minimum 2 characters)", variant: "destructive" });
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes("@")) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    const cleanPhone = signupPhone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      toast({ title: "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9", variant: "destructive" });
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters long", variant: "destructive" });
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      toast({ title: "Passwords do not match", description: "Please re-enter and confirm your password.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/signup/initiate", {
        name: signupName.trim(),
        email: signupEmail.trim().toLowerCase(),
        phone: cleanPhone,
        password: signupPassword,
      });
      const data = await res.json();

      setSignupToken(data.signupToken || "");
      setSignupStep("otp");
      setSignupOtpCode("");
      if (data.devOtp) setSignupDevOtp(data.devOtp);

      toast({
        title: "🔑 Verification OTP Code Sent!",
        description: `Check your inbox (${signupEmail}). If not found in Primary, please check your Spam / Junk folder!`,
      });
    } catch (err: any) {
      const errorMsg = String(err?.message || "");
      if (errorMsg.includes("already exists") || errorMsg.includes("409")) {
        toast({
          title: "Account Already Exists",
          description: "An account with this email already exists. Switching to Log In!",
        });
        setLoginEmail(signupEmail.trim().toLowerCase());
        setMode("login");
        setLoginStep("credentials");
      } else {
        toast({
          title: "Sign-Up Error",
          description: errorMsg || "Please verify your details and try again.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignupVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!signupOtpCode.trim() || signupOtpCode.length < 6) {
      toast({ title: "Please enter the 6-digit OTP code", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/signup/verify-otp", {
        signupToken,
        code: signupOtpCode.trim(),
        platform: "web",
      });
      const data = await res.json();

      if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      setUser(data.user || data);

      toast({
        title: "🎉 Account Created Successfully!",
        description: `Welcome to FarmFreshFarmer, ${data.user?.name || ""}!`,
      });
      navigate("/");
    } catch (err: any) {
      toast({
        title: "Invalid or Expired OTP",
        description: err.message || "Please check the code and try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  // ----------------------------------------------------
  // GOOGLE AUTH
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // FORGOT PASSWORD FLOW
  // ----------------------------------------------------
  async function handleSendForgotOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotEmail.includes("@")) {
      toast({ title: "Please enter your registered email address", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password/otp/send", {
        email: forgotEmail.trim().toLowerCase(),
      });
      const data = await res.json();
      setForgotStep("otp");
      if (data.devOtp) setForgotDevOtp(data.devOtp);
      toast({
        title: "🔑 Password Reset OTP Sent!",
        description: `Check your inbox (${forgotEmail}). If not in Primary, check your Spam folder!`,
      });
    } catch (err: any) {
      const errMsg = String(err?.message || "");
      if (errMsg.includes("No account") || errMsg.includes("sign up") || errMsg.includes("404")) {
        toast({
          title: "Account Not Found",
          description: "No account found with this email. Please sign up first.",
        });
        setShowForgotModal(false);
        setSignupEmail(forgotEmail.trim().toLowerCase());
        setMode("signup");
        setSignupStep("form");
      } else {
        toast({
          title: "Error",
          description: errMsg || "Could not send reset OTP. Check your email.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotOtpCode.trim() || forgotOtpCode.length < 6) {
      toast({ title: "Please enter the 6-digit OTP code", variant: "destructive" });
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters long", variant: "destructive" });
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      toast({ title: "Passwords do not match", description: "Please re-enter matching passwords.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password/otp/verify-reset", {
        email: forgotEmail.trim().toLowerCase(),
        code: forgotOtpCode.trim(),
        newPassword: forgotNewPassword.trim(),
      });
      const data = await res.json();
      toast({
        title: "✨ Password Reset Successful!",
        description: data.message || "You can now log in with your new password.",
      });
      setLoginEmail(forgotEmail.trim().toLowerCase());
      setLoginPassword(forgotNewPassword);
      setShowForgotModal(false);
      setForgotStep("email");
      setForgotOtpCode("");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
    } catch (err: any) {
      toast({
        title: "Reset Failed",
        description: err.message || "Invalid or expired OTP code.",
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

            {/* Title & Subtitle */}
            <div className="text-center space-y-1">
              <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-foreground">
                {mode === "login"
                  ? (loginStep === "otp" ? "Verify Login OTP" : "Welcome Back")
                  : (signupStep === "otp" ? "Verify Registration" : "Create Account")}
              </h1>
              <p className="text-xs text-muted-foreground">
                {mode === "login"
                  ? (loginStep === "otp" ? "Enter the 6-digit 2FA code sent to your email" : "Sign in securely with Password & Email OTP")
                  : (signupStep === "otp" ? "Enter the 6-digit code sent to your email" : "Sign up in seconds. All fields are mandatory.")}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            {loginStep === "credentials" && signupStep === "form" && (
              <div className="grid grid-cols-2 p-1 bg-secondary/60 rounded-2xl border border-card-border text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setMode("login"); }}
                  className={`py-2.5 rounded-xl transition-all ${mode === "login" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
                >
                  🔐 Log In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("signup"); }}
                  className={`py-2.5 rounded-xl transition-all ${mode === "signup" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
                >
                  ✨ Sign Up
                </button>
              </div>
            )}

            {/* ======================================================== */}
            {/* GOOGLE SIGN-IN OPTION                                    */}
            {/* ======================================================== */}
            {googleEnabled && loginStep === "credentials" && signupStep === "form" && (
              <div className="space-y-3 flex flex-col items-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast({ title: "Google Sign-In Error", description: "Failed to sign in.", variant: "destructive" })}
                />

                {emailEnabled && (
                  <div className="relative flex items-center justify-center my-2 w-full">
                    <div className="border-t border-card-border w-full" />
                    <span className="bg-card px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest absolute">Or</span>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 1: LOGIN FLOW                                        */}
            {/* ======================================================== */}
            {mode === "login" && emailEnabled && (
              <>
                {/* STEP 1: Enter Email & Password */}
                {loginStep === "credentials" ? (
                  <form onSubmit={handleLoginInitiate} className="space-y-4">
                    <div>
                      <Label htmlFor="login-email" className="text-xs font-bold flex items-center gap-1.5">
                        <Mail size={13} className="text-emerald-500" />
                        <span>Email Address *</span>
                      </Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="Email address..."
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        className="mt-1 rounded-xl"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="login-pwd" className="text-xs font-bold flex items-center gap-1.5">
                          <Lock size={13} className="text-emerald-500" />
                          <span>Password *</span>
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotEmail(loginEmail);
                            setShowForgotModal(true);
                            setForgotStep("email");
                          }}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                        >
                          🔑 Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="login-pwd"
                          type={showLoginPassword ? "text" : "password"}
                          placeholder="Password..."
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          className="rounded-xl pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={busy || !loginEmail || !loginPassword}
                      className="w-full py-5 rounded-xl bg-gradient-to-r from-emerald-600 to-primary font-bold shadow-lg shadow-emerald-900/30"
                    >
                      {busy ? "Verifying Credentials…" : "Continue with 2FA OTP →"}
                    </Button>
                  </form>
                ) : (
                  /* STEP 2: Enter 6-Digit 2FA OTP */
                  <form onSubmit={handleLoginVerifyOtp} className="space-y-4">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-0.5">
                      <p className="text-xs font-extrabold text-emerald-400">📬 6-Digit 2FA Code Sent!</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Sent to <strong className="text-foreground">{loginEmail}</strong>.<br />
                        <span className="text-amber-400 font-bold">If not in Primary, please check your Spam / Junk folder!</span>
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="login-otp" className="text-xs font-bold text-emerald-400">Enter 6-Digit OTP Code</Label>
                        <button
                          type="button"
                          onClick={() => setLoginStep("credentials")}
                          className="text-[11px] text-primary underline cursor-pointer"
                        >
                          Change Credentials
                        </button>
                      </div>
                      <Input
                        id="login-otp"
                        type="text"
                        placeholder="OTP code..."
                        maxLength={6}
                        value={loginOtpCode}
                        onChange={(e) => setLoginOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        autoFocus
                        className="text-center font-mono text-xl tracking-[0.3em] font-extrabold rounded-xl border-emerald-500/50"
                      />
                      {loginDevOtp && (
                        <p className="text-xs text-amber-400 mt-1 font-mono text-center bg-amber-500/10 py-1 rounded border border-amber-500/20">
                          DEV OTP: {loginDevOtp}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={busy || loginOtpCode.length < 6}
                      className="w-full py-5 rounded-xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 font-bold shadow-lg shadow-emerald-900/30"
                    >
                      {busy ? "Verifying OTP…" : "Verify Code & Sign In"}
                    </Button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={handleLoginInitiate}
                        disabled={busy}
                        className="text-xs text-muted-foreground hover:text-emerald-400 underline font-semibold"
                      >
                        Didn't receive code? Resend OTP
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* ======================================================== */}
            {/* TAB 2: SIGNUP FLOW                                       */}
            {/* ======================================================== */}
            {mode === "signup" && emailEnabled && (
              <>
                {/* STEP 1: Enter Name, Email, Phone, Password, Confirm Password */}
                {signupStep === "form" ? (
                  <form onSubmit={handleSignupInitiate} className="space-y-3.5">
                    <div>
                      <Label htmlFor="signup-name" className="text-xs font-bold flex items-center gap-1.5">
                        <UserIcon size={13} className="text-emerald-500" />
                        <span>Full Name *</span>
                      </Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Name..."
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                        className="mt-1 rounded-xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-email" className="text-xs font-bold flex items-center gap-1.5">
                        <Mail size={13} className="text-emerald-500" />
                        <span>Email Address *</span>
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Email address..."
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        className="mt-1 rounded-xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-phone" className="text-xs font-bold flex items-center gap-1.5">
                        <Phone size={13} className="text-emerald-500" />
                        <span>10-Digit Mobile Number (+91) *</span>
                      </Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">+91</span>
                        <Input
                          id="signup-phone"
                          type="tel"
                          placeholder="Mobile number..."
                          value={signupPhone}
                          onChange={(e) => setSignupPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          required
                          className="pl-11 rounded-xl"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="signup-password" className="text-xs font-bold flex items-center gap-1.5">
                        <Lock size={13} className="text-emerald-500" />
                        <span>Password (min 6 characters) *</span>
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          id="signup-password"
                          type={showSignupPassword ? "text" : "password"}
                          placeholder="Password..."
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          required
                          minLength={6}
                          className="rounded-xl pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="signup-confirm-pwd" className="text-xs font-bold flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-emerald-500" />
                        <span>Confirm Password *</span>
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          id="signup-confirm-pwd"
                          type={showSignupConfirmPassword ? "text" : "password"}
                          placeholder="Confirm password..."
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          required
                          minLength={6}
                          className="rounded-xl pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showSignupConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {signupConfirmPassword && signupPassword !== signupConfirmPassword && (
                        <p className="text-[11px] text-red-400 font-semibold mt-1">⚠️ Passwords do not match</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={busy || !signupName || !signupEmail || signupPhone.length < 10 || signupPassword.length < 6 || signupPassword !== signupConfirmPassword}
                      className="w-full py-5 rounded-xl bg-gradient-to-r from-emerald-600 to-primary font-bold shadow-lg shadow-emerald-900/30 mt-2"
                    >
                      {busy ? "Sending Verification OTP…" : "Send Verification Code →"}
                    </Button>
                  </form>
                ) : (
                  /* STEP 2: Enter 6-Digit Signup OTP */
                  <form onSubmit={handleSignupVerifyOtp} className="space-y-4">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-0.5">
                      <p className="text-xs font-extrabold text-emerald-400">📬 Verification Code Sent!</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Sent to <strong className="text-foreground">{signupEmail}</strong>.<br />
                        <span className="text-amber-400 font-bold">If not in Primary, check your Spam / Junk folder!</span>
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="signup-otp" className="text-xs font-bold text-emerald-400">Enter 6-Digit OTP Code</Label>
                        <button
                          type="button"
                          onClick={() => setSignupStep("form")}
                          className="text-[11px] text-primary underline cursor-pointer"
                        >
                          Edit Details
                        </button>
                      </div>
                      <Input
                        id="signup-otp"
                        type="text"
                        placeholder="OTP code..."
                        maxLength={6}
                        value={signupOtpCode}
                        onChange={(e) => setSignupOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        autoFocus
                        className="text-center font-mono text-xl tracking-[0.3em] font-extrabold rounded-xl border-emerald-500/50"
                      />
                      {signupDevOtp && (
                        <p className="text-xs text-amber-400 mt-1 font-mono text-center bg-amber-500/10 py-1 rounded border border-amber-500/20">
                          DEV OTP: {signupDevOtp}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={busy || signupOtpCode.length < 6}
                      className="w-full py-5 rounded-xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 font-bold shadow-lg shadow-emerald-900/30"
                    >
                      {busy ? "Verifying & Creating Account…" : "Verify & Complete Registration"}
                    </Button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={handleSignupInitiate}
                        disabled={busy}
                        className="text-xs text-muted-foreground hover:text-emerald-400 underline font-semibold"
                      >
                        Didn't receive code? Resend OTP
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* Footer Navigation & Legal Links */}
            <div className="pt-2 border-t border-card-border space-y-2">
              <p className="text-xs text-center text-muted-foreground">
                {mode === "login" ? "Don't have an account? " : "Already registered? "}
                <button
                  type="button"
                  className="text-primary font-bold underline cursor-pointer"
                  onClick={() => {
                    setMode(mode === "login" ? "signup" : "login");
                    setLoginStep("credentials");
                    setSignupStep("form");
                  }}
                >
                  {mode === "login" ? "Sign up now" : "Log in"}
                </button>
              </p>

              <p className="text-[11px] text-center text-muted-foreground leading-relaxed pt-2 border-t border-card-border/60">
                By signing in you agree to all our{" "}
                <button
                  type="button"
                  onClick={() => navigate("/terms")}
                  className="text-emerald-500 font-bold underline hover:text-emerald-400 cursor-pointer"
                >
                  Legal Terms &amp; Conditions, and Privacy Policy.
                </button>
              </p>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => navigate("/admin/login")}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-extrabold bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/25 transition-all cursor-pointer"
                >
                  <span>🔐 Admin &amp; Partner Logins</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* GOOGLE PHONE NUMBER MODAL                                */}
        {/* ======================================================== */}
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
                    placeholder="Mobile number..."
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

        {/* ======================================================== */}
        {/* INTEGRATED FORGOT PASSWORD MODAL                         */}
        {/* ======================================================== */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setShowForgotModal(false)}>
            <div className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-emerald-500/30 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <span>🔑 Reset Password</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              {forgotStep === "email" ? (
                <form onSubmit={handleSendForgotOtp} className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Enter your registered email address. We will send a 6-digit OTP code to verify and reset your password.
                  </p>

                  <div>
                    <Label htmlFor="forgot-email" className="text-xs font-bold">Email Address</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="Email address..."
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      className="mt-1 rounded-xl"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={busy || !forgotEmail}
                    className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg"
                  >
                    {busy ? "Sending OTP…" : "Send Reset Code →"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyResetPassword} className="space-y-3.5">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">
                      Reset OTP sent to <strong className="text-foreground">{forgotEmail}</strong>.<br />
                      <span className="text-amber-400 font-semibold">Please check your Spam folder if not in Primary.</span>
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label htmlFor="forgot-otp" className="text-xs font-bold text-emerald-400">6-Digit OTP Code</Label>
                      <button
                        type="button"
                        onClick={() => setForgotStep("email")}
                        className="text-[11px] text-primary underline cursor-pointer"
                      >
                        Change Email
                      </button>
                    </div>
                    <Input
                      id="forgot-otp"
                      type="text"
                      placeholder="OTP code..."
                      maxLength={6}
                      value={forgotOtpCode}
                      onChange={(e) => setForgotOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      autoFocus
                      className="text-center font-mono text-xl tracking-[0.3em] font-extrabold rounded-xl border-emerald-500/50"
                    />
                    {forgotDevOtp && (
                      <p className="text-xs text-amber-400 mt-1 font-mono text-center bg-amber-500/10 py-1 rounded border border-amber-500/20">
                        DEV OTP: {forgotDevOtp}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="forgot-new-pwd" className="text-xs font-bold">New Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="forgot-new-pwd"
                        type={showForgotNewPwd ? "text" : "password"}
                        placeholder="Password..."
                        minLength={6}
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        required
                        className="rounded-xl pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPwd(!showForgotNewPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showForgotNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="forgot-confirm-pwd" className="text-xs font-bold">Confirm New Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="forgot-confirm-pwd"
                        type={showForgotConfirmPwd ? "text" : "password"}
                        placeholder="Confirm password..."
                        minLength={6}
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        required
                        className="rounded-xl pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotConfirmPwd(!showForgotConfirmPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showForgotConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={busy || forgotOtpCode.length < 6 || forgotNewPassword.length < 6 || forgotNewPassword !== forgotConfirmPassword}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-primary font-bold shadow-lg"
                  >
                    {busy ? "Resetting Password…" : "Update Password & Log In"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}
      </Layout>
    </GoogleOAuthProvider>
  );
}
