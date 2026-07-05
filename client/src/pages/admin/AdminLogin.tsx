import { useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLogin() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("admin@farmfreshfarmer.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email.trim().toLowerCase(), password);
      if (u.role !== "admin") {
        toast({ title: "Not an admin account", description: "Use the admin email to sign in here.", variant: "destructive" });
        return;
      }
      toast({ title: "Welcome, admin" });
      navigate("/admin/products");
    } catch {
      toast({ title: "Login failed", description: "Wrong email or password.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-8">
        <div className="flex justify-center mb-4">
          <span className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground">
            <ShieldCheck size={24} />
          </span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-center">Admin login</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">FarmFreshFarmer dashboard</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="admin-email">Email</Label>
            <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-admin-email" />
          </div>
          <div>
            <Label htmlFor="admin-password">Password</Label>
            <Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="input-admin-password" />
          </div>
          <Button type="submit" className="w-full" disabled={busy} data-testid="button-admin-login">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
