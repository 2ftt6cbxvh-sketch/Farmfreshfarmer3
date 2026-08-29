import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/store";
import { getStarTheme } from "@/lib/starTheme";
import { apiRequest, apiGet } from "@/lib/queryClient";
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
  Star, Crown, Shield, Sparkles, MapPin, Eye, ExternalLink, RefreshCw, Calendar, Trash2, Smartphone
} from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { PhoneVerificationModal } from "@/components/PhoneVerificationModal";
import { EmailVerificationModal } from "@/components/EmailVerificationModal";
import { AccountPasswordCard } from "@/components/AccountPasswordCard";

interface StarDiscountRule {
  id: number;
  ruleType: "customer" | "staff";
  starFrom: number;
  starTo: number;
  discountPercent: string;
  description: string | null;
  active: boolean;
}

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
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto || "");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<ChatSessionHistory | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);

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

  const { data: starRules = [] } = useQuery<StarDiscountRule[]>({
    queryKey: ["/api/star-discount-rules"],
    queryFn: () => apiGet<StarDiscountRule[]>("/api/star-discount-rules"),
    refetchInterval: 5000,
  });

  const { data: publicSettings } = useQuery<any>({ queryKey: ["/api/settings/public"] });

  async function handlePhotoUpload(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Photo Too Large", description: "Please upload an image smaller than 5MB.", variant: "destructive" });
      return;
    }
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const uploadRes = await fetch("/api/upload/customer-photo", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.message || "Failed to upload photo");
      }
      const photoUrl = uploadData.url;
      setProfilePhoto(photoUrl);

      // Save directly to user profile
      const saveRes = await apiRequest("PATCH", "/api/user/profile", {
        name,
        address,
        profilePhoto: photoUrl,
      });
      const saveData = await saveRes.json();
      setUser(saveData.user || { ...user, profilePhoto: photoUrl });
      toast({ title: "Profile Photo Updated!", description: "Your new avatar has been saved." });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const cleanEnteredPhone = phone.replace(/\D/g, "").slice(-10);
    const cleanSavedPhone = user?.phone ? user.phone.replace(/\D/g, "").slice(-10) : "";

    // If phone number is being changed or added, require SMS OTP verification!
    if (cleanEnteredPhone && cleanEnteredPhone !== cleanSavedPhone) {
      setBusy(false);
      toast({
        title: "🔒 Mobile Verification Required",
        description: "Phone number changes require 6-digit SMS OTP verification to prove ownership.",
      });
      setShowVerifyModal(true);
      return;
    }

    try {
      const res = await apiRequest("PATCH", "/api/user/profile", { name, address, profilePhoto });
      const data = await res.json();
      setUser(data.user || { ...user, name, address, profilePhoto });
      toast({ title: "Profile Details Saved!" });
    } catch (err: any) {
      toast({ title: "Failed to update profile", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteChatSession(sessionToken: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this past chat transcript?")) return;
    try {
      const res = await fetch(`/api/chatbot/my-sessions/${sessionToken}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete chat session");
      toast({ title: "Chat session deleted", description: "Transcript removed from your history." });
      refetchChats();
      if (selectedTranscript?.sessionToken === sessionToken) {
        setSelectedTranscript(null);
      }
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err?.message || "Could not delete session", variant: "destructive" });
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

  // Determine loyalty stars and display based on role
  const isSuperAdmin = Boolean(user.isPrimaryAdmin || user.email?.toLowerCase() === "admin@farmfreshfarmer.com" || user.id === 1);
  const isStaffRole = !isSuperAdmin && user.role !== "customer";
  
  const isStarThemeEnabled = publicSettings?.enable_star_tier_colors !== false;

  const starsCount = isSuperAdmin
    ? 6
    : isStaffRole
    ? Math.max(0, Number(user.starRating) ?? 5)
    : Number(user.customerStars || 0);

  const currentUserTheme = getStarTheme(starsCount, isStarThemeEnabled);

  // Calculate VIP Tier & Discount based on dynamic admin panel star discount rules
  const currentMatchingRule = starRules.find(r => 
    r.active && 
    r.ruleType === (isStaffRole ? "staff" : "customer") && 
    starsCount >= r.starFrom && 
    starsCount <= r.starTo
  ) || starRules.find(r => 
    r.active && 
    r.ruleType === "customer" && 
    starsCount >= r.starFrom && 
    starsCount <= r.starTo
  );

  const dynamicDiscountLabel = currentMatchingRule
    ? `${parseFloat(currentMatchingRule.discountPercent)}% Extra OFF`
    : starsCount >= 5 ? "15% Extra OFF" : starsCount >= 4 ? "10% Extra OFF" : starsCount >= 3 ? "8% Extra OFF" : starsCount >= 2 ? "5% Extra OFF" : starsCount >= 1 ? "2% Extra OFF" : "Standard Loyalty";

  const starTier = isSuperAdmin
    ? { name: "Master Admin", badge: "👑 Executive Super Admin (6★)", discount: "Executive 6★ Staff Tier", color: "from-amber-400 via-yellow-500 to-amber-600" }
    : isStaffRole
    ? { name: "Staff Specialist", badge: `🛡️ Staff (${starsCount}★)`, discount: `Staff ${starsCount}★ Tier (${dynamicDiscountLabel})`, color: starsCount >= 5 ? "from-blue-600 to-indigo-600" : starsCount === 4 ? "from-slate-400 to-zinc-500" : starsCount === 3 ? "from-[#cd7f32] to-[#804010]" : "from-emerald-500 to-teal-600" }
    : starsCount >= 5
    ? { name: "Blue VIP Member", badge: `💎 ${starsCount}★ Blue Tier`, discount: dynamicDiscountLabel, color: "from-blue-600 via-sky-500 to-indigo-600" }
    : starsCount === 4
    ? { name: "Silver Member", badge: `🥈 ${starsCount}★ Silver Tier`, discount: dynamicDiscountLabel, color: "from-slate-400 via-slate-300 to-zinc-500" }
    : starsCount === 3
    ? { name: "Bronze Member", badge: `🥉 ${starsCount}★ Bronze Tier`, discount: dynamicDiscountLabel, color: "from-[#a66020] via-[#cd7f32] to-[#804010]" }
    : { name: "Green Tier Member", badge: `🌿 ${starsCount}★ Green Tier`, discount: dynamicDiscountLabel, color: "from-emerald-500 to-teal-600" };

  const isUserVerified = Boolean(isSuperAdmin || (user.isEmailVerified && user.isPhoneVerified) || (user.isVerified && user.isPhoneVerified));

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        
        {/* Profile Hero Banner with Tier Themes */}
        <div className={`relative overflow-hidden rounded-3xl border transition-all p-6 sm:p-8 shadow-sm ${currentUserTheme.borderClass} ${currentUserTheme.bgClass}`}>
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="relative group/avatar">
                {user.profilePhoto || profilePhoto ? (
                  <img
                    src={user.profilePhoto || profilePhoto}
                    alt={user.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-md shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 flex items-center justify-center text-white font-extrabold text-2xl shadow-md shrink-0">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-full shadow-md cursor-pointer transition-transform hover:scale-110">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePhotoUpload(f);
                    }}
                    disabled={photoUploading}
                  />
                  <Sparkles size={11} className={photoUploading ? "animate-spin" : ""} />
                </label>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-serif text-xl sm:text-2xl font-black text-foreground">
                    {user.name || "Valued Customer"}
                  </h1>
                  {isUserVerified && <VerifiedBadge size="md" />}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    ✉️ {user.email}
                    {user.isEmailVerified ? <span className="text-emerald-500 font-bold text-[10px]">✓</span> : <span className="text-red-400 font-bold text-[10px]">(Unverified)</span>}
                  </span>
                  {user.phone && (
                    <span className="flex items-center gap-1">
                      📞 {user.phone}
                      {user.isPhoneVerified ? <span className="text-emerald-500 font-bold text-[10px]">✓</span> : <span className="text-red-400 font-bold text-[10px]">(Unverified)</span>}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r ${starTier.color} shadow-xs`}>
                    <Crown size={12} /> {starTier.badge}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    • {starTier.discount} on checkout
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
              {user.role === "customer" && !user.isEmailVerified && (
                <Button
                  size="sm"
                  onClick={() => setShowEmailVerifyModal(true)}
                  className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md gap-1.5"
                >
                  <Mail size={14} /> Verify Email (Step 1)
                </Button>
              )}
              {user.role === "customer" && !user.isPhoneVerified && (
                <Button
                  size="sm"
                  onClick={() => setShowVerifyModal(true)}
                  className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold text-xs rounded-xl shadow-md gap-1.5"
                >
                  <Smartphone size={14} /> Verify Mobile via SMS OTP (Step 2)
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchTickets();
                  refetchChats();
                }}
                className="gap-1.5 text-xs font-bold rounded-xl"
              >
                <RefreshCw size={13} className={ticketsLoading || chatsLoading ? "animate-spin" : ""} /> Refresh Data
              </Button>
            </div>
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
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete Transcript"
                          onClick={(e) => handleDeleteChatSession(chat.sessionToken, e)}
                        >
                          <Trash2 size={13} />
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

          {/* ─── TAB 3: LOYALTY STARS & REWARDS / STAFF AUTHORIZATION ─── */}
          <TabsContent value="stars" className="space-y-4 m-0">
            <div className="rounded-3xl border border-card-border bg-card p-6 shadow-sm space-y-6">
              {(() => {
                const isStaffRole = isSuperAdmin || (user?.role && user.role !== "customer");
                const targetRuleType = isStaffRole ? "staff" : "customer";

                const relevantRules = starRules
                  .filter((r) => r.ruleType === targetRuleType && r.active)
                  .sort((a, b) => a.starFrom - b.starFrom);

                const displayRules = relevantRules.length > 0
                  ? relevantRules
                  : (isStaffRole
                      ? [
                          { id: 1, starFrom: 1, starTo: 1, discountPercent: "5", description: "Staff Level 1" },
                          { id: 2, starFrom: 2, starTo: 2, discountPercent: "10", description: "Staff Level 2" },
                          { id: 3, starFrom: 3, starTo: 3, discountPercent: "15", description: "Staff Level 3" },
                          { id: 4, starFrom: 4, starTo: 4, discountPercent: "20", description: "Staff Level 4" },
                          { id: 5, starFrom: 5, starTo: 5, discountPercent: "25", description: "Staff Executive Level 5" },
                          { id: 6, starFrom: 6, starTo: 6, discountPercent: "30", description: "Master Admin Executive Level 6" },
                        ]
                      : [
                          { id: 1, starFrom: 1, starTo: 1, discountPercent: "2", description: "Bronze tier (1 Star)" },
                          { id: 2, starFrom: 2, starTo: 2, discountPercent: "5", description: "Silver tier (2 Stars)" },
                          { id: 3, starFrom: 3, starTo: 3, discountPercent: "8", description: "Gold tier (3 Stars)" },
                          { id: 4, starFrom: 4, starTo: 4, discountPercent: "12", description: "Platinum tier (4 Stars)" },
                          { id: 5, starFrom: 5, starTo: 5, discountPercent: "15", description: "Diamond tier (5 Stars)" },
                        ]);

                const gridColsClass = displayRules.length <= 4 ? "md:grid-cols-4" : displayRules.length === 5 ? "md:grid-cols-5" : "md:grid-cols-6";

                return (
                  <>
                    <div className="flex items-center justify-between border-b border-card-border pb-4">
                      <div>
                        <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                          <Star size={18} className="text-amber-500 fill-amber-400" />
                          {isStaffRole ? "🛡️ Staff Authorization Tiers" : "FarmFresh Loyalty Rewards"}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isStaffRole
                            ? "Authorized staff discount levels applied automatically on checkout based on your star rating."
                            : "Earn Stars on every purchase and unlock automatic discounts on every order."}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-black ${currentUserTheme.starColor} ${currentUserTheme.glowClass}`}>★ {starsCount}</span>
                        <p className="text-[10px] text-muted-foreground font-bold">
                          {isStaffRole ? "Staff Rating" : "Current Stars"} ({currentUserTheme.label})
                        </p>
                      </div>
                    </div>

                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridColsClass} gap-3 text-xs`}>
                      {displayRules.map((r: any) => {
                        const isActiveTier = starsCount === r.starTo || (starsCount >= r.starFrom && starsCount <= r.starTo);
                        const starsRangeText = `${r.starTo} Star${r.starTo === 1 ? '' : 's'}`;
                        const filledStars = Math.min(r.starTo, 6);
                        const tierTheme = getStarTheme(r.starTo, isStarThemeEnabled);

                        return (
                          <div
                            key={r.id || `${r.starFrom}-${r.starTo}`}
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                              isActiveTier
                                ? `${tierTheme.borderClass} ${tierTheme.bgClass} font-bold shadow-md`
                                : "border-card-border bg-muted/20 hover:border-card-border/80"
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-extrabold text-foreground capitalize truncate text-xs">
                                  {r.description || `Level ${r.starTo}`}
                                </span>
                                {isActiveTier && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${tierTheme.badgeClass}`}>
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              <p className="text-foreground font-bold mt-1 text-[11px] flex items-center gap-1">
                                <span>{starsRangeText}</span>
                                <span className={`${tierTheme.starColor} ${tierTheme.glowClass} font-mono`}>{'★'.repeat(filledStars)}</span>
                              </p>
                            </div>
                            <div className="mt-3 pt-2 border-t border-card-border/40">
                              <p className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                                {parseFloat(r.discountPercent)}% Extra OFF
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

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
                {/* Profile Photo Uploader */}
                <div className="flex items-center gap-4 p-3 bg-muted/20 border border-card-border rounded-2xl">
                  {profilePhoto || user.profilePhoto ? (
                    <img
                      src={profilePhoto || user.profilePhoto!}
                      alt="Avatar"
                      className="w-14 h-14 rounded-xl object-cover border border-emerald-500 shadow-xs"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold block">Profile Avatar Photo</Label>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold cursor-pointer transition-colors border border-primary/30">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handlePhotoUpload(f);
                          }}
                          disabled={photoUploading}
                        />
                        {photoUploading ? "Uploading..." : "📷 Upload New Photo"}
                      </label>
                      {(profilePhoto || user.profilePhoto) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-500 hover:text-red-600"
                          onClick={() => {
                            setProfilePhoto("");
                            apiRequest("PATCH", "/api/user/profile", { name, phone, address, profilePhoto: "" }).then(() => {
                              setUser({ ...user, profilePhoto: null });
                              toast({ title: "Avatar Removed" });
                            });
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">PNG, JPG, or WebP up to 5MB</p>
                  </div>
                </div>

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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="emailAddress" className="text-xs font-bold">Email Address</Label>
                      <button
                        type="button"
                        onClick={() => setShowEmailVerifyModal(true)}
                        className="text-[11px] font-bold text-emerald-500 hover:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Shield size={11} /> Change Email (OTP)
                      </button>
                    </div>
                    <Input
                      id="emailAddress"
                      value={user.email}
                      disabled
                      className="mt-1 rounded-xl text-xs bg-muted/40 cursor-not-allowed font-medium text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mobilePhone" className="text-xs font-bold">Mobile Phone Number (for WhatsApp/SMS updates)</Label>
                    <button
                      type="button"
                      onClick={() => setShowVerifyModal(true)}
                      className="text-[11px] font-bold text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Smartphone size={11} /> {user.phone ? "Change Phone (SMS OTP)" : "Verify Mobile (SMS OTP)"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-3 py-2 text-xs font-bold rounded-xl bg-secondary border border-border text-muted-foreground shrink-0">
                      🇮🇳 +91
                    </span>
                    <Input
                      id="mobilePhone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      required
                      className="rounded-xl text-xs font-mono font-bold tracking-wider"
                    />
                  </div>
                  {user.isVerified && (
                    <p className="text-[10px] text-sky-400 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Mobile Number Verified with Blue Badge
                    </p>
                  )}
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

            {/* Password & Security Card */}
            <AccountPasswordCard userEmail={user.email} />
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

            <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
              {selectedTranscript && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1 text-xs"
                  onClick={() => handleDeleteChatSession(selectedTranscript.sessionToken)}
                >
                  <Trash2 size={13} /> Delete Transcript
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setSelectedTranscript(null)}>
                Close Transcript
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 📱 Firebase Mobile Verification Modal */}
        <PhoneVerificationModal
          open={showVerifyModal}
          onOpenChange={setShowVerifyModal}
          mode="verify_account"
          defaultPhone={phone || user.phone || ""}
        />

        {/* 📧 Email OTP Verification Modal */}
        <EmailVerificationModal
          open={showEmailVerifyModal}
          onOpenChange={setShowEmailVerifyModal}
        />
      </div>
    </Layout>
  );
}
