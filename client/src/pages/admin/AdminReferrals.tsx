import { useQuery } from "@tanstack/react-query";
import { Gift, Users, IndianRupee } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiGet } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

interface Customer {
  id: number; name: string; email: string;
  referralCode: string | null; successfulReferrals: number; referralBalance: number;
}

export default function AdminReferrals() {
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/admin/customers"],
    queryFn: () => apiGet<Customer[]>("/api/admin/customers"),
  });

  const withReferrals = customers.filter((c) => c.referralCode);
  const totalReferrals = customers.reduce((s, c) => s + (c.successfulReferrals || 0), 0);
  const totalBalance = customers.reduce((s, c) => s + Number(c.referralBalance || 0), 0);
  const sorted = [...customers].sort((a, b) => (b.successfulReferrals || 0) - (a.successfulReferrals || 0));

  return (
    <AdminLayout title="Referrals">
      <div className="rounded-xl border border-card-border bg-card p-4 mb-4 text-sm text-muted-foreground" data-testid="card-referral-rules">
        <p className="font-semibold text-foreground mb-1">Program rules</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>New customers get 10% off their first order when signing up with a referral code.</li>
          <li>Referrers earn 5% of the referred customer's qualifying order as reward credit.</li>
          <li>Referrer reward is capped at 30% max discount applied per order.</li>
        </ul>
      </div>

      {isLoading ? <Skeleton className="h-32 rounded-xl" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-card-border bg-card p-4 flex items-center gap-3" data-testid="kpi-customers-with-referrals">
            <span className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary"><Users size={20} /></span>
            <div><p className="text-xs text-muted-foreground">Customers with referral codes</p><p className="text-lg font-bold">{withReferrals.length}</p></div>
          </div>
          <div className="rounded-xl border border-card-border bg-card p-4 flex items-center gap-3" data-testid="kpi-successful-referrals">
            <span className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-accent/20 text-accent"><Gift size={20} /></span>
            <div><p className="text-xs text-muted-foreground">Total successful referrals</p><p className="text-lg font-bold">{totalReferrals}</p></div>
          </div>
          <div className="rounded-xl border border-card-border bg-card p-4 flex items-center gap-3" data-testid="kpi-outstanding-balance">
            <span className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary"><IndianRupee size={20} /></span>
            <div><p className="text-xs text-muted-foreground">Outstanding referral balance</p><p className="text-lg font-bold">{formatINR(totalBalance)}</p></div>
          </div>
        </div>
      )}

      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Customer</th>
                <th className="p-3 font-semibold">Referral code</th>
                <th className="p-3 font-semibold">Successful referrals</th>
                <th className="p-3 font-semibold">Referral balance</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-t border-card-border" data-testid={`row-referral-${c.id}`}>
                  <td className="p-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </td>
                  <td className="p-3 font-mono text-xs">{c.referralCode || "—"}</td>
                  <td className="p-3">{c.successfulReferrals}</td>
                  <td className="p-3 font-medium">{formatINR(Number(c.referralBalance))}</td>
                </tr>
              ))}
              {sorted.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No customers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
