import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Package } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/store";
import { apiGet } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Order } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Delivered") return "default";
  if (status === "Cancelled") return "outline";
  return "secondary";
}

export default function Orders() {
  const { user, loading } = useAuth();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/mine"],
    queryFn: () => apiGet<Order[]>("/api/orders/mine"),
    enabled: !!user,
  });

  if (!loading && !user) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <Package className="mx-auto text-muted-foreground" size={44} />
          <h1 className="font-serif text-2xl font-bold mt-4">Please log in</h1>
          <p className="text-muted-foreground mt-2">Log in to see your order history.</p>
          <Link href="/login" className="inline-block mt-6 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover-elevate">Log in</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-6">My orders</h1>
        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-card-border bg-card p-10 text-center">
            <p className="text-muted-foreground">You haven't placed any orders yet.</p>
            <Link href="/" className="text-primary underline mt-2 inline-block">Start shopping</Link>
          </div>
        ) : (
          <ul className="space-y-4" role="list">
            {orders.map((o) => (
              <li key={o.id} className="rounded-xl border border-card-border bg-card p-4" data-testid={`order-${o.id}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Order #{o.id}</span>
                  <Badge variant={statusVariant(o.status)}>{o.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{new Date(o.createdAt).toLocaleString("en-IN")}</p>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-card-border text-sm">
                  <span className="text-muted-foreground">{o.paymentMethod}{o.couponCode ? ` · ${o.couponCode}` : ""}</span>
                  <span className="font-bold">{formatINR(Number(o.total))}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
