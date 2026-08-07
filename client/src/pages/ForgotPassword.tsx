import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send reset link");

      setSubmitted(true);
      toast({ title: "Reset Link Sent", description: "If an account exists, instructions have been sent to your email." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader className="text-center">
          <div className="mx-auto bg-green-900/30 p-3 rounded-full w-fit mb-2">
            <KeyRound className="w-8 h-8 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <CardDescription className="text-slate-400">
            Enter your email address and we'll send you a password reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto animate-bounce" />
              <p className="text-sm text-slate-300">
                Check your inbox! We've sent a single-use password reset link to <span className="font-semibold text-white">{email}</span>.
              </p>
              <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800" onClick={() => setSubmitted(false)}>
                Try another email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 focus:border-green-500 text-white"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-green-700 hover:bg-green-600 font-semibold" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}
          <div className="mt-6 text-center">
            <Link href="/login" className="inline-flex items-center text-sm text-slate-400 hover:text-green-400">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
