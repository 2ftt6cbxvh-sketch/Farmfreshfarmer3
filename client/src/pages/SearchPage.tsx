import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function SearchPage() {
  const searchString = useSearch();
  const q = new URLSearchParams(searchString).get("q") || "";

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", "search", q],
    queryFn: () => apiGet<Product[]>(`/api/products?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
  });

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="font-serif text-2xl font-bold mb-1">Search results</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {q ? `Showing results for “${q}”` : "Type something in the search bar"}
        </p>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-card-border bg-card p-10 text-center">
            <p className="text-muted-foreground">No products found{q ? ` for “${q}”` : ""}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
