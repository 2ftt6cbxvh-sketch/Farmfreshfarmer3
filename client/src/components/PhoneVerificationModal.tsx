import { useState, useEffect } from "react";
import { useAuth } from "@/lib/store";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { setupRecaptcha, sendFirebasePhoneOtp } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Smartphone, ShieldCheck, CheckCircle2, AlertTriangle, Sparkles, RefreshCw, KeyRound, Lock, Unlock, AlertCircle
} from "lucide-react";
import { VerifiedBadge } from "./VerifiedBadge";

interface PhoneVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "verify_account" | "unlock_lockout";
  targetEmail?: string;
  defaultPhone?: string;
  onSuccess?: () => void;
}

function formatFirebasePhoneError(err: any): { title: string; description: string } {
  const raw = String(err?.message || err?.code || "").toLowerCase();

  if (raw.includes("invalid-verification-code") || raw.includes("code-expired") || raw.includes("session-expired") || raw.includes("invalid-credential")) {
    return {
      title: "❌ Incorrect OTP Code",
      description: "The 6-digit SMS verification code entered is incorrect or expired. Please check your latest SMS or tap 'Resend Code'.",
    };
  }

  if (raw.includes("billing-not-enabled") || raw.includes("billing")) {
    return {
      title: "⚙️ SMS Gateway Setup Required",
      description: "SMS delivery requires Blaze plan activation in Firebase Console, or adding this phone under 'Phone numbers for testing' in Firebase.",
    };
  }

  if (raw.includes("too-many-requests") || raw.includes("quota-exceeded")) {
    return {
      title: "⏳ SMS Rate Limit Exceeded",
      description: "Too many SMS requests sent in a short time. Please wait 2-3 minutes before trying again.",
    };
  }

  if (raw.includes("invalid-phone-number") || raw.includes("missing-phone-number")) {
    return {
      title: "📱 Invalid Mobile Number",
      description: "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).",
    };
  }

  if (raw.includes("captcha-check-failed") || raw.includes("recaptcha") || raw.includes("app-not-authorized")) {
    return {
      title: "🛡️ Verification Notice",
      description: "Security check could not be completed. Please refresh the page and try again.",
    };
  }

  if (raw.includes("network-request-failed") || raw.includes("network")) {
    return {
      title: "🌐 Connection Error",
      description: "Network connection issue. Please check your internet connection and try again.",
    };
  }

  // Clean raw Firebase boilerplate text
  const cleanMsg = err?.message
    ? String(err.message)
        .replace(/^Firebase:\s*/i, "")
        .replace(/Error\s*\(/i, "")
        .replace(/\(auth\/[^)]+\)\.?/i, "")
        .replace(/\)\.?$/i, "")
        .replace(/auth\//i, "")
        .trim()
    : "Unable to process phone verification. Please try again.";

  return {
    title: "Verification Notice",
    description: cleanMsg || "Invalid verification attempt. Please check your details and retry.",
  };
}

