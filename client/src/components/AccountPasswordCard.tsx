import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Lock,
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
} from "lucide-react";

interface AccountPasswordCardProps {
  userEmail: string;
}

export function AccountPasswordCard({ userEmail }: AccountPasswordCardProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"normal" | "otp">("normal");

  // Normal mode states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [busy, setBusy] = useState(false);

  // OTP mode states
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Handle Standard Password Update (with current password)
  const handleNormalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast({ title: "Current password required", description: "Please enter your current password.", variant: "destructive" });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast({ title: "Password too short", description: "New password must be at least 8 characters long.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "New password and confirmation do not match.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update password");
      }
      toast({
        title: "🔒 Password Updated Successfully!",
        description: "A security confirmation has been sent to your registered email.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({
        title: "Password Update Failed",
        description: err.message || "Please check your current password.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // Dispatch 6-digit OTP to user email
  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const res = await apiRequest("POST", "/api/auth/password-otp/send");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send verification code");
      }
      setOtpSent(true);
      setCooldown(60);
      toast({
        title: "✉️ Verification Code Sent!",
        description: `We've sent a 6-digit verification code to ${userEmail}. Please check your Inbox and Spam folder.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to Send OTP",
        description: err.message || "Please try again in a few moments.",
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  };

  // Handle OTP Verification & Password Reset
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      toast({ title: "Invalid Code", description: "Please enter the 6-digit code sent to your email.", variant: "destructive" });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast({ title: "Password too short", description: "New password must be at least 8 characters long.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "New password and confirmation do not match.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/password-otp/verify-and-update", {
        otp: otp.trim(),
        newPassword,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Verification failed");
      }
      toast({
        title: "🔒 Password Verified & Updated!",
        description: "Your new password is now active. A confirmation email has been sent.",
      });
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setOtpSent(false);
      setMode("normal");
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message || "Invalid or expired code. Please request a new code.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-card-border bg-card p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Lock size={18} className="text-emerald-500" /> Account Password &amp; Security
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Update your account password or verify via email if you forgot your old password
          </p>
        </div>
        <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-card-border">
          <button
            type="button"
            onClick={() => setMode("normal")}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === "normal"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            I know my password
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("otp");
              if (!otpSent) handleSendOtp();
            }}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === "otp"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Forgot old password (OTP)
          </button>
        </div>
      </div>

      {/* MODE 1: Standard Password Update */}
      {mode === "normal" && (
        <form onSubmit={handleNormalSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="currentPassword" className="text-xs font-bold">
                Current Password
              </Label>
              <button
                type="button"
                onClick={() => {
                  setMode("otp");
                  if (!otpSent) handleSendOtp();
                }}
                className="text-[11px] font-bold text-emerald-500 hover:text-emerald-400 hover:underline cursor-pointer"
              >
                Forgot current password? Verify via Email OTP
              </button>
            </div>
            <div className="relative mt-1">
              <Input
                id="currentPassword"
                type={showCurrentPw ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
                className="rounded-xl text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="newPassword" className="text-xs font-bold">
                New Password (min. 8 characters)
              </Label>
              <div className="relative mt-1">
                <Input
                  id="newPassword"
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New strong password"
                  required
                  className="rounded-xl text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-xs font-bold">
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className="mt-1 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
            <Button type="submit" disabled={busy} className="font-bold cursor-pointer">
              {busy ? "Updating Password..." : "🔒 Update Password"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              A security notification will be sent to <strong>{userEmail}</strong>
            </p>
          </div>
        </form>
      )}

      {/* MODE 2: Forgot Old Password (Verify via Email OTP) */}
      {mode === "otp" && (
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                <Mail size={15} />
                <span>Verify Identity via Email OTP</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendOtp}
                disabled={sendingOtp || cooldown > 0}
                className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
              >
                {sendingOtp ? (
                  "Sending..."
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : (
                  <>
                    <RefreshCw size={11} className="mr-1" /> Resend OTP
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              We sent a 6-digit verification code to <strong>{userEmail}</strong>. Enter the code below along with your new password.
            </p>
          </div>

          <div>
            <Label htmlFor="otpCode" className="text-xs font-bold">
              6-Digit Verification Code
            </Label>
            <Input
              id="otpCode"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="e.g. 123456"
              maxLength={6}
              required
              className="mt-1 rounded-xl text-center font-mono font-black text-base tracking-[0.3em] max-w-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="otpNewPassword" className="text-xs font-bold">
                New Password (min. 8 characters)
              </Label>
              <div className="relative mt-1">
                <Input
                  id="otpNewPassword"
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  className="rounded-xl text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="otpConfirmPassword" className="text-xs font-bold">
                Confirm New Password
              </Label>
              <Input
                id="otpConfirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className="mt-1 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
            <Button type="submit" disabled={busy || otp.length !== 6} className="font-bold cursor-pointer">
              {busy ? "Verifying & Updating..." : "🔑 Verify OTP & Set New Password"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("normal")}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
            >
              ← Back to I know my password
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
