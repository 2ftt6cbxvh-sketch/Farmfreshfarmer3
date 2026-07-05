import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Eye, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Product } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Subscription {
  id: number; userId: number; planId: number; status: string; deliveryDays: string;
  weeklyPrice: string; startDate: string; nextDeliveryDate: string | null;
  customer: { id: number; name: string; email: string } | null;
}
interface SubItem { id: number; productId: number; qty: number; }
interface Cycle { id: number; deliveryDate: string; deliveryDay: string; status: string; amount: string; }
interface SubStatusLog { id: number; status: string; note: string | null; createdAt: string; actorType: string; }
interface SubDetail { subscription: Subscription; items: SubItem[]; cycles: Cycle[]; statusLogs: SubStatusLog[]; }

interface Plan {
  id: number; name: string; slug: string; description: string; price: string;
  deliveryDays: string; active: boolean; items: { productId: number; qty: number }[];
}

const SUB_STATUSES = ["pending", "active", "paused", "cancelled", "expired"];

interface PlanForm {
  id?: number;
  name: string;
  description: string;
  price: string;
  deliveryDays: string;
  active: boolean;
  items: { productId: number; qty: number }[];
}
const EMPTY_PLAN: PlanForm = { name: "", description: "", price: "", deliveryDays: "both", active: true, items: [] };

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const [tab, setTab] = useState("subscribers");

  /* -------- Subscribers -------- */
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [weeks, setWeeks] = useState("2");
  const [createOrders, setCreateOrders] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);

  const { data: subs = [], isLoading: subsLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/admin/subscriptions", statusFilter],
    queryFn: () => apiGet<Subscription[]>(`/api/admin/subscriptions${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const { data: detail, isLoading: detailLoading } = useQuery<SubDetail>({
    queryKey: ["/api/admin/subscriptions", detailId],
    queryFn: () => apiGet<SubDetail>(`/api/admin/subscriptions/${detailId}`),
    enabled: detailId != null,
  });

  const generate = useMutation({
    mutationFn: async () => {
      return await (await apiRequest("POST", "/api/admin/subscriptions/generate-cycles", {
        weeks: parseInt(weeks) || 2,
        createOrders,
      })).json();
    },
    onSuccess: (data) => {
      setGenResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      toast({ title: "Cycles generated" });
    },
    onError: () => toast({ title: "Could not generate cycles", variant: "destructive" }),
  });

  /* -------- Plans -------- */
  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState<PlanForm>(EMPTY_PLAN);
  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/admin/plans"],
    queryFn: () => apiGet<Plan[]>("/api/admin/plans"),
  });
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", "all"],
    queryFn: () => apiGet<Product[]>("/api/products"),
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      const payload = {
        name: planForm.name.trim(),
        description: planForm.description.trim(),
        price: parseFloat(planForm.price) || 0,
        deliveryDays: planForm.deliveryDays,
        active: planForm.active,
        items: planForm.items,
      };
      if (planForm.id) {
        await apiRequest("PATCH", `/api/admin/plans/${planForm.id}`, payload);
      } else {
        await apiRequest("POST", "/api/admin/plans", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setPlanOpen(false);
      setPlanForm(EMPTY_PLAN);
      toast({ title: planForm.id ? "Plan updated" : "Plan created" });
    },
    onError: () => toast({ title: "Could not save plan", variant: "destructive" }),
  });

  const togglePlanActive = useMutation({
    mutationFn: async (p: Plan) => { await apiRequest("PATCH", `/api/admin/plans/${p.id}`, { active: !p.active }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] }),
  });

  const delPlan = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/plans/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] }); toast({ title: "Plan deleted" }); },
  });

  function openAddPlan() { setPlanForm(EMPTY_PLAN); setPlanOpen(true); }
  function openEditPlan(p: Plan) {
    setPlanForm({ id: p.id, name: p.name, description: p.description, price: String(p.price), deliveryDays: p.deliveryDays, active: p.active, items: p.items.map((i) => ({ productId: i.productId, qty: i.qty })) });
    setPlanOpen(true);
  }
  function addPlanItem() {
    if (products.length === 0) return;
    setPlanForm((f) => ({ ...f, items: [...f.items, { productId: products[0].id, qty: 1 }] }));
  }
  function updatePlanItem(idx: number, patch: Partial<{ productId: number; qty: number }>) {
    setPlanForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  }
  function removePlanItem(idx: number) {
    setPlanForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  return (
    <AdminLayout title="Subscriptions">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="tabs-subscriptions" className="mb-4">
          <TabsTrigger value="subscribers" data-testid="tab-subscribers">Subscribers</TabsTrigger>
          <TabsTrigger value="plans" data-testid="tab-plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-sub-status-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {SUB_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { setGenResult(null); setGenOpen(true); }} data-testid="button-generate-cycles">
              <RefreshCw size={15} className="mr-1" /> Generate upcoming cycles
            </Button>
          </div>

          {subsLoading ? <Skeleton className="h-64 rounded-xl" /> : (
            <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr>
                    <th className="p-3 font-semibold">ID</th>
                    <th className="p-3 font-semibold">Customer</th>
                    <th className="p-3 font-semibold">Weekly price</th>
                    <th className="p-3 font-semibold">Delivery days</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id} className="border-t border-card-border" data-testid={`row-subscription-${s.id}`}>
                      <td className="p-3 font-semibold">#{s.id}</td>
                      <td className="p-3">{s.customer ? `${s.customer.name} (${s.customer.email})` : "—"}</td>
                      <td className="p-3">{formatINR(Number(s.weeklyPrice))}</td>
                      <td className="p-3 text-muted-foreground capitalize">{s.deliveryDays}</td>
                      <td className="p-3"><Badge variant={s.status === "active" ? "default" : "outline"}>{s.status}</Badge></td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" onClick={() => setDetailId(s.id)} data-testid={`button-view-sub-${s.id}`}><Eye size={15} /></Button>
                      </td>
                    </tr>
                  ))}
                  {subs.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No subscriptions found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="plans">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">Weekly box plans customers can subscribe to.</p>
            <Button onClick={openAddPlan} data-testid="button-add-plan"><Plus size={16} className="mr-1" /> New plan</Button>
          </div>
          {plansLoading ? <Skeleton className="h-64 rounded-xl" /> : (
            <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr>
                    <th className="p-3 font-semibold">Name</th>
                    <th className="p-3 font-semibold">Price</th>
                    <th className="p-3 font-semibold">Delivery days</th>
                    <th className="p-3 font-semibold">Items</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id} className="border-t border-card-border" data-testid={`row-plan-${p.id}`}>
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3">{formatINR(Number(p.price))}</td>
                      <td className="p-3 text-muted-foreground capitalize">{p.deliveryDays}</td>
                      <td className="p-3 text-muted-foreground">{p.items.length}</td>
                      <td className="p-3">
                        <button onClick={() => togglePlanActive.mutate(p)} data-testid={`button-toggle-plan-${p.id}`}>
                          <Badge variant={p.active ? "default" : "outline"}>{p.active ? "Active" : "Inactive"}</Badge>
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditPlan(p)} data-testid={`button-edit-plan-${p.id}`}><Pencil size={15} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${p.name}?`)) delPlan.mutate(p.id); }} data-testid={`button-delete-plan-${p.id}`}><Trash2 size={15} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {plans.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No plans yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Subscription detail dialog */}
      <Dialog open={detailId != null} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-2xl">
          <DialogHeader><DialogTitle>Subscription #{detailId}</DialogTitle></DialogHeader>
          {detailLoading || !detail ? <Skeleton className="h-64 rounded-lg" /> : (
            <div className="space-y-5">
              <div className="text-sm">
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">{detail.subscription.customer ? `${detail.subscription.customer.name} (${detail.subscription.customer.email})` : "—"}</p>
                <Badge variant={detail.subscription.status === "active" ? "default" : "outline"} className="mt-1">{detail.subscription.status}</Badge>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-2">Items</h3>
                <ul className="text-sm space-y-1">
                  {detail.items.map((it) => {
                    const prod = products.find((p) => p.id === it.productId);
                    return <li key={it.id}>{it.qty} × {prod?.name ?? `Product #${it.productId}`}</li>;
                  })}
                  {detail.items.length === 0 && <p className="text-muted-foreground">No items.</p>}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-2">Delivery cycles</h3>
                <ul className="space-y-1 text-sm" data-testid="list-cycles">
                  {detail.cycles.map((c) => (
                    <li key={c.id} className="flex justify-between border-b border-card-border pb-1">
                      <span>{c.deliveryDay} — {new Date(c.deliveryDate).toLocaleDateString("en-IN")}</span>
                      <span className="flex items-center gap-2"><Badge variant="outline">{c.status}</Badge> {formatINR(Number(c.amount))}</span>
                    </li>
                  ))}
                  {detail.cycles.length === 0 && <p className="text-muted-foreground">No cycles generated yet.</p>}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-2">Status timeline</h3>
                <ul className="space-y-2 text-sm">
                  {detail.statusLogs.map((log) => (
                    <li key={log.id} className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div>
                        <p className="font-medium">{log.status} <span className="text-xs text-muted-foreground">({log.actorType})</span></p>
                        {log.note && <p className="text-muted-foreground">{log.note}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                      </div>
                    </li>
                  ))}
                  {detail.statusLogs.length === 0 && <p className="text-muted-foreground">No status history.</p>}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate cycles dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate upcoming Sat/Sun cycles</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Weeks ahead</Label>
              <Input type="number" value={weeks} onChange={(e) => setWeeks(e.target.value)} data-testid="input-weeks" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={createOrders} onCheckedChange={setCreateOrders} data-testid="switch-create-orders" />
              <Label>Also create orders for generated cycles</Label>
            </div>
            {genResult && (
              <div className="rounded-lg bg-secondary p-3 text-sm" data-testid="text-generate-result">
                <pre className="whitespace-pre-wrap">{JSON.stringify(genResult, null, 2)}</pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Close</Button>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending} data-testid="button-run-generate">
              {generate.isPending ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan create/edit dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{planForm.id ? "Edit plan" : "New plan"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} data-testid="input-plan-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} data-testid="input-plan-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Weekly price (₹)</Label>
                <Input type="number" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} data-testid="input-plan-price" />
              </div>
              <div>
                <Label>Delivery days</Label>
                <Select value={planForm.deliveryDays} onValueChange={(v) => setPlanForm({ ...planForm, deliveryDays: v })}>
                  <SelectTrigger data-testid="select-plan-delivery-days"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saturday">Saturday</SelectItem>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={planForm.active} onCheckedChange={(v) => setPlanForm({ ...planForm, active: v })} data-testid="switch-plan-active" />
              <Label>Active</Label>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Box items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPlanItem} data-testid="button-add-plan-item"><Plus size={14} className="mr-1" /> Add item</Button>
              </div>
              <div className="space-y-2">
                {planForm.items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2" data-testid={`plan-item-row-${idx}`}>
                    <Select value={String(it.productId)} onValueChange={(v) => updatePlanItem(idx, { productId: Number(v) })}>
                      <SelectTrigger className="flex-1" data-testid={`select-plan-item-product-${idx}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" className="w-20" value={it.qty} onChange={(e) => updatePlanItem(idx, { qty: parseInt(e.target.value) || 1 })} data-testid={`input-plan-item-qty-${idx}`} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removePlanItem(idx)} data-testid={`button-remove-plan-item-${idx}`}><Trash2 size={14} /></Button>
                  </div>
                ))}
                {planForm.items.length === 0 && <p className="text-sm text-muted-foreground">No items added yet.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>Cancel</Button>
            <Button onClick={() => savePlan.mutate()} disabled={savePlan.isPending || !planForm.name || !planForm.price} data-testid="button-save-plan">
              {savePlan.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
