import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { getStarTheme } from "@/lib/starTheme";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, Lock, Unlock, BadgeCheck, Pencil, Save, Mail, Phone, User as UserIcon, Sparkles, TrendingUp, Search, HeartPulse, PieChart } from "lucide-react";
import { useAuth } from "@/lib/store";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
}

export default function AdminCustomers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = Boolean(currentUser?.isPrimaryAdmin || currentUser?.email?.toLowerCase() === "admin@farmfreshfarmer.com");

  const [starEditId, setStarEditId] = useState<number | null>(null);
  const [starEditVal, setStarEditVal] = useState<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editVerified, setEditVerified] = useState(false);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/admin/customers"],
    queryFn: () => apiGet<Customer[]>("/api/admin/customers"),
  });

  // Chief Executive Super Admin Behavioral Analytics
  const { data: behaviorAnalytics } = useQuery<{
    totalTrackedProfiles: number;
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
    mutationFn: async ({ id, name, email, phone, isVerified }: { id: number; name: string; email: string; phone: string; isVerified: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/customers/${id}`, { name, email, phone, isVerified });
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
            <div className="text-right">
              <span className="text-xs font-bold text-muted-foreground">Profiles Tracked: </span>
              <span className="text-sm font-black text-emerald-400">
                {behaviorAnalytics?.totalTrackedProfiles ?? customers.length}
              </span>
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

      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Customer</th>
                <th className="p-3 font-semibold">Loyalty Stars</th>
                <th className="p-3 font-semibold">Phone</th>
                <th className="p-3 font-semibold">Orders</th>
                <th className="p-3 font-semibold">Total spent</th>
                <th className="p-3 font-semibold">First order</th>
                <th className="p-3 font-semibold">Referral code</th>
                <th className="p-3 font-semibold">Referral balance</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-card-border" data-testid={`row-customer-${c.id}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium">{c.name}</p>
                      {c.isEmailVerified && c.isPhoneVerified && <VerifiedBadge size="sm" />}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{c.email}</span>
                      {c.isEmailVerified ? (
                        <span className="text-emerald-400 font-bold text-[10px]">✓</span>
                      ) : (
                        <span className="text-red-400 font-bold text-[10px]">(Unverified)</span>
                      )}
                    </p>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => { setStarEditId(c.id); setStarEditVal(c.customerStars || 0); }}
                      className="flex flex-col gap-0.5 group p-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/15 transition-all text-left cursor-pointer"
                      title="Click to edit loyalty stars"
                    >
                      <div className="flex items-center gap-1 font-extrabold text-xs text-blue-400">
                        {(c.customerStars || 0) > 0 ? (
                          <span>★ {c.customerStars} Stars</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic font-normal">No stars</span>
                        )}
                      </div>
                      <span className="text-[9px] text-blue-400 opacity-70 group-hover:opacity-100 font-bold mt-0.5">Edit ({c.customerStars || 0}/5)</span>
                    </button>
                  </td>
                  <td className="p-3">
                    {c.phone ? (
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-foreground font-medium">{c.phone}</span>
                        {c.isPhoneVerified ? (
                          <span title="Mobile Number Verified via WhatsApp" className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                            ✓ Verified
                          </span>
                        ) : (
                          <span title="Mobile Phone Not Verified" className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20">
                            Unverified
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">{c.totalOrders}</td>
                  <td className="p-3 font-medium">{formatINR(Number(c.totalSpent))}</td>
                  <td className="p-3">{c.hasCompletedFirstOrder ? <Badge variant="default">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                  <td className="p-3 font-mono text-xs">{c.referralCode || "—"}</td>
                  <td className="p-3">{formatINR(Number(c.referralBalance))}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      <Badge variant={c.status === "blocked" ? "destructive" : "default"}>{c.status}</Badge>
                      {c.isEmailVerified && c.isPhoneVerified ? (
                        <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                          <BadgeCheck size={9} /> Fully Verified
                        </Badge>
                      ) : c.isEmailVerified ? (
                        <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit">
                          ✉️ Email Only
                        </Badge>
                      ) : (
                        <Badge className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                          Unverified
                        </Badge>
                      )}
                      {(c.isPermanentlyLocked || c.status === "locked") && (
                        <Badge className="text-[9px] bg-red-600/20 text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                          <Lock size={9} /> Locked
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {(c.isPrimaryAdmin || c.email?.toLowerCase() === "admin@farmfreshfarmer.com" || c.id === 1) ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          👑 Protected Root Super Admin (Immutable)
                        </span>
                      ) : (
                        <>
                          {isSuperAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditTarget(c);
                                setEditName(c.name || "");
                                setEditEmail(c.email || "");
                                setEditPhone(c.phone || "");
                                setEditVerified(Boolean(c.isVerified));
                              }}
                              title="Manually edit customer phone, email & details (Super Admin Override)"
                              className="h-8 px-2.5 text-xs font-bold text-amber-400 border-amber-500/40 hover:bg-amber-500/10 rounded-lg flex items-center gap-1"
                            >
                              <Pencil size={12} /> Edit
                            </Button>
                          )}

                          {isSuperAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => verifyUserMut.mutate(c.id)}
                              disabled={verifyUserMut.isPending}
                              title={c.isVerified ? "Remove verification badge" : "Verify genuine customer with Blue Badge"}
                              className={`h-8 px-2.5 text-xs font-bold rounded-lg flex items-center gap-1 ${
                                c.isVerified
                                  ? "text-sky-400 border-sky-500/40 hover:bg-sky-500/10"
                                  : "text-muted-foreground border-border hover:text-sky-400 hover:border-sky-500/40"
                              }`}
                            >
                              <BadgeCheck size={12} /> {c.isVerified ? "Verified" : "Verify"}
                            </Button>
                          )}

                          {(c.isPermanentlyLocked || c.status === "locked" || (c.failedLoginAttempts || 0) > 0) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unlockUserMut.mutate(c.id)}
                              disabled={unlockUserMut.isPending}
                              title="Unlock account and reset failed login attempts"
                              className="h-8 px-2.5 text-xs font-bold text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 rounded-lg flex items-center gap-1"
                            >
                              <Unlock size={12} /> Unlock
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStatus.mutate({ id: c.id, status: c.status === "blocked" ? "active" : "blocked" })}
                            data-testid={`button-toggle-block-${c.id}`}
                            className="rounded-lg text-xs"
                          >
                            {c.status === "blocked" ? "Unblock" : "Block"}
                          </Button>

                          {isSuperAdmin && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget(c)}
                              title="Permanently delete customer from DB (Super Admin Only)"
                              className="h-8 px-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-lg transition-all"
                            >
                              <Trash2 size={13} />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No customers yet.</td></tr>}
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
                  <p className="text-xs text-amber-400 font-semibold">Super Admin Manual Override (No OTP Required)</p>
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

              <div className="p-3 rounded-xl bg-secondary/50 border border-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground flex items-center gap-1">
                    Verified Customer Blue Badge
                    <VerifiedBadge size="sm" />
                  </p>
                  <p className="text-[10px] text-muted-foreground">Authorize customer for order placement</p>
                </div>
                <input
                  type="checkbox"
                  checked={editVerified}
                  onChange={(e) => setEditVerified(e.target.checked)}
                  className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                />
              </div>
              </div>

              <div className="sticky bottom-0 z-10 bg-card p-4 border-t border-border flex gap-2 shrink-0">
                <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setEditTarget(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
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
    </AdminLayout>
  );
}
