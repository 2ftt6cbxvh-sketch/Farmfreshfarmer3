import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, Eye, Package, Tag, Edit3, Save, Upload, RotateCcw, Trash2, ShieldCheck, RefreshCw, FolderTree } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient, imgUrl } from "@/lib/queryClient";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface CategoryOption {
  id: number;
  name: string;
  slug: string;
}

interface ProductEditModalState {
  item: PendingProduct;
  action: "approved" | "under_review" | "changes_requested" | "rejected" | "approve_deletion" | "reject_deletion";
}

export function AdminApprovals() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPrimaryAdmin = Boolean(
    user?.isPrimaryAdmin ||
    user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    (user?.role === "admin" && (user?.id === 1 || user?.id === 0))
  );
  const [actionModal, setActionModal] = useState<{
    type: "product" | "category";
    id: number;
    name: string;
    action: "approved" | "under_review" | "changes_requested" | "rejected" | "approve_deletion" | "reject_deletion";
  } | null>(null);
  const [productEditModal, setProductEditModal] = useState<ProductEditModalState | null>(null);
  const [reconsiderPromptModal, setReconsiderPromptModal] = useState<PendingProduct | null>(null);
  const [reconsiderEditModal, setReconsiderEditModal] = useState<PendingProduct | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [resubmitNote, setResubmitNote] = useState("");
  const [note, setNote] = useState("");

  // Edit fields state for Master Admin inline adjustments
  const [editName, setEditName] = useState("");
  const [editCategorySlug, setEditCategorySlug] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editDiscount, setEditDiscount] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Instant polling (every 1.5 seconds) for real-time live approval updates across clients!
  const { data: products = [], isLoading: loadingProducts, isFetching: fetchingProducts, refetch: refetchProducts } = useQuery<PendingProduct[]>({
    queryKey: ["/api/admin/approvals/products"],
    queryFn: () => apiGet<PendingProduct[]>("/api/admin/approvals/products"),
    refetchInterval: 1500,
    refetchIntervalInBackground: true,
  });

  const { data: categories = [], isLoading: loadingCategories, isFetching: fetchingCategories, refetch: refetchCategories } = useQuery<PendingCategory[]>({
    queryKey: ["/api/admin/approvals/categories"],
    queryFn: () => apiGet<PendingCategory[]>("/api/admin/approvals/categories"),
    refetchInterval: 1500,
    refetchIntervalInBackground: true,
  });

  const { data: reconsiderationProducts = [], isLoading: loadingReconsideration, refetch: refetchReconsideration } = useQuery<PendingProduct[]>({
    queryKey: ["/api/admin/approvals/reconsideration"],
    queryFn: () => apiGet<PendingProduct[]>("/api/admin/approvals/reconsideration"),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  const { data: allCategories = [] } = useQuery<CategoryOption[]>({
    queryKey: ["/api/categories"],
    queryFn: () => apiGet<CategoryOption[]>("/api/categories"),
  });

  const { data: history = [], isLoading: loadingHistory, refetch: refetchHistory } = useQuery<ApprovalHistoryItem[]>({
    queryKey: ["/api/admin/approvals/history"],
    queryFn: () => apiGet<ApprovalHistoryItem[]>("/api/admin/approvals/history"),
    refetchInterval: 3000,
  });

  const isRefreshing = fetchingProducts || fetchingCategories;

  function handleManualRefresh() {
    refetchProducts();
    refetchCategories();
    refetchHistory();
    toast({ title: "Queue Refreshed 🔄", description: "Checked for new sub-admin requests." });
  }

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
      action: "approved" | "under_review" | "changes_requested" | "rejected" | "approve_deletion" | "reject_deletion";
      note: string;
      editFields?: any;
    }) => {
      const endpoint = type === "product" ? `/api/admin/approvals/products/${id}` : `/api/admin/approvals/categories/${id}`;
      await apiRequest("PATCH", endpoint, { action, note, editFields });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/reconsideration"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });

      let title = "Status Updated";
      let desc = "Approval decision recorded.";
      if (variables.action === "approved") {
        title = "Approved & Published Live! 🚀";
        desc = "Item changes published to live storefront.";
      } else if (variables.action === "changes_requested") {
        title = "Sent for Reconsideration ↩️";
        desc = "Product sent back to Sub-Admin with your feedback note. Sub-Admin notified via Telegram.";
      } else if (variables.action === "approve_deletion") {
        title = "Item Permanently Deleted 🗑️";
        desc = "Sub-admin deletion request was approved and item removed.";
      } else if (variables.action === "reject_deletion") {
        title = "Deletion Rejected & Item Restored 🛡️";
        desc = "Item restored to live storefront.";
      }

      toast({ title, description: desc });
      setActionModal(null);
      setProductEditModal(null);
      setReconsiderPromptModal(null);
      setFeedbackNote("");
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

  const resubmitMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiRequest("POST", `/api/admin/approvals/products/${id}/resubmit`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/reconsideration"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/history"] });
      setReconsiderEditModal(null);
      setResubmitNote("");
      toast({ title: "🚀 Product Resubmitted!", description: "Changes updated and sent to Super Admin for approval. Alert dispatched on Telegram." });
    },
    onError: (err: any) => {
      toast({ title: "Resubmission failed", description: err?.message || "Server error", variant: "destructive" });
    },
  });

  const revertMutation = useMutation({
    mutationFn: async ({ type, id, note }: { type: "product" | "category"; id: number; note?: string }) => {
      await apiRequest("POST", "/api/admin/approvals/revert", { type, id, note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({
        title: "Approval Reverted ↩️",
        description: "Item removed from storefront and returned to moderation queue.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Revert Failed",
        description: err?.message || "Could not revert approval status",
        variant: "destructive",
      });
    },
  });

  const openProductReviewModal = (item: PendingProduct, action: "approved" | "under_review" | "rejected" | "approve_deletion" | "reject_deletion") => {
    setProductEditModal({ item, action });
    setEditName(item.name || "");
    setEditCategorySlug(item.categorySlug || allCategories[0]?.slug || "fruits");
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
        categorySlug: editCategorySlug,
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
    if (status === "pending_deletion" || status === "deletion_requested") {
      return (
        <Badge variant="destructive" className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 flex items-center gap-1 font-bold animate-pulse">
          <Trash2 className="w-3 h-3" /> Deletion Requested 🗑️
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
    if (status === "reverted") {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1 font-medium">
          <RotateCcw className="w-3 h-3" /> Reverted ↩️
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
    <AdminLayout title={isPrimaryAdmin ? "Product & Category Approvals" : "Product Reconsiderations ↩️"}>
      <div className="space-y-6">
        <div className="bg-card border border-card-border p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              {isPrimaryAdmin ? (
                <>
                  <CheckCircle className="text-emerald-500" size={24} /> Master Admin Approval Queue
                </>
              ) : (
                <>
                  <RotateCcw className="text-amber-500" size={24} /> Product Reconsideration Hub ↩️
                </>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {isPrimaryAdmin
                ? "Review assigned categories, prices, images, and sub-admin deletion requests for products and categories."
                : "Review feedback notes from Master Admin, edit requested product details, and click Resubmit."}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              className="text-xs font-bold gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 h-8 cursor-pointer"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
              <span>Refresh</span>
            </Button>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs font-bold px-3 py-1.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping mr-1" />
              {isPrimaryAdmin ? `⏳ Pending Items: ${products.length + categories.length}` : `↩️ Requires Action: ${reconsiderationProducts.length}`}
            </Badge>
          </div>
        </div>

        {!isPrimaryAdmin && reconsiderationProducts.length > 0 && (
          <div className="p-4 bg-amber-500/15 border-2 border-amber-500/40 rounded-2xl flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300 font-extrabold shadow-sm">
            <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 animate-spin" />
            <div>
              <span>
                <strong>Sub-Admin Action Required:</strong> You have {reconsiderationProducts.length} product(s) sent back for reconsideration by Master Admin. Edit the details below and click <strong>Resubmit</strong>.
              </span>
            </div>
          </div>
        )}

        <Tabs defaultValue="reconsideration" className="w-full">
          <TabsList className={`grid w-full ${isPrimaryAdmin ? "grid-cols-4 max-w-2xl" : "grid-cols-1 max-w-xs"}`}>
            {isPrimaryAdmin && (
              <TabsTrigger value="products" data-testid="tab-products">
                Products {products.length > 0 && `(${products.length})`}
              </TabsTrigger>
            )}
            {isPrimaryAdmin && (
              <TabsTrigger value="categories" data-testid="tab-categories">
                Categories {categories.length > 0 && `(${categories.length})`}
              </TabsTrigger>
            )}
            <TabsTrigger value="reconsideration" data-testid="tab-reconsideration" className="text-amber-500 font-bold">
              🔄 Re-Consider {reconsiderationProducts.length > 0 && `(${reconsiderationProducts.length})`}
            </TabsTrigger>
            {isPrimaryAdmin && (
              <TabsTrigger value="history" data-testid="tab-history">
                Approval Log
              </TabsTrigger>
            )}
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
                {products.map((item) => {
                  const isDeletion = item.approvalStatus === "pending_deletion";
                  const categoryName = allCategories.find((c) => c.slug === item.categorySlug)?.name || item.categorySlug || "Uncategorized";
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border ${isDeletion ? "border-red-500/50 bg-red-500/5" : "border-card-border bg-card"} p-5 shadow-sm space-y-4 flex flex-col justify-between`}
                      data-testid={`card-product-${item.id}`}
                    >
                      <div className="space-y-3">
                        {isDeletion && (
                          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-600 font-extrabold">
                            <Trash2 size={16} className="shrink-0 text-red-500" />
                            <span>Sub-Admin requested PERMANENT DELETION for this product!</span>
                          </div>
                        )}
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
                              <div className="mt-1 flex items-center gap-1.5">
                                <Badge variant="outline" className="bg-primary/10 border-primary/25 text-primary text-[10px] font-extrabold px-2 py-0.5">
                                  📁 {categoryName}
                                </Badge>
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

                      {isDeletion ? (
                        <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-3 border-t border-card-border">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 font-bold text-xs shadow-sm h-9 gap-1.5 justify-center"
                            onClick={() => {
                              if (confirm(`Approve permanent deletion of "${item.name}"? This action cannot be undone.`)) {
                                mutation.mutate({ type: "product", id: item.id, action: "approve_deletion", note });
                              }
                            }}
                            disabled={mutation.isPending}
                          >
                            <Trash2 size={14} /> Approve Deletion 🗑️
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 text-xs font-bold h-9 gap-1.5 justify-center shadow-sm"
                            onClick={() => mutation.mutate({ type: "product", id: item.id, action: "reject_deletion", note })}
                            disabled={mutation.isPending}
                          >
                            <ShieldCheck size={14} /> Reject & Restore Live 🛡️
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 pt-3 border-t border-card-border">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md"
                              onClick={() => openProductReviewModal(item, "approved")}
                              data-testid={`btn-approve-product-${item.id}`}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Review & Approve
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

                          {/* Request Changes / Send for Reconsideration */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReconsiderPromptModal(item);
                              setFeedbackNote("");
                            }}
                            className="w-full text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10 text-xs font-bold h-8 gap-1.5"
                          >
                            <span>↩️ Send Back to Sub-Admin for Changes</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4 pt-4">
            {loadingCategories ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-48 rounded-xl" />
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
                {categories.map((item) => {
                  const isDeletion = item.approvalStatus === "pending_deletion";
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border ${isDeletion ? "border-red-500/50 bg-red-500/5" : "border-card-border bg-card"} p-5 shadow-sm space-y-4 flex flex-col justify-between`}
                    >
                      <div className="space-y-3">
                        {isDeletion && (
                          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-600 font-extrabold">
                            <Trash2 size={16} className="shrink-0 text-red-500" />
                            <span>Sub-Admin requested PERMANENT DELETION for this category!</span>
                          </div>
                        )}
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

                      {isDeletion ? (
                        <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-2 border-t border-card-border">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 font-bold text-xs shadow-sm h-9 gap-1.5 justify-center"
                            onClick={() => {
                              if (confirm(`Approve permanent deletion of category "${item.name}"?`)) {
                                mutation.mutate({ type: "category", id: item.id, action: "approve_deletion", note });
                              }
                            }}
                            disabled={mutation.isPending}
                          >
                            <Trash2 size={14} /> Approve Deletion 🗑️
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 text-xs font-bold h-9 gap-1.5 justify-center shadow-sm"
                            onClick={() => mutation.mutate({ type: "category", id: item.id, action: "reject_deletion", note })}
                            disabled={mutation.isPending}
                          >
                            <ShieldCheck size={14} /> Reject & Restore Live 🛡️
                          </Button>
                        </div>
                      ) : (
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
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Re-Consideration Queue Tab (Products sent back for changes) */}
          <TabsContent value="reconsideration" className="space-y-4 pt-4">
            {loadingReconsideration ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-56 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
              </div>
            ) : reconsiderationProducts.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground border border-dashed rounded-2xl bg-card">
                <CheckCircle className="mx-auto text-emerald-500 mb-2" size={36} />
                <h3 className="font-bold text-base text-foreground">Re-Consideration Queue Clear!</h3>
                <p className="text-xs mt-1">No products currently require changes or modifications from sub-admins.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {reconsiderationProducts.map((item) => {
                  const categoryName = allCategories.find((c) => c.slug === item.categorySlug)?.name || item.categorySlug || "Uncategorized";
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 shadow-sm space-y-4 flex flex-col justify-between"
                      data-testid={`card-reconsider-${item.id}`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {item.image ? (
                              <img
                                src={imgUrl(item.image)}
                                alt={item.name}
                                className="w-14 h-14 rounded-xl object-cover border border-amber-500/30 bg-muted shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-muted border border-amber-500/30 flex items-center justify-center text-muted-foreground shrink-0">
                                <Package className="w-7 h-7" />
                              </div>
                            )}
                            <div>
                              <h3 className="font-bold text-base line-clamp-1 text-foreground">{item.name}</h3>
                              <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 mt-0.5">
                                <span>₹{item.price}</span>
                                <span>•</span>
                                <span className="text-muted-foreground">{item.unit || "250g"}</span>
                                <span>•</span>
                                <span className="text-muted-foreground">Stock: {item.stock ?? 50}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-600 text-[10px] font-extrabold px-2 py-0.5">
                                  📁 {categoryName}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Super Admin Feedback Banner */}
                        <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <span>💬 Super Admin Feedback / Required Changes:</span>
                          </p>
                          <p className="text-xs text-foreground font-medium italic">
                            "{item.approvalNote || "Please review and adjust product details."}"
                          </p>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1 bg-secondary/40 p-2.5 rounded-xl border border-card-border/50">
                          <p>
                            <span className="font-bold text-foreground">Assigned Sub-Admin:</span>{" "}
                            <span className="text-emerald-500 font-extrabold">{item.submitterName || (item.submittedBy ? `Staff #${item.submittedBy}` : "Sub-Admin")}</span>
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Returned:</span>{" "}
                            {new Date(item.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-amber-500/30">
                        <Button
                          size="sm"
                          className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-md"
                          onClick={() => {
                            setReconsiderEditModal(item);
                            setEditName(item.name || "");
                            setEditCategorySlug(item.categorySlug || allCategories[0]?.slug || "fruits");
                            setEditPrice(String(item.price || "0"));
                            setEditStock(String(item.stock || "50"));
                            setEditUnit(item.unit || "250 Grams");
                            setEditDiscount(String(item.discountPercent || "0"));
                            setEditImage(item.image || "");
                            setEditDescription(item.description || "");
                            setResubmitNote("");
                          }}
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" /> Review & Edit Changes
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
                      <th className="p-3 font-semibold">Action Status</th>
                      <th className="p-3 font-semibold">Date & Time</th>
                      <th className="p-3 font-semibold">Note</th>
                      <th className="p-3 font-semibold text-right">Revert Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-t border-card-border">
                        <td className="p-3 font-bold text-foreground">{row.entityName || `#${row.entityId}`}</td>
                        <td className="p-3 capitalize text-muted-foreground">{row.entityType}</td>
                        <td className="p-3">{renderStatusBadge(row.action || row.toStatus || "approved")}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap text-xs">
                          {new Date(row.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-3 text-muted-foreground max-w-xs truncate text-xs">{row.note || "Approved & Live Storefront"}</td>
                        <td className="p-3 text-right">
                          {row.action !== "reverted" && row.toStatus !== "pending" && row.action !== "deleted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10 text-xs font-bold gap-1"
                              onClick={() => {
                                if (confirm(`Revert approval for "${row.entityName}"? It will be removed from storefront and returned to moderation.`)) {
                                  revertMutation.mutate({ type: row.entityType as any, id: row.entityId });
                                }
                              }}
                              disabled={revertMutation.isPending}
                            >
                              <RotateCcw size={12} /> Revert Approval ↩️
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Super Admin Reconsideration Feedback Prompt Dialog */}
        {reconsiderPromptModal && (
          <Dialog open={reconsiderPromptModal !== null} onOpenChange={(open) => !open && setReconsiderPromptModal(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-amber-500">
                  <span>↩️ Send "{reconsiderPromptModal.name}" Back for Changes</span>
                </DialogTitle>
                <DialogDescription className="text-xs leading-relaxed">
                  Provide specific notes or feedback to the Sub-Admin. They will be notified via Telegram and this product will be placed in their Re-Consideration Queue.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                <div>
                  <Label className="font-bold text-foreground">Admin Feedback & Required Adjustments *</Label>
                  <Textarea
                    value={feedbackNote}
                    onChange={(e) => setFeedbackNote(e.target.value)}
                    placeholder="e.g. Please increase unit size to 500g, correct price to ₹180, and add higher resolution organic farm photo..."
                    className="mt-1 min-h-[90px] text-xs font-medium"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setReconsiderPromptModal(null)} disabled={mutation.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!feedbackNote.trim()) {
                      toast({ title: "Feedback note required", description: "Please enter instructions for the Sub-Admin.", variant: "destructive" });
                      return;
                    }
                    mutation.mutate({
                      type: "product",
                      id: reconsiderPromptModal.id,
                      action: "changes_requested",
                      note: feedbackNote.trim(),
                    });
                  }}
                  disabled={mutation.isPending}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-md"
                >
                  {mutation.isPending ? "Sending..." : "↩️ Send Back to Sub-Admin"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Sub-Admin Reconsideration Edit & Resubmit Modal */}
        {reconsiderEditModal && (
          <Dialog open={reconsiderEditModal !== null} onOpenChange={(open) => !open && setReconsiderEditModal(null)}>
            <DialogContent className="sm:max-w-4xl md:max-w-5xl w-[92vw] max-h-[90vh] overflow-y-auto p-6 md:p-8 bg-card/95 backdrop-blur-2xl rounded-3xl border-2 border-amber-500/20 shadow-2xl">
              <DialogHeader className="pb-3 border-b border-card-border/60">
                <DialogTitle className="flex items-center gap-2 text-lg font-black text-amber-500">
                  <Edit3 size={20} />
                  Re-Consider & Modify: "{reconsiderEditModal.name}"
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Review the Admin feedback note below, make the required corrections to the product, and resubmit for approval.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Admin Feedback Box */}
                <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    💬 Required Changes from Super Admin:
                  </p>
                  <p className="text-xs font-semibold text-foreground italic">
                    "{reconsiderEditModal.approvalNote || "Please review and adjust product details."}"
                  </p>
                </div>

                <div>
                  <Label className="font-bold">Product Title *</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
                </div>

                <div className="p-3 rounded-xl bg-secondary/50 border border-card-border space-y-1.5">
                  <Label className="font-bold text-foreground flex items-center gap-1.5">
                    <FolderTree size={14} className="text-emerald-500" /> Category *
                  </Label>
                  <Select value={editCategorySlug} onValueChange={setEditCategorySlug}>
                    <SelectTrigger className="font-semibold text-xs bg-background">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {allCategories.map((cat) => (
                        <SelectItem key={cat.slug} value={cat.slug} className="text-xs">
                          📁 {cat.name} ({cat.slug})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                {/* Upload & Update Product Image */}
                <div className="p-3 rounded-xl bg-secondary/50 border border-card-border space-y-2">
                  <Label className="font-bold text-foreground flex items-center gap-1.5">
                    <Upload size={14} className="text-emerald-500" /> Update Product Image
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
                        <Upload size={14} /> {uploading ? "Uploading Image…" : "Upload New Image 📸"}
                      </Button>
                      <Input
                        value={editImage}
                        onChange={(e) => setEditImage(e.target.value)}
                        placeholder="...or paste image URL"
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
                  <Label className="font-bold text-foreground">Note for Super Admin on Changes Made</Label>
                  <Input
                    placeholder="e.g. Updated price to ₹180 and replaced photo as requested..."
                    value={resubmitNote}
                    onChange={(e) => setResubmitNote(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setReconsiderEditModal(null)} disabled={resubmitMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    resubmitMutation.mutate({
                      id: reconsiderEditModal.id,
                      payload: {
                        name: editName,
                        categorySlug: editCategorySlug,
                        price: editPrice,
                        stock: editStock,
                        unit: editUnit,
                        discountPercent: editDiscount,
                        image: editImage,
                        description: editDescription,
                        resubmitNote: resubmitNote.trim(),
                      },
                    });
                  }}
                  disabled={resubmitMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md gap-1.5"
                >
                  <Save size={15} /> {resubmitMutation.isPending ? "Resubmitting..." : "Resubmit for Approval 🚀"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Master Admin Interactive Approval & Inline Edit Dialog */}
        {productEditModal && (
          <Dialog open={productEditModal !== null} onOpenChange={(open) => !open && setProductEditModal(null)}>
            <DialogContent className="sm:max-w-4xl md:max-w-5xl w-[92vw] max-h-[90vh] overflow-y-auto p-6 md:p-8 bg-card/95 backdrop-blur-2xl rounded-3xl border-2 border-emerald-500/20 shadow-2xl">
              <DialogHeader className="pb-3 border-b border-card-border/60">
                <DialogTitle className="flex items-center gap-2 text-lg font-black text-emerald-500">
                  <Edit3 size={20} />
                  Master Admin Review: "{productEditModal.item.name}"
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Inspect assigned category, upload new images, and tweak sub-admin submitted product values directly before publishing live.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div>
                  <Label className="font-bold">Product Title *</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
                </div>

                {/* Sub-Admin Assigned Category Dropdown */}
                <div className="p-3 rounded-xl bg-secondary/50 border border-card-border space-y-1.5">
                  <Label className="font-bold text-foreground flex items-center gap-1.5">
                    <FolderTree size={14} className="text-emerald-500" /> Assigned Category (Sub-Admin Choice) *
                  </Label>
                  <Select value={editCategorySlug} onValueChange={setEditCategorySlug}>
                    <SelectTrigger className="font-semibold text-xs bg-background">
                      <SelectValue placeholder="Select assigned category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {allCategories.map((cat) => (
                        <SelectItem key={cat.slug} value={cat.slug} className="text-xs">
                          📁 {cat.name} ({cat.slug})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Sub-admin selected this category. You can reassign it to any other category before approving.
                  </p>
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
                    placeholder="Optional note e.g. Updated product category & photo before approving..."
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
