import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Package, Camera, AlertTriangle, CheckCircle, X, FileText } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/store";
import { apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Order } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TaxInvoiceModal } from "@/components/TaxInvoiceModal";

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Delivered") return "default";
  if (status === "Cancelled") return "outline";
  return "secondary";
}

export default function Orders() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [billOrderId, setBillOrderId] = useState<number | null>(null);
  const [reason, setReason] = useState("Damaged or Spoiled Perishables");
  const [comments, setComments] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/mine"],
    queryFn: () => apiGet<Order[]>("/api/orders/mine"),
    enabled: !!user,
    refetchInterval: 3000, // Live automatic sync every 3s!
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "Photo File Too Large",
        description: "Please upload an image smaller than 15MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitRefund = async () => {
    if (!activeOrder) return;
    if (!photoDataUrl) {
      toast({
        title: "📸 Compulsory Photo Proof Required",
        description: "Please select a clear photo of the damaged/delivered produce before submitting.",
        variant: "destructive",
      });
      return;
    }
    if (!comments.trim()) {
      toast({
        title: "Reason Description Required",
        description: "Please describe the issue with your order.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${activeOrder.id}/request-refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: user?.name || activeOrder.customerName || "",
          customerPhone: activeOrder.phone || "",
          customerEmail: user?.email || activeOrder.customerEmail || "",
          concern: `${reason}: ${comments.trim()}`,
          photoUrl: photoDataUrl,
          refundAmount: activeOrder.total,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit refund request.");

      toast({
        title: "Refund Request Submitted! ✅",
        description: data.message || `Request for Order #${activeOrder.id} received.`,
      });

      setActiveOrder(null);
      setComments("");
      setPhotoDataUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/orders/mine"] });
    } catch (err: any) {
      toast({
        title: "Submission Error ❌",
        description: err.message || "Could not submit refund request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!loading && !user) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <Package className="mx-auto text-muted-foreground" size={44} />
          <h1 className="font-serif text-2xl font-bold mt-4">Please log in</h1>
          <p className="text-muted-foreground mt-2">Log in to see your order history.</p>
          <Link href="/login" className="inline-block mt-6 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover-elevate">Log in</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-6">My orders</h1>
        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-card-border bg-card p-10 text-center">
            <p className="text-muted-foreground">You haven't placed any orders yet.</p>
            <Link href="/" className="text-primary underline mt-2 inline-block">Start shopping</Link>
          </div>
        ) : (
          <ul className="space-y-4" role="list">
            {orders.map((o) => (
              <li key={o.id} className="rounded-xl border border-card-border bg-card p-4 space-y-3" data-testid={`order-${o.id}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-base">Order #{o.id}</span>
                  <Badge variant={statusVariant(o.status)}>{o.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleString("en-IN")}</p>
                <div className="flex justify-between items-center pt-2 border-t border-card-border text-sm">
                  <span className="text-muted-foreground">{o.paymentMethod}{o.couponCode ? ` · ${o.couponCode}` : ""}</span>
                  <span className="font-bold text-base">{formatINR(Number(o.total))}</span>
                </div>

                <div className="flex justify-end items-center gap-2 pt-2 border-t border-card-border/60">
                  {/* View / Download Official Bill */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBillOrderId(o.id)}
                    className="border-sky-500/30 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/20 text-xs font-bold gap-1 rounded-xl"
                  >
                    <FileText size={13} /> View / Download Bill
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveOrder(o)}
                    className="border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-bold gap-1 rounded-xl"
                  >
                    <Camera size={13} /> Request Return / Refund
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Official Tax Invoice / Bill Modal */}
      <TaxInvoiceModal
        orderId={billOrderId}
        open={billOrderId != null}
        onOpenChange={(v) => !v && setBillOrderId(null)}
        isAdmin={false}
      />

      {/* Compulsory Photo Proof Refund Modal */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setActiveOrder(null)}
              className="absolute top-4 right-4 p-1 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>

            <div>
              <h3 className="font-serif text-xl font-bold flex items-center gap-2 text-foreground">
                <Camera className="text-red-500" size={20} /> Request Order Return & Refund
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Order #{activeOrder.id} · Total {formatINR(Number(activeOrder.total))}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1.5">Select Issue Category:</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-input bg-background text-xs font-semibold"
                >
                  <option value="Damaged or Spoiled Perishables">🥦 Damaged or Spoiled Perishables</option>
                  <option value="Quality Issue / Rotten Items">🥭 Quality Issue / Rotten Produce</option>
                  <option value="Wrong Items Delivered">📦 Wrong Items Delivered</option>
                  <option value="Severe Delivery Delay">⏰ Severe Delivery Delay</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-red-500 block mb-1">
                  📸 Damage Photo Proof (COMPULSORY *):
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Attach a clear photo of the damaged produce item or package proof. Requests without photo proof cannot be processed.
                </p>

                {photoDataUrl ? (
                  <div className="space-y-2">
                    <img
                      src={photoDataUrl}
                      alt="Damage Proof"
                      className="w-full h-40 object-cover rounded-xl border border-emerald-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoDataUrl("")}
                      className="text-xs text-red-500 font-bold hover:underline"
                    >
                      ✕ Remove & Choose Different Photo
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-red-500/40 rounded-xl bg-red-500/5 hover:bg-red-500/10 cursor-pointer transition-all">
                    <Camera className="text-red-500 mb-1" size={24} />
                    <span className="font-bold text-red-600 text-xs">+ Upload Damage Photo Proof (Required)</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Click to choose image file</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                      required
                    />
                  </label>
                )}
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Issue Details / Comments:</label>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Describe what was damaged or wrong with your delivery..."
                  className="text-xs rounded-xl"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => setActiveOrder(null)} size="sm" className="text-xs">
                Cancel
              </Button>
              <Button
                onClick={handleSubmitRefund}
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md"
                size="sm"
              >
                {isSubmitting ? "Submitting..." : "Submit Refund Request & Photo Proof"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
