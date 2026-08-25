import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/store";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import {
  Ticket, User, Phone, Mail, Clock, CheckCircle2, AlertCircle, MessageSquare,
  Star, Crown, Shield, Sparkles, MapPin, Eye, ExternalLink, RefreshCw, Calendar
} from "lucide-react";

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

interface ChatSessionHistory {
  id: number;
  sessionToken: string;
  status: "bot" | "waiting_for_agent" | "agent_connected" | "closed";
  assignedAgentName?: string | null;
  lastActivityAt: string;
  createdAt: string;
  messageCount: number;
  lastMessage?: string;
  messages: Array<{
    id: string;
    sender: string;
    senderName?: string;
    message: string;
    createdAt: string;
  }>;
}

export default function Account() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [busy, setBusy] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<ChatSessionHistory | null>(null);

  const { data: ticketData, isLoading: ticketsLoading, refetch: refetchTickets } = useQuery<{ tickets: SupportTicket[] }>({
    queryKey: ["/api/support-tickets/my", user?.email, user?.id],
    queryFn: async () => {
      if (!user?.email) return { tickets: [] };
      const res = await fetch(`/api/support-tickets/my?email=${encodeURIComponent(user.email)}&userId=${user?.id || ''}`);
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  const { data: chatHistoryData, isLoading: chatsLoading, refetch: refetchChats } = useQuery<{ sessions: ChatSessionHistory[] }>({
    queryKey: ["/api/chatbot/my-sessions", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/chatbot/my-sessions");
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest("PATCH", "/api/user/profile", { name, phone, address });
      const data = await res.json();
      setUser(data.user || { ...user, name, phone, address });
      toast({ title: "Profile Updated Successfully!" });
    } catch (err: any) {
      try {
        const phoneRes = await apiRequest("PATCH", "/api/user/phone", { phone });
        const phoneData = await phoneRes.json();
        setUser(phoneData.user || { ...user, phone });
        toast({ title: "Phone number updated successfully!" });
      } catch (innerErr: any) {
        toast({ title: "Failed to update profile", description: err.message, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
            <User size={32} />
          </div>
          <h2 className="text-xl font-bold text-foreground">Sign In to View Your Profile</h2>
          <p className="text-xs text-muted-foreground">
            Manage your details, track live support tickets, view chat history transcripts, and check your loyalty stars.
          </p>
          <Button onClick={() => (window.location.href = "/login")} className="w-full font-bold">
            Sign In Now
          </Button>
        </div>
      </Layout>
    );
  }

  const myTickets = ticketData?.tickets || [];
  const myChats = chatHistoryData?.sessions || [];
  const starsCount = user.customerStars ?? 0;

  // Calculate VIP Tier based on customer stars
  const starTier =
    starsCount >= 100
      ? { name: "Diamond VIP", badge: "💎 Diamond", discount: "10% Extra OFF", color: "from-cyan-500 to-blue-600" }
      : starsCount >= 50
      ? { name: "Platinum VIP", badge: "🏆 Platinum", discount: "7% Extra OFF", color: "from-purple-500 to-indigo-600" }
      : starsCount >= 20
      ? { name: "Gold VIP", badge: "🥇 Gold", discount: "5% Extra OFF", color: "from-amber-400 to-yellow-600" }
      : starsCount >= 5
      ? { name: "Silver Member", badge: "🥈 Silver", discount: "3% Extra OFF", color: "from-slate-400 to-gray-600" }
      : { name: "Bronze Member", badge: "🥉 Bronze", discount: "Standard Loyalty", color: "from-orange-400 to-amber-700" };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        
        {/* Profile Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 flex items-center justify-center text-white font-extrabold text-2xl shadow-md shrink-0">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-serif text-xl sm:text-2xl font-black text-foreground">
                    {user.name || "Valued Customer"}
                  </h1>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r ${starTier.color} shadow-xs`}>
                    <Crown size={12} /> {starTier.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span>✉️ {user.email}</span>
                  {user.phone && <span>📞 {user.phone}</span>}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black">
                    <Star size={13} className="fill-amber-400 text-amber-400" />
                    {starsCount} Loyalty Stars ⭐
                  </span>
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    {starTier.discount} on checkout
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchTickets();
                refetchChats();
              }}
              className="self-start sm:self-center gap-1.5 text-xs font-bold"
            >
              <RefreshCw size={13} className={ticketsLoading || chatsLoading ? "animate-spin" : ""} /> Refresh Data
            </Button>
          </div>
        </div>

        {/* Multi-Tab Profile Hub */}
        <Tabs defaultValue="tickets" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full h-11 p-1 bg-muted/30 rounded-2xl">
            <TabsTrigger value="tickets" className="text-xs font-bold rounded-xl gap-1.5">
              <Ticket size={14} className="shrink-0" />
              <span className="hidden sm:inline">Support</span> Tickets ({myTickets.length})
            </TabsTrigger>
            <TabsTrigger value="chats" className="text-xs font-bold rounded-xl gap-1.5">
              <MessageSquare size={14} className="shrink-0" />
              <span className="hidden sm:inline">Live</span> Chats ({myChats.length})
            </TabsTrigger>
            <TabsTrigger value="stars" className="text-xs font-bold rounded-xl gap-1.5">
              <Star size={14} className="shrink-0 text-amber-500 fill-amber-400" />
              Stars ({starsCount})
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs font-bold rounded-xl gap-1.5">
              <User size={14} className="shrink-0" />
              Profile
            </TabsTrigger>
          </TabsList>

          {/* ─── TAB 1: SUPPORT TICKETS ─── */}
          <TabsContent value="tickets" className="space-y-4 m-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-foreground">Support &amp; Grievance Tickets</h2>
                <p className="text-xs text-muted-foreground">Track resolution status and staff notes for your tickets</p>
              </div>
            </div>

            {ticketsLoading ? (
              <div className="text-center py-12 text-xs text-muted-foreground">Loading your tickets...</div>
            ) : myTickets.length === 0 ? (
              <div className="rounded-3xl border border-card-border bg-card p-8 text-center space-y-3 shadow-sm">
                <Ticket size={36} className="mx-auto text-muted-foreground/40" />
                <h3 className="font-bold text-sm text-foreground">No Support Tickets Raised Yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Need help with an order, refund, or delivery? Open Lakshmi AI in the bottom right corner anytime to raise a ticket.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myTickets.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-card-border bg-card p-4 sm:p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2.5 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-md">
                          {t.ticketId}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar size={11} /> {new Date(t.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <Badge
                        variant={t.status === "open" ? "destructive" : t.status === "under_solving" ? "default" : "secondary"}
                        className="text-[10px] font-bold"
                      >
                        {t.status === "open" ? "🔴 Open" : t.status === "under_solving" ? "🟡 Under Solving" : t.status === "solved" ? "🟢 Solved" : "⚪ Closed"}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase">Your Concern:</p>
                      <p className="text-xs text-foreground bg-muted/20 p-3 rounded-xl border border-card-border mt-1 leading-relaxed">
                        "{t.concern}"
                      </p>
                    </div>

                    {t.adminNotes && (
                      <div className="text-xs bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-900 dark:text-emerald-200">
                        <span className="font-bold flex items-center gap-1 mb-1 text-emerald-700 dark:text-emerald-400">
                          <MessageSquare size={13} /> Official Support Resolution:
                        </span>
                        <p className="leading-relaxed">{t.adminNotes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── TAB 2: LIVE CHAT & BOT CONVERSATION HISTORY ─── */}
          <TabsContent value="chats" className="space-y-4 m-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-foreground">Previous Chat Sessions</h2>
                <p className="text-xs text-muted-foreground">Review your past conversations with Lakshmi AI and live customer representatives</p>
              </div>
            </div>

            {chatsLoading ? (
              <div className="text-center py-12 text-xs text-muted-foreground">Loading chat history...</div>
            ) : myChats.length === 0 ? (
              <div className="rounded-3xl border border-card-border bg-card p-8 text-center space-y-3 shadow-sm">
                <MessageSquare size={36} className="mx-auto text-muted-foreground/40" />
                <h3 className="font-bold text-sm text-foreground">No Chat History Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  You haven't chatted with Lakshmi or Live Support yet. Click the Lakshmi button in the bottom right to start chatting!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myChats.map((chat) => (
                  <div key={chat.id} className="rounded-2xl border border-card-border bg-card p-4 sm:p-5 shadow-sm space-y-3 hover:border-primary/40 transition">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-muted rounded-md text-foreground">
                          ID: {chat.sessionToken.substring(0, 12)}...
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock size={11} /> {new Date(chat.lastActivityAt || chat.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant={chat.status === "agent_connected" ? "default" : chat.status === "waiting_for_agent" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {chat.status === "waiting_for_agent" ? "⏳ Waiting for Agent" : chat.status === "agent_connected" ? "🟢 Live Chat" : chat.status === "closed" ? "📁 Resolved / Closed" : "🤖 AI Assistance"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-bold gap-1"
                          onClick={() => setSelectedTranscript(chat)}
                        >
                          <Eye size={12} /> View Transcript ({chat.messageCount})
                        </Button>
                      </div>
                    </div>

                    <div className="bg-muted/15 p-2.5 rounded-xl border border-card-border text-xs text-muted-foreground italic truncate">
                      Latest: "{chat.lastMessage}"
                    </div>

                    {chat.assignedAgentName && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        👤 Representative Assigned: {chat.assignedAgentName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── TAB 3: LOYALTY STARS & REWARDS ─── */}
          <TabsContent value="stars" className="space-y-4 m-0">
            <div className="rounded-3xl border border-card-border bg-card p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-card-border pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                    <Star size={18} className="text-amber-500 fill-amber-400" /> FarmFresh Loyalty Rewards
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Earn Stars on every purchase and unlock automatic discounts on every order.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-amber-500">★ {starsCount}</span>
                  <p className="text-[10px] text-muted-foreground font-bold">Current Stars</p>
                </div>
              </div>

              {/* VIP Tiers Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className={`p-4 rounded-2xl border ${starsCount >= 100 ? "border-cyan-500 bg-cyan-500/10 font-bold" : "border-card-border bg-muted/20"}`}>
                  <p className="font-black text-cyan-500">💎 Diamond VIP</p>
                  <p className="text-foreground font-bold mt-1">100+ Stars</p>
                  <p className="text-muted-foreground text-[11px] mt-1">10% Extra OFF + Priority Express Dispatch</p>
                </div>
                <div className={`p-4 rounded-2xl border ${starsCount >= 50 && starsCount < 100 ? "border-purple-500 bg-purple-500/10 font-bold" : "border-card-border bg-muted/20"}`}>
                  <p className="font-black text-purple-500">🏆 Platinum VIP</p>
                  <p className="text-foreground font-bold mt-1">50 - 99 Stars</p>
                  <p className="text-muted-foreground text-[11px] mt-1">7% Extra OFF on all orders</p>
                </div>
                <div className={`p-4 rounded-2xl border ${starsCount >= 20 && starsCount < 50 ? "border-amber-500 bg-amber-500/10 font-bold" : "border-card-border bg-muted/20"}`}>
                  <p className="font-black text-amber-500">🥇 Gold VIP</p>
                  <p className="text-foreground font-bold mt-1">20 - 49 Stars</p>
                  <p className="text-muted-foreground text-[11px] mt-1">5% Extra OFF on all orders</p>
                </div>
                <div className={`p-4 rounded-2xl border ${starsCount >= 5 && starsCount < 20 ? "border-emerald-500 bg-emerald-500/10 font-bold" : "border-card-border bg-muted/20"}`}>
                  <p className="font-black text-emerald-500">🥈 Silver Member</p>
                  <p className="text-foreground font-bold mt-1">5 - 19 Stars</p>
                  <p className="text-muted-foreground text-[11px] mt-1">3% Extra OFF on all orders</p>
                </div>
              </div>

              <div className="bg-muted/15 p-4 rounded-2xl border border-card-border text-xs space-y-2">
                <h4 className="font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" /> How to Earn More Stars:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Complete Orders:</strong> Receive Stars based on order value.</li>
                  <li><strong>Review Products:</strong> Leave 5-star verified reviews on purchased items.</li>
                  <li><strong>Refer Friends:</strong> Get bonus Stars when your friends complete their first purchase.</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* ─── TAB 4: PROFILE & ADDRESS SETTINGS ─── */}
          <TabsContent value="settings" className="space-y-4 m-0">
            <div className="rounded-3xl border border-card-border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <User size={18} className="text-primary" /> Edit Profile &amp; Default Delivery Address
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Keep your phone and address up to date for smooth door-step deliveries
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fullName" className="text-xs font-bold">Full Name</Label>
                    <Input
                      id="fullName"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      className="mt-1 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <Label htmlFor="emailAddress" className="text-xs font-bold">Email Address</Label>
                    <Input
                      id="emailAddress"
                      value={user.email}
                      disabled
                      className="mt-1 rounded-xl text-xs bg-muted/40 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="mobilePhone" className="text-xs font-bold">Mobile Phone Number (for WhatsApp/SMS updates)</Label>
                  <Input
                    id="mobilePhone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    required
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="deliveryAddress" className="text-xs font-bold">Default Delivery Address</Label>
                  <Textarea
                    id="deliveryAddress"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter full flat, building, street, landmark, and pincode"
                    rows={3}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>

                <Button type="submit" disabled={busy} className="font-bold">
                  {busy ? "Saving Changes..." : "Save Profile Details"}
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>

        {/* ─── TRANSCRIPT VIEWER MODAL ─── */}
        <Dialog open={!!selectedTranscript} onOpenChange={(o) => !o && setSelectedTranscript(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                <MessageSquare size={16} className="text-primary" />
                Chat Transcript ({selectedTranscript?.sessionToken.substring(0, 12)}...)
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-muted/10 rounded-xl border border-card-border max-h-[400px]">
              {selectedTranscript?.messages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No recorded messages for this session.</p>
              ) : (
                selectedTranscript?.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === "customer" ? "items-end" : "items-start"}`}
                  >
                    <div className="text-[10px] text-muted-foreground mb-0.5 font-bold">
                      {m.sender === "customer" ? "You" : m.senderName || "Support"} · {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div
                      className={`rounded-2xl px-3 py-2 text-xs max-w-[85%] leading-relaxed ${
                        m.sender === "customer"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-card border border-card-border text-foreground rounded-tl-sm shadow-xs"
                      }`}
                    >
                      {m.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setSelectedTranscript(null)}>
                Close Transcript
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
