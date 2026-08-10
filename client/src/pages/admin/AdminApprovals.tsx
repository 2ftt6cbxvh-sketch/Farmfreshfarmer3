import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, Eye, Package, Tag, Edit3, Save, Upload } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient, imgUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface PendingProduct {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
  price?: string | number | null;
  discountPercent?: string | number | null;
  stock?: number | null;
  unit?: string | null;
  categorySlug?: string | null;
  approvalStatus: string;
  submittedBy?: number | null;
  approvalNote?: string | null;
  createdAt: string;
  submitterName?: string | null;
}

interface PendingCategory {
  id: number;
  name: string;
  slug?: string | null;
  approvalStatus: string;
  submittedBy?: number | null;
  approvalNote?: string | null;
  createdAt: string;
  submitterName?: string | null;
}

interface ApprovalHistoryItem {
  id: number;
  entityType: string;
  entityId: number;
  entityName: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  adminUserId?: number | null;
  submittedByUserId?: number | null;
  note?: string | null;
  createdAt: string;
}

interface ProductEditModalState {
  item: PendingProduct;
  action: "approved" | "under_review" | "rejected";
}

export function AdminApprovals() {
  const { toast } = useToast();
  const [actionModal, setActionModal] = useState<{
    type: "product" | "category";
    id: number;
    name: string;
    action: "approved" | "under_review" | "rejected";
  } | null>(null);
  const [productEditModal, setProductEditModal] = useState<ProductEditModalState | null>(null);
  const [note, setNote] = useState("");

  // Edit fields state for Master Admin inline adjustments
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editDiscount, setEditDiscount] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: products = [], isLoading: loadingProducts } = useQuery<PendingProduct[]>({
    queryKey: ["/api/admin/approvals/products"],
    queryFn: () => apiGet<PendingProduct[]>("/api/admin/approvals/products"),
    refetchInterval: 5000,
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery<PendingCategory[]>({
    queryKey: ["/api/admin/approvals/categories"],
    queryFn: () => apiGet<PendingCategory[]>("/api/admin/approvals/categories"),
    refetchInterval: 5000,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery<ApprovalHistoryItem[]>({
    queryKey: ["/api/admin/approvals/history"],
    queryFn: () => apiGet<ApprovalHistoryItem[]>("/api/admin/approvals/history"),
    refetchInterval: 5000,
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);

      const token = localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        headers,
        body: fd,
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setEditImage(data.url);
        toast({ title: "New image uploaded & attached! 📸" });
        return;
      }
      throw new Error("Upload server error");
    } catch (err) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setEditImage(result);
          toast({ title: "New image attached! 📸" });
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  }

  const mutation = useMutation({
    mutationFn: async ({
      type,
      id,
      action,
      note,
      editFields,
    }: {
      type: "product" | "category";
      id: number;
      action: "approved" | "under_review" | "rejected";
      note: string;
      editFields?: any;
    }) => {
      const endpoint = type === "product" ? `/api/admin/approvals/products/${id}` : `/api/admin/approvals/categories/${id}`;
      await apiRequest("PATCH", endpoint, { action, note, editFields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Approval status updated & live on store! 🎉" });
      setActionModal(null);
      setProductEditModal(null);
      setNote("");
    },
    onError: (err: any) => {
      toast({
        title: "Action failed",
        description: err?.message || "Could not update approval status",
        variant: "destructive",
      });
    },
  });

  const openProductReviewModal = (item: PendingProduct, action: "approved" | "under_review" | "rejected") => {
    setProductEditModal({ item, action });
    setEditName(item.name || "");
    setEditPrice(String(item.price || "0"));
    setEditStock(String(item.stock || "50"));
    setEditUnit(item.unit || "250 Grams");
    setEditDiscount(String(item.discountPercent || "0"));
    setEditImage(item.image || "");
    setEditDescription(item.description || "");
    setNote("");
  };

  const handleConfirmProductAction = () => {
    if (!productEditModal) return;
    mutation.mutate({
      type: "product",
      id: productEditModal.item.id,
      action: productEditModal.action,
      note,
      editFields: {
        name: editName,
        price: editPrice,
        stock: editStock,
        unit: editUnit,
        discountPercent: editDiscount,
        image: editImage,
        description: editDescription,
      },
    });
  };

  const renderStatusBadge = (status: string) => {
    if (status === "pending") {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 flex items-center gap-1 font-medium">
          <Clock className="w-3 h-3" /> Pending Approval ⏳
        </Badge>
      );
    }
    if (status === "under_review") {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 flex items-center gap-1 font-medium">
          <Eye className="w-3 h-3" /> Under Review
        </Badge>
      );
    }
    if (status === "approved" || status === "submitted") {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-medium">
          <CheckCircle className="w-3 h-3" /> Approved & Live
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 flex items-center gap-1 font-medium">
        <XCircle className="w-3 h-3" /> Rejected
      </Badge>
    );
  };

  return (
    <AdminLayout title="Product & Category Approvals">
      <div className="space-y-6">
        <div className="bg-card border border-card-border p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              <CheckCircle className="text-emerald-500" size={24} /> Master Admin Approval Queue
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Review, edit images, adjust prices/stock, and approve products submitted by sub-admins. Changes update live instantly.
            </p>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs font-bold px-3 py-1">
            ⏳ Pending Items: {products.length + categories.length}
          </Badge>
        </div>

        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="products" data-testid="tab-products">
              Products {products.length > 0 && `(${products.length})`}
            </TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">
              Categories {categories.length > 0 && `(${categories.length})`}
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              Approval Log
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4 pt-4">
            {loadingProducts ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
            ) : products.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground border border-dashed rounded-2xl bg-card">
                <CheckCircle className="mx-auto text-emerald-500 mb-2" size={36} />
                <h3 className="font-bold text-base text-foreground">No Pending Approvals!</h3>
                <p className="text-xs mt-1">All products submitted by sub-admins have been reviewed and approved.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-card-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between"
                    data-testid={`card-product-${item.id}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <img
                              src={imgUrl(item.image)}
                              alt={item.name}
                              className="w-14 h-14 rounded-xl object-cover border border-card-border bg-muted shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-muted border border-card-border flex items-center justify-center text-muted-foreground shrink-0">
                              <Package className="w-7 h-7" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-bold text-base line-clamp-1 text-foreground">{item.name}</h3>
                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500 mt-0.5">
                              <span>₹{item.price}</span>
                              <span>•</span>
                              <span className="text-muted-foreground">{item.unit || "250g"}</span>
                              <span>•</span>
                              <span className="text-muted-foreground">Stock: {item.stock ?? 50}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1 bg-secondary/40 p-3 rounded-xl border border-card-border/50">
                        <p>
                          <span className="font-bold text-foreground">Sub-Admin Submitter:</span>{" "}
                          <span className="text-emerald-500 font-extrabold">{item.submitterName || (item.submittedBy ? `Staff #${item.submittedBy}` : "Sub-Admin")}</span>
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Submitted:</span>{" "}
                          {new Date(item.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-card-border">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md"
                        onClick={() => openProductReviewModal(item, "approved")}
                        data-testid={`btn-approve-product-${item.id}`}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Review, Edit & Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-500/30 hover:bg-red-50 text-xs font-bold"
                        onClick={() => openProductReviewModal(item, "rejected")}
                        data-testid={`btn-reject-product-${item.id}`}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4 pt-4">
            {loadingCategories ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
            ) : categories.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground border border-dashed rounded-2xl bg-card">
                <CheckCircle className="mx-auto text-emerald-500 mb-2" size={36} />
                <h3 className="font-bold text-base text-foreground">No Pending Category Approvals!</h3>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-card-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                          <Tag className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-foreground">{item.name}</h3>
                          <span className="text-xs text-muted-foreground">slug: {item.slug}</span>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1 bg-secondary/40 p-2.5 rounded-xl border border-card-border/50">
                        <p>
                          <span className="font-bold text-foreground">Submitted by:</span>{" "}
                          {item.submitterName || (item.submittedBy ? `User #${item.submittedBy}` : "Sub-Admin")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-card-border">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        onClick={() => { setActionModal({ type: "category", id: item.id, name: item.name, action: "approved" }); setNote(""); }}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve Category
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-500/30 text-xs font-bold"
                        onClick={() => { setActionModal({ type: "category", id: item.id, name: item.name, action: "rejected" }); setNote(""); }}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 pt-4">
            {loadingHistory ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : (
              <div className="rounded-2xl border border-card-border bg-card overflow-x-auto shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-left">
                    <tr>
                      <th className="p-3 font-semibold">Entity</th>
                      <th className="p-3 font-semibold">Type</th>
                      <th className="p-3 font-semibold">Action</th>
                      <th className="p-3 font-semibold">Date</th>
                      <th className="p-3 font-semibold">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-t border-card-border">
                        <td className="p-3 font-bold text-foreground">{row.entityName || `#${row.entityId}`}</td>
                        <td className="p-3 capitalize text-muted-foreground">{row.entityType}</td>
                        <td className="p-3">{renderStatusBadge(row.action)}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3 text-muted-foreground max-w-xs truncate">{row.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Master Admin Interactive Approval & Inline Edit Dialog */}
        {productEditModal && (
          <Dialog open={productEditModal !== null} onOpenChange={(open) => !open && setProductEditModal(null)}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
                  <Edit3 className="text-emerald-500" size={20} />
                  Master Admin Review: "{productEditModal.item.name}"
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Inspect, upload new images, and tweak sub-admin submitted product values directly before publishing live.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div>
                  <Label className="font-bold">Product Title *</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="font-bold">Price (₹) *</Label>
                    <Input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="font-bold">Discount %</Label>
                    <Input type="number" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="font-bold">Stock Qty *</Label>
                    <Input type="number" value={editStock} onChange={(e) => setEditStock(e.target.value)} className="mt-1" />
                  </div>
                </div>

                <div>
                  <Label className="font-bold">Unit / Pack Size *</Label>
                  <Input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="mt-1" />
                </div>

                {/* Upload & Update Product Image in Approval Stage */}
                <div className="p-3 rounded-xl bg-secondary/50 border border-card-border space-y-2">
                  <Label className="font-bold text-foreground flex items-center gap-1.5">
                    <Upload size={14} className="text-emerald-500" /> Upload & Replace Product Image in Approval Stage
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-xl bg-muted overflow-hidden shrink-0 border border-card-border">
                      {editImage ? (
                        <img src={imgUrl(editImage)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                          <Package size={24} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(f);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold gap-1.5"
                      >
                        <Upload size={14} /> {uploading ? "Uploading Image…" : "Upload New Image File 📸"}
                      </Button>
                      <Input
                        value={editImage}
                        onChange={(e) => setEditImage(e.target.value)}
                        placeholder="...or paste image URL directly"
                        className="text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="font-bold">Product Description</Label>
                  <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="mt-1 min-h-[70px]" />
                </div>

                <div className="p-3 bg-secondary/50 rounded-xl space-y-1">
                  <Label className="font-bold text-foreground">Master Admin Approval Note (Sent to Sub-Admin)</Label>
                  <Input
                    placeholder="Optional note e.g. Updated product photo & price before approving..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setProductEditModal(null)} disabled={mutation.isPending}>
                  Cancel
                </Button>
                {productEditModal.action === "rejected" ? (
                  <Button
                    variant="destructive"
                    onClick={handleConfirmProductAction}
                    disabled={mutation.isPending}
                    className="font-bold"
                  >
                    ❌ Reject Product
                  </Button>
                ) : (
                  <Button
                    onClick={handleConfirmProductAction}
                    disabled={mutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md gap-1.5"
                  >
                    <Save size={15} /> {mutation.isPending ? "Publishing..." : "Approve & Publish Live 🚀"}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminApprovals;
