import { useEffect } from "react";
import { useSearch, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { recordSearchQuery, recordUnmetDemandSearch } from "@/lib/recommendation-store";
import { Sparkles, Radio, ArrowRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SearchPage() {
  const searchString = useSearch();
  const q = new URLSearchParams(searchString).get("q") || "";

  // 1. Fast cached query for exact keyword
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", "search", q],
    queryFn: () => apiGet<Product[]>(`/api/products?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // 2. Fetch popular fresh crops as instant fallback if 0 results found
  const { data: fallbackProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", "featured_fallbacks"],
    queryFn: () => apiGet<Product[]>("/api/products?featured=1"),
    staleTime: 300000,
    enabled: !isLoading && products.length === 0 && q.length > 0,
  });

  // Real-time search signal tracking + Zero-Result Unmet Search pipeline for Narayana AI
  useEffect(() => {
    if (q && q.trim().length > 1) {
      recordSearchQuery(q);

      if (!isLoading && products.length === 0) {
        recordUnmetDemandSearch(q, 0);
      }
    }
  }, [q, isLoading, products.length]);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
          <div>
            <h1 className="font-serif text-2xl font-bold mb-1">Search results</h1>
            <p className="text-sm text-muted-foreground">
              {q ? `Showing results for “${q}”` : "Type something in the search bar"}
            </p>
          </div>
          {products.length > 0 && (
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              {products.length} item{products.length > 1 ? "s" : ""} in stock
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="space-y-8">
            {/* Zero result notice & Live radar badge */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-card to-amber-950/10 p-6 md:p-10 text-center space-y-4 shadow-sm">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-extrabold animate-pulse">
                <Radio size={14} className="text-amber-500" />
                <span>Live Sourcing Alert Dispatched to Narayana AI</span>
              </div>

              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-black text-foreground">
                  “{q}” is currently not in inventory
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We have logged your search in real time with our farm operations team. We procure fresh harvest directly from local Andhra &amp; Telangana growers daily.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <Link href="/">
                  <Button variant="outline" className="text-xs rounded-xl gap-1.5 border-emerald-500/30 cursor-pointer">
                    <ShoppingBag size={14} />
                    Browse Catalog
                  </Button>
                </Link>
                <Link href="/categories">
                  <Button className="text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 cursor-pointer">
                    Explore Categories
                    <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Popular produce recommendations */}
            {fallbackProducts.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-sm font-black text-foreground">
                  <Sparkles size={16} className="text-amber-400" />
                  <span>Popular Farm-Fresh Picks Available Today</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {fallbackProducts.slice(0, 8).map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
