import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, Check, X, EyeOff } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReviewRow {
  id: number; productId: number; userName: string; rating: number; comment: string;
  moderationStatus: string; createdAt: string;
}

const STATUSES = ["all", "pending", "approved", "rejected", "hidden"];

function StatusBadge({ status }: { status: string }) {
  const variant = status === "approved" ? "default" : status === "rejected" || status === "hidden" ? "destructive" : "outline";
  return <Badge variant={variant as any}>{status}</Badge>;
}

export default function AdminReviews() {
  const { toast } = useToast();
  const [tab, setTab] = useState("all");

  const { data: reviews = [], isLoading } = useQuery<ReviewRow[]>({
    queryKey: ["/api/admin/reviews", tab],
    queryFn: () => apiGet<ReviewRow[]>(`/api/admin/reviews${tab !== "all" ? `?status=${tab}` : ""}`),
  });

  const moderate = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "approve" | "reject" | "hide" }) => {
      await apiRequest("POST", `/api/admin/reviews/${id}/moderate`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({ title: "Review updated" });
    },
    onError: () => toast({ title: "Could not moderate review", variant: "destructive" }),
  });

  return (
    <AdminLayout title="Reviews">
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList data-testid="tabs-review-status">
          {STATUSES.map((s) => <TabsTrigger key={s} value={s} data-testid={`tab-review-${s}`}>{s}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-card-border bg-card p-4" data-testid={`row-review-${r.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{r.userName}</span>
                    <span className="flex items-center gap-0.5 text-accent">
                      {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} fill={i < r.rating ? "currentColor" : "none"} />)}
                    </span>
                    <StatusBadge status={r.moderationStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Product #{r.productId} · {new Date(r.createdAt).toLocaleDateString("en-IN")}</p>
                  {r.comment && <p className="text-sm mt-2">{r.comment}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => moderate.mutate({ id: r.id, action: "approve" })} data-testid={`button-approve-${r.id}`}>
                    <Check size={14} className="mr-1" /> Approve
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => moderate.mutate({ id: r.id, action: "reject" })} data-testid={`button-reject-${r.id}`}>
                    <X size={14} className="mr-1" /> Reject
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => moderate.mutate({ id: r.id, action: "hide" })} data-testid={`button-hide-${r.id}`}>
                    <EyeOff size={14} className="mr-1" /> Hide
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {reviews.length === 0 && <div className="rounded-xl border border-card-border bg-card p-8 text-center text-muted-foreground">No reviews found.</div>}
        </div>
      )}
    </AdminLayout>
  );
}
