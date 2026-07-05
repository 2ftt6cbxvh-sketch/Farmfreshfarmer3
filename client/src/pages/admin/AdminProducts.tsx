import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Upload, Search } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient, imgUrl } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Product, Category } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Form {
  id?: number;
  name: string;
  description: string;
  categorySlug: string;
  price: string;
  discountPercent: string;
  unit: string;
  image: string;
  stock: string;
  dietTag: string;
  featured: boolean;
}

const EMPTY: Form = {
  name: "", description: "", categorySlug: "", price: "", discountPercent: "0",
  unit: "250 Grams", image: "", stock: "50", dietTag: "none", featured: false,
};

export default function AdminProducts() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", "all"],
    queryFn: () => apiGet<Product[]>("/api/products"),
  });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        categorySlug: form.categorySlug,
        price: parseFloat(form.price) || 0,
        discountPercent: parseFloat(form.discountPercent) || 0,
        unit: form.unit.trim() || "250 Grams",
        image: form.image.trim(),
        stock: parseInt(form.stock) || 0,
        dietTag: form.dietTag,
        featured: form.featured,
      };
      if (form.id) {
        await apiRequest("PATCH", `/api/products/${form.id}`, payload);
      } else {
        await apiRequest("POST", "/api/products", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setOpen(false);
      setForm(EMPTY);
      toast({ title: form.id ? "Product updated" : "Product added" });
    },
    onError: () => toast({ title: "Could not save product", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/products/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product deleted" });
    },
    onError: () => toast({ title: "Could not delete", variant: "destructive" }),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const base = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
      const res = await fetch(`${base}/api/upload`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("upload failed");
      const data = await res.json();
      setForm((f) => ({ ...f, image: data.url }));
      toast({ title: "Image uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function openAdd() { setForm(EMPTY); setOpen(true); }
  function openEdit(p: Product) {
    setForm({
      id: p.id, name: p.name, description: p.description, categorySlug: p.categorySlug,
      price: String(p.price), discountPercent: String(p.discountPercent), unit: p.unit,
      image: p.image, stock: String(p.stock), dietTag: p.dietTag, featured: p.featured,
    });
    setOpen(true);
  }

  const filtered = products.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <AdminLayout title="Products">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="relative max-w-xs w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products…" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="input-filter" />
        </div>
        <Button onClick={openAdd} data-testid="button-add-product"><Plus size={16} className="mr-1" /> Add product</Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Product</th>
                <th className="p-3 font-semibold">Category</th>
                <th className="p-3 font-semibold">Price</th>
                <th className="p-3 font-semibold">Disc.</th>
                <th className="p-3 font-semibold">Stock</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-card-border" data-testid={`row-product-${p.id}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded bg-secondary overflow-hidden shrink-0">
                        {p.image ? <img src={imgUrl(p.image)} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <span className="font-medium">{p.name}</span>
                      {p.featured ? <span className="text-[10px] bg-accent/30 rounded px-1">Featured</span> : null}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{p.categorySlug}</td>
                  <td className="p-3">{formatINR(Number(p.price))}</td>
                  <td className="p-3">{Number(p.discountPercent) ? `${Number(p.discountPercent)}%` : "—"}</td>
                  <td className="p-3">{p.stock}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`button-edit-${p.id}`}><Pencil size={15} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${p.name}?`)) del.mutate(p.id); }} data-testid={`button-delete-${p.id}`}><Trash2 size={15} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No products. Click "Add product" to create one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit product" : "Add product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-product-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-product-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.categorySlug} onValueChange={(v) => setForm({ ...form, categorySlug: v })}>
                  <SelectTrigger data-testid="select-category"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Diet tag</Label>
                <Select value={form.dietTag} onValueChange={(v) => setForm({ ...form, dietTag: v })}>
                  <SelectTrigger data-testid="select-diet"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="veg">Veg (green)</SelectItem>
                    <SelectItem value="nonveg">Non-veg (red)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Price (₹)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="input-price" />
              </div>
              <div>
                <Label>Discount %</Label>
                <Input type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} data-testid="input-discount" />
              </div>
              <div>
                <Label>Stock</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} data-testid="input-stock" />
              </div>
            </div>
            <div>
              <Label>Unit / pack size</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. 250 Grams, 1 Kg, 1 piece" data-testid="input-unit" />
            </div>
            <div>
              <Label>Product image</Label>
              <div className="flex items-center gap-3 mt-1">
                <div className="h-16 w-16 rounded bg-secondary overflow-hidden shrink-0">
                  {form.image ? <img src={imgUrl(form.image)} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="button-upload">
                  <Upload size={15} className="mr-1" /> {uploading ? "Uploading…" : "Upload image"}
                </Button>
              </div>
              <Input className="mt-2" placeholder="…or paste an image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} data-testid="input-image-url" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} data-testid="switch-featured" />
              <Label>Show on home page (featured)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.categorySlug || !form.price} data-testid="button-save-product">
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
