import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ticket, Search, CheckCircle2, Clock, AlertCircle, Phone, Mail, User, MessageSquare, Filter, RefreshCw } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface SupportTicket {
  id: number;
  ticketId: string;
  userId?: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  concern: string;
  status: "open" | "under_solving" | "solved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  assignedAgentName?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Tickets" },
  { value: "open", label: "🔴 Open" },
  { value: "under_solving", label: "🟡 Under Solving" },
  { value: "solved", label: "🟢 Solved" },
  { value: "closed", label: "⚪ Closed" },
];

export default function AdminTickets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading, refetch } = useQuery<{ tickets: SupportTicket[] }>({
    queryKey: ["/api/admin/support-tickets", selectedStatus],
    queryFn: async () => {
      const url = selectedStatus === "all" ? "/api/admin/support-tickets" : `/api/admin/support-tickets?status=${selectedStatus}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` } });
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
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
      toast({ title: "Ticket Updated!", description: "Status and notes saved successfully." });
      setEditingId(null);
    },
  });

  const tickets = (data?.tickets || []).filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.ticketId.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      t.customerPhone.toLowerCase().includes(q) ||
      t.customerEmail.toLowerCase().includes(q) ||
      t.concern.toLowerCase().includes(q);
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
              <Ticket className="text-purple-600" /> Support Tickets Management
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              View and resolve customer support tickets submitted via Lakshmi AI &amp; website
            </p>
          </div>

          <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2">
            <RefreshCw size={14} /> Refresh List
          </Button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedStatus(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedStatus === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              placeholder="Search ID, name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>
        </div>

        {/* Tickets Grid / List */}
        {isLoading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border">
            <Ticket size={40} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="font-bold text-foreground">No Support Tickets Found</p>
            <p className="text-xs text-muted-foreground">No tickets match the selected status filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tickets.map((t) => (
              <div key={t.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-lg">
                      {t.ticketId}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Status Dropdown */}
                  <select
                    value={t.status}
                    onChange={(e) => updateMutation.mutate({ id: t.id, status: e.target.value })}
                    className={`text-xs font-extrabold px-2.5 py-1 rounded-xl border outline-none cursor-pointer ${
                      t.status === "open"
                        ? "bg-red-500/10 text-red-600 border-red-500/30"
                        : t.status === "under_solving"
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                        : t.status === "solved"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "bg-gray-500/10 text-gray-600 border-gray-500/30"
                    }`}
                  >
                    <option value="open">🔴 Open</option>
                    <option value="under_solving">🟡 Under Solving</option>
                    <option value="solved">🟢 Solved</option>
                    <option value="closed">⚪ Closed</option>
                  </select>
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

                {/* Concern */}
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Customer Concern:</p>
                  <p className="text-xs text-foreground bg-background p-3 rounded-xl border border-border whitespace-pre-wrap">
                    "{t.concern}"
                  </p>
                </div>

                {/* Admin Notes & Rep */}
                {t.adminNotes && editingId !== t.id && (
                  <div className="text-xs bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-700 dark:text-emerald-300">
                    <span className="font-bold">Staff Resolution Note:</span> {t.adminNotes}
                  </div>
                )}

                {/* Edit Notes Form */}
                {editingId === t.id ? (
                  <div className="space-y-2 pt-2">
                    <Textarea
                      placeholder="Enter resolution notes for customer..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="text-xs rounded-xl"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: t.id, adminNotes: notes })}
                        className="h-7 text-xs font-bold"
                      >
                        Save Note
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingId(t.id); setNotes(t.adminNotes || ""); }}
                    className="text-xs text-purple-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <MessageSquare size={12} /> {t.adminNotes ? "Edit Resolution Note" : "+ Add Staff Note"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
