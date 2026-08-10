import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/store";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { Ticket, User, Phone, Mail, Clock, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";

interface SupportTicket {
  id: number;
  ticketId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  concern: string;
  status: "open" | "under_solving" | "solved" | "closed";
  priority: string;
  assignedAgentName?: string;
  adminNotes?: string;
  createdAt: string;
}

export default function Account() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState(user?.phone || "");
  const [busy, setBusy] = useState(false);

  const { data: ticketData, isLoading: ticketsLoading } = useQuery<{ tickets: SupportTicket[] }>({
    queryKey: ["/api/support-tickets/my", user?.email, user?.id],
    queryFn: async () => {
      if (!user?.email) return { tickets: [] };
      const res = await fetch(`/api/support-tickets/my?email=${encodeURIComponent(user.email)}&userId=${user?.id || ''}`);
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

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

  if (!user) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">Please log in to view your account &amp; support tickets.</p>
          <Button onClick={() => (window.location.href = "/login")}>Sign In Now</Button>
        </div>
      </Layout>
    );
  }

  const myTickets = ticketData?.tickets || [];

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-foreground">My Account &amp; Profile</h1>
          <p className="text-xs text-muted-foreground mt-1">Manage your details &amp; track support ticket resolution status</p>
        </div>

        {/* Profile Details Card */}
        <div className="rounded-3xl border border-card-border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <User size={18} className="text-primary" /> Profile Details
          </h2>

          {!user.phone && (
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3 flex items-center gap-2">
              <span className="text-amber-500 font-bold text-xs">⚠️ Add your 10-digit phone number to receive instant SMS/WhatsApp delivery updates</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-bold text-muted-foreground block">Full Name:</span>
              <span className="text-foreground font-semibold text-sm">{user.name || "Customer"}</span>
            </div>
            <div>
              <span className="font-bold text-muted-foreground block">Email Address:</span>
              <span className="text-foreground font-semibold text-sm">{user.email}</span>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-3 pt-2 border-t border-card-border/60">
            <div>
              <Label htmlFor="phone" className="text-xs font-bold">Mobile Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                required
                className="mt-1 rounded-xl text-xs"
              />
            </div>
            <Button type="submit" disabled={busy} size="sm" className="font-bold">
              {busy ? "Saving..." : "Save Phone Number"}
            </Button>
          </form>
        </div>

        {/* Support Tickets Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Ticket className="text-purple-600" /> 🎫 My Support Tickets ({myTickets.length})
            </h2>
          </div>

          {ticketsLoading ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Loading your tickets...</div>
          ) : myTickets.length === 0 ? (
            <div className="rounded-2xl border border-card-border bg-card p-6 text-center space-y-2 shadow-sm">
              <Ticket size={32} className="mx-auto text-muted-foreground/40" />
              <p className="text-xs font-bold text-foreground">No support tickets yet. Need help? Ask Laxshmi AI to raise a ticket!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myTickets.map((t) => (
                <div key={t.id} className="rounded-2xl border border-card-border bg-card p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black px-2.5 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-md">
                        {t.ticketId}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${
                      t.status === "open"
                        ? "bg-red-500/10 text-red-600 border-red-500/30"
                        : t.status === "under_solving"
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                        : t.status === "solved"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "bg-gray-500/10 text-gray-600 border-gray-500/30"
                    }`}>
                      {t.status === "open" ? "🔴 Open" : t.status === "under_solving" ? "🟡 Under Solving" : t.status === "solved" ? "🟢 Solved" : "⚪ Closed"}
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase">Your Concern:</p>
                    <p className="text-xs text-foreground bg-secondary/30 p-2.5 rounded-xl border border-border mt-1">
                      "{t.concern}"
                    </p>
                  </div>

                  {t.adminNotes && (
                    <div className="text-xs bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-800 dark:text-emerald-300">
                      <span className="font-bold flex items-center gap-1 mb-0.5">
                        <MessageSquare size={12} /> Staff Resolution Update:
                      </span>
                      {t.adminNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
