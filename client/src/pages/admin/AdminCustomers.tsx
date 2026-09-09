import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { getStarTheme } from "@/lib/starTheme";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, Lock, Unlock, BadgeCheck, Pencil, Save, Mail, Phone, User as UserIcon, Sparkles, TrendingUp, Search, HeartPulse, PieChart, Send, X, LayoutGrid, List, CheckCircle2, XCircle, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/store";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Customer {
  id: number; name: string; email: string; phone: string | null; status: string;
  hasCompletedFirstOrder: boolean; totalOrders: number; totalSpent: string;
  referralCode: string | null; successfulReferrals: number; referralBalance: number;
  customerStars?: number;
  isPermanentlyLocked?: boolean;
  failedLoginAttempts?: number;
  lockoutUntil?: string | null;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  isPrimaryAdmin?: boolean;
}

export default function AdminCustomers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = Boolean(
    currentUser?.isPrimaryAdmin ||
    currentUser?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    currentUser?.role === "superadmin" ||
    currentUser?.role === "admin" ||
    currentUser?.role === "manager_admin" ||
    currentUser?.id === 1
  );

  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const [starEditId, setStarEditId] = useState<number | null>(null);
  const [starEditVal, setStarEditVal] = useState<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editVerified, setEditVerified] = useState(false);
  const [editEmailVerified, setEditEmailVerified] = useState(false);
  const [editPhoneVerified, setEditPhoneVerified] = useState(false);

  // Custom Email Dispatcher State
  const [emailTarget, setEmailTarget] = useState<Customer | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHeadline, setEmailHeadline] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailButtonText, setEmailButtonText] = useState("Visit FarmFreshFarmer");
  const [emailButtonUrl, setEmailButtonUrl] = useState("https://farmfreshfarmer.com");

  const { data: customers = [], isLoading, isError, error, refetch } = useQuery<Customer[]>({
    queryKey: ["/api/admin/customers"],
    queryFn: () => apiGet<Customer[]>("/api/admin/customers"),
  });

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c: Customer) =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.referralCode && c.referralCode.toLowerCase().includes(q)) ||
      String(c.id).includes(q)
    );
  }, [customers, searchQuery]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
    toast({ title: `${label} Copied!`, description: text });
  };

  // Chief Executive Super Admin Behavioral Analytics
  const { data: behaviorAnalytics } = useQuery<{
    totalTrackedProfiles: number;
    totalGuestSessions: number;
    totalCombinedVisitors: number;
    topSearches: { keyword: string; count: number }[];
    topCategories: { category: string; count: number }[];
    topHealthTopics: { topic: string; count: number }[];
  }>({
    queryKey: ["/api/admin/analytics/behavior"],
    queryFn: () => apiGet("/api/admin/analytics/behavior"),
    enabled: isSuperAdmin,
    staleTime: 30000,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("POST", `/api/admin/customers/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({ title: "Customer status updated" });
    },
    onError: () => toast({ title: "Could not update status", variant: "destructive" }),
  });

  const updateCustomerMut = useMutation({
    mutationFn: async ({ id, name, email, phone, isVerified, isEmailVerified, isPhoneVerified }: {
      id: number;
      name: string;
      email: string;
      phone: string;
      isVerified: boolean;
      isEmailVerified?: boolean;
      isPhoneVerified?: boolean;
    }) => {
      const res = await apiRequest("PATCH", `/api/admin/customers/${id}`, {
        name,
        email,
        phone,
        isVerified,
        isEmailVerified,
        isPhoneVerified,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Customer Details Updated", description: data.message || "Saved successfully." });
      setEditTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message || "Could not update customer", variant: "destructive" });
    },
  });

  const toggleEmailVerifyMut = useMutation({
    mutationFn: async ({ id, isEmailVerified }: { id: number; isEmailVerified?: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/customers/${id}/toggle-email-verify`, { isEmailVerified });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Email Verification Updated", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message || "Could not update email verification", variant: "destructive" });
    },
  });

  const togglePhoneVerifyMut = useMutation({
    mutationFn: async ({ id, isPhoneVerified }: { id: number; isPhoneVerified?: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/customers/${id}/toggle-phone-verify`, { isPhoneVerified });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Phone Verification Updated", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message || "Could not update phone verification", variant: "destructive" });
    },
  });

  const setStarsMut = useMutation({
    mutationFn: async ({ id, stars }: { id: number; stars: number }) => {
      await apiRequest("PATCH", `/api/users/${id}/customer-stars`, { customerStars: stars });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({ title: "Loyalty stars updated! ⭐" });
      setStarEditId(null);
    },
    onError: () => toast({ title: "Could not update stars", variant: "destructive" }),
  });

  const deleteUserMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}/permanent`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "🗑️ Account Deleted", description: data.message || "Customer permanently deleted from database." });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Deletion Failed", description: err.message || "Could not delete customer", variant: "destructive" });
    },
  });

  const unlockUserMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/unlock`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "🔓 Customer Unlocked", description: data.message || "Customer account unlocked successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Unlock Failed", description: err.message || "Could not unlock customer", variant: "destructive" });
    },
  });

  const verifyUserMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/verify-badge`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: data.message || "Customer verification updated" });
    },
    onError: (err: any) => {
      toast({ title: "Verification update failed", description: err?.message, variant: "destructive" });
    },
  });

  const sendEmailMut = useMutation({
    mutationFn: async ({ id, subject, headline, message, buttonText, buttonUrl }: {
      id: number;
      subject: string;
      headline?: string;
      message: string;
      buttonText?: string;
      buttonUrl?: string;
    }) => {
      const res = await apiRequest("POST", `/api/admin/customers/${id}/send-email`, {
        subject,
        headline,
        message,
        buttonText,
        buttonUrl,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Email Sent Successfully! ✉️", description: data.message || "Branded message delivered to customer inbox." });
      setEmailTarget(null);
      setEmailSubject("");
      setEmailHeadline("");
      setEmailMessage("");
    },
    onError: (err: any) => {
      toast({ title: "Email Dispatch Failed", description: err.message || "Could not deliver email.", variant: "destructive" });
    },
  });

  return (
    <AdminLayout title="Customers">
      <p className="text-sm text-muted-foreground mb-4">All registered customers, their order history, loyalty stars, and referral performance.</p>

      {/* ── Chief Executive Super Admin: Behavioral Analytics & Demand Intelligence ── */}
      {isSuperAdmin && (
        <div className="mb-8 p-5 rounded-2xl bg-gradient-to-br from-card via-card to-emerald-950/20 border-2 border-emerald-500/30 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  Customer Behavioral Analytics &amp; Demand Insights
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                    Super Admin Exclusive
                  </Badge>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Aggregated, privacy-safe analytics on trending produce searches, category views, and Lakshmi AI health topics.
                </p>
              </div>
            </div>
            <div className="text-right space-y-0.5">
              <span className="text-xs font-bold text-muted-foreground">Total Visitors Tracked: </span>
              <span className="text-sm font-black text-emerald-400">
                {behaviorAnalytics?.totalCombinedVisitors ?? (customers.length)}
              </span>
              <p className="text-[10px] text-muted-foreground">
                {behaviorAnalytics?.totalTrackedProfiles ?? 0} Logged-in • {behaviorAnalytics?.totalGuestSessions ?? 0} Guests
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Top Product & Website Searches */}
            <div className="p-3.5 rounded-xl bg-background/60 border border-card-border space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <Search size={14} />
                <span>Trending Product Searches</span>
              </div>
              {behaviorAnalytics?.topSearches && behaviorAnalytics.topSearches.length > 0 ? (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {behaviorAnalytics.topSearches.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-card border border-card-border/60">
                      <span className="font-semibold text-foreground truncate max-w-[140px] capitalize">"{s.keyword}"</span>
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        {s.count} search{s.count > 1 ? "es" : ""}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No search queries recorded yet.</p>
              )}
            </div>

            {/* Top Lakshmi AI Health Queries */}
            <div className="p-3.5 rounded-xl bg-background/60 border border-card-border space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                <HeartPulse size={14} />
                <span>Top Lakshmi AI Health Inquiries</span>
              </div>
              {behaviorAnalytics?.topHealthTopics && behaviorAnalytics.topHealthTopics.length > 0 ? (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {behaviorAnalytics.topHealthTopics.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-card border border-card-border/60">
                      <span className="font-semibold text-foreground truncate max-w-[140px] capitalize">
                        {t.topic.replace(/_/g, " ")}
                      </span>
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        {t.count} quer{t.count > 1 ? "ies" : "y"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No AI inquiries recorded yet.</p>
              )}
            </div>

            {/* Most Visited Produce Categories */}
            <div className="p-3.5 rounded-xl bg-background/60 border border-card-border space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                <PieChart size={14} />
                <span>Top Browsed Categories</span>
              </div>
              {behaviorAnalytics?.topCategories && behaviorAnalytics.topCategories.length > 0 ? (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {behaviorAnalytics.topCategories.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-card border border-card-border/60">
                      <span className="font-semibold text-foreground truncate max-w-[140px] capitalize">
                        {c.category.replace(/-/g, " ")}
                      </span>
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        {c.count} view{c.count > 1 ? "s" : ""}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No category views recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search & View Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by customer name, email, phone, referral code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-card border-card-border text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary/60 p-1 rounded-xl border border-card-border">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "cards"
                  ? "bg-emerald-500/20 text-emerald-400 shadow-xs border border-emerald-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={14} />
              <span>Customer Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-emerald-500/20 text-emerald-400 shadow-xs border border-emerald-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List size={14} />
              <span>Table View</span>
            </button>
          </div>

          <Badge variant="outline" className="h-9 px-3 rounded-xl border-card-border text-xs font-mono font-bold">
            {filteredCustomers.length} {filteredCustomers.length === 1 ? "Customer" : "Customers"}
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : isError ? (
        <div className="p-8 text-center text-red-400 font-bold bg-card border border-red-500/30 rounded-2xl">
          ⚠️ Error loading customers: {(error as any)?.message || "Session verification failed"}.
          <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-3 h-7 text-xs border-emerald-500/40 text-emerald-400">
            Retry
          </Button>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground bg-card border border-card-border rounded-2xl space-y-2">
          <p className="text-sm font-semibold text-foreground">No customers found</p>
          <p className="text-xs">Try adjusting your search criteria or register a new customer.</p>
        </div>
      ) : viewMode === "cards" ? (
        /* ── MODE 1: RICH RESPONSIVE CUSTOMER CARDS ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4.5">
          {filteredCustomers.map((c) => {
            const isRootAdmin = Boolean(c.isPrimaryAdmin || c.email?.toLowerCase() === "admin@farmfreshfarmer.com" || c.id === 1);
            return (
              <div
                key={c.id}
                className="group relative rounded-2xl border border-card-border bg-card/95 hover:border-emerald-500/30 hover:shadow-xl transition-all p-5 flex flex-col justify-between space-y-4"
                data-testid={`card-customer-${c.id}`}
              >
                {/* Top Section */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-primary/20 border border-emerald-500/30 flex items-center justify-center font-serif text-lg font-black text-emerald-400 shrink-0">
                        {c.name ? c.name.charAt(0).toUpperCase() : "C"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-extrabold text-sm text-foreground truncate">{c.name || "Unnamed Customer"}</h3>
                          {c.isEmailVerified && c.isPhoneVerified && <VerifiedBadge size="sm" />}
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">Customer #{c.id}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isRootAdmin ? (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          👑 Root Admin
                        </span>
                      ) : (
                        <Badge variant={c.status === "blocked" ? "destructive" : "default"} className="text-[10px] uppercase font-bold">
                          {c.status}
                        </Badge>
                      )}
                      {(c.isPermanentlyLocked || c.status === "locked") && (
                        <Badge className="text-[9px] bg-red-600/20 text-red-400 border border-red-500/30 flex items-center gap-0.5">
                          <Lock size={9} /> Locked
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="space-y-1.5 p-2.5 rounded-xl bg-secondary/30 border border-card-border/60 text-xs font-mono">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Mail size={13} className="text-muted-foreground shrink-0" />
                        <span className="truncate text-foreground font-medium">{c.email || "No Email"}</span>
                      </div>
                      {c.email && (
                        <button
                          type="button"
                          onClick={() => handleCopy(c.email, `email-${c.id}`)}
                          className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                          title="Copy Email"
                        >
                          {copiedText === `email-${c.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Phone size={13} className="text-muted-foreground shrink-0" />
                        <span className="truncate text-foreground font-medium">{c.phone || "No Phone"}</span>
                      </div>
                      {c.phone && (
                        <button
                          type="button"
                          onClick={() => handleCopy(c.phone!, `phone-${c.id}`)}
                          className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                          title="Copy Phone"
                        >
                          {copiedText === `phone-${c.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-background border border-card-border/60">
                      <span className="text-[10px] text-muted-foreground block">Orders</span>
                      <span className="font-mono text-xs font-bold text-foreground">{c.totalOrders || 0}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-background border border-card-border/60">
                      <span className="text-[10px] text-muted-foreground block">Total Spent</span>
                      <span className="font-mono text-xs font-bold text-emerald-400">{formatINR(Number(c.totalSpent || 0))}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-background border border-card-border/60">
                      <span className="text-[10px] text-muted-foreground block">Loyalty</span>
                      <button
                        onClick={() => { setStarEditId(c.id); setStarEditVal(c.customerStars || 0); }}
                        className="font-mono text-xs font-extrabold text-amber-400 hover:underline cursor-pointer"
                        title="Click to edit stars"
                      >
                        {(c.customerStars || 0) > 0 ? `${c.customerStars}★` : "0★"}
                      </button>
                    </div>
                  </div>

                  {/* ── SEPARATE VERIFICATION CONTROLS FOR EMAIL & PHONE ── */}
                  <div className="p-2.5 rounded-xl bg-background/80 border border-card-border/80 space-y-2">
                    <div className="text-[11px] font-bold text-muted-foreground flex items-center justify-between">
                      <span>Verification Controls</span>
                      {c.isEmailVerified && c.isPhoneVerified ? (
                        <span className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1">
                          <CheckCircle2 size={11} /> Fully Verified
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                          <AlertTriangle size={11} /> Pending
                        </span>
                      )}
                    </div>

                    {/* Email Verification Row */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        {c.isEmailVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <CheckCircle2 size={12} className="text-emerald-400" />
                            Email Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400">
                            <XCircle size={12} className="text-red-400" />
                            Email Unverified
                          </span>
                        )}
                      </div>

                      {!isRootAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleEmailVerifyMut.mutate({ id: c.id, isEmailVerified: !c.isEmailVerified })}
                          disabled={toggleEmailVerifyMut.isPending}
                          className={`h-6 px-2 text-[10px] font-extrabold rounded-md cursor-pointer ${
                            c.isEmailVerified
                              ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          }`}
                        >
                          {c.isEmailVerified ? "Unverify Email" : "Verify Email"}
                        </Button>
                      )}
                    </div>

                    {/* Phone Verification Row */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        {c.isPhoneVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <CheckCircle2 size={12} className="text-emerald-400" />
                            Phone Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400">
                            <XCircle size={12} className="text-red-400" />
                            Phone Unverified
                          </span>
                        )}
                      </div>

                      {!isRootAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePhoneVerifyMut.mutate({ id: c.id, isPhoneVerified: !c.isPhoneVerified })}
                          disabled={togglePhoneVerifyMut.isPending}
                          className={`h-6 px-2 text-[10px] font-extrabold rounded-md cursor-pointer ${
                            c.isPhoneVerified
                              ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          }`}
                        >
                          {c.isPhoneVerified ? "Unverify Phone" : "Verify Phone"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="space-y-2 pt-2 border-t border-card-border/80">
                  {/* ✉️ PROMINENT "MAIL" BUTTON (VISIBLE ON CUSTOMER CARDS) */}
                  {c.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmailTarget(c);
                        setEmailSubject(`A Special Message from FarmFreshFarmer, ${c.name?.split(" ")[0] || "Valued Customer"}`);
                        setEmailHeadline("Direct Update from FarmFreshFarmer");
                        setEmailMessage("");
                        setEmailButtonText("Shop Fresh Harvest");
                        setEmailButtonUrl("https://farmfreshfarmer.com");
                      }}
                      title="Send custom branded FarmFreshFarmer email to this customer"
                      className="w-full h-9 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                    >
                      <Mail size={15} />
                      <span>Send Mail to {c.name?.split(" ")[0] || "Customer"}</span>
                    </Button>
                  )}

                  {!isRootAdmin && (
                    <div className="flex items-center justify-between gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditTarget(c);
                          setEditName(c.name || "");
                          setEditEmail(c.email || "");
                          setEditPhone(c.phone || "");
                          setEditVerified(Boolean(c.isVerified));
                          setEditEmailVerified(Boolean(c.isEmailVerified));
                          setEditPhoneVerified(Boolean(c.isPhoneVerified));
                        }}
                        className="flex-1 h-8 text-xs font-bold text-amber-400 border-amber-500/40 hover:bg-amber-500/10 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Pencil size={12} /> Edit
                      </Button>

                      {(c.isPermanentlyLocked || c.status === "locked" || (c.failedLoginAttempts || 0) > 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unlockUserMut.mutate(c.id)}
                          disabled={unlockUserMut.isPending}
                          className="h-8 px-2.5 text-xs font-bold text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Unlock size={12} /> Unlock
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatus.mutate({ id: c.id, status: c.status === "blocked" ? "active" : "blocked" })}
                        className="h-8 px-2.5 text-xs font-bold rounded-lg cursor-pointer"
                      >
                        {c.status === "blocked" ? "Unblock" : "Block"}
                      </Button>

                      {isSuperAdmin && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(c)}
                          className="h-8 px-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-lg cursor-pointer"
                          title="Permanently Delete Customer"
                        >
                          <Trash2 size={12} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── MODE 2: TABLE VIEW ── */
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Customer</th>
                <th className="p-3 font-semibold">Loyalty Stars</th>
                <th className="p-3 font-semibold">Phone &amp; Verification</th>
                <th className="p-3 font-semibold">Orders</th>
                <th className="p-3 font-semibold">Total Spent</th>
                <th className="p-3 font-semibold">First Order</th>
                <th className="p-3 font-semibold">Referral Code</th>
                <th className="p-3 font-semibold">Referral Balance</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((c) => {
                const isRootAdmin = Boolean(c.isPrimaryAdmin || c.email?.toLowerCase() === "admin@farmfreshfarmer.com" || c.id === 1);
                return (
                  <tr key={c.id} className="border-t border-card-border" data-testid={`row-customer-${c.id}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-foreground">{c.name}</p>
                        {c.isEmailVerified && c.isPhoneVerified && <VerifiedBadge size="sm" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">{c.email}</span>
                        {!isRootAdmin && (
                          <button
                            type="button"
                            onClick={() => toggleEmailVerifyMut.mutate({ id: c.id, isEmailVerified: !c.isEmailVerified })}
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer ${
                              c.isEmailVerified
                                ? "bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400"
                                : "bg-red-500/10 text-red-400 hover:bg-emerald-500/10 hover:text-emerald-400"
                            }`}
                            title={c.isEmailVerified ? "Click to Unverify Email" : "Click to Verify Email"}
                          >
                            {c.isEmailVerified ? "✓ Email (Unverify?)" : "✗ Unverified (Verify?)"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => { setStarEditId(c.id); setStarEditVal(c.customerStars || 0); }}
                        className="flex flex-col gap-0.5 group p-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-all text-left cursor-pointer shadow-xs"
                        title="Click to edit loyalty stars"
                      >
                        <div className="flex items-center gap-1 font-extrabold text-xs text-amber-500 dark:text-yellow-400">
                          {(c.customerStars || 0) > 0 ? (
                            <span className="flex items-center gap-1 font-black">
                              <span>{"⭐".repeat(Math.min(5, c.customerStars || 0))}</span>
                              <span className="ml-0.5">{c.customerStars}★</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic font-normal">No stars (0★)</span>
                          )}
                        </div>
                        <span className="text-[9px] text-amber-600 dark:text-yellow-400/80 group-hover:text-amber-500 font-bold mt-0.5">Edit ({c.customerStars || 0}/5)</span>
                      </button>
                    </td>
                    <td className="p-3">
                      {c.phone ? (
                        <div className="space-y-1">
                          <span className="text-foreground font-mono text-xs font-medium">{c.phone}</span>
                          {!isRootAdmin && (
                            <div>
                              <button
                                type="button"
                                onClick={() => togglePhoneVerifyMut.mutate({ id: c.id, isPhoneVerified: !c.isPhoneVerified })}
                                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer ${
                                  c.isPhoneVerified
                                    ? "bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400"
                                    : "bg-red-500/10 text-red-400 hover:bg-emerald-500/10 hover:text-emerald-400"
                                }`}
                                title={c.isPhoneVerified ? "Click to Unverify Phone" : "Click to Verify Phone"}
                              >
                                {c.isPhoneVerified ? "✓ Phone (Unverify?)" : "✗ Unverified (Verify?)"}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">—</span>
                      )}
                    </td>
                    <td className="p-3 font-mono">{c.totalOrders}</td>
                    <td className="p-3 font-medium font-mono text-emerald-400">{formatINR(Number(c.totalSpent))}</td>
                    <td className="p-3">{c.hasCompletedFirstOrder ? <Badge variant="default">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                    <td className="p-3 font-mono text-xs">{c.referralCode || "—"}</td>
                    <td className="p-3 font-mono">{formatINR(Number(c.referralBalance))}</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <Badge variant={c.status === "blocked" ? "destructive" : "default"} className="text-[10px] uppercase font-bold">
                          {c.status}
                        </Badge>
                        {(c.isPermanentlyLocked || c.status === "locked") && (
                          <Badge className="text-[9px] bg-red-600/20 text-red-400 border border-red-500/30 flex items-center gap-0.5">
                            <Lock size={9} /> Locked
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {isRootAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            👑 Protected Root Super Admin
                          </span>
                        ) : (
                          <>
                            {/* ✉️ Send Mail Button */}
                            {c.email && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEmailTarget(c);
                                  setEmailSubject(`A Special Message from FarmFreshFarmer, ${c.name?.split(" ")[0] || "Valued Customer"}`);
                                  setEmailHeadline("Direct Update from FarmFreshFarmer");
                                  setEmailMessage("");
                                  setEmailButtonText("Shop Fresh Harvest");
                                  setEmailButtonUrl("https://farmfreshfarmer.com");
                                }}
                                title="Send custom branded FarmFreshFarmer email to this customer"
                                className="h-8 px-2.5 text-xs font-bold text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Mail size={12} /> Mail
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditTarget(c);
                                setEditName(c.name || "");
                                setEditEmail(c.email || "");
                                setEditPhone(c.phone || "");
                                setEditVerified(Boolean(c.isVerified));
                                setEditEmailVerified(Boolean(c.isEmailVerified));
                                setEditPhoneVerified(Boolean(c.isPhoneVerified));
                              }}
                              className="h-8 px-2.5 text-xs font-bold text-amber-400 border-amber-500/40 hover:bg-amber-500/10 rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil size={12} /> Edit
                            </Button>

                            {(c.isPermanentlyLocked || c.status === "locked" || (c.failedLoginAttempts || 0) > 0) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => unlockUserMut.mutate(c.id)}
                                disabled={unlockUserMut.isPending}
                                className="h-8 px-2.5 text-xs font-bold text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Unlock size={12} /> Unlock
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStatus.mutate({ id: c.id, status: c.status === "blocked" ? "active" : "blocked" })}
                              className="rounded-lg text-xs cursor-pointer"
                            >
                              {c.status === "blocked" ? "Unblock" : "Block"}
                            </Button>

                            {isSuperAdmin && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteTarget(c)}
                                className="h-8 px-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-lg cursor-pointer"
                                title="Permanently delete customer"
                              >
                                <Trash2 size={12} />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Super Admin Manual Customer Edit Modal */}
      {editTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-hidden" onClick={() => setEditTarget(null)}>
          <div className="bg-card border border-amber-500/40 rounded-3xl w-full max-w-md max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 text-amber-400">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Pencil size={20} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">Edit Customer Details</h3>
                  <p className="text-xs text-amber-400 font-semibold">Super Admin Manual Override</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateCustomerMut.mutate({
                  id: editTarget.id,
                  name: editName,
                  email: editEmail,
                  phone: editPhone,
                  isVerified: editVerified,
                  isEmailVerified: editEmailVerified,
                  isPhoneVerified: editPhoneVerified,
                });
              }}
              className="flex flex-col flex-1 overflow-hidden min-h-0"
            >
              <div className="overflow-y-auto p-6 space-y-3.5 flex-1 overscroll-contain">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">Full Name</Label>
                  <div className="relative">
                    <UserIcon size={14} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="pl-9 rounded-xl text-xs font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">Email Address</Label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="pl-9 rounded-xl text-xs font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">Mobile Phone Number</Label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      type="tel"
                      maxLength={10}
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      className="pl-9 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">10-digit Indian mobile number without +91</p>
                </div>

                {/* Separate Verification Controls */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-xs font-bold text-foreground">Verification Toggles</Label>

                  <div className="p-3 rounded-xl bg-secondary/50 border border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Mail size={13} className="text-emerald-400" />
                        Email Address Verified
                      </p>
                      <p className="text-[10px] text-muted-foreground">Customer email verification status</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editEmailVerified}
                      onChange={(e) => setEditEmailVerified(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-secondary/50 border border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Phone size={13} className="text-sky-400" />
                        Mobile Phone (WhatsApp) Verified
                      </p>
                      <p className="text-[10px] text-muted-foreground">Customer mobile number verification status</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editPhoneVerified}
                      onChange={(e) => setEditPhoneVerified(e.target.checked)}
                      className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-secondary/50 border border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1">
                        Verified Customer Blue Badge
                        <VerifiedBadge size="sm" />
                      </p>
                      <p className="text-[10px] text-muted-foreground">Master platform trust badge</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editVerified}
                      onChange={(e) => setEditVerified(e.target.checked)}
                      className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 z-10 bg-card p-4 border-t border-border flex gap-2 shrink-0">
                <Button type="button" variant="outline" className="flex-1 rounded-xl cursor-pointer" onClick={() => setEditTarget(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                  disabled={updateCustomerMut.isPending}
                >
                  {updateCustomerMut.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permanent Deletion Confirmation Modal */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-card border border-red-500/40 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-foreground">Permanent Account Deletion</h3>
                <p className="text-xs text-red-400 font-semibold">Super Admin Action</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete customer <strong className="text-foreground">{deleteTarget.name}</strong> (<span className="text-emerald-400">{deleteTarget.email}</span>)?
            </p>

            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 leading-relaxed">
              ⚠️ <strong>Warning:</strong> This will completely remove this user, their cart items, customer profile, and authentication records from the database. This action <strong>cannot</strong> be undone.
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 font-bold"
                onClick={() => deleteUserMut.mutate(deleteTarget.id)}
                disabled={deleteUserMut.isPending}
              >
                {deleteUserMut.isPending ? "Deleting…" : "Yes, Delete Permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Stars Modal */}
      {starEditId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setStarEditId(null)}>
          <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold flex items-center gap-2">⭐ Assign Loyalty Stars</h3>
            <p className="text-xs text-muted-foreground">Give customer loyalty stars (0 to 5 max).</p>
            
            <div className="flex flex-col items-center gap-3 py-4 bg-secondary/50 rounded-xl">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const theme = getStarTheme(starVal, true);
                  const isSelected = starEditVal >= starVal;
                  return (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setStarEditVal(starVal)}
                      className={`text-2xl transition-transform hover:scale-125 ${isSelected ? `${theme.starColor} ${theme.glowClass}` : "text-muted-foreground/30"}`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setStarEditVal(0)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                  starEditVal === 0
                    ? "bg-muted border-card-border text-foreground font-black"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Set to 0 Stars (No Discount)
              </button>
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-muted-foreground">Selected Stars:</span>
              <span className="font-bold text-foreground text-sm">{starEditVal} / 5 Stars</span>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setStarEditId(null)}>Cancel</Button>
              <Button
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold"
                onClick={() => setStarsMut.mutate({ id: starEditId, stars: starEditVal })}
                disabled={setStarsMut.isPending}
              >
                {setStarsMut.isPending ? "Saving..." : "Save Stars"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Branded Email Composer Modal */}
      {emailTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4" onClick={() => setEmailTarget(null)}>
          <div className="bg-card border border-emerald-500/40 rounded-3xl w-full max-w-xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                    Send Branded Email
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Official Emerald Template
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    To: <strong className="text-foreground">{emailTarget.name}</strong> ({emailTarget.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailTarget(null)}
                className="w-8 h-8 rounded-xl bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!emailSubject.trim() || !emailMessage.trim()) {
                  toast({ title: "Please fill subject and message body", variant: "destructive" });
                  return;
                }
                sendEmailMut.mutate({
                  id: emailTarget.id,
                  subject: emailSubject.trim(),
                  headline: emailHeadline.trim() || emailSubject.trim(),
                  message: emailMessage.trim(),
                  buttonText: emailButtonText.trim() || "Visit FarmFreshFarmer",
                  buttonUrl: emailButtonUrl.trim() || "https://farmfreshfarmer.com",
                });
              }}
              className="p-5 space-y-4 overflow-y-auto"
            >
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 leading-relaxed">
                🌿 This message will automatically be rendered inside the official FarmFreshFarmer emerald theme, including the logo, personalized greeting, customer support footer, and branded action button.
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Email Subject Line *</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g. Exclusive Weekend Organic Harvest Offer for You"
                  className="rounded-xl border-border bg-background"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Hero Headline (Inside Email Banner)</Label>
                <Input
                  value={emailHeadline}
                  onChange={(e) => setEmailHeadline(e.target.value)}
                  placeholder="e.g. Fresh from Visakhapatnam & Guntur Farms"
                  className="rounded-xl border-border bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Message Body *</Label>
                <Textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="Write your message here... You can write multiple paragraphs."
                  rows={6}
                  className="rounded-xl border-border bg-background font-sans text-xs leading-relaxed"
                  required
                />
                <p className="text-[11px] text-muted-foreground">Line breaks will automatically be formatted into clean, responsive email paragraphs.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Button Label</Label>
                  <Input
                    value={emailButtonText}
                    onChange={(e) => setEmailButtonText(e.target.value)}
                    placeholder="e.g. Claim Your Fresh Harvest"
                    className="rounded-xl border-border bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Button Destination URL</Label>
                  <Input
                    value={emailButtonUrl}
                    onChange={(e) => setEmailButtonUrl(e.target.value)}
                    placeholder="https://farmfreshfarmer.com"
                    className="rounded-xl border-border bg-background"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="sticky bottom-0 pt-4 flex gap-2 border-t border-border bg-card">
                <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setEmailTarget(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sendEmailMut.isPending}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/30"
                >
                  <Send size={14} />
                  {sendEmailMut.isPending ? "Sending Branded Email…" : "Send Email Now"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
