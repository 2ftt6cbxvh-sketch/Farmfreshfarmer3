import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ShoppingBag, IndianRupee, Receipt, Repeat, AlertTriangle, CalendarClock,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import { AdminLayout } from "./AdminLayout";
import { apiGet } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Product } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

interface SalesSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  activeSubscriptions: number;
  upcomingDeliveries: { date: string; day: string }[];
  lowStockCount: number;
}

function KpiCard({ icon: Icon, label, value, testid }: { icon: any; label: string; value: string | number; testid: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-4 flex items-center gap-3" data-testid={testid}>
      <span className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary shrink-0">
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: summary, isLoading } = useQuery<SalesSummary>({
    queryKey: ["/api/admin/sales-summary"],
    queryFn: () => apiGet<SalesSummary>("/api/admin/sales-summary"),
  });
  const { data: lowStock = [], isLoading: lowLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/inventory/low-stock"],
    queryFn: () => apiGet<Product[]>("/api/admin/inventory/low-stock"),
  });

  const chartData = summary
    ? Object.entries(summary.ordersByStatus).map(([status, count]) => ({ status, count }))
    : [];

  return (
    <AdminLayout title="Dashboard">
      {isLoading || !summary ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <KpiCard icon={ShoppingBag} label="Total orders" value={summary.totalOrders} testid="kpi-total-orders" />
          <KpiCard icon={IndianRupee} label="Total revenue" value={formatINR(summary.totalRevenue)} testid="kpi-total-revenue" />
          <KpiCard icon={Receipt} label="Avg order value" value={formatINR(summary.averageOrderValue)} testid="kpi-avg-order" />
          <KpiCard icon={Repeat} label="Active subscriptions" value={summary.activeSubscriptions} testid="kpi-active-subs" />
          <KpiCard icon={AlertTriangle} label="Low stock items" value={summary.lowStockCount} testid="kpi-low-stock" />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Upcoming Sat/Sun deliveries */}
        <div className="rounded-xl border border-card-border bg-card p-5 lg:col-span-1" data-testid="card-upcoming-deliveries">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock size={18} className="text-accent" />
            <h2 className="font-semibold">Upcoming Sat/Sun deliveries</h2>
          </div>
          {isLoading || !summary ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : summary.upcomingDeliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming deliveries scheduled.</p>
          ) : (
            <ul className="space-y-2" data-testid="list-upcoming-deliveries">
              {summary.upcomingDeliveries.map((d, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
                  <span className="font-medium">{d.day}</span>
                  <span className="text-muted-foreground">{new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Orders by status chart */}
        <div className="rounded-xl border border-card-border bg-card p-5 lg:col-span-2" data-testid="card-orders-by-status">
          <h2 className="font-semibold mb-3">Orders by status</h2>
          {isLoading || !summary ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--card-border))" />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--card-border))", borderRadius: 8 }} />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Low stock mini table */}
      <div className="rounded-xl border border-card-border bg-card p-5 mt-4" data-testid="card-low-stock">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Low-stock products</h2>
          <Link href="/admin/inventory" className="text-sm text-primary underline" data-testid="link-view-inventory">View inventory</Link>
        </div>
        {lowLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : lowStock.length === 0 ? (
          <p className="text-sm text-muted-foreground">All products are well stocked.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-1 font-medium">Product</th><th className="py-1 font-medium">Stock</th></tr>
            </thead>
            <tbody>
              {lowStock.slice(0, 8).map((p) => (
                <tr key={p.id} className="border-t border-card-border" data-testid={`row-lowstock-${p.id}`}>
                  <td className="py-1.5">{p.name}</td>
                  <td className="py-1.5 text-destructive font-semibold">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
