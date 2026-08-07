import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/store";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Account() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState(user?.phone || "");
  const [busy, setBusy] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest("PATCH", "/api/user/phone", { phone });
      const data = await res.json();
      setUser(data.user);
      toast({ title: "Phone number updated successfully!" });
    } catch (err: any) {
      toast({ title: "Failed to update phone", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="font-serif text-2xl font-bold mb-6">Account Settings</h1>

        {!user.phone && (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 mb-6 flex items-center justify-between">
            <span className="text-amber-500 font-bold text-sm">⚠️ Add your phone number to receive order updates</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-card-border bg-card p-6">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" required />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Saving..." : "Save Phone Number"}
          </Button>
        </form>
      </div>
    </Layout>
  );
}
