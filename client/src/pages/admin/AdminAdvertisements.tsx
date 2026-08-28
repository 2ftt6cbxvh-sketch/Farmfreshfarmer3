import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { apiGet, apiRequest, queryClient, imgUrl } from "@/lib/queryClient";
import type { Product } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, AlertTriangle, ShieldAlert, Plus, Trash2,
  CheckCircle2, Eye, EyeOff, Package, Megaphone
} from "lucide-react";
import type { AnnouncementItem } from "@/components/NotificationBell";

export default function AdminAdvertisements() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"advertisement" | "warning" | "critical">("advertisement");
  const [productId, setProductId] = useState<string>("");
  const [showPopup, setShowPopup] = useState(true);
  const [priority, setPriority] = useState<number>(0);
  const [targetAudience, setTargetAudience] = useState("all");

  const { data: announcements = [], isLoading, refetch } = useQuery<AnnouncementItem[]>({
    queryKey: ["/api/admin/announcements"],
    queryFn: () => apiGet<AnnouncementItem[]>("/api/admin/announcements"),
    staleTime: 0,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: () => apiGet<Product[]>("/api/products"),
  });

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/admin/announcements", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements/active"] });
      toast({ title: "📢 Advertisement / Notice Published!" });
      setIsCreating(false);
      setTitle("");
      setMessage("");
      setProductId("");
    },
    onError: (err: any) => {
      toast({ title: "Publishing Failed", description: err?.message, variant: "destructive" });
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
    onSuccess: () => {
      toast({ title: "Status updated" });
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
              Publish site-wide announcements, critical security notices (Red), operational warnings (Yellow), and green marketing advertisements with attached product cards.
            </p>
          </div>
          <Button
            onClick={() => setIsCreating(!isCreating)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl gap-2 shadow-md shrink-0"
          >
            {isCreating ? "✕ Cancel" : <><Plus size={16} /> New Broadcast / Ad</>}
          </Button>
        </div>

        {/* 📝 Create Broadcast Form */}
        {isCreating && (
          <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-card border border-emerald-500/40 shadow-xl space-y-4 animate-in fade-in duration-200">
            <h3 className="text-base font-black flex items-center gap-2 text-foreground">
              <Megaphone size={18} className="text-emerald-500" />
              <span>Create Site-Wide Broadcast</span>
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
                    <p className="text-[10px] opacity-70">Green promo with product card</p>
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
                placeholder="e.g. Flash Sale: 20% Off Alphonso Mangoes!"
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
                placeholder="Enter details of the announcement, terms, or warning notice..."
                className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-secondary/50 border border-card-border text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Optional Attached Product (for Advertisements) */}
            {category === "advertisement" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Attach Featured Product (Optional)</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-secondary/50 border border-card-border text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- No product attached --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{p.price})
                    </option>
                  ))}
                </select>
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
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                disabled={createMut.isPending}
              >
                {createMut.isPending ? "Publishing..." : "Publish Broadcast"}
              </Button>
            </div>
          </form>
        )}

        {/* 📋 Announcements List Table */}
        <div className="rounded-2xl border border-card-border bg-card overflow-hidden shadow-sm">
          {isLoading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider">Type</th>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider">Title & Message</th>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider">Attached Product</th>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider">Popup</th>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider">Status</th>
                    <th className="p-3.5 font-bold text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {announcements.map((item) => (
                    <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
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
                        {item.product ? (
                          <div className="flex items-center gap-2">
                            {item.product.image && (
                              <img src={imgUrl(item.product.image)} alt="" className="w-6 h-6 rounded object-cover" />
                            )}
                            <span className="font-bold text-foreground truncate max-w-[120px]">{item.product.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-xs font-semibold">
                        {item.showPopup ? <span className="text-emerald-500">Yes</span> : <span className="text-muted-foreground">No</span>}
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => toggleActiveMut.mutate({ id: item.id, isActive: !item.isActive })}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                            item.isActive
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                          onClick={() => deleteMut.mutate(item.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
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
