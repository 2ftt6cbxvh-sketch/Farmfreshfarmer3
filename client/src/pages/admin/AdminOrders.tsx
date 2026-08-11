import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Eye, FileText, Trash2, AlertTriangle } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Order } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { TaxInvoiceModal } from "@/components/TaxInvoiceModal";

interface OrderItemRow { id: number; name: string; unit: string; price: string; qty: number; lineTotal: string; }
interface OrderDiscountRow { id: number; ruleType: string; label: string; amount: string; createdAt: string; }
interface OrderStatusLog { id: number; status: string; note: string | null; createdAt: string; }
interface OrderDetail { order: Order; items: OrderItemRow[]; discounts: OrderDiscountRow[]; statusLogs: OrderStatusLog[]; }

const STATUSES = ["Placed", "Packed", "Out for delivery", "Delivered", "Cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "Delivered") return "default";
  if (status === "Cancelled") return "destructive";
  return "secondary";
}

export default function AdminOrders() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [invoiceOrderId, setInvoiceOrderId] = useState<number | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    queryFn: () => apiGet<Order[]>("/api/orders"),
    refetchInterval: 2500, // Live automatic sync every 2.5s!
  });

  const { data: detail, isLoading: detailLoading } = useQuery<OrderDetail>({
    queryKey: ["/api/orders", detailId],
    queryFn: () => apiGet<OrderDetail>(`/api/orders/${detailId}`),
    enabled: detailId != null,
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/orders/${id}`, { status });
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", vars.id] });
      toast({ title: "Order updated" });
    },
    onError: () => toast({ title: "Could not update order", variant: "destructive" }),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/orders/${id}/hard-delete`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setDeleteOrderId(null);
      toast({ title: "🗑️ Deleted Out of Existence", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete order", description: err?.message || "Server error", variant: "destructive" });
    },
  });

  const filtered = orders.filter((o) =>
    (statusFilter === "all" || o.status === statusFilter) &&
    (paymentFilter === "all" || o.paymentStatus === paymentFilter)
  );

  return (
    <AdminLayout title="Orders">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger data-testid="select-filter-payment"><SelectValue placeholder="Payment status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payment statuses</SelectItem>
              {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Order</th>
                <th className="p-3 font-semibold">Customer</th>
                <th className="p-3 font-semibold">Total</th>
                <th className="p-3 font-semibold">Payment</th>
                <th className="p-3 font-semibold">Payment status</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Placed</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-card-border hover:bg-secondary/20 transition-colors" data-testid={`row-order-${o.id}`}>
                  <td className="p-3 font-semibold">#{o.id}</td>
                  <td className="p-3">
                    <p className="font-medium text-foreground">{o.customerName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{o.phone}</p>
                  </td>
                  <td className="p-3 font-medium text-emerald-500 font-mono">{formatINR(Number(o.total))}</td>
                  <td className="p-3 text-muted-foreground">{o.paymentMethod}</td>
                  <td className="p-3"><Badge variant="outline">{o.paymentStatus}</Badge></td>
                  <td className="p-3">
                    <div className="w-40">
                      <Select value={o.status} onValueChange={(v) => update.mutate({ id: o.id, status: v })}>
                        <SelectTrigger data-testid={`select-status-${o.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* GST Tax Invoice / Bill Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInvoiceOrderId(o.id)}
                        className="h-8 px-2.5 rounded-xl text-xs font-bold text-sky-400 hover:bg-sky-500/20 bg-sky-500/10 border border-sky-500/30 shadow-sm"
                        title="Generate, Preview and Edit Legal GST Tax Invoice Bill"
                      >
                        <FileText size={13} className="mr-1 text-sky-400" /> Generate Bill
                      </Button>

                      {/* Detail View Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailId(o.id)}
                        className="h-8 px-2 rounded-xl text-xs font-bold border border-border"
                        data-testid={`button-view-order-${o.id}`}
                        title="View Order Details"
                      >
                        <Eye size={13} className="mr-1" /> View
                      </Button>

                      {/* Delete Out of Existence Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteOrderId(o.id)}
                        className="h-8 px-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 border border-red-500/30"
                        title="Delete order out of existence permanently"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No orders match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Tax Invoice Modal for Super Admin (with Live Edit & Print) */}
      <TaxInvoiceModal
        orderId={invoiceOrderId}
        open={invoiceOrderId != null}
        onOpenChange={(v) => !v && setInvoiceOrderId(null)}
        isAdmin={true}
      />

      {/* Hard Delete Confirmation Dialog */}
      <Dialog open={deleteOrderId != null} onOpenChange={(v) => !v && setDeleteOrderId(null)}>
        <DialogContent className="max-w-md rounded-3xl border-red-500/40 bg-card p-6 shadow-2xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-2">
              <AlertTriangle size={24} />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Delete Order #{deleteOrderId} Out-of-Existence?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1.5 leading-relaxed">
              This action will <b>permanently erase Order #{deleteOrderId}</b>, its line items, status timelines, discount logs, and refund tickets from the database. 
              <br /><br />
              <span className="text-red-400 font-bold">⚠️ This cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOrderId(null)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={hardDeleteMutation.isPending}
              onClick={() => deleteOrderId && hardDeleteMutation.mutate(deleteOrderId)}
              className="rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs shadow-md"
            >
              {hardDeleteMutation.isPending ? "Erasing Order..." : "🗑️ Confirm Hard Deletion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailId != null} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>Order #{detailId}</DialogTitle>
              <Button
                size="sm"
                onClick={() => {
                  const targetId = detailId;
                  setDetailId(null);
                  setInvoiceOrderId(targetId);
                }}
                className="h-8 px-3 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm"
              >
                <FileText size={13} className="mr-1.5" /> Generate & Edit Bill
              </Button>
            </div>
          </DialogHeader>
          {detailLoading || !detail ? <Skeleton className="h-64 rounded-lg" /> : (
            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{detail.order.customerName} · {detail.order.phone}</p>
                  <p className="text-muted-foreground">{detail.order.address}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment</p>
                  <p className="font-medium">{detail.order.paymentMethod} · <Badge variant="outline">{detail.order.paymentStatus}</Badge></p>
                  <Badge variant={statusVariant(detail.order.status)} className="mt-1">{detail.order.status}</Badge>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2">Line items</h3>
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr><th className="py-1">Item</th><th className="py-1">Qty</th><th className="py-1">Price</th><th className="py-1 text-right">Line total</th></tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it) => (
                      <tr key={it.id} className="border-t border-card-border" data-testid={`order-item-${it.id}`}>
                        <td className="py-1.5">{it.name} <span className="text-muted-foreground text-xs">({it.unit})</span></td>
                        <td className="py-1.5">{it.qty}</td>
                        <td className="py-1.5">{formatINR(Number(it.price))}</td>
                        <td className="py-1.5 text-right">{formatINR(Number(it.lineTotal))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2">Discount breakdown</h3>
                <ul className="text-sm space-y-1">
                  <li className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(Number(detail.order.subtotal))}</span></li>
                  {Number(detail.order.firstOrderDiscount) > 0 && (
                    <li className="flex justify-between"><span className="text-muted-foreground">First-order discount</span><span>-{formatINR(Number(detail.order.firstOrderDiscount))}</span></li>
                  )}
                  {Number(detail.order.referralDiscount) > 0 && (
                    <li className="flex justify-between"><span className="text-muted-foreground">Referral discount</span><span>-{formatINR(Number(detail.order.referralDiscount))}</span></li>
                  )}
                  {Number(detail.order.referralRewardApplied) > 0 && (
                    <li className="flex justify-between"><span className="text-muted-foreground">Referral reward applied</span><span>-{formatINR(Number(detail.order.referralRewardApplied))}</span></li>
                  )}
                  {detail.discounts.map((d) => (
                    <li key={d.id} className="flex justify-between"><span className="text-muted-foreground">{d.label}</span><span>-{formatINR(Number(d.amount))}</span></li>
                  ))}
                  <li className="flex justify-between font-bold border-t border-card-border pt-1"><span>Total</span><span>{formatINR(Number(detail.order.total))}</span></li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2">Status timeline</h3>
                <ul className="space-y-2" data-testid="list-status-timeline">
                  {detail.statusLogs.map((log) => (
                    <li key={log.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div>
                        <p className="font-medium">{log.status}</p>
                        {log.note && <p className="text-muted-foreground">{log.note}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                      </div>
                    </li>
                  ))}
                  {detail.statusLogs.length === 0 && <p className="text-sm text-muted-foreground">No status history yet.</p>}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
