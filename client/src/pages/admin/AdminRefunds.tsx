import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Search, CheckCircle2, Clock, AlertCircle, Phone, Mail, User, MessageSquare, Filter, RefreshCw, Camera, DollarSign, ExternalLink, ShieldCheck, XCircle } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface RefundTicket {
  id: number;
  ticketId: string;
  userId?: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  concern: string;
  orderId?: number;
  photoUrl?: string;
  refundAmount?: string;
  refundStatus?: string;
  status: "open" | "under_solving" | "solved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  assignedAgentName?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminRefunds() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterTab, setFilterTab] = useState<"all" | "requested" | "refunded" | "rejected">("requested");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading, refetch } = useQuery<{ tickets: RefundTicket[] }>({
    queryKey: ["/api/admin/support-tickets"],
    queryFn: async () => {
      const res = await fetch("/api/admin/support-tickets", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      });
      return res.json();
    },
    refetchInterval: 5000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status?: string; adminNotes?: string }) => {
      const res = await fetch(`/api/admin/support-tickets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        },
        body: JSON.stringify({ status, adminNotes }),
      });
      if (!res.ok) throw new Error("Failed to update refund request");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Refund Request Updated", description: "Changes saved successfully." });
      setEditingId(null);
      setRejectingId(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
    },
  });

  const processRefundMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const res = await fetch(`/api/admin/support-tickets/${ticketId}/process-refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to process refund");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "PhonePe Refund Approved & Processed! 💳",
        description: data.message || "Refund has been processed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
    },
    onError: (err: any) => {
      toast({
        title: "Refund Execution Error ❌",
        description: err.message || "Could not process refund via PhonePe.",
        variant: "destructive",
      });
    },
  });

  const allTickets = data?.tickets || [];
  // Filter for Return / Refund tickets only
  const refundTickets = allTickets.filter(
    (t) => t.orderId || t.photoUrl || t.refundStatus || t.concern?.toLowerCase().includes("refund") || t.concern?.toLowerCase().includes("return")
  );

  const filteredTickets = refundTickets.filter((t) => {
    // Filter tab
    if (filterTab === "requested" && (t.refundStatus === "refunded" || t.status === "closed")) return false;
    if (filterTab === "refunded" && t.refundStatus !== "refunded" && t.status !== "solved") return false;
    if (filterTab === "rejected" && t.status !== "closed") return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchId = String(t.id).includes(q) || t.ticketId.toLowerCase().includes(q) || String(t.orderId || "").includes(q);
      const matchCust = t.customerName.toLowerCase().includes(q) || t.customerPhone.includes(q) || t.customerEmail.toLowerCase().includes(q);
      const matchConcern = t.concern.toLowerCase().includes(q);
      return matchId || matchCust || matchConcern;
    }
    return true;
  });

  // Calculate statistics
  const pendingCount = refundTickets.filter((t) => t.refundStatus !== "refunded" && t.status !== "closed").length;
  const refundedCount = refundTickets.filter((t) => t.refundStatus === "refunded" || t.status === "solved").length;
  const totalRefundedSum = refundTickets
    .filter((t) => t.refundStatus === "refunded" || t.status === "solved")
    .reduce((sum, t) => sum + (parseFloat(t.refundAmount || "0") || 0), 0);

  return (
    <AdminLayout title="Refunds & Returns Control Center">
      <div className="space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div>
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              <RotateCcw className="text-emerald-500" size={24} /> Customer Refund & Return Requests
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Inspect compulsory damage photo proofs and trigger 1-click PhonePe refunds directly to customer accounts.
            </p>
          </div>

          <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2 text-xs font-bold">
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-amber-500/30 p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Pending Requests</p>
              <h3 className="text-2xl font-black text-amber-500 mt-1">{pendingCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold">
              <Clock size={20} />
            </div>
          </div>

          <div className="bg-card border border-emerald-500/30 p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total Refunded</p>
              <h3 className="text-2xl font-black text-emerald-500 mt-1">₹{totalRefundedSum.toLocaleString("en-IN")}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold">
              <DollarSign size={20} />
            </div>
          </div>

          <div className="bg-card border border-purple-500/30 p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Photo Proof Status</p>
              <h3 className="text-2xl font-black text-purple-500 mt-1">100% Mandatory</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold">
              <Camera size={20} />
            </div>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          <div className="flex gap-2 border border-border p-1 rounded-xl bg-card">
            <button
              onClick={() => setFilterTab("requested")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === "requested" ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📥 Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilterTab("refunded")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === "refunded" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ✅ Approved / Refunded ({refundedCount})
            </button>
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === "all" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📋 All ({refundTickets.length})
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
            <Input
              placeholder="Search by Order ID, Customer Name, Phone, Ticket ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs rounded-xl"
            />
          </div>
        </div>

        {/* Refunds List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground font-semibold">Loading refund requests...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="bg-card border border-border p-12 rounded-2xl text-center">
            <ShieldCheck className="mx-auto text-emerald-500 mb-3" size={40} />
            <h3 className="font-bold text-base">No Refund Requests Found</h3>
            <p className="text-xs text-muted-foreground mt-1">There are no matching refund or return requests in this tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTickets.map((t) => (
              <div key={t.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 relative">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-lg">
                      {t.ticketId}
                    </span>
                    {t.orderId && (
                      <span className="font-mono text-xs font-extrabold px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg">
                        Order #{t.orderId}
                      </span>
                    )}
                  </div>

                  <Badge
                    variant={
                      t.refundStatus === "refunded" || t.status === "solved"
                        ? "default"
                        : t.status === "closed"
                        ? "outline"
                        : "secondary"
                    }
                    className="font-extrabold text-xs"
                  >
                    {t.refundStatus === "refunded" || t.status === "solved"
                      ? "✓ Refunded"
                      : t.status === "closed"
                      ? "❌ Rejected / Closed"
                      : "⏳ Refund Requested"}
                  </Badge>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-secondary/30 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <User size={13} className="text-primary" /> {t.customerName}
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                    <Phone size={13} className="text-emerald-500" /> {t.customerPhone}
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-muted-foreground truncate">
                    <Mail size={13} className="text-purple-500" /> {t.customerEmail}
                  </div>
                </div>

                {/* Concern & Issue */}
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Reason & Issue Details:</p>
                  <p className="text-xs text-foreground bg-background p-3 rounded-xl border border-border whitespace-pre-wrap">
                    "{t.concern}"
                  </p>
                </div>

                {/* COMPULSORY Damage Photo Proof */}
                {t.photoUrl ? (
                  <div className="space-y-1.5 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <p className="text-[11px] font-extrabold text-red-500 flex items-center gap-1">
                      📸 COMPULSORY DAMAGE PHOTO PROOF ATTACHED:
                    </p>
                    <div className="flex items-center gap-3">
                      <img
                        src={t.photoUrl}
                        alt="Customer Damage Proof"
                        className="w-20 h-20 object-cover rounded-lg border border-red-500/30 cursor-pointer hover:opacity-90 shadow-sm transition-all"
                        onClick={() => setPreviewPhoto(t.photoUrl || null)}
                      />
                      <div className="space-y-1 text-xs">
                        <p className="font-bold text-foreground">Inspect Damage Evidence</p>
                        <p className="text-[11px] text-muted-foreground">Click thumbnail to view full high-res photo proof.</p>
                        <button
                          type="button"
                          onClick={() => setPreviewPhoto(t.photoUrl || null)}
                          className="text-xs font-bold text-red-500 hover:underline inline-flex items-center gap-1"
                        >
                          🔍 Expand Photo Proof
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-semibold">
                    ⚠️ No photo uploaded with this general support request.
                  </div>
                )}

                {/* PhonePe Refund Execution Bar */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      Refund Amount: ₹{t.refundAmount || "Full Total"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Target Order: #{t.orderId || "N/A"}
                    </p>
                  </div>

                  {t.refundStatus !== "refunded" && t.status !== "closed" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={processRefundMutation.isPending}
                        onClick={() => processRefundMutation.mutate(t.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md"
                      >
                        {processRefundMutation.isPending ? "Executing..." : "💳 Approve & Process PhonePe Refund"}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setRejectingId(t.id); setRejectReason(""); }}
                        className="border-red-500/40 text-red-600 hover:bg-red-50 text-xs font-bold"
                      >
                        ✕ Reject
                      </Button>
                    </div>
                  ) : t.refundStatus === "refunded" || t.status === "solved" ? (
                    <Badge className="bg-emerald-500 text-white font-extrabold text-xs">
                      ✓ Refund Completed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-red-500/40 text-red-500 font-extrabold text-xs">
                      ❌ Rejected
                    </Badge>
                  )}
                </div>

                {/* Reject Form Modal Overlay / Expand */}
                {rejectingId === t.id && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-red-600">Enter Rejection Reason for Customer:</p>
                    <Input
                      placeholder="Reason for rejecting refund (e.g. Photo proof invalid / item not damaged)..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="text-xs"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)} className="h-7 text-xs">
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          updateMutation.mutate({
                            id: t.id,
                            status: "closed",
                            adminNotes: `❌ Refund Rejected by Staff: ${rejectReason || "Photo proof or claim verified invalid."}`,
                          })
                        }
                        className="h-7 text-xs font-bold"
                      >
                        Confirm Reject
                      </Button>
                    </div>
                  </div>
                )}

                {/* Admin Resolution Notes */}
                {t.adminNotes && editingId !== t.id && (
                  <div className="text-xs bg-secondary/50 border border-border p-2.5 rounded-xl text-foreground">
                    <span className="font-bold text-primary">Staff Note:</span> {t.adminNotes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Lightbox Photo Preview Modal */}
        {previewPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewPhoto(null)}
          >
            <div className="relative max-w-3xl max-h-[90vh] bg-card p-2 rounded-2xl border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full font-extrabold text-sm flex items-center justify-center shadow-lg"
              >
                ✕
              </button>
              <img src={previewPhoto} alt="Damage Proof Evidence" className="max-w-full max-h-[80vh] rounded-xl object-contain" />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
