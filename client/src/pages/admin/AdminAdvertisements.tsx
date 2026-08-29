import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { apiGet, apiRequest, queryClient, imgUrl } from "@/lib/queryClient";
import type { Product } from "@/lib/types";
import { effectivePrice, formatINR } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, AlertTriangle, ShieldAlert, Plus, Trash2,
  CheckCircle2, Eye, EyeOff, Package, Megaphone, Search,
  Radio, Power, Edit3, X, Check
} from "lucide-react";
import type { AnnouncementItem } from "@/components/NotificationBell";

export default function AdminAdvertisements() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"advertisement" | "warning" | "critical">("advertisement");
  const [productId, setProductId] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showPopup, setShowPopup] = useState(true);
  const [priority, setPriority] = useState<number>(0);
  const [targetAudience, setTargetAudience] = useState("all");

  const { data: announcements = [], isLoading } = useQuery<AnnouncementItem[]>({
    queryKey: ["/api/admin/announcements"],
    queryFn: () => apiGet<AnnouncementItem[]>("/api/admin/announcements"),
    staleTime: 0,
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products", "admin_all"],
    queryFn: () => apiGet<Product[]>("/api/products?includeInactive=1&all=1"),
    staleTime: 0,
  });

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 50);
    const q = productSearch.toLowerCase();
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.categorySlug && p.categorySlug.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [products, productSearch]);

  const selectedProduct = useMemo(() => {
    if (!productId) return null;
    return products.find((p) => String(p.id) === String(productId)) || null;
  }, [products, productId]);

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      if (editingId) {
        const res = await apiRequest("PATCH", `/api/admin/announcements/${editingId}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/admin/announcements", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements/active"] });
      toast({
        title: editingId ? "✨ Advertisement Updated!" : "📢 Advertisement / Notice Published!",
        description: "Your changes are immediately active across the site.",
      });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Operation Failed", description: err?.message, variant: "destructive" });
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/announcements/${id}`, { isActive });
      return res.json();
    },
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/announcements"] });
      const previous = queryClient.getQueryData<AnnouncementItem[]>(["/api/admin/announcements"]);
      queryClient.setQueryData<AnnouncementItem[]>(["/api/admin/announcements"], (old = []) =>
        old.map((a) => (a.id === id ? { ...a, isActive } : a))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/admin/announcements"], context.previous);
      }
      toast({ title: "Update Failed", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements/active"] });
    },
    onSuccess: (_, vars) => {
      toast({
        title: vars.isActive ? "🟢 Advertisement is now LIVE!" : "⚪ Advertisement turned OFF",
        description: vars.isActive ? "Visitors will now see this broadcast." : "Ad is paused and hidden from visitors.",
      });
    },
  });

  const togglePopupMut = useMutation({
    mutationFn: async ({ id, showPopup }: { id: number; showPopup: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/announcements/${id}`, { showPopup });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements/active"] });
      toast({ title: "Popup setting updated" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/announcements/${id}`);
      return res.json();
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/announcements"] });
      const previous = queryClient.getQueryData<AnnouncementItem[]>(["/api/admin/announcements"]);
      queryClient.setQueryData<AnnouncementItem[]>(["/api/admin/announcements"], (old = []) =>
        old.filter((a) => a.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/admin/announcements"], context.previous);
      }
      toast({ title: "Delete Failed", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements/active"] });
    },
    onSuccess: () => {
      toast({ title: "🗑️ Announcement Deleted" });
    },
  });

  function resetForm() {
    setIsCreating(false);
    setEditingId(null);
    setTitle("");
    setMessage("");
    setCategory("advertisement");
    setProductId("");
    setProductSearch("");
    setShowProductDropdown(false);
    setShowPopup(true);
    setPriority(0);
    setTargetAudience("all");
  }

  function startEdit(item: AnnouncementItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setMessage(item.message);
    setCategory(item.category as any);
    setProductId(item.productId ? String(item.productId) : "");
    setShowPopup(Boolean(item.showPopup));
    setPriority(Number(item.priority || 0));
    setTargetAudience(item.targetAudience || "all");
    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      return toast({ title: "Title and message are required", variant: "destructive" });
    }

    createMut.mutate({
      title: title.trim(),
      message: message.trim(),
      category,
      productId: productId ? Number(productId) : null,
      showPopup,
      priority: Number(priority),
      targetAudience,
    });
  };

  return (
    <AdminLayout title="Advertisements & Broadcasts">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Publish marketing popups with live discounted products, emergency security alerts (Red), and operational announcements (Yellow).
            </p>
          </div>
          <Button
            onClick={() => {
              if (isCreating) resetForm();
              else setIsCreating(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl gap-2 shadow-md shrink-0"
          >
            {isCreating ? "✕ Cancel" : <><Plus size={16} /> New Broadcast / Ad</>}
          </Button>
        </div>

        {/* 📝 Create / Edit Broadcast Form */}
        {isCreating && (
          <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-card border border-emerald-500/40 shadow-xl space-y-4 animate-in fade-in duration-200">
            <h3 className="text-base font-black flex items-center gap-2 text-foreground">
              <Megaphone size={18} className="text-emerald-500" />
              <span>{editingId ? "Edit Advertisement / Broadcast" : "Create Site-Wide Broadcast"}</span>
            </h3>

            {/* Category Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Category Theme</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setCategory("advertisement")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    category === "advertisement"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 font-black ring-2 ring-emerald-500/30"
                      : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles size={18} className="text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">🟢 Advertisement</p>
                    <p className="text-[10px] opacity-70">Green promo with attached product card</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory("warning")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    category === "warning"
                      ? "bg-amber-500/20 border-amber-500 text-amber-400 font-black ring-2 ring-amber-500/30"
                      : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">🟡 Warning</p>
                    <p className="text-[10px] opacity-70">Yellow operational advisory</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory("critical")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    category === "critical"
                      ? "bg-red-500/20 border-red-500 text-red-400 font-black ring-2 ring-red-500/30"
                      : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ShieldAlert size={18} className="text-red-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">🔴 Critical Security</p>
                    <p className="text-[10px] opacity-70">Red high-priority notice</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Announcement Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Flash Sale: 75% Off Mango Pickles for 10 mins!"
                className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-secondary/50 border border-card-border text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Message / Details *</label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter promo details, discount highlights, or terms..."
                className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-secondary/50 border border-card-border text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* 🔍 Searchable Attached Product Selector (for Advertisements) */}
            {category === "advertisement" && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Attach Featured Product (Auto-updates with Live Discounts)</span>
                  {selectedProduct && (
                    <button
                      type="button"
                      onClick={() => setProductId("")}
                      className="text-[11px] text-red-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <X size={12} /> Remove Attachment
                    </button>
                  )}
                </label>

                {/* Selected Product Card Preview */}
                {selectedProduct ? (
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/40 flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      {selectedProduct.image ? (
                        <img
                          src={imgUrl(selectedProduct.image)}
                          alt={selectedProduct.name}
                          className="w-12 h-12 rounded-lg object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-emerald-950/40 flex items-center justify-center text-xl shrink-0">
                          🌱
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-foreground truncate">{selectedProduct.name}</p>
                          {Number(selectedProduct.discountPercent || 0) > 0 && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black">
                              {Math.round(Number(selectedProduct.discountPercent))}% OFF
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-black text-emerald-400">
                            {formatINR(effectivePrice(Number(selectedProduct.price), Number(selectedProduct.discountPercent || 0)))}
                          </span>
                          {Number(selectedProduct.discountPercent || 0) > 0 && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              {formatINR(Number(selectedProduct.price))}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">({selectedProduct.unit || "unit"})</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowProductDropdown(true)}
                      className="text-xs font-bold rounded-lg shrink-0"
                    >
                      Change Product
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={productSearch}
                          onFocus={() => setShowProductDropdown(true)}
                          onChange={(e) => {
                            setProductSearch(e.target.value);
                            setShowProductDropdown(true);
                          }}
                          placeholder="Type product name (e.g. Mango Pickle, Oil, Ghee)..."
                          className="w-full pl-9 pr-3.5 py-2.5 text-xs font-semibold rounded-xl bg-secondary/50 border border-card-border text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {showProductDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-64 overflow-y-auto rounded-xl bg-card border border-border shadow-2xl p-1 divide-y divide-border/40">
                        {isLoadingProducts ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">Loading catalog...</div>
                        ) : filteredProducts.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">No products found matching "{productSearch}"</div>
                        ) : (
                          filteredProducts.map((p) => {
                            const disc = Number(p.discountPercent || 0);
                            const eff = effectivePrice(Number(p.price), disc);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setProductId(String(p.id));
                                  setShowProductDropdown(false);
                                  setProductSearch("");
                                }}
                                className="w-full p-2.5 text-left rounded-lg hover:bg-secondary flex items-center justify-between gap-3 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {p.image ? (
                                    <img src={imgUrl(p.image)} alt="" className="w-9 h-9 rounded-md object-cover border border-border shrink-0" />
                                  ) : (
                                    <div className="w-9 h-9 rounded-md bg-emerald-950/30 flex items-center justify-center text-sm shrink-0">🌱</div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{p.categorySlug} • {p.unit || "unit"}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs font-black text-emerald-400">{formatINR(eff)}</p>
                                  {disc > 0 && (
                                    <p className="text-[9px] text-muted-foreground line-through">{formatINR(Number(p.price))}</p>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Checkbox Options */}
            <div className="flex flex-wrap items-center gap-6 pt-2">
              <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPopup}
                  onChange={(e) => setShowPopup(e.target.checked)}
                  className="rounded border-border text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Trigger Popup Modal for Site Visitors</span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Priority:</span>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  min={0}
                  max={10}
                  className="w-16 px-2 py-1 text-xs font-bold rounded-lg bg-secondary border border-border text-center"
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-card-border">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                disabled={createMut.isPending}
              >
                {createMut.isPending ? "Saving..." : editingId ? "Save Changes" : "Publish Broadcast"}
              </Button>
            </div>
          </form>
        )}

        {/* 📋 Announcements List with 1-Click Live Switchers */}
        <div className="rounded-2xl border border-card-border bg-card overflow-hidden shadow-sm">
          {isLoading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider">Live Status</th>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider">Type</th>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider">Title & Message</th>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider">Attached Product</th>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider">Popup Mode</th>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {announcements.map((item) => {
                    const isLive = Boolean(item.isActive);
                    return (
                      <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                        {/* ⚡ 1-Click LIVE / OFF LIVE Toggle Button */}
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => toggleActiveMut.mutate({ id: item.id, isActive: !isLive })}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                              isLive
                                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 ring-2 ring-emerald-500/40 animate-pulse"
                                : "bg-secondary text-muted-foreground hover:text-foreground border border-border hover:bg-secondary/80"
                            }`}
                            title={isLive ? "Click to turn OFF live" : "Click to make LIVE instantly"}
                          >
                            <Power size={13} className={isLive ? "text-slate-950 font-black" : "text-muted-foreground"} />
                            <span>{isLive ? "🟢 LIVE NOW" : "⚪ OFF LIVE"}</span>
                          </button>
                        </td>

                        <td className="p-3.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-black uppercase ${
                              item.category === "critical"
                                ? "bg-red-500/15 text-red-400 border-red-500/30"
                                : item.category === "warning"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {item.category}
                          </Badge>
                        </td>

                        <td className="p-3.5 max-w-xs sm:max-w-md">
                          <p className="font-bold text-foreground text-xs">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{item.message}</p>
                        </td>

                        <td className="p-3.5 text-xs">
                          {item.product ? (() => {
                            const disc = Number(item.product.discountPercent || 0);
                            const eff = disc > 0 ? (Number(item.product.price) * (1 - disc / 100)) : Number(item.product.price);
                            return (
                              <div className="flex items-center gap-2.5">
                                {item.product.image && (
                                  <img src={imgUrl(item.product.image)} alt="" className="w-8 h-8 rounded-lg object-cover border border-border" />
                                )}
                                <div>
                                  <p className="font-bold text-foreground truncate max-w-[140px]">{item.product.name}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="font-black text-emerald-400">{formatINR(eff)}</span>
                                    {disc > 0 && (
                                      <span className="text-[10px] text-muted-foreground line-through">{formatINR(Number(item.product.price))}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })() : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="p-3.5 text-xs">
                          <button
                            type="button"
                            onClick={() => togglePopupMut.mutate({ id: item.id, showPopup: !item.showPopup })}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              item.showPopup
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {item.showPopup ? "⚡ Popup Active" : "🔕 Silent / Bell Only"}
                          </button>
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => startEdit(item)}
                              title="Edit Advertisement"
                            >
                              <Edit3 size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                              onClick={() => deleteMut.mutate(item.id)}
                              title="Delete Advertisement"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {announcements.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground text-xs font-medium">
                        No announcements or advertisements published yet. Click "New Broadcast / Ad" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
