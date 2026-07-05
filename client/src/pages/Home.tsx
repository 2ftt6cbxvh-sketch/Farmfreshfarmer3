import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet, imgUrl } from "@/lib/queryClient";
import { ArrowRight, Star } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { DietDot } from "@/components/DietDot";
import type { Category, Product } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

const CAT_IMAGES: Record<string, string> = {
  fruits: "/images/cat-fruits.jpg",
  vegetables: "/images/cat-vegetables.jpg",
  "homemade-sweets": "/images/cat-sweets.jpg",
  namkeen: "/images/cat-namkeen.jpg",
  "pickles-veg": "/images/cat-pickle-veg.jpg",
  "pickles-non-veg": "/images/cat-pickle-nonveg.jpg",
  millets: "/images/cat-millets.jpg",
  pulses: "/images/cat-pulses.jpg",
  spices: "/images/cat-spices.jpg",
};

export default function Home() {
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const { data: featured = [], isLoading } = useQuery<Product[]>({ queryKey: ["/api/products", "featured"], queryFn: () => apiGet<Product[]>("/api/products?featured=1") });

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary">
        <img src={imgUrl("/images/hero.jpg")} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-24 max-w-full">
          <div className="max-w-xl">
            <span className="inline-block rounded-full bg-accent/20 text-accent-foreground text-xs font-semibold px-3 py-1 mb-4">
              Now delivering in Visakhapatnam
            </span>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight text-foreground">
              Fresh from the farm, <span className="text-primary">straight to your door</span>
            </h1>
            <p className="mt-4 text-base text-muted-foreground max-w-md">
              Fruits, vegetables, homemade sweets, namkeen, pickles, millets, pulses & spices — instant delivery, naturally fresh.
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/category/fruits" className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover-elevate" data-testid="button-shop-now">
                Shop now <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold">Shop by category</h2>
          <p className="text-muted-foreground text-sm mt-1">Everything fresh, all in one place</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="group flex flex-col items-center text-center rounded-xl border border-card-border bg-card p-4 hover-elevate"
              data-testid={`category-card-${c.slug}`}
            >
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden ring-4 ring-accent/20">
                <img
                  src={imgUrl(CAT_IMAGES[c.slug] || "")}
                  alt={c.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <h3 className="font-semibold text-sm sm:text-base">{c.name}</h3>
                <DietDot tag={c.dietTag} size={13} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold">Fresh picks for you</h2>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
          </div>
        ) : featured.length === 0 ? (
          <p className="text-muted-foreground text-sm">No featured products yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Story */}
      <section className="bg-secondary/50 py-12">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-serif text-2xl font-bold">Our story</h2>
          <p className="mt-3 text-muted-foreground">
            FarmFreshFarmer is a brand-new business born in Visakhapatnam with a simple promise: get the freshest produce,
            authentic homemade sweets, and traditional pickles from local farms and kitchens to your home — fast.
            Every order is hand-picked and delivered with care.
          </p>
          <div className="mt-6 flex justify-center gap-1 text-accent">
            {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={18} fill="currentColor" />)}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Loved by our first customers in Vizag</p>
        </div>
      </section>
    </Layout>
  );
}
