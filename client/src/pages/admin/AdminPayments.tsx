import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Payment {
  id: number; orderId: number | null; userId: number | null; provider: string;
  merchantOrderId: string; providerTransactionId: string | null; amount: string;
  currency: string; status: string; method: string | null; createdAt: string;
}

const STATUSES = ["all", "pending", "success", "failed", "refunded"];

function statusVariant(status: string): "default" | "destructive" | "outline" {
  if (status === "success") return "default";
  if (status === "failed") return "destructive";
  return "outline";
}

export default function AdminPayments() {
  const { toast } = useToast();
  const [tab, setTab] = useState("all");
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/admin/payments"],
    queryFn: () => apiGet<Payment[]>("/api/admin/payments"),
  });

  const refund = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/payments/${refundTarget!.merchantOrderId}/refund`, {
        amount: amount ? Number(amount) : undefined,
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      setRefundTarget(null);
      setAmount("");
      setReason("");
      toast({ title: "Refund initiated" });
    },
    onError: () => toast({ title: "Could not process refund", variant: "destructive" }),
  });

  const filtered = tab === "all" ? payments : payments.filter((p) => p.status === tab);

  return (
    <AdminLayout title="Payments">
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList data-testid="tabs-payment-status">
          {STATUSES.map((s) => <TabsTrigger key={s} value={s} data-testid={`tab-payment-${s}`}>{s}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Merchant order ID</th>
                <th className="p-3 font-semibold">Order</th>
                <th className="p-3 font-semibold">Amount</th>
                <th className="p-3 font-semibold">Method</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Created</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-card-border" data-testid={`row-payment-${p.id}`}>
                  <td className="p-3 font-mono text-xs">{p.merchantOrderId}</td>
                  <td className="p-3">{p.orderId != null ? `#${p.orderId}` : "—"}</td>
                  <td className="p-3 font-medium">{formatINR(Number(p.amount))}</td>
                  <td className="p-3 text-muted-foreground">{p.method || p.provider}</td>
                  <td className="p-3"><Badge variant={statusVariant(p.status)}>{p.status}</Badge></td>
                  <td className="p-3 text-muted-foreground">{new Date(p.createdAt).toLocaleString("en-IN")}</td>
                  <td className="p-3">
                    <div className="flex justify-end">
                      {p.status === "success" && (
                        <Button variant="outline" size="sm" onClick={() => { setRefundTarget(p); setAmount(""); setReason(""); }} data-testid={`button-refund-${p.id}`}>
                          <RotateCcw size={14} className="mr-1" /> Refund
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No payments found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={refundTarget != null} onOpenChange={(v) => !v && setRefundTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refund payment {refundTarget?.merchantOrderId}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Full amount: <span className="font-semibold text-foreground">{refundTarget ? formatINR(Number(refundTarget.amount)) : ""}</span></p>
            <div>
              <Label>Refund amount (leave blank for full refund)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={refundTarget?.amount} data-testid="input-refund-amount" />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} data-testid="input-refund-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (confirm("Confirm refund? This action cannot be undone.")) refund.mutate(); }}
              disabled={refund.isPending}
              data-testid="button-confirm-refund"
            >
              {refund.isPending ? "Processing…" : "Confirm refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
