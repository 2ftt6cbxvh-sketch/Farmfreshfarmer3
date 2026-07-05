import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Coupon } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function AdminCoupons() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("10");
  const [minOrder, setMinOrder] = useState("0");

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons"],
    queryFn: () => apiGet<Coupon[]>("/api/coupons"),
  });

  const create = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/coupons", {
        code: code.trim().toUpperCase(),
        discountPercent: parseFloat(discount) || 0,
        minOrder: parseFloat(minOrder) || 0,
        active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setOpen(false); setCode(""); setDiscount("10"); setMinOrder("0");
      toast({ title: "Coupon created" });
    },
    onError: () => toast({ title: "Could not create coupon", description: "Code may already exist.", variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: async (c: Coupon) => { await apiRequest("PATCH", `/api/coupons/${c.id}`, { active: !c.active }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/coupons"] }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/coupons/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/coupons"] }); toast({ title: "Coupon deleted" }); },
  });

  return (
    <AdminLayout title="Coupons">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Create discount codes customers can apply at checkout.</p>
        <Button onClick={() => setOpen(true)} data-testid="button-add-coupon"><Plus size={16} className="mr-1" /> New coupon</Button>
      </div>

      {isLoading ? <Skeleton className="h-48 rounded-xl" /> : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Code</th>
                <th className="p-3 font-semibold">Discount</th>
                <th className="p-3 font-semibold">Min order</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-card-border" data-testid={`row-coupon-${c.id}`}>
                  <td className="p-3 font-mono font-semibold">{c.code}</td>
                  <td className="p-3">{Number(c.discountPercent)}%</td>
                  <td className="p-3">{Number(c.minOrder) ? formatINR(Number(c.minOrder)) : "—"}</td>
                  <td className="p-3"><Badge variant={c.active ? "default" : "outline"}>{c.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggle.mutate(c)} data-testid={`button-toggle-${c.id}`}>{c.active ? "Disable" : "Enable"}</Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${c.code}?`)) del.mutate(c.id); }} data-testid={`button-delete-coupon-${c.id}`}><Trash2 size={15} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No coupons yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New coupon</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Coupon code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. FRESH10" data-testid="input-coupon-code" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount %</Label>
                <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} data-testid="input-coupon-discount" />
              </div>
              <div>
                <Label>Min order (₹)</Label>
                <Input type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} data-testid="input-coupon-minorder" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !code.trim()} data-testid="button-save-coupon">{create.isPending ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
