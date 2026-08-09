import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, Eye, ChevronDown, Package, Tag } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  image?: string | null;
  price?: string | null;
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

interface ActionModalState {
  type: "product" | "category";
  id: number;
  name: string;
  action: "approved" | "under_review" | "rejected";
}

export function AdminApprovals() {
  const { toast } = useToast();
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null);
  const [note, setNote] = useState("");

  const { data: products = [], isLoading: loadingProducts } = useQuery<PendingProduct[]>({
    queryKey: ["/api/admin/approvals/products"],
    queryFn: () => apiGet<PendingProduct[]>("/api/admin/approvals/products"),
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery<PendingCategory[]>({
    queryKey: ["/api/admin/approvals/categories"],
    queryFn: () => apiGet<PendingCategory[]>("/api/admin/approvals/categories"),
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery<ApprovalHistoryItem[]>({
    queryKey: ["/api/admin/approvals/history"],
    queryFn: () => apiGet<ApprovalHistoryItem[]>("/api/admin/approvals/history"),
  });

  const mutation = useMutation({
    mutationFn: async ({
      type,
      id,
      action,
      note,
    }: {
      type: "product" | "category";
      id: number;
      action: "approved" | "under_review" | "rejected";
      note: string;
    }) => {
      const endpoint = type === "product" ? `/api/admin/approvals/products/${id}` : `/api/admin/approvals/categories/${id}`;
      await apiRequest("PATCH", endpoint, { action, note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/history"] });
      toast({ title: "Approval status updated successfully" });
      setActionModal(null);
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

  const handleOpenActionModal = (
    type: "product" | "category",
    id: number,
    name: string,
    action: "approved" | "under_review" | "rejected"
  ) => {
    setActionModal({ type, id, name, action });
    setNote("");
  };

  const handleConfirmAction = () => {
    if (!actionModal) return;
    mutation.mutate({
      type: actionModal.type,
      id: actionModal.id,
      action: actionModal.action,
      note,
    });
  };

  const renderStatusBadge = (status: string) => {
    if (status === "pending") {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 flex items-center gap-1 font-medium">
          <Clock className="w-3 h-3" /> Pending
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
    if (status === "approved") {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-medium">
          <CheckCircle className="w-3 h-3" /> Approved
        </Badge>
      );
    }
    if (status === "rejected") {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 flex items-center gap-1 font-medium">
          <XCircle className="w-3 h-3" /> Rejected
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const actionLabel = (action: string) => {
    if (action === "approved") return "Approve";
    if (action === "under_review") return "Mark Under Review";
    if (action === "rejected") return "Reject";
    return action;
  };

  return (
    <AdminLayout title="Product & Category Approvals">
      <Tabs defaultValue="products" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="products" className="flex items-center gap-2" data-testid="tab-products">
            <Package className="w-4 h-4" />
            Products ({products.length})
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2" data-testid="tab-categories">
            <Tag className="w-4 h-4" />
            Categories ({categories.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2" data-testid="tab-history">
            <Clock className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          {loadingProducts ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl bg-card/50">
              ✅ No pending approvals! All products and categories are reviewed.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-card-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between"
                  data-testid={`card-product-${item.id}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-lg object-cover border border-card-border bg-muted shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted border border-card-border flex items-center justify-center text-muted-foreground shrink-0">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-base line-clamp-1">{item.name}</h3>
                          {item.categorySlug && (
                            <span className="text-xs text-muted-foreground">Category: {item.categorySlug}</span>
                          )}
                        </div>
                      </div>
                      {renderStatusBadge(item.approvalStatus)}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 p-2.5 rounded-lg border border-card-border/50">
                      <p>
                        <span className="font-medium text-foreground">Submitted by:</span>{" "}
                        {item.submitterName || (item.submittedBy ? `User #${item.submittedBy}` : "Unknown")}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Date:</span>{" "}
                        {new Date(item.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {item.approvalNote && (
                        <p className="pt-1 border-t border-card-border/50 italic text-muted-foreground">
                          Note: "{item.approvalNote}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-card-border">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30 text-xs font-semibold"
                      onClick={() => handleOpenActionModal("product", item.id, item.name, "approved")}
                      data-testid={`btn-approve-product-${item.id}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 border-blue-500/30 text-xs font-semibold"
                      onClick={() => handleOpenActionModal("product", item.id, item.name, "under_review")}
                      data-testid={`btn-review-product-${item.id}`}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-red-600 dark:text-red-400 hover:bg-red-500/10 border-red-500/30 text-xs font-semibold"
                      onClick={() => handleOpenActionModal("product", item.id, item.name, "rejected")}
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
        <TabsContent value="categories" className="space-y-4">
          {loadingCategories ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          ) : categories.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl bg-card/50">
              ✅ No pending approvals! All products and categories are reviewed.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-card-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between"
                  data-testid={`card-category-${item.id}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                          <Tag className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-base line-clamp-1">{item.name}</h3>
                          {item.slug && <span className="text-xs text-muted-foreground">slug: {item.slug}</span>}
                        </div>
                      </div>
                      {renderStatusBadge(item.approvalStatus)}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 p-2.5 rounded-lg border border-card-border/50">
                      <p>
                        <span className="font-medium text-foreground">Submitted by:</span>{" "}
                        {item.submitterName || (item.submittedBy ? `User #${item.submittedBy}` : "Unknown")}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Date:</span>{" "}
                        {new Date(item.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {item.approvalNote && (
                        <p className="pt-1 border-t border-card-border/50 italic text-muted-foreground">
                          Note: "{item.approvalNote}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-card-border">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30 text-xs font-semibold"
                      onClick={() => handleOpenActionModal("category", item.id, item.name, "approved")}
                      data-testid={`btn-approve-category-${item.id}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 border-blue-500/30 text-xs font-semibold"
                      onClick={() => handleOpenActionModal("category", item.id, item.name, "under_review")}
                      data-testid={`btn-review-category-${item.id}`}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-red-600 dark:text-red-400 hover:bg-red-500/10 border-red-500/30 text-xs font-semibold"
                      onClick={() => handleOpenActionModal("category", item.id, item.name, "rejected")}
                      data-testid={`btn-reject-category-${item.id}`}
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
        <TabsContent value="history" className="space-y-4">
          {loadingHistory ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl bg-card/50">
              No approval history recorded yet.
            </div>
          ) : (
            <div className="rounded-xl border border-card-border bg-card overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr>
                    <th className="p-3 font-semibold">Entity</th>
                    <th className="p-3 font-semibold">Type</th>
                    <th className="p-3 font-semibold">Action</th>
                    <th className="p-3 font-semibold">Processed By</th>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-t border-card-border" data-testid={`history-row-${row.id}`}>
                      <td className="p-3 font-medium">{row.entityName || `#${row.entityId}`}</td>
                      <td className="p-3 capitalize text-muted-foreground">{row.entityType}</td>
                      <td className="p-3">{renderStatusBadge(row.action)}</td>
                      <td className="p-3 text-muted-foreground">
                        {row.adminUserId ? `Admin #${row.adminUserId}` : "System"}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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

      {/* Confirmation Dialog */}
      <Dialog open={actionModal !== null} onOpenChange={(open) => !open && setActionModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionModal?.action === "approved" && <CheckCircle className="w-5 h-5 text-emerald-500" />}
              {actionModal?.action === "under_review" && <Eye className="w-5 h-5 text-blue-500" />}
              {actionModal?.action === "rejected" && <XCircle className="w-5 h-5 text-red-500" />}
              <span>
                {actionModal ? actionLabel(actionModal.action) : ""} "{actionModal?.name}"
              </span>
            </DialogTitle>
            <DialogDescription>
              Please enter an optional note or rationale for this approval status update.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              placeholder="Add approval note (optional)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
              data-testid="textarea-approval-note"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setActionModal(null)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              variant={actionModal?.action === "rejected" ? "destructive" : "default"}
              onClick={handleConfirmAction}
              disabled={mutation.isPending}
              data-testid="btn-confirm-action"
            >
              {mutation.isPending ? "Updating..." : "Confirm Action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

export default AdminApprovals;
