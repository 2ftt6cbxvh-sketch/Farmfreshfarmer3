import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, ShoppingCart, Menu, X, Sun, Moon, Sparkles, TrendingUp,
  MapPin, Navigation, ShieldCheck, Zap, ChevronRight, CheckCircle2,
  Lock, Store
} from "lucide-react";
import { useCart, useAuth } from "@/lib/store";
import { useTheme } from "@/lib/theme-provider";
import { useQuery } from "@tanstack/react-query";
import type { Category } from "@/lib/types";
import { DietDot } from "./DietDot";
import { imgUrl } from "@/lib/queryClient";
import { getStarTheme } from "@/lib/starTheme";
import { useToast } from "@/hooks/use-toast";

export function Header() {
  const { count } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileClosing, setMobileClosing] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Delivery Location Modal State
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [pincodeInput, setPincodeInput] = useState("");
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const mobileSearchBoxRef = useRef<HTMLDivElement>(null);

  // Track scroll for sticky elevated glass navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
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

  // Sync stored PIN code
  useEffect(() => {
    const stored = localStorage.getItem("fff_user_pincode") || localStorage.getItem("user_pincode");
    if (stored) setPincodeInput(stored);
  }, []);

  // Location resolution query
  const activePincode = pincodeInput.trim();
  const { data: locData, isLoading: locLoading, refetch: refetchLocation } = useQuery<any>({
    queryKey: ["/api/delivery/resolve", activePincode],
    queryFn: async () => {
      const pin = activePincode || localStorage.getItem("fff_user_pincode") || "520001";
      const res = await fetch(`/api/delivery/resolve?pincode=${encodeURIComponent(pin)}`);
      if (!res.ok) throw new Error("Location resolution failed");
      return res.json();
    },
    enabled: true,
    staleTime: 60000,
  });

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

  // Handle GPS location detection
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation Error", description: "Geolocation is not supported by your browser.", variant: "destructive" });
      return;
    }
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/delivery/resolve?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (data && data.pincode) {
            setPincodeInput(data.pincode);
            localStorage.setItem("fff_user_pincode", data.pincode);
            localStorage.setItem("user_pincode", data.pincode);
            toast({
              title: "Location Detected! 📍",
              description: `Delivering to ${data.area || data.city || data.pincode} (${data.distanceKm ? data.distanceKm + "km from hub" : "Serviceable"})`,
            });
            refetchLocation();
            setLocModalOpen(false);
          } else {
            setPincodeInput("520001");
            localStorage.setItem("fff_user_pincode", "520001");
            toast({ title: "Default Hub Set", description: "Set to Vijayawada Central Hub (520001)" });
            setLocModalOpen(false);
          }
        } catch {
          toast({ title: "Location Error", description: "Could not resolve your area. Please enter your PIN code.", variant: "destructive" });
        } finally {
          setIsDetectingGps(false);
        }
      },
      () => {
        setIsDetectingGps(false);
        toast({ title: "Permission Denied", description: "Please enter your 6-digit PIN code manually.", variant: "destructive" });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSavePincode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pincodeInput.replace(/\D/g, "");
    if (clean.length !== 6) {
      toast({ title: "Invalid PIN Code", description: "Please enter a valid 6-digit Indian PIN code.", variant: "destructive" });
      return;
    }
    localStorage.setItem("fff_user_pincode", clean);
    localStorage.setItem("user_pincode", clean);
    refetchLocation();
    setLocModalOpen(false);
    toast({ title: "Delivery Location Updated! 🚚", description: `Active PIN Code set to ${clean}.` });
  };

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

  const displayLocation = locData?.area || locData?.city || (activePincode ? `PIN: ${activePincode}` : "Select Delivery Location");
  const isServiceable = locData?.serviceable !== false;
  const deliveryEta = locData?.eta || "30–45 Mins";

  return (
    <header className="sticky top-0 z-50 w-full transition-all duration-300">
      {/* ── 1. Ultra-Sleek Top Location & Express ETA Ribbon ── */}
      <div className="bg-gradient-to-r from-emerald-950 via-zinc-950 to-emerald-950 text-white border-b border-emerald-500/20 py-1.5 px-3 sm:px-6 shadow-sm">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
          {/* Left: Location & Hub Resolution */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setLocModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 transition-all active:scale-95 cursor-pointer truncate"
              title="Click to change delivery location"
            >
              <MapPin size={12} className="text-emerald-400 shrink-0 animate-pulse" />
              <span className="truncate">{displayLocation}</span>
              <ChevronRight size={10} className="text-emerald-400/70 shrink-0" />
            </button>

            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-zinc-300">
              {isServiceable ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-semibold text-emerald-400">Instant Farm Delivery</span>
                  <span className="text-zinc-400">· ETA {deliveryEta}</span>
                </>
              ) : (
                <span className="text-amber-300 font-medium">Standard Pan-India Shipping</span>
              )}
            </span>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDetectGps}
              disabled={isDetectingGps}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-bold text-zinc-200 transition-colors cursor-pointer"
            >
              <Navigation size={10} className={`text-emerald-400 ${isDetectingGps ? "animate-spin" : ""}`} />
              <span>{isDetectingGps ? "Detecting..." : "Detect Location"}</span>
            </button>

            <button
              onClick={() => setLocModalOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-bold text-amber-300 transition-colors cursor-pointer"
            >
              <span>{activePincode ? `PIN: ${activePincode}` : "Enter PIN"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Main Floating Glassmorphic Navigation Bar ── */}
      <div
        className={`w-full backdrop-blur-xl transition-all duration-300 border-b ${
          scrolled
            ? "bg-background/92 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.15)] border-emerald-500/30 py-2"
            : "bg-background/85 shadow-sm border-emerald-500/20 py-2.5"
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
                    className="p-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-amber-500 text-white hover:opacity-90 active:scale-95 transition-all shadow-sm"
                    aria-label="Submit search"
                  >
                    <Search size={12} />
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

          {/* Right Section: Star Tier, Admin Portal, Theme Toggle, Cart */}
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

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full bg-secondary/80 hover:bg-secondary border border-border flex items-center justify-center text-foreground transition-all hover:scale-105 active:scale-95"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-emerald-700" />}
            </button>

            {/* Cart Button */}
            <Link
              href="/cart"
              className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-md hover:scale-105 active:scale-95 transition-all duration-200"
              data-testid="link-cart"
            >
              <ShoppingCart size={15} />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 && (
                <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-emerald-950 text-white text-[10px] font-black">
                  {count}
                </span>
              )}
            </Link>

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => (mobileOpen ? closeMobileMenu() : setMobileOpen(true))}
              className="md:hidden w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-accent transition-transform active:scale-95"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Search Row (Shown below logo on small screens) */}
        <div ref={mobileSearchBoxRef} className="md:hidden px-3 pt-2 relative">
          <form onSubmit={submitSearch} className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search organic fruits, sweets, pickles..."
              className="w-full rounded-full border border-emerald-500/30 bg-secondary/70 pl-9 pr-10 py-1.5 text-xs font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-emerald-600 text-white"
              aria-label="Search"
            >
              <Search size={12} />
            </button>
          </form>

          {/* Mobile Search Dropdown */}
          {searchFocused && (
            <div className="absolute top-[calc(100%+4px)] left-3 right-3 bg-card border border-emerald-500/30 rounded-2xl shadow-2xl z-50 p-3 space-y-3 animate-in fade-in duration-200">
              <div>
                <div className="flex items-center gap-1 text-[10px] font-black text-amber-500 mb-1.5">
                  <TrendingUp size={11} />
                  <span>Trending</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {recommendations.map((rec) => (
                    <button
                      key={rec}
                      onClick={() => {
                        setSearch(rec);
                        navigate(`/search?q=${encodeURIComponent(rec)}`);
                        setSearchFocused(false);
                      }}
                      className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/10 border border-emerald-500/20 text-foreground"
                    >
                      {rec}
                    </button>
                  ))}
                </div>
              </div>

              {search.trim().length > 0 && predictions.length > 0 && (
                <div className="pt-2 border-t border-emerald-500/20 space-y-1">
                  {predictions.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleProductSearchClick(p.id)}
                      className="flex items-center justify-between p-1.5 rounded-lg hover:bg-emerald-500/10"
                    >
                      <span className="text-xs font-bold text-foreground truncate">{p.name}</span>
                      <span className="text-xs font-black text-emerald-500 ml-2">₹{parseFloat(p.price).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 3. Minimalist Category Pill Ribbon ── */}
        <nav className="hidden lg:block border-t border-emerald-500/15 bg-background/40 backdrop-blur-md mt-2">
          <div className="mx-auto max-w-7xl px-4 py-1.5">
            <ul className="flex items-center justify-center gap-6 overflow-x-auto scrollbar-none whitespace-nowrap" role="list">
              {categories.map((c) => {
                const isActive = location === `/category/${c.slug}`;
                return (
                  <li key={c.slug}>
                    <Link
                      href={`/category/${c.slug}`}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-extrabold rounded-full transition-all duration-200 ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xs"
                          : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"
                      }`}
                      data-testid={`nav-${c.slug}`}
                    >
                      <span>{c.name}</span>
                      <DietDot tag={c.dietTag} size={8} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </div>

      {/* ── 4. Mobile Drawer Menu ── */}
      {(mobileOpen || mobileClosing) && (
        <div className={`lg:hidden mt-2 mx-3 rounded-3xl border border-emerald-500/30 bg-card/95 backdrop-blur-2xl p-4 space-y-4 shadow-2xl ${mobileClosing ? "animate-mobile-drawer-exit" : "animate-mobile-drawer"}`}>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-500">Explore Categories</span>
            <button onClick={closeMobileMenu} className="p-1 rounded-full bg-secondary text-muted-foreground">
              <X size={14} />
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-2" role="list">
            {categories.map((c, idx) => (
              <li key={c.slug} style={{ animationDelay: `${idx * 25}ms` }}>
                <Link
                  href={`/category/${c.slug}`}
                  onClick={closeMobileMenu}
                  className="flex items-center justify-between px-3 py-2.5 text-xs font-bold rounded-xl bg-secondary/50 border border-emerald-500/15 hover:border-emerald-500/30 text-foreground active:scale-95 transition-all"
                >
                  <span className="truncate">{c.name}</span>
                  <DietDot tag={c.dietTag} size={9} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 5. Delivery Location Chooser Modal ── */}
      {locModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-card border border-emerald-500/30 rounded-3xl p-6 shadow-2xl text-foreground space-y-4 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setLocModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-full text-muted-foreground hover:bg-secondary transition"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-500">
                <MapPin size={20} />
              </div>
              <div>
                <h3 className="text-base font-black">Delivery Location</h3>
                <p className="text-xs text-muted-foreground">Check instant farm delivery ETA & serviceability</p>
              </div>
            </div>

            {/* GPS Detection Button */}
            <button
              onClick={handleDetectGps}
              disabled={isDetectingGps}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Navigation size={14} className={isDetectingGps ? "animate-spin" : ""} />
              <span>{isDetectingGps ? "Detecting GPS Location..." : "Use My Current GPS Location"}</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-border" />
              <span className="flex-shrink mx-3 text-[10px] font-bold uppercase text-muted-foreground">Or Enter 6-Digit PIN</span>
              <div className="flex-grow border-t border-border" />
            </div>

            {/* Manual PIN Code Input */}
            <form onSubmit={handleSavePincode} className="space-y-3">
              <input
                type="text"
                maxLength={6}
                value={pincodeInput}
                onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 520001, 530001..."
                className="w-full rounded-2xl border border-emerald-500/40 bg-secondary/50 px-4 py-3 text-sm font-bold text-foreground text-center tracking-widest focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-all"
              >
                Apply Location & Check ETA 🚚
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
