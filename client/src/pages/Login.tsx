import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        await register({ name: name.trim(), email: email.trim().toLowerCase(), password, phone: phone.trim() || undefined });
        toast({ title: "Welcome to FarmFreshFarmer!" });
      } else {
        await login(email.trim().toLowerCase(), password);
        toast({ title: "Welcome back!" });
      }
      navigate("/");
    } catch (err: any) {
      const msg = String(err?.message || "");
      toast({
        title: mode === "signup" ? "Could not sign up" : "Could not log in",
        description: msg.includes("409") ? "This email is already registered." : msg.includes("401") ? "Wrong email or password." : "Please check your details and try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-card-border bg-card p-6 sm:p-8">
          <div className="flex justify-center mb-4"><Logo /></div>
          <h1 className="font-serif text-2xl font-bold text-center">
            {mode === "login" ? "Log in to your account" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            {mode === "login" ? "Use your email and password" : "Sign up with your Gmail or any email"}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-name" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-email" />
            </div>
            {mode === "signup" && (
              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-phone" />
              </div>
            )}
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} data-testid="input-password" />
            </div>
            <Button type="submit" className="w-full" disabled={busy} data-testid="button-submit-auth">
              {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-4">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              className="text-primary font-semibold underline"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              data-testid="button-toggle-mode"
            >
              {mode === "login" ? "Create an account" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    </Layout>
  );
}
