import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { getStarTheme } from "@/lib/starTheme";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Customer {
  id: number; name: string; email: string; phone: string | null; status: string;
  hasCompletedFirstOrder: boolean; totalOrders: number; totalSpent: string;
  referralCode: string | null; successfulReferrals: number; referralBalance: number;
  customerStars?: number;
}

export default function AdminCustomers() {
  const { toast } = useToast();
  const [starEditId, setStarEditId] = useState<number | null>(null);
  const [starEditVal, setStarEditVal] = useState<number>(0);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/admin/customers"],
    queryFn: () => apiGet<Customer[]>("/api/admin/customers"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("POST", `/api/admin/customers/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({ title: "Customer status updated" });
    },
    onError: () => toast({ title: "Could not update status", variant: "destructive" }),
  });

  const setStarsMut = useMutation({
    mutationFn: async ({ id, stars }: { id: number; stars: number }) => {
      await apiRequest("PATCH", `/api/users/${id}/customer-stars`, { customerStars: stars });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({ title: "Loyalty stars updated! ⭐" });
      setStarEditId(null);
    },
    onError: () => toast({ title: "Could not update stars", variant: "destructive" }),
  });

  return (
    <AdminLayout title="Customers">
      <p className="text-sm text-muted-foreground mb-4">All registered customers, their order history, loyalty stars, and referral performance.</p>
      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Customer</th>
                <th className="p-3 font-semibold">Loyalty Stars</th>
                <th className="p-3 font-semibold">Phone</th>
                <th className="p-3 font-semibold">Orders</th>
                <th className="p-3 font-semibold">Total spent</th>
                <th className="p-3 font-semibold">First order</th>
                <th className="p-3 font-semibold">Referral code</th>
                <th className="p-3 font-semibold">Referral balance</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-card-border" data-testid={`row-customer-${c.id}`}>
                  <td className="p-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => { setStarEditId(c.id); setStarEditVal(c.customerStars || 0); }}
                      className="flex flex-col gap-0.5 group p-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/15 transition-all text-left"
                      title="Click to edit loyalty stars"
                    >
                      <div className="flex items-center gap-1 font-extrabold text-xs text-blue-400">
                        {(c.customerStars || 0) > 0 ? (
                          <span>★ {c.customerStars} Stars</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic font-normal">No stars</span>
                        )}
                      </div>
                      <span className="text-[9px] text-blue-400 opacity-70 group-hover:opacity-100 font-bold mt-0.5">Edit ({c.customerStars || 0}/5)</span>
                    </button>
                  </td>
                  <td className="p-3 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="p-3">{c.totalOrders}</td>
                  <td className="p-3 font-medium">{formatINR(Number(c.totalSpent))}</td>
                  <td className="p-3">{c.hasCompletedFirstOrder ? <Badge variant="default">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                  <td className="p-3 font-mono text-xs">{c.referralCode || "—"}</td>
                  <td className="p-3">{formatINR(Number(c.referralBalance))}</td>
                  <td className="p-3"><Badge variant={c.status === "blocked" ? "destructive" : "default"}>{c.status}</Badge></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatus.mutate({ id: c.id, status: c.status === "blocked" ? "active" : "blocked" })}
                        data-testid={`button-toggle-block-${c.id}`}
                      >
                        {c.status === "blocked" ? "Unblock" : "Block"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No customers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Customer Stars Modal */}
      {starEditId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setStarEditId(null)}>
          <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold flex items-center gap-2">⭐ Assign Loyalty Stars</h3>
            <p className="text-xs text-muted-foreground">Give customer loyalty stars (0 to 5 max).</p>
            
            <div className="flex flex-col items-center gap-3 py-4 bg-secondary/50 rounded-xl">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const theme = getStarTheme(starVal, true);
                  const isSelected = starEditVal >= starVal;
                  return (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setStarEditVal(starVal)}
                      className={`text-2xl transition-transform hover:scale-125 ${isSelected ? `${theme.starColor} ${theme.glowClass}` : "text-muted-foreground/30"}`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setStarEditVal(0)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                  starEditVal === 0
                    ? "bg-muted border-card-border text-foreground font-black"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Set to 0 Stars (No Discount)
              </button>
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-muted-foreground">Selected Stars:</span>
              <span className="font-bold text-foreground text-sm">{starEditVal} / 5 Stars</span>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setStarEditId(null)}>Cancel</Button>
              <Button
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold"
                onClick={() => setStarsMut.mutate({ id: starEditId, stars: starEditVal })}
                disabled={setStarsMut.isPending}
              >
                {setStarsMut.isPending ? "Saving..." : "Save Stars"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
