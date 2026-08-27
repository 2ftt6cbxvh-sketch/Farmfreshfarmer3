import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, ShoppingCart, Menu, X, Sun, Moon, Sparkles, TrendingUp,
  MapPin, ShieldCheck, Zap, ChevronRight, CheckCircle2,
  Lock, Store
} from "lucide-react";
import { useCart, useAuth } from "@/lib/store";
import { useTheme } from "@/lib/theme-provider";
import { useQuery } from "@tanstack/react-query";
import type { Category } from "@/lib/types";
import { DietDot } from "./DietDot";
import { imgUrl } from "@/lib/queryClient";
import { getStarTheme } from "@/lib/starTheme";

export function Header() {
  const { count } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [location, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileClosing, setMobileClosing] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartPopped, setCartPopped] = useState(false);

  const prevCount = useRef(count);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const mobileSearchBoxRef = useRef<HTMLDivElement>(null);

  // Animate cart on item count change
  useEffect(() => {
    if (count !== prevCount.current) {
      setCartPopped(true);
      const t = setTimeout(() => setCartPopped(false), 600);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
  }, [count]);

  // Track scroll for sticky elevated glass navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = document.getElementById("main-search-input");
        input?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { data: publicSettings } = useQuery<any>({
    queryKey: ["/api/settings/public"],
    staleTime: 60000,
  });

  const { data: searchConfig } = useQuery<any>({
    queryKey: ["/api/search/config"],
    staleTime: 60000,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    staleTime: 60000,
  });

  const { data: allProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    staleTime: 60000,
  });

  const isStarThemeEnabled = publicSettings?.enable_star_tier_colors !== false;
  const isSuperAdmin = Boolean(user?.isPrimaryAdmin || user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" || user?.id === 1);
  const isStaff = Boolean(!isSuperAdmin && user && user.role !== "customer");
  const starsCount = isSuperAdmin
    ? 6
    : isStaff
    ? Math.max(0, Math.min(6, Number(user?.starRating) ?? 5))
    : Math.max(0, Math.min(5, Number(user?.customerStars) || 0));

  const currentHeaderStarTheme = getStarTheme(user ? starsCount : 0, isStarThemeEnabled);

  // Close search suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(e.target as Node) &&
        mobileSearchBoxRef.current &&
        !mobileSearchBoxRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    navigate(`/search?q=${encodeURIComponent(search.trim())}`);
    setSearchFocused(false);
    closeMobileMenu();
  }

  function handleProductSearchClick(productId: number) {
    setSearchFocused(false);
    closeMobileMenu();
    navigate(`/product/${productId}`);
  }

  function closeMobileMenu() {
    if (!mobileOpen) return;
    setMobileClosing(true);
    setTimeout(() => {
      setMobileOpen(false);
      setMobileClosing(false);
    }, 220);
  }

  // Recommendations and query predictions
  const recommendations: string[] = searchConfig?.recommendations?.length
    ? searchConfig.recommendations
    : ["Alphonso Mango", "Fresh Tomatoes", "Ghee Laddu", "Avakaya Pickle", "Organic Spinach"];

  const predictions = search.trim().length > 0
    ? allProducts
        .filter((p) => p.active !== false && p.approvalStatus !== "pending")
        .filter((p) =>
          p.name?.toLowerCase().includes(search.toLowerCase()) ||
          p.categorySlug?.toLowerCase().includes(search.toLowerCase()) ||
          p.description?.toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, 5)
    : [];

  return (
    <header className="sticky top-0 z-50 w-full transition-all duration-300">
      {/* ── Main Floating Glassmorphic Navigation Bar ── */}
      <div
        className={`w-full backdrop-blur-xl transition-all duration-300 border-b ${
          scrolled
            ? "bg-background/95 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.2)] border-emerald-500/30 py-2.5"
            : "bg-background/90 shadow-sm border-emerald-500/20 py-3"
        }`}
      >
        <div className="mx-auto max-w-7xl px-3 sm:px-6 flex items-center justify-between gap-3 sm:gap-6">
          {/* Logo & Brand Wordmark */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group select-none">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-amber-600 p-0.5 shadow-md group-hover:scale-105 transition-transform duration-300 flex items-center justify-center">
              <img
                src={imgUrl("/images/logo-icon.png")}
                alt="FarmFreshFarmer"
                className="w-full h-full object-contain filter drop-shadow"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg sm:text-xl font-black tracking-tight text-foreground group-hover:text-emerald-500 transition-colors leading-none">
                FarmFresh<span className="text-emerald-500">Farmer</span>
              </span>
              <span className="text-[9px] font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase mt-0.5">
                ORGANIC · FARM TO HOME
              </span>
            </div>
          </Link>

          {/* Desktop Search Bar with Shortcut Hint & Auto-complete */}
          <div ref={searchBoxRef} className="hidden md:flex flex-1 max-w-xl relative">
            <form onSubmit={submitSearch} className="w-full relative">
              <div className="relative flex items-center w-full">
                <input
                  id="main-search-input"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="Search organic fruits, ghee sweets, avakaya pickles..."
                  className="w-full rounded-full border border-emerald-500/30 bg-secondary/50 dark:bg-zinc-900/60 backdrop-blur-md pl-10 pr-20 py-2 text-xs font-semibold text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
                  data-testid="input-search"
                />
                <Search size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />

                {/* Shortcut Badge / Search Button */}
                <div className="absolute right-1.5 flex items-center gap-1">
                  {!search && (
                    <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground bg-background/80 border border-border rounded-md shadow-xs pointer-events-none">
                      ⌘K
                    </kbd>
                  )}
                  <button
                    type="submit"
                    className="w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors shadow-xs"
                    aria-label="Submit search"
                  >
                    <Search size={13} />
                  </button>
                </div>
              </div>
            </form>

            {/* Desktop Search Dropdown */}
            {searchFocused && (
              <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-card/98 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.35)] z-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Trending Search Tags */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-500 mb-2">
                    <TrendingUp size={13} />
                    <span>Trending Recommendations</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recommendations.map((rec) => (
                      <button
                        key={rec}
                        onClick={() => {
                          setSearch(rec);
                          navigate(`/search?q=${encodeURIComponent(rec)}`);
                          setSearchFocused(false);
                        }}
                        className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-foreground transition-all active:scale-95 cursor-pointer"
                      >
                        {rec}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Matching Predictions */}
                {search.trim().length > 0 && (
                  <div className="pt-3 border-t border-emerald-500/20 space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                      <Sparkles size={13} />
                      <span>Matching Products</span>
                    </div>

                    {predictions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No direct product matches found.</p>
                    ) : (
                      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                        {predictions.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleProductSearchClick(p.id)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-emerald-500/15 cursor-pointer transition-colors group/item"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {p.image ? (
                                <img src={imgUrl(p.image)} alt={p.name} className="w-8 h-8 rounded-lg object-cover shrink-0 border" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-emerald-950/30 flex items-center justify-center text-sm shrink-0">🌱</div>
                              )}
                              <div className="truncate">
                                <p className="text-xs font-bold text-foreground group-hover/item:text-emerald-500 transition-colors truncate">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground">{p.unit}</p>
                              </div>
                            </div>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 ml-2 shrink-0">
                              ₹{parseFloat(p.price).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Section: Star Tier, Admin Portal, Theme Toggle, Animated Cart */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* VIP Star Tier Badge */}
            {user && (
              <div
                className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-full border shadow-xs"
                style={{
                  backgroundColor: currentHeaderStarTheme.fillColor + "15",
                  borderColor: currentHeaderStarTheme.fillColor + "50",
                  color: currentHeaderStarTheme.fillColor,
                }}
                title={`${currentHeaderStarTheme.label} (${starsCount} Stars)`}
              >
                <span className="text-xs">{starsCount >= 6 ? "👑" : "★"}</span>
                <span className="text-[11px] font-black tracking-tight">{starsCount}★</span>
              </div>
            )}

            {/* Admin / Staff Shortcut */}
            {user && (user.role === "admin" || user.role === "staff" || user.role === "support" || isSuperAdmin) && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-700 shadow-sm transition-all active:scale-95"
              >
                <Store size={13} className="text-amber-400" />
                <span>Store Admin</span>
              </Link>
            )}

            {/* Light / Dark Mode Toggle (Fully Working) */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full bg-secondary/80 hover:bg-secondary border border-border flex items-center justify-center text-foreground transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-xs"
              aria-label="Toggle theme"
              title="Toggle Light / Dark theme"
            >
              {theme === "dark" ? (
                <Sun size={16} className="text-amber-400 animate-spin-slow" />
              ) : (
                <Moon size={16} className="text-emerald-700" />
              )}
            </button>

            {/* Animated Dynamic Cart Button */}
            <Link
              href="/cart"
              className={`relative group inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs shadow-[0_4px_18px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 ${
                cartPopped ? "scale-110 ring-4 ring-amber-400/40" : ""
              }`}
              data-testid="link-cart"
            >
              <ShoppingCart
                size={16}
                className={`transition-transform duration-300 group-hover:-rotate-12 ${
                  cartPopped ? "animate-bounce" : ""
                }`}
              />
              <span className="hidden sm:inline font-black tracking-wide">Cart</span>
              {count > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-slate-950 text-amber-400 border border-amber-300 text-[10px] font-black shadow-sm transition-all duration-300 ${
                    cartPopped ? "scale-125 bg-emerald-950 text-white border-emerald-400" : ""
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>

            {/* Mobile Search & Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors"
              aria-label="Toggle mobile menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Search Box */}
        {mobileOpen && (
          <div
            ref={mobileSearchBoxRef}
            className={`md:hidden px-4 pt-3 pb-2 border-t border-emerald-500/20 bg-card/95 backdrop-blur-xl ${
              mobileClosing ? "animate-out fade-out slide-out-to-top duration-200" : "animate-in fade-in slide-in-from-top duration-200"
            }`}
          >
            <form onSubmit={submitSearch} className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fruits, sweets, pickles..."
                className="w-full rounded-full border border-emerald-500/30 bg-secondary/80 pl-10 pr-10 py-2 text-xs font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </form>

            {/* Mobile Recommendations */}
            <div className="flex flex-wrap gap-1.5 mt-2.5 pb-2">
              {recommendations.slice(0, 4).map((rec) => (
                <button
                  key={rec}
                  onClick={() => {
                    setSearch(rec);
                    navigate(`/search?q=${encodeURIComponent(rec)}`);
                    closeMobileMenu();
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-500/10 border border-emerald-500/20 text-foreground"
                >
                  {rec}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. Horizontal Scrollable Category Ribbon ── */}
      <div className="w-full bg-card/75 dark:bg-zinc-950/70 backdrop-blur-md border-b border-border/60 overflow-x-auto no-scrollbar py-2">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 flex items-center gap-2 min-w-max">
          {categories.map((c) => {
            const isActive = location === `/category/${c.slug}`;
            return (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className={`group relative flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                }`}
              >
                <span>{c.name}</span>
                <DietDot tag={c.dietTag} size={10} />
                {isActive && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-emerald-500 rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
