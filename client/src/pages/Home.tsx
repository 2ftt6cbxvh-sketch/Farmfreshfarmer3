import { useState, useRef, useEffect, useMemo } from "react";
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

  // Smooth Multi-Layer Parallax Scroll Tracking
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    let animationFrameId: number;
    const handleScroll = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        setScrollY(window.scrollY);
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 3D Card Interactive Tilt & Specular Light Follow
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHoveringCard, setIsHoveringCard] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };
  const handleMouseEnter = () => setIsHoveringCard(true);
  const handleMouseLeave = () => {
    setIsHoveringCard(false);
    setMousePos({ x: 0, y: 0 });
  };

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

  const homeStarTheme = getStarTheme(user ? homeStarsCount : 0, isStarThemeEnabled);

  // Parallax offsets calculation for multi-layer depth
  const bgOrbOffset1 = scrollY * 0.25;
  const bgOrbOffset2 = scrollY * -0.18;
  const heroTextOffset = scrollY * 0.08;
  const floatingLeaf1Offset = scrollY * 0.45;
  const floatingLeaf2Offset = scrollY * -0.30;
  const floatingGrainOffset = scrollY * 0.38;
  const showcaseCardOffset = scrollY * 0.15;

  return (
    <Layout>
      {/* ── Dynamic VIP Star Tier Notification Banner ── */}
      {user && (
        <div
          className="w-full border-b py-2 px-4 text-center text-xs font-black tracking-wide flex items-center justify-center gap-2 transition-all shadow-inner"
          style={{
            backgroundColor: homeStarTheme.fillColor + "18",
            borderColor: homeStarTheme.fillColor + "45",
            color: homeStarTheme.fillColor,
          }}
        >
          <span className="text-base">{homeStarsCount >= 6 ? "👑" : "⭐"}</span>
          <span>
            {user.name ? `${user.name} — ` : ""}
            Active Status: <strong>{homeStarTheme.label} ({homeStarsCount} Stars)</strong>
          </span>
        </div>
      )}

      {/* ── LUXURY OPENING HERO SECTION WITH PARALLAX & 3D TILT ── */}
      <section className="relative overflow-hidden pt-10 pb-20 sm:py-24 bg-gradient-to-b from-emerald-950/25 via-background to-background">
        {/* Parallax Layer 0: Ambient Glowing Aura Orbs */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse-glow parallax-layer"
          style={{ transform: `translate3d(0, ${bgOrbOffset1}px, 0)` }}
        />
        <div
          className="absolute top-1/3 -right-32 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse-glow parallax-layer"
          style={{ transform: `translate3d(0, ${bgOrbOffset2}px, 0)` }}
        />

        {/* Parallax Layer 1: Floating Seasonal Particles */}
        <div
          className="absolute top-20 left-[10%] text-2xl opacity-40 select-none pointer-events-none animate-float-slow parallax-layer"
          style={{ transform: `translate3d(0, ${floatingLeaf1Offset}px, 0)` }}
        >
          🌿
        </div>
        <div
          className="absolute top-48 right-[15%] text-2xl opacity-40 select-none pointer-events-none animate-float-reverse parallax-layer"
          style={{ transform: `translate3d(0, ${floatingGrainOffset}px, 0)` }}
        >
          🌾
        </div>
        <div
          className="absolute bottom-20 left-[20%] text-xl opacity-35 select-none pointer-events-none animate-float-slow parallax-layer"
          style={{ transform: `translate3d(0, ${floatingLeaf2Offset}px, 0)` }}
        >
          🍃
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Hero Narrative & Value Pillars */}
          <div
            className="lg:col-span-7 space-y-6 text-center lg:text-left parallax-layer"
            style={{ transform: `translate3d(0, ${heroTextOffset}px, 0)` }}
          >
            {/* Top Micro-Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black shadow-xs">
              <Sparkles size={14} className="text-amber-500 animate-spin-slow" />
              <span>{txt.hero_badge || "Vijayawada & Vizag's #1 Instant Organic Farm Delivery"}</span>
            </div>

            {/* Editorial Serif Headline */}
            <h1 className="font-serif text-4xl sm:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
              Fresh from local farms,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-emerald-500 to-amber-500 dark:from-emerald-400 dark:via-emerald-300 dark:to-amber-400">
                delivered straight
              </span>{" "}
              to your doorstep.
            </h1>

            {/* Sub-headline / Brand Promise */}
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              {txt.hero_subtext ||
                "Hand-picked organic fruits, vine-ripened vegetables, authentic ghee sweets, traditional Andhra pickles, millets & spices."}
            </p>

            {/* CTA Action Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="#categories-section"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-[0_8px_25px_rgba(245,158,11,0.35)] hover:shadow-[0_12px_32px_rgba(245,158,11,0.5)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
              >
                <span>Explore Harvest 🌾</span>
                <ArrowRight size={16} />
              </a>

              <Link
                href="/account/referrals"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border text-foreground font-bold text-sm hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <span>🎁 Refer & Earn Rewards</span>
              </Link>
            </div>

            {/* Micro Trust Bar */}
            <div className="pt-6 grid grid-cols-3 gap-2 sm:gap-4 max-w-lg mx-auto lg:mx-0 border-t border-emerald-500/20 text-xs font-semibold text-muted-foreground">
              <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                <span>100% Naturally Grown</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                <Zap size={15} className="text-amber-500 shrink-0" />
                <span>Instant Delivery ETA</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                <Package size={15} className="text-emerald-500 shrink-0" />
                <span>Zero Preservatives</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Perspective Parallax Showcase Card */}
          <div
            className="lg:col-span-5 flex justify-center perspective-[1200px] parallax-layer"
            style={{ transform: `translate3d(0, ${showcaseCardOffset}px, 0)` }}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div
              className="relative w-full max-w-md aspect-4/3 rounded-3xl p-3 bg-gradient-to-br from-emerald-500/30 via-card to-amber-500/20 border border-emerald-500/40 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out"
              style={{
                transform: `rotateX(${mousePos.y * -16}deg) rotateY(${mousePos.x * 16}deg) scale3d(${
                  isHoveringCard ? 1.02 : 1
                }, ${isHoveringCard ? 1.02 : 1}, 1)`,
                transformStyle: "preserve-3d",
              }}
            >
              {/* Specular Lighting Glow */}
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none opacity-50 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at ${((mousePos.x + 0.5) * 100).toFixed(1)}% ${(
                    (mousePos.y + 0.5) *
                    100
                  ).toFixed(1)}%, rgba(255,255,255,0.2) 0%, transparent 60%)`,
                }}
              />

              {/* Hero Image Showcase Carousel */}
              <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black/40">
                {showcaseMode === "custom_image" ? (
                  <img
                    src={heroConfig?.customImageUrl || "/images/p-mango.jpg"}
                    alt={heroConfig?.customTitle || "Direct Farm Harvest"}
                    className="w-full h-full object-cover"
                  />
                ) : featuredHeroList.length > 0 ? (
                  featuredHeroList.map((prod, idx) => (
                    <img
                      key={prod.id || idx}
                      src={imgUrl(prod.image || "/images/p-mango.jpg")}
                      alt={prod.name}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                        idx === heroIdx % featuredHeroList.length ? "opacity-100 scale-105" : "opacity-0 scale-100"
                      }`}
                      style={{ transition: "opacity 1s ease-in-out, transform 4s ease-out" }}
                    />
                  ))
                ) : (
                  <img
                    src="/images/p-mango.jpg"
                    alt="Direct Farm Harvest"
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Carousel Progress Dots */}
                {showcaseMode === "featured_products" && featuredHeroList.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-30 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
                    {featuredHeroList.map((_, dotIdx) => (
                      <button
                        key={dotIdx}
                        onClick={() => setHeroIdx(dotIdx)}
                        className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                          dotIdx === heroIdx % featuredHeroList.length
                            ? "bg-amber-400 w-4 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                            : "bg-white/40 hover:bg-white/70"
                        }`}
                        aria-label={`View hero item ${dotIdx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Floating Top-Left Badge in 3D Space */}
              <div
                className="absolute top-6 left-6 bg-card/92 backdrop-blur-xl border border-emerald-500/35 rounded-2xl p-2.5 sm:p-3 shadow-xl flex items-center gap-2.5 z-20 transition-transform duration-200"
                style={{
                  transform: `translateZ(40px) translate3d(${mousePos.x * -10}px, ${mousePos.y * -10}px, 0)`,
                }}
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
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
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
                    {showcaseMode === "custom_image"
                      ? heroConfig?.customSubtitle || "Picked this morning"
                      : featuredHeroList.length > 0 && featuredHeroList[heroIdx % featuredHeroList.length]
                      ? `₹${featuredHeroList[heroIdx % featuredHeroList.length].price} / ${
                          featuredHeroList[heroIdx % featuredHeroList.length].unit
                        }`
                      : "Picked this morning"}
                  </p>
                </div>
              </div>

              {/* Floating Bottom-Right Badge in 3D Space */}
              <div
                className="absolute bottom-6 right-6 bg-card/92 backdrop-blur-xl border border-amber-500/35 rounded-2xl p-2.5 sm:p-3 shadow-xl flex items-center gap-2.5 z-20 transition-transform duration-200"
                style={{
                  transform: `translateZ(50px) translate3d(${mousePos.x * 12}px, ${mousePos.y * 12}px, 0)`,
                }}
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                  <Zap size={18} />
                </div>
                <div className="min-w-0 pr-1">
                  <p className="text-xs font-black text-foreground">Express Delivery</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Live Hub Transit</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3D Glassmorphic Category Showcase with Parallax ── */}
      <section id="categories-section" className="mx-auto max-w-7xl px-4 sm:px-6 py-16 scroll-mt-8 relative">
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
            <div className="flex flex-col sm:flex-row items-center gap-4 p-6 rounded-3xl bg-card/60 border border-emerald-500/20 backdrop-blur hover:scale-102 transition-transform duration-300">
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

            <div className="flex flex-col sm:flex-row items-center gap-4 p-6 rounded-3xl bg-card/60 border border-amber-500/20 backdrop-blur hover:scale-102 transition-transform duration-300">
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

            <div className="flex flex-col sm:flex-row items-center gap-4 p-6 rounded-3xl bg-card/60 border border-emerald-500/20 backdrop-blur hover:scale-102 transition-transform duration-300">
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
