import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Please enter your registered email address", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password/otp/send", {
        email: email.trim().toLowerCase(),
      });
      const data = await res.json();
      setStep("otp");
      if (data.devOtp) setDevOtp(data.devOtp);
      toast({
        title: "🔑 Reset OTP Sent!",
        description: `Check your inbox (${email}). If not found in Primary, check your Spam folder!`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Could not find an account with this email.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 6) {
      toast({ title: "Please enter the 6-digit OTP code", variant: "destructive" });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters long", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "Please re-enter matching passwords.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password/otp/verify-reset", {
        email: email.trim().toLowerCase(),
        code: otpCode.trim(),
        newPassword: newPassword.trim(),
      });
      const data = await res.json();
      toast({
        title: "✨ Password Updated Successfully!",
        description: data.message || "You can now log in with your new password.",
      });
      navigate("/login");
    } catch (err: any) {
      toast({
        title: "Reset Failed",
        description: err.message || "Invalid or expired OTP code.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100 rounded-3xl shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-green-900/30 p-3 rounded-2xl w-fit mb-2 border border-green-500/20">
            <KeyRound className="w-8 h-8 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === "email" ? "Forgot Password" : "Reset Your Password"}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {step === "email"
              ? "Enter your email address and we'll send you a 6-digit OTP code."
              : "Enter the 6-digit OTP code sent to your email and create a new password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 focus:border-green-500 text-white rounded-xl"
                  required
                />
              </div>
              <Button type="submit" className="w-full py-5 rounded-xl bg-green-700 hover:bg-green-600 font-bold" disabled={loading}>
                {loading ? "Sending OTP Code..." : "Send Verification OTP →"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyAndReset} className="space-y-4">
              <div className="p-3 rounded-2xl bg-green-950/40 border border-green-500/30 text-xs text-slate-300 text-center space-y-0.5">
                <p>Sent OTP code to <strong className="text-white">{email}</strong>.</p>
                <p className="text-amber-300 font-semibold">If not in Primary, please check your Spam / Junk folder!</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label htmlFor="otp" className="text-xs font-bold text-green-400">6-Digit OTP Code</Label>
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="text-[11px] text-green-400 underline"
                  >
                    Change Email
                  </button>
                </div>
                <Input
                  id="otp"
                  type="text"
                  placeholder="OTP code..."
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center font-mono text-xl tracking-[0.3em] font-extrabold bg-slate-950 border-green-500/50 text-white rounded-xl"
                  required
                  autoFocus
                />
                {devOtp && (
                  <p className="text-xs text-amber-400 mt-1 font-mono text-center bg-amber-500/10 py-1 rounded border border-amber-500/20">
                    DEV OTP: {devOtp}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="new-pwd" className="text-xs font-bold">New Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="new-pwd"
                    type={showNewPwd ? "text" : "password"}
                    placeholder="Password..."
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-pwd" className="text-xs font-bold">Confirm New Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirm-pwd"
                    type={showConfirmPwd ? "text" : "password"}
                    placeholder="Confirm password..."
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-red-400 font-semibold mt-1">⚠️ Passwords do not match</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full py-5 rounded-xl bg-green-700 hover:bg-green-600 font-bold"
                disabled={loading || otpCode.length < 6 || newPassword.length < 6 || newPassword !== confirmPassword}
              >
                {loading ? "Updating Password..." : "Update Password & Sign In"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="inline-flex items-center text-sm text-slate-400 hover:text-green-400 font-semibold">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
