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

  const [phone, setPhone] = useState(defaultPhone || user?.phone || "");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setPhone(defaultPhone || user?.phone || "");
      setOtp("");
      setStep("phone");
      setLoading(false);
      setErrorMessage(null);
    }
  }, [open, defaultPhone, user?.phone]);

  const handleSendOtp = async (e?: React.FormEvent) => {
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
      // 1. Pre-check phone number availability before sending Firebase SMS OTP
      const precheckRes = await apiRequest("POST", "/api/auth/phone/check-availability", {
        phone: cleanPhone,
        userId: user?.id,
        email: targetEmail || user?.email,
        mode,
      });
      const precheckData = await precheckRes.json();
      if (!precheckRes.ok || !precheckData.available) {
        const errorMsg = precheckData.message || "This mobile number is already linked to another account.";
        setErrorMessage(errorMsg);
        toast({
          title: "Mobile Number Already In Use",
          description: errorMsg,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // 2. Setup invisible reCAPTCHA container
      const appVerifier = setupRecaptcha("recaptcha-container-modal");
      const confirmation = await sendFirebasePhoneOtp(cleanPhone, appVerifier);
      setConfirmationResult(confirmation);
      setStep("otp");
      setErrorMessage(null);
      toast({
        title: "📲 6-Digit SMS Code Sent!",
        description: `Please check SMS messages on +91 ${cleanPhone}.`,
      });
    } catch (err: any) {
      console.error("[Firebase Phone Auth Error]:", err);
      const parsed = formatFirebasePhoneError(err);
      setErrorMessage(parsed.description);
      toast({
        title: parsed.title,
        description: parsed.description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    if (!otp.trim() || otp.trim().length < 6) {
      const msg = "Please enter all 6 digits of the SMS verification code.";
      setErrorMessage(msg);
      return toast({ title: "Incomplete Code", description: msg, variant: "destructive" });
    }

    setLoading(true);
    try {
      let idToken = "";
      if (confirmationResult) {
        const userCredential = await confirmationResult.confirm(otp.trim());
        idToken = await userCredential.user.getIdToken();
      }

      const cleanPhone = phone.replace(/\D/g, "").slice(-10);

      if (mode === "unlock_lockout") {
        // Unlock Rate Limit / Locked Account via Mobile OTP
        const res = await apiRequest("POST", "/api/auth/unlock-with-phone", {
          email: targetEmail || user?.email,
          phone: cleanPhone,
          firebaseToken: idToken,
          otp: otp.trim(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to unlock account");

        toast({
          title: "🔓 Account Unlocked & Verified!",
          description: "All rate limits cleared and Blue Badge verified!",
        });
      } else {
        // Verify Account & Reward Blue Badge
        const res = await apiRequest("POST", "/api/auth/phone-verify-firebase", {
          userId: user?.id,
          email: user?.email,
          phone: cleanPhone,
          firebaseToken: idToken,
          otp: otp.trim(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Phone verification failed");

        if (user) {
          setUser({ ...user, isVerified: true, phone: cleanPhone });
        }
        toast({
          title: "🏅 Blue Badge Activated!",
          description: "Your mobile number has been verified. Order placement is unlocked!",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("[Firebase Verify OTP Error]:", err);
      const parsed = formatFirebasePhoneError(err);
      setErrorMessage(parsed.description);
      toast({
        title: parsed.title,
        description: parsed.description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-card border border-emerald-500/30 shadow-2xl">
        {/* Invisible reCAPTCHA container */}
        <div id="recaptcha-container-modal" className="hidden invisible pointer-events-none w-0 h-0 overflow-hidden absolute -left-[9999px] -top-[9999px]" />

        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md">
              {mode === "unlock_lockout" ? <Unlock size={20} /> : <Smartphone size={20} />}
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black flex items-center gap-1.5 text-foreground">
                {mode === "unlock_lockout" ? "Unlock Account via Mobile OTP" : "Verify Mobile & Get Blue Badge"}
                <VerifiedBadge size="sm" />
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {mode === "unlock_lockout"
                  ? "Verify your registered mobile number to instantly eliminate rate limits and restore access."
                  : "Verify with official SMS OTP to get verified status and unlock seamless ordering."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} className="space-y-4 pt-2">
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
          <form onSubmit={handleVerifyOtp} className="space-y-4 pt-2">
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
                onClick={handleSendOtp}
                disabled={loading}
                className="text-center text-[11px] text-muted-foreground hover:text-foreground font-semibold"
              >
                Didn't receive SMS? Resend Security Code
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
