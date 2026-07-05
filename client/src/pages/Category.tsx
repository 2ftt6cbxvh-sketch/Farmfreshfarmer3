import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { DietDot } from "@/components/DietDot";
import type { Category as Cat, Product } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function Category() {
  const [, params] = useRoute("/category/:slug");
  const slug = params?.slug || "";

  const { data: categories = [] } = useQuery<Cat[]>({ queryKey: ["/api/categories"] });
  const category = categories.find((c) => c.slug === slug);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", slug],
    queryFn: () => apiGet<Product[]>(`/api/products?category=${encodeURIComponent(slug)}`),
  });

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold">{category?.name || "Category"}</h1>
          {category && <DietDot tag={category.dietTag} size={16} />}
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {isLoading ? "Loading…" : `${products.length} product${products.length === 1 ? "" : "s"}`}
        </p>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-card-border bg-card p-10 text-center">
            <p className="text-muted-foreground">No products in this category yet. Check back soon.</p>
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
