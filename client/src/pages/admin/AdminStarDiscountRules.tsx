import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, Plus, Trash2, Edit2, Save, X, Zap, Users, RotateCcw } from "lucide-react";
import { apiGet, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./AdminLayout";

interface StarDiscountRule {
  id: number;
  ruleType: "customer" | "staff";
  starFrom: number;
  starTo: number;
  discountPercent: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_CUSTOMER_RULES = [
  { ruleType: "customer" as const, starFrom: 1, starTo: 1, discountPercent: "2", description: "Bronze tier (1 star)", active: true },
  { ruleType: "customer" as const, starFrom: 2, starTo: 2, discountPercent: "5", description: "Silver tier (2 stars)", active: true },
  { ruleType: "customer" as const, starFrom: 3, starTo: 3, discountPercent: "8", description: "Gold tier (3 stars)", active: true },
  { ruleType: "customer" as const, starFrom: 4, starTo: 4, discountPercent: "12", description: "Platinum tier (4 stars)", active: true },
  { ruleType: "customer" as const, starFrom: 5, starTo: 5, discountPercent: "15", description: "Diamond tier (5 stars)", active: true },
];

function StarRow({ count, color = "blue" }: { count: number; color?: "blue" | "gold" }) {
  const filled = Math.min(count, 5);
  const colorClass = color === "blue"
    ? "text-blue-400 drop-shadow-[0_0_4px_rgba(59,130,246,0.8)]"
    : "text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]";
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: filled }, (_, i) => (
        <Star key={i} size={13} fill="currentColor" className={colorClass} />
      ))}
      {Array.from({ length: Math.max(0, 5 - filled) }, (_, i) => (
        <Star key={`e-${i}`} size={13} className="text-muted-foreground opacity-30" />
      ))}
    </span>
  );
}