export function PhoneVerificationModal({
  open,
  onOpenChange,
  mode = "verify_account",
  targetEmail,
  defaultPhone,
  onSuccess,
}: PhoneVerificationModalProps) {
  const { user, setUser } = useAuth();
  const { toast } = useToast();

  const [method, setMethod] = useState<"whatsapp" | "sms">("whatsapp");
  const [phone, setPhone] = useState(defaultPhone || user?.phone || "");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // WhatsApp state
  const [waData, setWaData] = useState<{
    code: string;
    formattedCode: string;
    businessPhone: string;
    waLink: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setPhone(defaultPhone || user?.phone || "");
      setOtp("");
      setStep("phone");
      setLoading(false);
      setErrorMessage(null);

      // Auto-initiate WhatsApp session
      initiateWhatsApp();
    }
  }, [open, defaultPhone, user?.phone]);

  const initiateWhatsApp = async () => {
    try {
      const cleanPhone = (phone || user?.phone || "").replace(/\D/g, "").slice(-10);
      const res = await apiRequest("POST", "/api/auth/whatsapp/initiate", {
        phone: cleanPhone,
        userId: user?.id,
        email: targetEmail || user?.email,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWaData(data);
        if (data.code) setOtp(data.code);
      }
    } catch (err: any) {
      console.warn("[WhatsApp Initiate]:", err.message);
    }
  };

  const handleVerifyWhatsApp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const cleanCode = (otp || waData?.code || "").replace(/[^0-9]/g, "");

    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      const msg = "Please enter your valid 10-digit Indian mobile number.";
      setErrorMessage(msg);
      return toast({ title: "Invalid Mobile Number", description: msg, variant: "destructive" });
    }
    if (cleanCode.length !== 6) {
      const msg = "Please enter the 6-digit verification code.";
      setErrorMessage(msg);
      return toast({ title: "Incomplete Code", description: msg, variant: "destructive" });
    }

    setLoading(true);
    try {
      // 1. Open WhatsApp to send verification message to business number
      if (waData?.waLink) {
        window.open(waData.waLink, "_blank", "noopener,noreferrer");
      }

      // 2. Register verification on server
      const res = await apiRequest("POST", "/api/auth/whatsapp/verify", {
        phone: cleanPhone,
        code: cleanCode,
        userId: user?.id,
        email: targetEmail || user?.email,
        mode,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "WhatsApp verification failed.");

      if (user) {
        setUser({ ...user, isPhoneVerified: true, phone: cleanPhone, isVerified: Boolean(user.isEmailVerified) });
        localStorage.setItem("user", JSON.stringify({ ...user, isPhoneVerified: true, phone: cleanPhone, isVerified: Boolean(user.isEmailVerified) }));
      }

      toast({
        title: "🏅 Blue Badge Activated!",
        description: "Mobile number verified via WhatsApp! Order placement is unlocked.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("[WhatsApp Verify Error]:", err);
      const errMsg = err.message || "Verification code not matched. Please check your message.";
      setErrorMessage(errMsg);
      toast({ title: "Verification Failed", description: errMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendSmsOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      const msg = "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.";
      setErrorMessage(msg);
      return toast({
        title: "Invalid Mobile Number",
        description: msg,
        variant: "destructive",
      });
    }

    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/phone/send-otp", {
        phone: cleanPhone,
        userId: user?.id,
        email: targetEmail || user?.email,
        mode,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to dispatch SMS verification code.");
      }

      setStep("otp");
      setErrorMessage(null);
      toast({
        title: "📲 6-Digit SMS Code Sent!",
        description: `Please check your mobile SMS inbox on +91 ${cleanPhone}.`,
      });
    } catch (err: any) {
      console.error("[SMS Auth Error]:", err);
      const errMsg = err.message || "Failed to send SMS code. Please check your number and try again.";
      setErrorMessage(errMsg);
      toast({
        title: "SMS Dispatch Notice",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySmsOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    if (!otp.trim() || otp.trim().length < 6) {
      const msg = "Please enter all 6 digits of the SMS verification code.";
      setErrorMessage(msg);
      return toast({ title: "Incomplete Code", description: msg, variant: "destructive" });
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);

      const res = await apiRequest("POST", "/api/auth/phone/verify-otp", {
        userId: user?.id,
        email: targetEmail || user?.email,
        phone: cleanPhone,
        otp: otp.trim(),
        mode,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Phone verification failed.");

      if (user) {
        setUser({ ...user, isVerified: true, phone: cleanPhone });
        localStorage.setItem("user", JSON.stringify({ ...user, isVerified: true, phone: cleanPhone }));
      }

      toast({
        title: "🏅 Blue Badge Activated!",
        description: "Your mobile number has been verified. Order placement is unlocked!",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("[Verify SMS OTP Error]:", err);
      const errMsg = err.message || "Incorrect verification code. Please check your SMS and try again.";
      setErrorMessage(errMsg);
      toast({
        title: "Verification Failed",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-card border border-emerald-500/30 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-md">
              {mode === "unlock_lockout" ? <Unlock size={20} /> : <Smartphone size={20} />}
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black flex items-center gap-1.5 text-foreground">
                {mode === "unlock_lockout" ? "Unlock Account via Mobile" : "Verify Mobile & Get Blue Badge"}
                <VerifiedBadge size="sm" />
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Verify your 10-digit mobile number to unlock live order tracking and checkout.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Verification Method Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-secondary/50 rounded-2xl border border-border mt-1">
          <button
            type="button"
            onClick={() => {
              setMethod("whatsapp");
              setErrorMessage(null);
              initiateWhatsApp();
            }}
            className={`py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              method === "whatsapp"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>💬 WhatsApp (Instant &amp; Free)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod("sms");
              setErrorMessage(null);
            }}
            className={`py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              method === "sms"
                ? "bg-red-600 text-white shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>📱 SMS OTP</span>
          </button>
        </div>

        {method === "whatsapp" ? (
          /* ================= WHATSAPP VERIFICATION (100% FREE & 1-CLICK) ================= */
          <form onSubmit={handleVerifyWhatsApp} className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-emerald-500 flex items-center gap-1.5">
                  <ShieldCheck size={15} /> 1-Tap WhatsApp Verification
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-0.5 rounded-full">
                  100% Free &amp; Instant
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enter your 10-digit mobile number below. Clicking the button will open WhatsApp to send your verification message to our business line (<b>+91 7989793669</b>) and instantly verify your account!
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Your 10-Digit Mobile Number</Label>
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 text-xs font-bold rounded-xl bg-secondary border border-card-border text-muted-foreground shrink-0">
                  🇮🇳 +91
                </span>
                <Input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="9876543210"
                  className="font-mono text-sm font-extrabold rounded-xl bg-secondary/50 border-card-border tracking-wider"
                  autoFocus
                  required
                />
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold flex items-start gap-2 animate-in fade-in duration-200">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs rounded-xl shadow-lg py-3.5 cursor-pointer flex items-center justify-center gap-2"
                disabled={loading || phone.replace(/\D/g, "").length < 10}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Verifying…
                  </span>
                ) : (
                  <span>💬 Open WhatsApp &amp; Verify ({waData?.formattedCode || "FF-Code"}) ➔</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* ================= SMS OTP VERIFICATION ================= */
          step === "phone" ? (
            <form onSubmit={handleSendSmsOtp} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">10-Digit Mobile Number</Label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2 text-xs font-bold rounded-xl bg-secondary border border-card-border text-muted-foreground shrink-0">
                    🇮🇳 +91
                  </span>
                  <Input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="9876543210"
                    className="font-mono text-sm font-extrabold rounded-xl bg-secondary/50 border-card-border tracking-wider"
                    required
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold flex items-start gap-2 animate-in fade-in duration-200">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md py-2.5 cursor-pointer"
                  disabled={loading || phone.replace(/\D/g, "").length < 10}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin" /> Sending SMS Code…
                    </span>
                  ) : (
                    "Send 6-Digit SMS Security Code"
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handleVerifySmsOtp} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-red-500 dark:text-red-400 flex items-center gap-1.5">
                    <KeyRound size={13} /> Enter 6-Digit Red Security Code
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("phone");
                      setErrorMessage(null);
                    }}
                    className="text-[11px] text-red-500 hover:underline font-bold"
                  >
                    Change Number
                  </button>
                </div>
                <Input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="123456"
                  className="text-center font-mono text-2xl font-black text-red-500 dark:text-red-400 bg-red-500/10 border-2 border-red-500/40 rounded-xl tracking-widest focus:border-red-500 focus:ring-red-500"
                  autoFocus
                  required
                />
                <p className="text-[10px] text-center text-muted-foreground">
                  SMS security code dispatched to: <span className="font-bold text-foreground">+91 {phone}</span>
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold flex items-start gap-2 animate-in fade-in duration-200">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              <DialogFooter className="pt-2 flex flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md py-2.5 cursor-pointer"
                  disabled={loading || otp.length < 6}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin" /> Verifying Security Code…
                    </span>
                  ) : (
                    "Verify Security Code & Unlock Checkout"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={handleSendSmsOtp}
                  disabled={loading}
                  className="text-center text-[11px] text-muted-foreground hover:text-foreground font-semibold"
                >
                  Didn't receive SMS? Resend Security Code
                </button>
              </DialogFooter>
            </form>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
