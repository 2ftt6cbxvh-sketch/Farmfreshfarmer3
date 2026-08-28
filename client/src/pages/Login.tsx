import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock, Unlock, Mail, Phone, User as UserIcon, ShieldCheck, Sparkles } from "lucide-react";
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
import { PhoneVerificationModal } from "@/components/PhoneVerificationModal";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { AdminDirectAccessWarning } from "./admin/AdminDirectAccessWarning";

export default function Login() {
  const { user, login, setUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [showFullScreenThreat, setShowFullScreenThreat] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (user) {
      if (
        user.isPrimaryAdmin ||
        user.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
        ["admin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin", "customer_rep", "local_grievance_officer", "zonal_grievance_officer", "chief_grievance_officer"].includes(user.role)
      ) {
        navigate("/admin");
      } else if (user.role === "delivery_partner") {
        navigate("/partner-portal");
      } else {
        navigate("/profile");
      }
    }
  }, [user, navigate]);

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

  // ===================== PHONE LOCKOUT UNLOCK MODAL =====================
  const [showUnlockPhoneModal, setShowUnlockPhoneModal] = useState(false);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtpCode, setForgotOtpCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotNewPwd, setShowForgotNewPwd] = useState(false);
  const [showForgotConfirmPwd, setShowForgotConfirmPwd] = useState(false);
  const [forgotDevOtp, setForgotDevOtp] = useState<string | null>(null);

  // ===================== STAFF & SUB-ADMIN MODAL =====================
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffStep2fa, setStaffStep2fa] = useState(false);
  const [staffTempToken, setStaffTempToken] = useState("");
  const [staffMaskedTelegram, setStaffMaskedTelegram] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffOtpCode, setStaffOtpCode] = useState("");
  const [staffBusy, setStaffBusy] = useState(false);

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    const cleanStaffEmail = staffEmail.trim().toLowerCase();

    setStaffBusy(true);
    try {
      const res: any = await login(cleanStaffEmail, staffPassword);
      if (res?.require2fa) {
        setStaffStep2fa(true);
        setStaffTempToken(res.tempToken);
        setStaffMaskedTelegram(res.maskedPhone || res.maskedTelegram || "registered mobile");
        setStaffName(res.staffName || "Staff Member");
        toast({ title: "🔐 2FA Mobile OTP Dispatched", description: `Enter the 6-digit verification code sent to ${res.maskedPhone || res.maskedTelegram || "your registered mobile"}.` });
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
      toast({ title: "Welcome back, " + (u.name || "Staff Member") });
      navigate("/admin");
    } catch (err: any) {
      const msg = String(err?.message || "");
      toast({ title: "🚫 Access Denied", description: msg || "Invalid credentials.", variant: "destructive" });
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleStaffVerify2fa(e: React.FormEvent) {
    e.preventDefault();
    if (!staffOtpCode || staffOtpCode.trim().length !== 6) {
      toast({ title: "Invalid Code", description: "Please enter the 6-digit code sent to your mobile phone.", variant: "destructive" });
      return;
    }
    setStaffBusy(true);
    try {
      const res = await apiRequest("POST", "/api/login/verify-otp", {
        tempToken: staffTempToken,
        otp: staffOtpCode.trim(),
      });
      const data = await res.json();
      if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      if (data.user) {
        localStorage.setItem("adminUser", JSON.stringify(data.user));
        setUser(data.user);
      }
      toast({ title: "✨ 2FA Verified!", description: `Welcome back, ${data.user?.name || staffName}!` });
      navigate("/admin");
    } catch (err: any) {
      toast({ title: "2FA Verification Failed", description: err?.message || "Invalid or expired OTP code.", variant: "destructive" });
    } finally {
      setStaffBusy(false);
    }
  }

  // ----------------------------------------------------
  // LOGIN FLOW
  // ----------------------------------------------------
  async function handleLoginInitiate(e: React.FormEvent) {
    e.preventDefault();
    const cleanLoginEmail = loginEmail.trim().toLowerCase();

    if (!cleanLoginEmail || !cleanLoginEmail.includes("@")) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (!loginPassword) {
      toast({ title: "Please enter your password", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const recaptchaToken = await getRecaptchaToken("login");
      const res = await apiRequest("POST", "/api/auth/login/initiate", {
        email: cleanLoginEmail,
        password: loginPassword,
        recaptchaToken,
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
      if (errorMsg.toLowerCase().includes("lock") || errorMsg.includes("24 hours") || errorMsg.includes("temporary") || errorMsg.includes("permanently")) {
        setIsAccountLocked(true);
        toast({
          title: "🔒 Account Locked / Rate Limited",
          description: errorMsg || "Account is temporarily locked. You can instant unlock by verifying your mobile number!",
          variant: "destructive",
        });
      } else if (errorMsg.includes("Google Sign-In") || errorMsg.includes("googleAccount")) {
        toast({
          title: "Google Account Detected",
          description: "This account was registered via Google. Please click 'Sign in with Google' or reset your password.",
        });
      } else if (errorMsg.includes("sign up first") || errorMsg.includes("No account found") || errorMsg.includes("404")) {
        toast({
          title: "Account Not Found",
          description: "No account is registered with this email. Switching to Sign Up!",
        });
        setSignupEmail(loginEmail.trim().toLowerCase());
        setSignupPassword(loginPassword);
        setSignupConfirmPassword(loginPassword);
        setMode("signup");
        setSignupStep("form");
      } else {
        toast({
          title: "Invalid Credentials",
          description: errorMsg || "Wrong email or password.",
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
      const recaptchaToken = await getRecaptchaToken("signup");
      const res = await apiRequest("POST", "/api/auth/signup/initiate", {
        name: signupName.trim(),
        email: signupEmail.trim().toLowerCase(),
        phone: cleanPhone,
        password: signupPassword,
        recaptchaToken,
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
      const recaptchaToken = await getRecaptchaToken("forgot_password");
      const res = await apiRequest("POST", "/api/auth/forgot-password/otp/send", {
        email: forgotEmail.trim().toLowerCase(),
        recaptchaToken,
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

  if (showFullScreenThreat) {
    return (
      <AdminDirectAccessWarning
        title="Master Credentials Intercepted"
        subtitle="Chief Executive Super Admin credentials cannot be authenticated from public customer or staff interfaces. Access attempt has been intercepted, logged, and quarantined under Enterprise Zero-Trust Policy."
        targetRoute="Public / Customer Portal"
        policy="Executive Zero-Trust Clearance Required"
        onDismiss={() => {
          setShowFullScreenThreat(false);
          setLoginEmail("");
          setLoginPassword("");
          setStaffEmail("");
          setStaffPassword("");
          setShowStaffModal(false);
        }}
      />
    );
  }

  if (user) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-24 text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-bold text-foreground">Already signed in as {user.name || user.email}. Redirecting...</p>
        </div>
      </Layout>
    );
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

                    {isAccountLocked && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 text-center animate-in fade-in duration-200">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-black text-amber-400">
                          <Lock size={15} className="text-amber-400" />
                          <span>Account Rate Limited / Locked</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Verify your mobile number via Firebase SMS OTP to instantly eliminate the 24h+ lockout and unlock your account.
                        </p>
                        <Button
                          type="button"
                          onClick={() => setShowUnlockPhoneModal(true)}
                          className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md py-2.5 gap-1.5"
                        >
                          <Unlock size={14} /> Instant Unlock via Mobile SMS OTP
                        </Button>
                      </div>
                    )}

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
                  onClick={() => setShowStaffModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-extrabold bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/25 transition-all cursor-pointer"
                >
                  <span>🔐 Staff &amp; Delivery Partner Login</span>
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

        {/* 🛡️ Staff & Delivery Partner Sign In Modal (Sub-admins & Partners Only) */}
        {showStaffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="w-full max-w-md bg-card border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 relative">
              <button
                type="button"
                onClick={() => {
                  setShowStaffModal(false);
                  setStaffStep2fa(false);
                  setStaffOtpCode("");
                }}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-secondary transition"
              >
                ✕
              </button>

              {!staffStep2fa ? (
                <>
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 mb-2">
                      <ShieldCheck size={26} />
                    </div>
                    <h2 className="text-xl font-serif font-bold text-foreground">Staff &amp; Partner Portal</h2>
                    <p className="text-xs text-muted-foreground">Sub-Admins, Managers &amp; Delivery Partners</p>
                  </div>

                  <form onSubmit={handleStaffLogin} className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-foreground">Staff Email Address</Label>
                      <Input
                        type="email"
                        placeholder="staff@farmfreshfarmer.com"
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        required
                        className="rounded-xl font-mono text-xs h-11"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-foreground">Password</Label>
                      <Input
                        type="password"
                        placeholder="Enter password"
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        required
                        className="rounded-xl text-xs h-11"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={staffBusy || !staffEmail || !staffPassword}
                      className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs shadow-lg"
                    >
                      {staffBusy ? "Authenticating Staff..." : "Sign In to Staff Portal 🚀"}
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40 mb-2">
                      <Smartphone size={26} />
                    </div>
                    <h2 className="text-xl font-serif font-bold text-foreground">Staff 2FA Mobile Verification</h2>
                    <p className="text-xs text-muted-foreground">
                      Hello <b>{staffName}</b>, enter the 6-digit verification code sent to your mobile ({staffMaskedTelegram}).
                    </p>
                  </div>

                  <form onSubmit={handleStaffVerify2fa} className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-sky-400">6-Digit One-Time Passcode</Label>
                      <Input
                        type="text"
                        maxLength={6}
                        placeholder="123456"
                        value={staffOtpCode}
                        onChange={(e) => setStaffOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        autoFocus
                        className="rounded-xl text-center font-mono text-xl tracking-widest font-bold h-12 border-sky-500/40"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={staffBusy || staffOtpCode.length !== 6}
                      className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-extrabold rounded-xl text-xs shadow-lg"
                    >
                      {staffBusy ? "Verifying Token..." : "Verify & Unlock Access 🔓"}
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* 📱 Firebase Mobile SMS Unlock Modal */}
        <PhoneVerificationModal
          open={showUnlockPhoneModal}
          onOpenChange={setShowUnlockPhoneModal}
          mode="unlock_lockout"
          targetEmail={loginEmail}
          onSuccess={() => {
            setIsAccountLocked(false);
            setLoginStep("credentials");
          }}
        />
      </Layout>
    </GoogleOAuthProvider>
  );
}
