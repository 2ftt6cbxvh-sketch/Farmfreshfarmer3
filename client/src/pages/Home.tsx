import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet, imgUrl } from "@/lib/queryClient";
import {
  ArrowRight, Star, ShieldCheck, Zap, Package, Sparkles, ChevronRight,
  Award, Truck, HeartHandshake, Leaf, CheckCircle2, Clock, Megaphone
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/store";
import { getStarTheme } from "@/lib/starTheme";
import { ProductCard } from "@/components/ProductCard";
import { DietDot } from "@/components/DietDot";
import { TiltCard } from "@/components/TiltCard";
import type { Category, Product } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnnouncementItem } from "@/components/NotificationBell";
import { usePersonalizedRecommendations, clearActiveRecommendationFilters } from "@/lib/recommendation-store";

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

import {
  getInitialCategories,
  saveCachedCategories,
  getInitialProducts,
  saveCachedProducts,
} from "@/lib/catalog-seed";

export default function Home() {
  // Reset subcategory filter when landing on homepage to show farm-wide seasonal wellness picks
  useEffect(() => {
    clearActiveRecommendationFilters();
  }, []);

  const { data: categories = getInitialCategories() } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const data = await apiGet<Category[]>("/api/categories");
      if (Array.isArray(data) && data.length > 0) {
        saveCachedCategories(data);
      }
      return data;
    },
    initialData: getInitialCategories,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allProducts = getInitialProducts() } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const data = await apiGet<Product[]>("/api/products");
      if (Array.isArray(data) && data.length > 0) {
        saveCachedProducts(data);
      }
      return data;
    },
    initialData: getInitialProducts,
    staleTime: 5 * 60 * 1000,
  });

  const personalizedResult = usePersonalizedRecommendations(allProducts, { minCount: 4, maxCount: 8 });

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

  // Live ads from admin
  const { data: activeAds = [] } = useQuery<AnnouncementItem[]>({
    queryKey: ["/api/announcements/active"],
    queryFn: () => apiGet<AnnouncementItem[]>("/api/announcements/active"),
    staleTime: 60000,
  });
  const [adIdx, setAdIdx] = useState(0);
  useEffect(() => {
    if (activeAds.length <= 1) return;
    const t = setInterval(() => setAdIdx((i) => (i + 1) % activeAds.length), 5000);
    return () => clearInterval(t);
  }, [activeAds.length]);

  const isSuperAdmin = Boolean(user?.isPrimaryAdmin || user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" || user?.id === 1);
  const isStaff = Boolean(!isSuperAdmin && user && user.role !== "customer");
  const homeStarsCount = isSuperAdmin
    ? 6
    : isStaff
    ? Math.max(0, Math.min(6, Number(user?.starRating) ?? 5))
    : Math.max(0, Math.min(5, Number(user?.customerStars) || 0));

  const homeStarTheme = getStarTheme(user ? homeStarsCount : 0, isStarThemeEnabled);

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

      {/* ── 🔊 Live Ad / Broadcast Ticker Banner (always visible when ads exist) ── */}
      {activeAds.length > 0 && (() => {
        const ad = activeAds[adIdx % activeAds.length];
        const isCritical = ad.category === "critical";
        const isWarning = ad.category === "warning";
        const bgColor = isCritical
          ? "bg-red-950/90 border-red-500/50 text-red-200"
          : isWarning
          ? "bg-amber-950/90 border-amber-500/50 text-amber-200"
          : "bg-emerald-950/90 border-emerald-500/50 text-emerald-200";
        const icon = isCritical ? "🚨" : isWarning ? "⚠️" : "📢";
        return (
          <div className={`w-full border-b ${bgColor} py-2 px-4 flex items-center justify-center gap-2 text-xs font-bold transition-all animate-in fade-in duration-300`}>
            <span className="shrink-0 text-sm">{icon}</span>
            <span className="font-black truncate max-w-[140px] sm:max-w-none">{ad.title}:</span>
            <span className="truncate max-w-[180px] sm:max-w-lg opacity-90">{ad.message}</span>
            {activeAds.length > 1 && (
              <span className="ml-auto shrink-0 text-[10px] opacity-60">{adIdx + 1}/{activeAds.length}</span>
            )}
          </div>
        );
      })()}

      {/* ── LUXURY OPENING HERO SECTION WITH BALANCED PARALLAX & 3D TILT ── */}
      <section className="relative overflow-hidden pt-10 pb-20 sm:py-24 bg-gradient-to-b from-emerald-950/25 via-background to-background">
        {/* Parallax Layer 0: Ambient Glowing Aura Orbs (Pure GPU Composite) */}
        <div
          className="absolute -top-28 -left-28 w-[420px] h-[420px] bg-emerald-500/18 rounded-full blur-[100px] pointer-events-none animate-pulse-glow"
        />
        <div
          className="absolute top-1/4 -right-28 w-[420px] h-[420px] bg-amber-500/15 rounded-full blur-[100px] pointer-events-none animate-pulse-glow"
        />

        {/* Parallax Layer 1: Elegant Peripheral Organic Depth Accents */}
        <div
          className="absolute top-12 left-8 text-emerald-500/30 select-none pointer-events-none animate-float-slow hidden xl:block"
        >
          <Leaf size={36} className="rotate-12" />
        </div>
        <div
          className="absolute top-32 right-12 text-amber-500/25 select-none pointer-events-none animate-float-reverse hidden xl:block"
        >
          <Sparkles size={32} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Hero Narrative & Value Pillars */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Top Micro-Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black tracking-wide shadow-sm">
              <Sparkles size={14} className="text-emerald-500" />
              <span>{txt.hero_badge || "Vijayawada & Vizag's #1 Instant Organic Farm Delivery"}</span>
            </div>

            {/* Headline */}
            <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-black text-foreground tracking-tight leading-[1.08]">
              Fresh from local farms,{" "}
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage: user
                    ? `linear-gradient(135deg, ${homeStarTheme.fillColor}, ${homeStarTheme.fillColor}cc)`
                    : "linear-gradient(135deg, #10b981, #34d399)",
                }}
              >
                delivered straight
              </span>{" "}
              to your doorstep.
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-xl text-muted-foreground font-medium max-w-2xl leading-relaxed">
              {txt.hero_subtitle ||
                "Hand-picked organic fruits, vine-ripened vegetables, authentic ghee sweets, traditional Andhra pickles, millets & spices."}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="#categories-section"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm shadow-[0_6px_22px_rgba(245,158,11,0.4)] hover:shadow-[0_8px_30px_rgba(245,158,11,0.55)] transition-all duration-300 hover:scale-105 active:scale-95 group"
              >
                <span>Explore Harvest</span>
                <span className="text-base group-hover:translate-x-1 transition-transform">🌾</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>

              <Link
                href="/account/referrals"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border text-foreground font-bold text-sm shadow-sm transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <span>🎁</span>
                <span>Refer & Earn Rewards</span>
              </Link>
            </div>

            {/* Trust Micro-Bullets */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs font-bold text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                <span>100% Naturally Grown</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap size={15} className="text-amber-500 shrink-0" />
                <span>Instant Delivery ETA</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
                <span>Zero Preservatives</span>
              </div>
            </div>
          </div>

          {/* Right Column: 🌟 Luxury Glassmorphic Interactive Showcase Card 🌟 */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md aspect-square rounded-[36px] bg-gradient-to-br from-card/95 via-card/85 to-card/95 border-2 border-emerald-500/30 p-4 sm:p-6 shadow-[0_20px_50px_-15px_rgba(16,185,129,0.25)] hover:shadow-[0_25px_60px_-10px_rgba(16,185,129,0.35)] backdrop-blur-xl transition-all duration-500 ease-out hover:-translate-y-1.5 group cursor-pointer">
              {/* Ambient Glow Aura */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 rounded-[42px] blur-xl opacity-60 group-hover:opacity-90 transition-opacity duration-500 -z-10 pointer-events-none" />

              {/* Main Showcase Image Container */}
              <div className="relative w-full h-full rounded-[28px] overflow-hidden bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-center">
                {showcaseMode === "custom_image" && heroConfig?.customImageUrl ? (
                  <img
                    src={heroConfig.customImageUrl}
                    alt={heroConfig?.customTitle || "Organic Farm Harvest"}
                    fetchPriority="high"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                ) : featuredHeroList.length > 0 ? (
                  <img
                    src={imgUrl(featuredHeroList[heroIdx % featuredHeroList.length]?.image || "/images/hero.jpg")}
                    alt={featuredHeroList[heroIdx % featuredHeroList.length]?.name || "Organic Farm Harvest"}
                    fetchPriority="high"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out animate-in fade-in zoom-in-95 duration-500"
                  />
                ) : (
                  <img
                    src={imgUrl("/images/p-mango.jpg")}
                    alt="Organic Banganapalli Mangoes"
                    fetchPriority="high"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                )}

                {/* Progress Indicators if multiple featured products */}
                {showcaseMode === "featured_products" && featuredHeroList.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md">
                    {featuredHeroList.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHeroIdx(i);
                        }}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === heroIdx % featuredHeroList.length ? "w-5 bg-amber-400" : "w-1.5 bg-white/50"
                        }`}
                        aria-label={`Slide ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Floating Top-Left Badge */}
              <div className="absolute top-6 left-6 bg-card/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl p-2.5 sm:p-3 shadow-xl flex items-center gap-2.5 z-20 group-hover:-translate-y-1 transition-transform duration-300 pointer-events-none">
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

              {/* Floating Bottom-Right Badge */}
              <div className="absolute bottom-6 right-6 bg-card/95 backdrop-blur-xl border border-amber-500/40 rounded-2xl p-2.5 sm:p-3 shadow-xl flex items-center gap-2.5 z-20 group-hover:translate-y-1 transition-transform duration-300 pointer-events-none">
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

      {/* ── 3D Glassmorphic Category Showcase with Centered Grid ── */}
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
                    loading="lazy"
                    decoding="async"
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

      {/* ── Dynamic Personalized & Seasonal Disease Defense Picks ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 border-b border-emerald-500/20 pb-4 gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-500/15 px-3.5 py-1.5 rounded-full border border-amber-500/30 shadow-sm">
              <span className="text-sm">{personalizedResult.reason.icon}</span>
              <span>{personalizedResult.reason.badgeText}</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-black tracking-tight text-foreground mt-2">
              Fresh Picks for You
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
              {personalizedResult.reason.subText}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-88 rounded-3xl" />
            ))}
          </div>
        ) : personalizedResult.products.length === 0 ? (
          <p className="text-muted-foreground text-sm">No products found matching your current preferences.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {personalizedResult.products.map((p) => (
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
