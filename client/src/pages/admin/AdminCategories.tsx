import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import type { Category } from "@/lib/types";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Form {
  id?: number;
  name: string;
  slug: string;
  description: string;
  dietTag: string;
  parentId: string; // "none" sentinel or numeric string
  active: boolean;
  sortOrder: string;
}

const EMPTY: Form = { name: "", slug: "", description: "", dietTag: "none", parentId: "none", active: true, sortOrder: "0" };

export default function AdminCategories() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);

  const isPrimaryAdmin =
    user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    user?.isPrimaryAdmin === true ||
    (user?.role === "admin" && (user?.id === 1 || user?.id === 0));

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/admin/categories"],
    queryFn: () => apiGet<Category[]>("/api/admin/categories"),
    refetchInterval: 5000,
  });

  const byId = new Map(categories.map((c) => [c.id, c]));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        description: form.description.trim(),
        dietTag: form.dietTag,
        parentId: form.parentId === "none" ? null : Number(form.parentId),
        active: form.active,
        sortOrder: parseInt(form.sortOrder) || 0,
      };
      let res: any;
      if (form.id) {
        res = await apiRequest("PATCH", `/api/admin/categories/${form.id}`, payload);
      } else {
        res = await apiRequest("POST", "/api/admin/categories", payload);
      }
      return res?.json ? await res.json() : res;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/categories"] });
      setOpen(false);
      setForm(EMPTY);

      if (isPrimaryAdmin) {
        toast({ title: form.id ? "Category updated & live 🚀" : "Category published live 🚀" });
      } else {
        toast({
          title: "Sent for Super Admin Approval 📤",
          description: data?.message || "Category change submitted to Super Admin for review.",
        });
      }
    },
    onError: (err: any) => toast({ title: err?.message || "Could not save category", variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async (c: Category) => { await apiRequest("PATCH", `/api/admin/categories/${c.id}`, { active: !c.active }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/categories"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/categories/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category deleted" });
    },
    onError: (err: any) => toast({ title: err?.message || "Could not delete category", variant: "destructive" }),
  });

  function openAdd() { setForm(EMPTY); setOpen(true); }
  function openEdit(c: Category) {
    setForm({
      id: c.id, name: c.name, slug: c.slug, description: c.description, dietTag: c.dietTag,
      parentId: c.parentId != null ? String(c.parentId) : "none", active: c.active, sortOrder: String(c.sortOrder),
    });
    setOpen(true);
  }

  return (
    <AdminLayout title="Categories">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-sm text-muted-foreground">Organize the storefront catalog into parent/child categories.</p>
        <Button onClick={openAdd} data-testid="button-add-category">
          <Plus size={16} className="mr-1" /> Add category
        </Button>
      </div>

      {!isPrimaryAdmin && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-2">
          <Clock size={16} className="text-amber-500 shrink-0" />
          <span>
            <strong>Sub-Admin Moderation Notice:</strong> All category additions & edits require Super Admin approval. Clicking <strong>Submit for Approval</strong> will queue your changes for review.
          </span>
        </div>
      )}

      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Slug</th>
                <th className="p-3 font-semibold">Parent</th>
                <th className="p-3 font-semibold">Sort</th>
                <th className="p-3 font-semibold">Approval Status</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const status = (c as any).approvalStatus || "approved";
                return (
                  <tr key={c.id} className="border-t border-card-border" data-testid={`row-category-${c.id}`}>
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{c.slug}</td>
                    <td className="p-3 text-muted-foreground">{c.parentId != null ? (byId.get(c.parentId)?.name ?? `#${c.parentId}`) : "—"}</td>
                    <td className="p-3">{c.sortOrder}</td>
                    <td className="p-3">
                      {status === "approved" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-extrabold gap-1">
                          <CheckCircle2 size={12} /> Live Storefront
                        </Badge>
                      ) : status === "pending" || status === "under_review" ? (
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-extrabold animate-pulse gap-1">
                          <Clock size={12} /> Sent for Approval ⏳
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[11px] font-extrabold gap-1">
                          <AlertCircle size={12} /> Rejected
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} data-testid={`button-edit-category-${c.id}`}><Pencil size={15} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${c.name}?`)) del.mutate(c.id); }} data-testid={`button-delete-category-${c.id}`}><Trash2 size={15} /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No categories yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit category" : "Add category"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-category-name" />
            </div>
            <div>
              <Label>Slug (optional, auto-generated if blank)</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="e.g. fresh-fruits" data-testid="input-category-slug" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-category-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Parent category</Label>
                <Select value={form.parentId} onValueChange={(v) => setForm({ ...form, parentId: v })}>
                  <SelectTrigger data-testid="select-parent-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (top-level)</SelectItem>
                    {categories.filter((c) => c.id !== form.id).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Diet tag</Label>
                <Select value={form.dietTag} onValueChange={(v) => setForm({ ...form, dietTag: v })}>
                  <SelectTrigger data-testid="select-diet-tag"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="veg">Veg</SelectItem>
                    <SelectItem value="nonveg">Non-veg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Sort order</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} data-testid="input-sort-order" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="switch-category-active" />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.name.trim()}
              className={isPrimaryAdmin ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold" : "bg-amber-600 hover:bg-amber-700 text-white font-bold"}
              data-testid="button-save-category"
            >
              {save.isPending
                ? (isPrimaryAdmin ? "Publishing…" : "Submitting…")
                : (isPrimaryAdmin ? "Save & Publish Live 🚀" : "Submit for Approval 📤")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