export default function AdminStarDiscountRules() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<StarDiscountRule>>({});
  const [addForm, setAddForm] = useState({ ruleType: "customer", starFrom: 1, starTo: 1, discountPercent: "2", description: "", active: true });
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<"customer" | "staff">("customer");

  const { data: rules = [], isLoading } = useQuery<StarDiscountRule[]>({
    queryKey: ["/api/star-discount-rules"],
    queryFn: () => apiGet<StarDiscountRule[]>("/api/star-discount-rules"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/star-discount-rules"] });
    queryClient.invalidateQueries({ queryKey: ["/api/price/quote"] });
  };

  const createMut = useMutation({
    mutationFn: async (data: typeof addForm) => {
      const res = await apiRequest("POST", "/api/star-discount-rules", data);
      return res.json();
    },
    onSuccess: () => { invalidate(); setShowAdd(false); toast({ title: "Rule created! ✨" }); },
    onError: () => toast({ title: "Failed to create rule", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<StarDiscountRule> }) => {
      const res = await apiRequest("PATCH", `/api/star-discount-rules/${id}`, data);
      return res.json();
    },
    onSuccess: () => { invalidate(); setEditingId(null); toast({ title: "Rule updated!" }); },
    onError: () => toast({ title: "Failed to update rule", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/star-discount-rules/${id}`);
    },
    onSuccess: () => { invalidate(); toast({ title: "Rule deleted" }); },
    onError: () => toast({ title: "Failed to delete rule", variant: "destructive" }),
  });

  const resetDefaultsMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/star-discount-rules/reset-defaults", {});
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Rules reset to 1–5 Star Scale! 🌟" }); },
    onError: () => toast({ title: "Failed to reset rules", variant: "destructive" }),
  });

  const seedDefaults = async () => {
    for (const rule of DEFAULT_CUSTOMER_RULES) {
      await apiRequest("POST", "/api/star-discount-rules", rule).catch(() => {});
    }
    invalidate();
    toast({ title: "Default rules seeded! 🌟" });
  };

  const filteredRules = rules.filter(r => r.ruleType === activeTab);

  return (
    <AdminLayout title="Star Discount Rules">
      <div className="p-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="text-amber-400" size={24} /> Star Discount Rules
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Configure automatic discounts applied based on customer loyalty stars (1–5 Stars) or staff authorization levels.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => resetDefaultsMut.mutate()}
              disabled={resetDefaultsMut.isPending}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 text-amber-500 hover:text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/25 transition-all flex items-center gap-1.5"
              title="Reset rules to standard 1–5 Star Tiers"
            >
              <RotateCcw size={13} /> Reset 1–5 Star Tiers
            </button>
            <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-blue-500 transition-all">
              <Plus size={15} /> Add Rule
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["customer", "staff"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-card-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "customer" ? <span className="flex items-center gap-1.5"><Users size={13} /> Customer Stars</span> : <span className="flex items-center gap-1.5"><Zap size={13} /> Staff Stars</span>}
            </button>
          ))}
        </div>

        {/* Visual tiers preview */}
        <div className="mb-6 rounded-2xl border border-card-border bg-card/50 p-4">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Active {activeTab === 'customer' ? 'Customer Loyalty' : 'Staff Authorization'} Tiers</h2>
          <div className="flex flex-wrap gap-3">
            {filteredRules.filter(r => r.active).map(r => (
              <div key={r.id} className="flex flex-col items-center gap-1 rounded-xl bg-gradient-to-b from-card to-card/50 border border-card-border px-4 py-3 min-w-[100px]">
                <StarRow count={r.starTo} color={activeTab === 'customer' ? 'blue' : 'gold'} />
                <span className="text-xs text-muted-foreground font-medium">{r.starTo} Star{r.starTo === 1 ? '' : 's'}</span>
                <span className="text-lg font-black text-primary">{r.discountPercent}%</span>
                <span className="text-xs text-muted-foreground">off</span>
              </div>
            ))}
            {filteredRules.filter(r => r.active).length === 0 && (
              <p className="text-sm text-muted-foreground">No active {activeTab} rules. Add one or seed defaults.</p>
            )}
          </div>
        </div>

        {/* Add Rule Form */}
        {showAdd && (
          <div className="mb-6 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5">
            <h3 className="font-semibold mb-4">New Rule</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <select
                  value={addForm.ruleType}
                  onChange={e => setAddForm(f => ({ ...f, ruleType: e.target.value }))}
                  className="w-full rounded-xl bg-card border border-card-border px-3 py-2 text-sm"
                >
                  <option value="customer">Customer</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Star From (1–5)</label>
                <input type="number" min={1} max={6} value={addForm.starFrom}
                  onChange={e => setAddForm(f => ({ ...f, starFrom: Number(e.target.value) }))}
                  className="w-full rounded-xl bg-card border border-card-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Star To (1–5)</label>
                <input type="number" min={1} max={6} value={addForm.starTo}
                  onChange={e => setAddForm(f => ({ ...f, starTo: Number(e.target.value) }))}
                  className="w-full rounded-xl bg-card border border-card-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Discount %</label>
                <input type="number" min={0} max={100} step={0.5} value={addForm.discountPercent}
                  onChange={e => setAddForm(f => ({ ...f, discountPercent: e.target.value }))}
                  className="w-full rounded-xl bg-card border border-card-border px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
                <input type="text" value={addForm.description}
                  onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Diamond tier (5 stars)"
                  className="w-full rounded-xl bg-card border border-card-border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl border border-card-border text-sm">Cancel</button>
              <button
                onClick={() => createMut.mutate(addForm as any)}
                disabled={createMut.isPending}
                className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500"
              >{createMut.isPending ? 'Saving...' : 'Create Rule'}</button>
            </div>
          </div>
        )}

        {/* Rules Table */}
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-16 rounded-xl bg-card/50 border border-card-border animate-pulse" />)}</div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center rounded-2xl border border-dashed border-card-border py-12 text-muted-foreground">
            <Star size={36} className="mx-auto mb-3 text-muted-foreground" />
            <p>No {activeTab} rules yet. Add one above or click "Seed Defaults".</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRules.map(rule => (
              <div key={rule.id} className="rounded-xl border border-card-border bg-card p-4 flex flex-wrap items-center gap-4">
                {editingId === rule.id ? (
                  <>
                    <input type="number" min={1} max={6} value={editForm.starFrom ?? rule.starFrom}
                      onChange={e => setEditForm(f => ({ ...f, starFrom: Number(e.target.value) }))}
                      className="w-16 rounded-lg bg-card border border-card-border px-2 py-1 text-sm" />
                    <span className="text-muted-foreground">to</span>
                    <input type="number" min={1} max={6} value={editForm.starTo ?? rule.starTo}
                      onChange={e => setEditForm(f => ({ ...f, starTo: Number(e.target.value) }))}
                      className="w-16 rounded-lg bg-card border border-card-border px-2 py-1 text-sm" />
                    <input type="number" min={0} max={100} step={0.5} value={editForm.discountPercent ?? rule.discountPercent}
                      onChange={e => setEditForm(f => ({ ...f, discountPercent: e.target.value }))}
                      className="w-20 rounded-lg bg-card border border-card-border px-2 py-1 text-sm" />
                    <span className="text-sm text-muted-foreground">%</span>
                    <input type="text" value={editForm.description ?? rule.description ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      className="flex-1 min-w-[120px] rounded-lg bg-card border border-card-border px-2 py-1 text-sm" />
                    <button onClick={() => updateMut.mutate({ id: rule.id, data: editForm })} className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"><Save size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg border border-card-border text-muted-foreground hover:text-foreground"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <StarRow count={rule.starTo} color={rule.ruleType === 'customer' ? 'blue' : 'gold'} />
                      <span className="text-sm text-muted-foreground">{rule.starTo} Star{rule.starTo === 1 ? '' : 's'}</span>
                    </div>
                    <span className="text-2xl font-black text-primary">{rule.discountPercent}%</span>
                    <span className="text-sm text-muted-foreground flex-1">{rule.description}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${ rule.active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30' }`}>{rule.active ? 'Active' : 'Inactive'}</span>
                    <button onClick={() => { setEditingId(rule.id); setEditForm(rule); }} className="p-1.5 rounded-lg border border-card-border text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                    <button onClick={() => deleteMut.mutate(rule.id)} className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
