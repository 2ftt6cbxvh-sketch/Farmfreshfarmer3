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
  Smartphone, ShieldCheck, CheckCircle2, AlertTriangle, Sparkles, RefreshCw, KeyRound, Lock, Unlock
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
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setPhone(defaultPhone || user?.phone || "");
      setOtp("");
      setStep("phone");
      setLoading(false);
    }
  }, [open, defaultPhone, user?.phone]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      return toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid 10-digit Indian mobile number.",
        variant: "destructive",
      });
    }

    setLoading(true);
    try {
      // Setup invisible reCAPTCHA container
      const appVerifier = setupRecaptcha("recaptcha-container-modal");
      const confirmation = await sendFirebasePhoneOtp(cleanPhone, appVerifier);
      setConfirmationResult(confirmation);
      setStep("otp");
      toast({
        title: "📲 6-Digit SMS Code Sent!",
        description: `Please check SMS messages on +91 ${cleanPhone}.`,
      });
    } catch (err: any) {
      console.error("[Firebase Phone Auth Error]:", err);
      toast({
        title: "SMS Dispatch Notice",
        description: err?.message || "Failed to send SMS OTP. Please check your network.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otp.trim() || otp.trim().length < 6) {
      return toast({ title: "Please enter the 6-digit SMS code", variant: "destructive" });
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
      toast({
        title: "Verification Failed",
        description: err?.message || "Invalid OTP code or verification failed.",
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

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md py-2.5"
                disabled={loading || phone.replace(/\D/g, "").length < 10}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Sending SMS OTP…
                  </span>
                ) : (
                  "Send 6-Digit SMS Code"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">Enter 6-Digit SMS Code</Label>
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className="text-[11px] text-sky-400 hover:underline font-bold"
                >
                  Change Number
                </button>
              </div>
              <Input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="text-center font-mono text-xl font-black rounded-xl bg-secondary/50 border-card-border tracking-widest"
                autoFocus
                required
              />
            </div>

            <DialogFooter className="pt-2 flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-md py-2.5"
                disabled={loading || otp.length < 6}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Verifying…
                  </span>
                ) : (
                  "Confirm Code & Activate Verification"
                )}
              </Button>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="text-center text-[11px] text-muted-foreground hover:text-foreground font-semibold"
              >
                Didn't receive SMS? Resend Code
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
