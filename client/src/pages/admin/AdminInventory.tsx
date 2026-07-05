import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { History, Boxes } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import type { Product } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Adjustment {
  id: number;
  productId: number;
  changeQty: number;
  reason: string;
  previousStock: number;
  newStock: number;
  note: string | null;
  createdAt: string;
}

export default function AdminInventory() {
  const { toast } = useToast();
  const [tab, setTab] = useState("all");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [changeQty, setChangeQty] = useState("0");
  const [reason, setReason] = useState("manual");
  const [note, setNote] = useState("");

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", "all"],
    queryFn: () => apiGet<Product[]>("/api/products"),
  });
  const { data: lowStock = [], isLoading: lowLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/inventory/low-stock"],
    queryFn: () => apiGet<Product[]>("/api/admin/inventory/low-stock"),
  });

  const { data: adjustments = [], isLoading: adjLoading } = useQuery<Adjustment[]>({
    queryKey: ["/api/admin/inventory", activeProduct?.id, "adjustments"],
    queryFn: () => apiGet<Adjustment[]>(`/api/admin/inventory/${activeProduct!.id}/adjustments`),
    enabled: historyOpen && !!activeProduct,
  });

  const adjust = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/inventory/${activeProduct!.id}/adjust`, {
        changeQty: parseInt(changeQty) || 0,
        reason,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory/low-stock"] });
      setAdjustOpen(false);
      setChangeQty("0");
      setNote("");
      toast({ title: "Stock adjusted" });
    },
    onError: () => toast({ title: "Could not adjust stock", variant: "destructive" }),
  });

  function openAdjust(p: Product) { setActiveProduct(p); setChangeQty("0"); setReason("manual"); setNote(""); setAdjustOpen(true); }
  function openHistory(p: Product) { setActiveProduct(p); setHistoryOpen(true); }

  const list = tab === "low" ? lowStock : products;
  const loading = tab === "low" ? lowLoading : isLoading;

  return (
    <AdminLayout title="Inventory">
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList data-testid="tabs-inventory">
          <TabsTrigger value="all" data-testid="tab-all-products">All products</TabsTrigger>
          <TabsTrigger value="low" data-testid="tab-low-stock">Low stock ({lowStock.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Product</th>
                <th className="p-3 font-semibold">Stock</th>
                <th className="p-3 font-semibold">Low-stock threshold</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const low = p.stock <= p.lowStockThreshold;
                return (
                  <tr key={p.id} className="border-t border-card-border" data-testid={`row-inventory-${p.id}`}>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">
                      <span className={low ? "text-destructive font-semibold" : ""}>{p.stock}</span>
                      {low && <Badge variant="destructive" className="ml-2">Low</Badge>}
                    </td>
                    <td className="p-3 text-muted-foreground">{p.lowStockThreshold}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openHistory(p)} data-testid={`button-history-${p.id}`}>
                          <History size={14} className="mr-1" /> History
                        </Button>
                        <Button size="sm" onClick={() => openAdjust(p)} data-testid={`button-adjust-${p.id}`}>
                          <Boxes size={14} className="mr-1" /> Adjust
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No products found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust stock — {activeProduct?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Current stock: <span className="font-semibold text-foreground">{activeProduct?.stock}</span></p>
            <div>
              <Label>Change quantity (use negative to reduce)</Label>
              <Input type="number" value={changeQty} onChange={(e) => setChangeQty(e.target.value)} data-testid="input-change-qty" />
            </div>
            <div>
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger data-testid="select-reason"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="restock">Restock</SelectItem>
                  <SelectItem value="correction">Correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-adjust-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button onClick={() => adjust.mutate()} disabled={adjust.isPending || !parseInt(changeQty)} data-testid="button-save-adjust">
              {adjust.isPending ? "Saving…" : "Apply adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Adjustment history — {activeProduct?.name}</DialogTitle></DialogHeader>
          {adjLoading ? <Skeleton className="h-32 rounded-lg" /> : adjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No adjustments recorded yet.</p>
          ) : (
            <ul className="space-y-2" data-testid="list-adjustments">
              {adjustments.map((a) => (
                <li key={a.id} className="rounded-lg border border-card-border p-3 text-sm" data-testid={`adjustment-${a.id}`}>
                  <div className="flex items-center justify-between">
                    <span className={a.changeQty > 0 ? "font-semibold text-primary" : "font-semibold text-destructive"}>
                      {a.changeQty > 0 ? `+${a.changeQty}` : a.changeQty}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">{a.reason}{a.note ? ` — ${a.note}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{a.previousStock} → {a.newStock}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
