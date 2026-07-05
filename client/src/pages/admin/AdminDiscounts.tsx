import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface DiscountRule {
  id: number; name: string; type: string; discountPercent: string; active: boolean;
  appliesTo: string; maxUsesPerCustomer: number; stackable: boolean;
}

interface Form {
  id?: number;
  name: string;
  type: string;
  discountPercent: string;
  appliesTo: string;
  maxUsesPerCustomer: string;
  stackable: boolean;
  active: boolean;
}

const EMPTY: Form = { name: "", type: "manual", discountPercent: "0", appliesTo: "all", maxUsesPerCustomer: "1", stackable: false, active: true };

const TYPE_LABELS: Record<string, string> = {
  first_order: "New customer's first order gets this % off.",
  referral_new: "New customer signed up via referral code gets this % off their first order.",
  referral_reward: "Referrer earns this % of the referred customer's qualifying order as reward credit.",
  manual: "General/manual promotional rule.",
};

export default function AdminDiscounts() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);

  const { data: rules = [], isLoading } = useQuery<DiscountRule[]>({
    queryKey: ["/api/admin/discounts"],
    queryFn: () => apiGet<DiscountRule[]>("/api/admin/discounts"),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        discountPercent: parseFloat(form.discountPercent) || 0,
        appliesTo: form.appliesTo,
        maxUsesPerCustomer: parseInt(form.maxUsesPerCustomer) || 1,
        stackable: form.stackable,
        active: form.active,
      };
      if (form.id) {
        await apiRequest("PATCH", `/api/admin/discounts/${form.id}`, payload);
      } else {
        await apiRequest("POST", "/api/admin/discounts", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discounts"] });
      setOpen(false);
      setForm(EMPTY);
      toast({ title: form.id ? "Rule updated" : "Rule created" });
    },
    onError: () => toast({ title: "Could not save discount rule", variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async (r: DiscountRule) => { await apiRequest("PATCH", `/api/admin/discounts/${r.id}`, { active: !r.active }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/discounts"] }),
  });

  function openAdd() { setForm(EMPTY); setOpen(true); }
  function openEdit(r: DiscountRule) {
    setForm({
      id: r.id, name: r.name, type: r.type, discountPercent: String(r.discountPercent),
      appliesTo: r.appliesTo, maxUsesPerCustomer: String(r.maxUsesPerCustomer), stackable: r.stackable, active: r.active,
    });
    setOpen(true);
  }

  return (
    <AdminLayout title="Discounts">
      <div className="rounded-xl border border-card-border bg-card p-4 mb-4 text-sm text-muted-foreground">
        These rules drive automatic business logic (first-order discount, referral rewards). Editing percentages here is business-critical — changes apply immediately to new orders.
      </div>
      <div className="flex justify-end mb-4">
        <Button onClick={openAdd} data-testid="button-add-discount"><Plus size={16} className="mr-1" /> New rule</Button>
      </div>

      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Discount %</th>
                <th className="p-3 font-semibold">Applies to</th>
                <th className="p-3 font-semibold">Max uses/customer</th>
                <th className="p-3 font-semibold">Stackable</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-card-border" data-testid={`row-discount-${r.id}`}>
                  <td className="p-3 font-medium">
                    {r.name}
                    <p className="text-xs text-muted-foreground font-normal">{TYPE_LABELS[r.type] ?? ""}</p>
                  </td>
                  <td className="p-3"><Badge variant="outline">{r.type}</Badge></td>
                  <td className="p-3 font-semibold">{Number(r.discountPercent)}%</td>
                  <td className="p-3 text-muted-foreground">{r.appliesTo}</td>
                  <td className="p-3">{r.maxUsesPerCustomer}</td>
                  <td className="p-3">{r.stackable ? "Yes" : "No"}</td>
                  <td className="p-3">
                    <button onClick={() => toggleActive.mutate(r)} data-testid={`button-toggle-discount-${r.id}`}>
                      <Badge variant={r.active ? "default" : "outline"}>{r.active ? "Active" : "Inactive"}</Badge>
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)} data-testid={`button-edit-discount-${r.id}`}><Pencil size={15} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No discount rules yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Edit discount rule" : "New discount rule"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-discount-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })} disabled={!!form.id}>
                  <SelectTrigger data-testid="select-discount-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_order">first_order</SelectItem>
                    <SelectItem value="referral_new">referral_new</SelectItem>
                    <SelectItem value="referral_reward">referral_reward</SelectItem>
                    <SelectItem value="manual">manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Discount %</Label>
                <Input type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} data-testid="input-discount-percent" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Applies to</Label>
                <Select value={form.appliesTo} onValueChange={(v) => setForm({ ...form, appliesTo: v })}>
                  <SelectTrigger data-testid="select-applies-to"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">all</SelectItem>
                    <SelectItem value="normal">normal</SelectItem>
                    <SelectItem value="subscription">subscription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max uses per customer</Label>
                <Input type="number" value={form.maxUsesPerCustomer} onChange={(e) => setForm({ ...form, maxUsesPerCustomer: e.target.value })} data-testid="input-max-uses" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.stackable} onCheckedChange={(v) => setForm({ ...form, stackable: v })} data-testid="switch-stackable" />
              <Label>Stackable with other discounts</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="switch-discount-active" />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name} data-testid="button-save-discount">
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
