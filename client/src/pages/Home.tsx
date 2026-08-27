import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet, imgUrl } from "@/lib/queryClient";
import {
  ArrowRight, Star, ShieldCheck, Zap, Package, Sparkles, ChevronRight,
  Award, Truck, HeartHandshake, Leaf, CheckCircle2, Clock
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/store";
import { getStarTheme } from "@/lib/starTheme";
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
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    staleTime: 60000,
  });

  const { data: featured = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", "featured"],
    queryFn: () => apiGet<Product[]>("/api/products?featured=1"),
    staleTime: 60000,
  });

  // Dynamic Site Text & Badges Query
  const { data: siteTextData } = useQuery({
    queryKey: ["/api/content/site-text"],
    queryFn: async () => {
      const res = await fetch("/api/content/site-text");
      return res.json();
    },
    staleTime: 60000,
  });

  const txt: Record<string, string> = siteTextData?.textMap || {};

  // Dynamic Hero Showcase Query & Carousel State
  const { data: heroConfig } = useQuery<{
    mode: "featured_products" | "custom_image";
    customImageUrl?: string;
    customTitle?: string;
    customSubtitle?: string;
    featuredProducts?: any[];
  }>({
    queryKey: ["/api/hero-showcase"],
    queryFn: async () => {
      const res = await fetch("/api/hero-showcase");
      return res.json();
    },
    staleTime: 60000,
  });

  const showcaseMode = heroConfig?.mode || "featured_products";
  const featuredHeroList = heroConfig?.featuredProducts || [];
  const [heroIdx, setHeroIdx] = useState(0);

  // Smooth Parallax Scroll Tracking (GPU friendly)
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 3D Card Interactive Tilt
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };
  const handleMouseLeave = () => setMousePos({ x: 0, y: 0 });

  // Auto-rotate hero photos smoothly if 2+ products are selected
  useEffect(() => {
    if (showcaseMode !== "featured_products" || featuredHeroList.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % featuredHeroList.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [showcaseMode, featuredHeroList.length]);

  const { user } = useAuth();
  const { data: publicSettings } = useQuery<any>({
    queryKey: ["/api/settings/public"],
    staleTime: 60000,
  });
  const isStarThemeEnabled = publicSettings?.enable_star_tier_colors !== false;

  const isSuperAdmin = Boolean(user?.isPrimaryAdmin || user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" || user?.id === 1);
  const isStaff = Boolean(!isSuperAdmin && user && user.role !== "customer");
  const homeStarsCount = isSuperAdmin
    ? 6
    : isStaff
    ? Math.max(0, Math.min(6, Number(user?.starRating) ?? 5))
    : Math.max(0, Math.min(5, Number(user?.customerStars) || 0));

  const homeTheme = getStarTheme(user ? homeStarsCount : 0, isStarThemeEnabled);

  // Parallax offsets (capped for performance)
  const bgOrbOffset = Math.min(scrollY * 0.12, 60);
  const cardParallaxOffset = Math.min(scrollY * -0.06, 0);
  const badgeTopOffset = Math.min(scrollY * -0.14, 0);
  const badgeBottomOffset = Math.min(scrollY * -0.10, 0);

  return (
    <Layout>
      {/* ── High-End Organic Luxury Opening Hero with Parallax Scrolling ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-950/25 via-background to-background py-12 sm:py-20 lg:py-24 border-b border-border/80">
        {/* Parallax Ambient Floating Orbs */}
        <div
          className={`pointer-events-none absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full ${homeTheme.ambientGlowClass} opacity-60 blur-[130px] transition-transform duration-75`}
          style={{ transform: `translate3d(0, ${bgOrbOffset}px, 0)` }}
        />
        <div
          className={`pointer-events-none absolute top-1/3 -right-32 w-[30rem] h-[30rem] rounded-full bg-amber-500/20 opacity-40 blur-[140px] transition-transform duration-75`}
          style={{ transform: `translate3d(0, ${-bgOrbOffset}px, 0)` }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* ── Left Column: Headlines, Trust & CTAs ── */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Sparkling Hero Micro-Badge */}
            <div className={`inline-flex items-center gap-2 rounded-full ${homeTheme.heroBadgeClass} text-xs font-black px-4 py-1.5 shadow-md backdrop-blur-xl border border-emerald-500/30`}>
              <Sparkles size={14} className="text-amber-400 animate-pulse shrink-0" />
              <span className="tracking-wide">
                {txt.hero_badge_text || "Vijayawada & Vizag's #1 Instant Farm-Direct Harvest"}
              </span>
            </div>

            {/* Editorial Headline */}
            <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-black leading-[1.08] text-foreground tracking-tight">
              Fresh from local farms,{" "}
              <span className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-400 bg-clip-text text-transparent">
                delivered straight
              </span>{" "}
              to your doorstep.
            </h1>

            {/* Subheading */}
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed font-medium">
              {txt.hero_subtitle_text ||
                "Hand-picked organic fruits, vine-ripened vegetables, authentic ghee sweets, traditional Andhra pickles, millets & spices direct from natural farmers."}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <a
                href="#categories-section"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("categories-section")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`inline-flex items-center gap-2.5 rounded-full ${homeTheme.btnClass} px-7 py-3.5 text-sm font-black shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer`}
                data-testid="button-shop-now"
              >
                <span>Explore Harvest 🌾</span>
                <ArrowRight size={17} />
              </a>

              <Link
                href="/account/referrals"
                className={`inline-flex items-center gap-2 rounded-full ${homeTheme.btnSecondaryClass} px-5 py-3.5 text-xs font-black shadow-md hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer`}
                data-testid="button-refer-earn"
              >
                <span>🎁 Refer & Earn Rewards</span>
              </Link>
            </div>

            {/* Micro-Trust Feature Bar */}
            <div className={`flex flex-wrap items-center gap-4 sm:gap-6 p-4 rounded-3xl bg-card/75 border ${homeTheme.borderClass} backdrop-blur-xl shadow-lg mt-6`}>
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                <span>100% Naturally Grown</span>
              </div>
              <span className="hidden sm:inline text-emerald-500/40 font-bold">•</span>
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Zap size={16} className="text-amber-500 shrink-0 animate-pulse" />
                <span>Instant Delivery ETA</span>
              </div>
              <span className="hidden sm:inline text-emerald-500/40 font-bold">•</span>
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Package size={16} className="text-emerald-500 shrink-0" />
                <span>Zero Preservatives</span>
              </div>
            </div>
          </div>

          {/* ── Right Column: 3D Interactive Parallax Hero Showcase Card ── */}
          <div
            className="lg:col-span-5 relative"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              perspective: "1200px",
              transform: `translate3d(0, ${cardParallaxOffset}px, 0)`,
              transition: "transform 0.1s ease-out",
            }}
          >
            {/* Card Outer Shell with 3D Tilt */}
            <div
              className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-card/95 via-card/90 to-card/95 p-3.5 sm:p-4 shadow-2xl overflow-hidden group transition-transform duration-200 ease-out"
              style={{
                transform: `rotateX(${mousePos.y * -10}deg) rotateY(${mousePos.x * 10}deg)`,
                boxShadow: "0 25px 50px -12px rgba(5, 150, 105, 0.25), 0 0 30px rgba(245, 158, 11, 0.15)",
              }}
            >
              {/* Product Photo Showcase */}
              <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden bg-emerald-950/20">
                {showcaseMode === "custom_image" ? (
                  <img
                    src={heroConfig?.customImageUrl || "/images/p-mango.jpg"}
                    alt="Hero Showcase"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : featuredHeroList.length > 0 ? (
                  <>
                    {featuredHeroList.map((p: any, idx: number) => (
                      <img
                        key={p.id}
                        src={imgUrl(p.image)}
                        alt={p.name}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                          idx === (heroIdx % featuredHeroList.length) ? "opacity-100 z-10 scale-100" : "opacity-0 z-0 scale-105"
                        }`}
                      />
                    ))}
                    {/* Carousel Indicator Dots */}
                    {featuredHeroList.length > 1 && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
                        {featuredHeroList.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setHeroIdx(i)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              i === (heroIdx % featuredHeroList.length) ? "w-5 bg-amber-400" : "w-1.5 bg-white/50"
                            }`}
                            aria-label={`View featured product ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <img
                    src="/images/p-mango.jpg"
                    alt="Organic Harvest"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
              </div>

              {/* Floating Top-Left Badge with Parallax Depth */}
              <div
                className="absolute top-7 left-7 bg-card/90 backdrop-blur-xl border border-emerald-500/35 rounded-2xl p-2.5 sm:p-3 shadow-xl flex items-center gap-2.5 z-20 transition-transform duration-150"
                style={{ transform: `translate3d(0, ${badgeTopOffset}px, 0)` }}
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Leaf size={18} />
                </div>
                <div className="min-w-0 pr-1">
                  <p className="text-xs font-black text-foreground truncate">
                    {showcaseMode === "custom_image"
                      ? heroConfig?.customTitle || "Direct Farm Harvest"
                      : featuredHeroList.length > 0 && featuredHeroList[heroIdx % featuredHeroList.length]
                      ? featuredHeroList[heroIdx % featuredHeroList.length].name
                      : "Direct Farm Harvest"}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    {showcaseMode === "custom_image"
                      ? heroConfig?.customSubtitle || "Picked this morning"
                      : featuredHeroList.length > 0 && featuredHeroList[heroIdx % featuredHeroList.length]
                      ? `₹${featuredHeroList[heroIdx % featuredHeroList.length].price} / ${featuredHeroList[heroIdx % featuredHeroList.length].unit}`
                      : "Picked this morning"}
                  </p>
                </div>
              </div>

              {/* Floating Bottom-Right Badge with Parallax Depth */}
              <div
                className="absolute bottom-7 right-7 bg-card/90 backdrop-blur-xl border border-amber-500/35 rounded-2xl p-2.5 sm:p-3 shadow-xl flex items-center gap-2.5 z-20 transition-transform duration-150"
                style={{ transform: `translate3d(0, ${badgeBottomOffset}px, 0)` }}
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                  <Zap size={18} />
                </div>
                <div className="min-w-0 pr-1">
                  <p className="text-xs font-black text-foreground">Express Delivery</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Combined ETA calculated live</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3D Glassmorphic Category Showcase ── */}
      <section id="categories-section" className="mx-auto max-w-7xl px-4 sm:px-6 py-16 scroll-mt-8">
        <div className="text-center space-y-2 mb-12">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-3.5 py-1 rounded-full border border-emerald-500/30">
            Curated Categories
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-black tracking-tight text-foreground">
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

      {/* ── Featured Products Section ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
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

      {/* ── Organic Assurance & Farm Trust Section ── */}
      <section className="border-t border-emerald-500/20 bg-emerald-950/20 dark:bg-emerald-950/30 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-4 p-6 rounded-3xl bg-card/60 border border-emerald-500/20 backdrop-blur">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                <Leaf size={28} />
              </div>
              <div>
                <h3 className="font-serif text-lg font-black text-foreground">100% Naturally Farm Grown</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Direct from local certified natural farmers in Andhra & Telangana with zero chemical additives.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 p-6 rounded-3xl bg-card/60 border border-amber-500/20 backdrop-blur">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <Truck size={28} />
              </div>
              <div>
                <h3 className="font-serif text-lg font-black text-foreground">Farm to Doorstep in Hours</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Morning harvest delivered directly to your doorstep with express cold-safe transit.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 p-6 rounded-3xl bg-card/60 border border-emerald-500/20 backdrop-blur">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                <Award size={28} />
              </div>
              <div>
                <h3 className="font-serif text-lg font-black text-foreground">Highest Quality Guaranteed</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Every batch is inspected for natural aroma, authentic taste, and traditional purity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
