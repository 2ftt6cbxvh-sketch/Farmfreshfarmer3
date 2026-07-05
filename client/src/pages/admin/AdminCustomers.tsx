import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Customer {
  id: number; name: string; email: string; phone: string | null; status: string;
  hasCompletedFirstOrder: boolean; totalOrders: number; totalSpent: string;
  referralCode: string | null; successfulReferrals: number; referralBalance: number;
}

export default function AdminCustomers() {
  const { toast } = useToast();
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

  return (
    <AdminLayout title="Customers">
      <p className="text-sm text-muted-foreground mb-4">All registered customers, their order history, and referral performance.</p>
      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Customer</th>
                <th className="p-3 font-semibold">Phone</th>
                <th className="p-3 font-semibold">Orders</th>
                <th className="p-3 font-semibold">Total spent</th>
                <th className="p-3 font-semibold">First order</th>
                <th className="p-3 font-semibold">Referral code</th>
                <th className="p-3 font-semibold">Referrals</th>
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
                  <td className="p-3 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="p-3">{c.totalOrders}</td>
                  <td className="p-3 font-medium">{formatINR(Number(c.totalSpent))}</td>
                  <td className="p-3">{c.hasCompletedFirstOrder ? <Badge variant="default">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                  <td className="p-3 font-mono text-xs">{c.referralCode || "—"}</td>
                  <td className="p-3">{c.successfulReferrals}</td>
                  <td className="p-3">{formatINR(Number(c.referralBalance))}</td>
                  <td className="p-3"><Badge variant={c.status === "blocked" ? "destructive" : "default"}>{c.status}</Badge></td>
                  <td className="p-3">
                    <div className="flex justify-end">
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
    </AdminLayout>
  );
}
