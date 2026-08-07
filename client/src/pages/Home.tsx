import { useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet, imgUrl } from "@/lib/queryClient";
import { ArrowRight, Star, ShieldCheck, Zap, Package, Sparkles, ChevronRight, Award, Truck, HeartHandshake, Leaf } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { DietDot } from "@/components/DietDot";
import { TiltCard } from "@/components/TiltCard";
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
  const { data: featured = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", "featured"],
    queryFn: () => apiGet<Product[]>("/api/products?featured=1"),
  });

  // Dynamic Site Text & Badges Query
  const { data: siteTextData } = useQuery({
    queryKey: ["/api/content/site-text"],
    queryFn: async () => {
      const res = await fetch("/api/content/site-text");
      return res.json();
    },
  });

  const txt: Record<string, string> = siteTextData?.textMap || {};

  // Dynamic Hero Showcase Query & Carousel State
  const { data: heroConfig } = useQuery({
    queryKey: ["/api/hero-showcase"],
    queryFn: async () => {
      const res = await fetch("/api/hero-showcase");
      return res.json();
    },
  });

  const showcaseMode = heroConfig?.mode || "featured_products";
  const featuredHeroList = heroConfig?.featuredProducts || [];
  const [heroIdx, setHeroIdx] = useState(0);

  // Auto-rotate hero photos smoothly if 2+ products are selected
  useEffect(() => {
    if (showcaseMode !== "featured_products" || featuredHeroList.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % featuredHeroList.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [showcaseMode, featuredHeroList.length]);

  return (
    <Layout>
      {/* Smooth Ambient Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-500/10 via-background to-background py-16 sm:py-24 border-b border-emerald-500/15">
        {/* Background Ambient Spheres */}
        <div className="pointer-events-none absolute -top-32 -left-32 w-[30rem] h-[30rem] rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="pointer-events-none absolute top-1/2 -right-32 w-[30rem] h-[30rem] rounded-full bg-amber-500/15 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-black px-4 py-1.5 shadow-sm backdrop-blur-md">
              <Sparkles size={14} className="text-amber-500 animate-pulse" />
              <span>{txt.hero_badge_text || "Visakhapatnam's #1 Instant Organic Farm Delivery"}</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-6xl font-extrabold leading-[1.1] text-foreground tracking-tight">
              {txt.hero_headline_text || "Fresh from local farms, delivered straight to your doorstep."}
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed font-medium">
              {txt.hero_subtitle_text || "Hand-picked organic fruits, vine-ripened vegetables, authentic ghee sweets, traditional Andhra pickles, millets & spices."}
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/category/fruits"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-700 via-primary to-green-600 text-white px-8 py-4 text-sm font-extrabold shadow-xl shadow-emerald-900/20 hover:shadow-emerald-500/30 hover:scale-105 transition-all duration-300"
                data-testid="button-shop-now"
              >
                Explore Categories <ArrowRight size={18} />
              </Link>
            </div>

            {/* Sleek Feature Bar */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 p-4 rounded-2xl bg-card/60 border border-emerald-500/20 backdrop-blur-xl shadow-lg mt-6">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                <span>100% Naturally Grown</span>
              </div>
              <span className="hidden sm:inline text-emerald-500/30 font-bold">•</span>
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Zap size={16} className="text-amber-500 shrink-0 animate-pulse" />
                <span>Instant Delivery ETA</span>
              </div>
              <span className="hidden sm:inline text-emerald-500/30 font-bold">•</span>
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Package size={16} className="text-emerald-500 shrink-0" />
                <span>Zero Preservatives</span>
              </div>
            </div>
          </div>

          {/* Hero Right Showcase Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-card via-card/90 to-card/95 p-4 shadow-2xl overflow-hidden group">
              {showcaseMode === "custom_image" ? (
                <img
                  src={heroConfig?.customImageUrl || "/images/p-mango.jpg"}
                  alt="Organic Harvest"
                  className="w-full h-80 sm:h-96 rounded-2xl object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : featuredHeroList.length > 0 ? (
                <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden">
                  {featuredHeroList.map((p: any, idx: number) => (
                    <img
                      key={p.id}
                      src={imgUrl(p.image)}
                      alt={p.name}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                        idx === (heroIdx % featuredHeroList.length) ? "opacity-100 z-10" : "opacity-0 z-0"
                      }`}
                    />
                  ))}
                </div>
              ) : (
                <img
                  src="/images/p-mango.jpg"
                  alt="Organic Harvest"
                  className="w-full h-80 sm:h-96 rounded-2xl object-cover transition-transform duration-700 group-hover:scale-105"
                />
              )}

              {/* Showcase Floating Badge */}
              <div className="absolute top-8 left-8 bg-card/90 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-3 shadow-xl flex items-center gap-3 z-20">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Leaf size={20} />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-foreground">
                    {showcaseMode === "custom_image"
                      ? heroConfig?.customTitle || "Direct Farm Harvest"
                      : featuredHeroList.length > 0 && featuredHeroList[heroIdx % featuredHeroList.length]
                      ? featuredHeroList[heroIdx % featuredHeroList.length].name
                      : "Direct Farm Harvest"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {showcaseMode === "custom_image"
                      ? heroConfig?.customSubtitle || "Picked this morning"
                      : featuredHeroList.length > 0 && featuredHeroList[heroIdx % featuredHeroList.length]
                      ? `₹${featuredHeroList[heroIdx % featuredHeroList.length].price} / ${featuredHeroList[heroIdx % featuredHeroList.length].unit}`
                      : "Picked this morning"}
                  </p>
                </div>
              </div>

              <div className="absolute bottom-8 right-8 bg-card/90 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-3 shadow-xl flex items-center gap-3 z-20">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                  <Zap size={20} />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-foreground">Express Delivery</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Combined ETA calculated live</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3D Glassmorphic Category Showcase */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="text-center space-y-2 mb-12">
          <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/30">
            Curated Categories
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Explore Our Organic Harvest
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((c) => (
            <TiltCard key={c.slug} maxTilt={10} perspective={1000}>
              <Link
                href={`/category/${c.slug}`}
                className="group relative flex flex-col items-center text-center p-6 rounded-3xl border border-emerald-500/20 bg-card hover:bg-card/95 shadow-md hover:shadow-xl transition-all duration-300"
                data-testid={`card-category-${c.slug}`}
              >
                <div className="relative w-28 h-28 rounded-full overflow-hidden mb-4 border-2 border-emerald-500/30 group-hover:border-primary transition-colors p-1 bg-gradient-to-b from-emerald-500/20 to-transparent">
                  <img
                    src={CAT_IMAGES[c.slug] || imgUrl(c.image)}
                    alt={c.name}
                    className="w-full h-full object-cover rounded-full transition-transform duration-500 group-hover:scale-115"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <h3 className="font-serif text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {c.name}
                  </h3>
                  <DietDot tag={c.dietTag} size={15} />
                </div>

                <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  <span>Browse Products</span>
                  <ChevronRight size={14} />
                </div>
              </Link>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-end justify-between mb-8 border-b border-emerald-500/20 pb-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/30">
              Peak Season Favorites
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-foreground mt-2">
              Fresh Picks for You
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-88 rounded-3xl" />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <p className="text-muted-foreground text-sm">No featured products yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* 3D Glass Bento Grid Section — Our Farm-to-Home Promise */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="rounded-3xl border border-emerald-500/25 bg-card/90 backdrop-blur-2xl p-8 sm:p-14 shadow-2xl relative overflow-hidden">
          {/* Subtle Glow Spheres */}
          <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-amber-500/10 blur-[90px]" />

          <div className="text-center space-y-3 max-w-2xl mx-auto mb-12 relative z-10">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 px-4 py-1.5 rounded-full border border-emerald-500/30">
              {txt.promise_badge_text || "Visakhapatnam Farm to Fork"}
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-extrabold text-foreground">
              {txt.promise_title_text || "Our Farm-to-Home Promise"}
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base font-medium">
              {txt.promise_desc_text || "Connecting households directly with local organic farms and authentic Andhra kitchens. Zero chemicals, zero artificial ripening, and instant delivery right when you need it."}
            </p>
          </div>

          {/* Interactive 3D Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
            <TiltCard maxTilt={8} perspective={1000}>
              <div className="h-full p-6 rounded-2xl border border-emerald-500/20 bg-secondary/40 hover:bg-secondary/70 backdrop-blur-md transition-all shadow-md hover:shadow-xl space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-600/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Leaf size={24} />
                </div>
                <h3 className="font-serif text-lg font-bold text-foreground">{txt.promise_card1_title || "100% Organic"}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {txt.promise_card1_desc || "Sourced daily from certified local organic farms in Andhra Pradesh with zero chemical pesticides."}
                </p>
              </div>
            </TiltCard>

            <TiltCard maxTilt={8} perspective={1000}>
              <div className="h-full p-6 rounded-2xl border border-emerald-500/20 bg-secondary/40 hover:bg-secondary/70 backdrop-blur-md transition-all shadow-md hover:shadow-xl space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                  <Truck size={24} />
                </div>
                <h3 className="font-serif text-lg font-bold text-foreground">{txt.promise_card2_title || "Combined ETA"}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {txt.promise_card2_desc || "Haversine distance transit calculation + warehouse packing mins returned live for your PIN code."}
                </p>
              </div>
            </TiltCard>

            <TiltCard maxTilt={8} perspective={1000}>
              <div className="h-full p-6 rounded-2xl border border-emerald-500/20 bg-secondary/40 hover:bg-secondary/70 backdrop-blur-md transition-all shadow-md hover:shadow-xl space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-600/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <HeartHandshake size={24} />
                </div>
                <h3 className="font-serif text-lg font-bold text-foreground">{txt.promise_card3_title || "Authentic Recipes"}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {txt.promise_card3_desc || "Handcrafted ghee boondi laddus, spicy avakaya pickles, and namkeen made in small traditional batches."}
                </p>
              </div>
            </TiltCard>

            <TiltCard maxTilt={8} perspective={1000}>
              <div className="h-full p-6 rounded-2xl border border-emerald-500/20 bg-secondary/40 hover:bg-secondary/70 backdrop-blur-md transition-all shadow-md hover:shadow-xl space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                  <Award size={24} />
                </div>
                <h3 className="font-serif text-lg font-bold text-foreground">{txt.promise_card4_title || "Rated 4.9/5 Stars"}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {txt.promise_card4_desc || "Trusted by 1,200+ households across Visakhapatnam and Vijayawada."}
                </p>
              </div>
            </TiltCard>
          </div>

          <div className="flex items-center justify-center gap-1 text-amber-400 pt-8 relative z-10">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={22} fill="currentColor" />
            ))}
            <span className="text-xs font-black text-foreground ml-2">Rated 4.9/5 by 1,200+ Households</span>
          </div>
        </div>
      </section>
    </Layout>
  );
}
