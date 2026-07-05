import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Order } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    queryFn: () => apiGet<Order[]>("/api/orders"),
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
                <tr key={o.id} className="border-t border-card-border" data-testid={`row-order-${o.id}`}>
                  <td className="p-3 font-semibold">#{o.id}</td>
                  <td className="p-3">{o.customerName}</td>
                  <td className="p-3 font-medium">{formatINR(Number(o.total))}</td>
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
                  <td className="p-3">
                    <Button variant="ghost" size="icon" onClick={() => setDetailId(o.id)} data-testid={`button-view-order-${o.id}`}>
                      <Eye size={15} />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No orders match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={detailId != null} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-2xl">
          <DialogHeader><DialogTitle>Order #{detailId}</DialogTitle></DialogHeader>
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
