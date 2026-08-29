import { useState } from "react";
import { useAuth } from "@/lib/store";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Mail, KeyRound, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";

interface EmailVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail?: string;
  onSuccess?: (verifiedEmail: string) => void;
}

export function EmailVerificationModal({
  open,
  onOpenChange,
  initialEmail,
  onSuccess,
}: EmailVerificationModalProps) {
  const { user, setUser } = useAuth();
  const { toast } = useToast();

  const [newEmail, setNewEmail] = useState(initialEmail || user?.email || "");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open && (initialEmail || user?.email)) {
      setNewEmail(initialEmail || user?.email || "");
    }
  }, [open, initialEmail, user?.email]);

  const handleSendEmailOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = (newEmail || user?.email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@") || cleanEmail.length < 5) {
      const msg = "Please enter a valid email address.";
      setErrorMessage(msg);
      return toast({ title: "Invalid Email", description: msg, variant: "destructive" });
    }

    setLoading(true);
    try {
      let res: Response;
      if (cleanEmail === user?.email?.toLowerCase()) {
        // Send OTP to existing email
        res = await apiRequest("POST", "/api/auth/otp/send", { email: cleanEmail });
      } else {
        // Send OTP to new email
        res = await apiRequest("POST", "/api/user/email/send-otp", { newEmail: cleanEmail });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to dispatch email verification code.");

      setStep("otp");
      toast({
        title: "📧 6-Digit Email Code Sent!",
        description: `Check your inbox / spam folder on ${cleanEmail}.`,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send verification code. Please try again.");
      toast({
        title: "Dispatch Notice",
        description: err.message || "Failed to send code.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!otp.trim() || otp.trim().length < 6) {
      const msg = "Please enter the 6-digit OTP code sent to your email.";
      setErrorMessage(msg);
      return toast({ title: "Incomplete Code", description: msg, variant: "destructive" });
    }

    setLoading(true);
    try {
      const cleanEmail = (newEmail || user?.email || "").trim().toLowerCase();
      let res: Response;
      if (cleanEmail === user?.email?.toLowerCase()) {
        res = await apiRequest("POST", "/api/auth/otp/verify", {
          email: cleanEmail,
          code: otp.trim(),
        });
      } else {
        res = await apiRequest("POST", "/api/user/email/verify-otp", {
          newEmail: cleanEmail,
          otp: otp.trim(),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid OTP code.");

      if (user) {
        setUser({ ...user, email: cleanEmail, isVerified: true });
        localStorage.setItem("user", JSON.stringify({ ...user, email: cleanEmail, isVerified: true }));
      }

      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });

      toast({
        title: "🎉 Email Verified Successfully!",
        description: `Your account email (${cleanEmail}) is now verified. You can proceed with order placement & payment.`,
      });

      onOpenChange(false);
      if (onSuccess) onSuccess(cleanEmail);
      setStep("email");
      setOtp("");
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid verification code. Please try again.");
      toast({
        title: "Verification Failed",
        description: err.message || "Invalid code.",
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
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-foreground">
                Update Email with OTP
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Verify ownership of your new email address with a secure 6-digit code.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "email" ? (
          <form onSubmit={handleSendEmailOtp} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">New Email Address</Label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-3 text-muted-foreground" />
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="name@example.com"
                  className="pl-10 font-medium text-xs rounded-xl bg-secondary/50 border-card-border"
                  required
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Current email: <span className="font-semibold text-foreground">{user?.email}</span>
              </p>
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
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-md py-2.5"
                disabled={loading || !newEmail.includes("@")}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Sending Email OTP…
                  </span>
                ) : (
                  "Send 6-Digit Email Code"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyEmailOtp} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">Enter 6-Digit Code</Label>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setErrorMessage(null);
                  }}
                  className="text-[11px] text-emerald-400 hover:underline font-bold"
                >
                  Change Email
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
                className="text-center font-mono text-xl font-black rounded-xl bg-secondary/50 border-card-border tracking-widest"
                autoFocus
                required
              />
              <p className="text-[10px] text-center text-muted-foreground">
                Code sent to: <span className="font-bold text-foreground">{newEmail}</span>
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
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-md py-2.5"
                disabled={loading || otp.length < 6}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Verifying Code…
                  </span>
                ) : (
                  "Confirm & Update Email Address"
                )}
              </Button>

              <button
                type="button"
                onClick={handleSendEmailOtp}
                disabled={loading}
                className="text-center text-[11px] text-muted-foreground hover:text-foreground font-semibold"
              >
                Didn't receive email? Resend Code
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
