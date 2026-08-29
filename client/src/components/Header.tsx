import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import {
  Search, ShoppingCart, Menu, X, Sun, Moon, Sparkles, TrendingUp,
  MapPin, ShieldCheck, Zap, ChevronRight, ChevronDown, CheckCircle2,
  Lock, Store, User as UserIcon, UserCircle2, PackageCheck, Gift,
  Ticket, Shield, Truck, LogOut, ShoppingBag
} from "lucide-react";
import { useCart, useAuth } from "@/lib/store";
import { useTheme } from "@/lib/theme-provider";
import { useQuery } from "@tanstack/react-query";
import type { Category } from "@/lib/types";
import { DietDot } from "./DietDot";
import { imgUrl } from "@/lib/queryClient";
import { getStarTheme } from "@/lib/starTheme";
import { NotificationBell } from "./NotificationBell";
import { VerifiedBadge } from "./VerifiedBadge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { count } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileClosing, setMobileClosing] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartPopped, setCartPopped] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const prevCount = useRef(count);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const mobileSearchBoxRef = useRef<HTMLDivElement>(null);

  // Recompute dropdown position whenever it's focused or window resizes/scrolls
  useLayoutEffect(() => {
    if (!searchFocused || !searchBoxRef.current) { setDropdownRect(null); return; }
    const update = () => {
      const rect = searchBoxRef.current?.getBoundingClientRect();
      if (rect) setDropdownRect({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [searchFocused]);

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

  const isUserVerified = Boolean(isSuperAdmin || (user?.isEmailVerified && user?.isPhoneVerified) || (user?.isVerified && user?.isPhoneVerified));

  // Close search suggestions on route change
  useEffect(() => {
    setSearchFocused(false);
  }, [location]);

  // Close search suggestions on page scroll
  useEffect(() => {
    const handleScrollDismiss = () => {
      if (searchFocused) {
        setSearchFocused(false);
      }
    };
    window.addEventListener("scroll", handleScrollDismiss, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollDismiss);
  }, [searchFocused]);

  // Close search suggestions on outside click, touch, or Escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      const clickedInsideDesktop = searchBoxRef.current?.contains(target);
      const clickedInsideMobile = mobileSearchBoxRef.current?.contains(target);

      if (!clickedInsideDesktop && !clickedInsideMobile) {
        setSearchFocused(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSearchFocused(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
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

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
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

  return (
    <header className="sticky top-0 z-50 w-full transition-all duration-300">
      {/* ── Main Floating Glassmorphic Navigation Bar ── */}
      <div
        className={`w-full backdrop-blur-xl transition-all duration-300 border-b relative z-30 ${
          scrolled
            ? "bg-background/95 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.25)] border-emerald-500/30 py-2.5"
            : "bg-background/90 shadow-sm border-emerald-500/20 py-3"
        }`}
      >
        <div className="mx-auto max-w-7xl px-2.5 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-6 relative z-40">
          {/* 🌟 Logo & Brand Wordmark — Ultra-Crisp, High-Contrast Luminous Badge 🌟 */}
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2.5 shrink min-w-0 group select-none">
            <div className="relative w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white dark:bg-emerald-950/80 p-1 sm:p-1.5 shadow-[0_4px_16px_rgba(16,185,129,0.35)] border-2 border-emerald-400/80 group-hover:scale-105 group-hover:shadow-[0_6px_22px_rgba(16,185,129,0.5)] transition-all duration-300 flex items-center justify-center shrink-0">
              <img
                src={imgUrl("/images/logo-icon.png")}
                alt="FarmFreshFarmer"
                className="w-full h-full object-contain filter drop-shadow"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
            </div>
            <div className="flex flex-col min-w-0">
              <span
                className="font-serif text-sm sm:text-xl font-black tracking-tight text-foreground transition-colors leading-none drop-shadow-xs truncate"
                style={{ ['--hover-color' as any]: currentHeaderStarTheme.fillColor }}
              >
                <span className="group-hover:text-[var(--hover-color)] transition-colors duration-300">FarmFresh</span><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-amber-500 dark:from-emerald-400 dark:to-yellow-300">Farmer</span>
              </span>
              <span className="text-[7.5px] sm:text-[9px] font-black tracking-[0.12em] sm:tracking-[0.2em] text-emerald-600 dark:text-emerald-400 uppercase mt-0.5 whitespace-nowrap truncate">
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
                  className="w-full rounded-full border border-emerald-500/30 bg-secondary/50 dark:bg-zinc-900/80 backdrop-blur-md pl-10 pr-20 py-2 text-xs font-semibold text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
                  data-testid="input-search"
                />
                <Search size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />

                {/* Shortcut Badge / Clear button / Search Button */}
                <div className="absolute right-1.5 flex items-center gap-1.5">
                  {search ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setSearchFocused(false);
                      }}
                      className="w-5 h-5 rounded-full hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground flex items-center justify-center text-xs transition-colors cursor-pointer"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  ) : (
                    <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground bg-background/80 border border-border rounded-md shadow-xs pointer-events-none">
                      ⌘K
                    </kbd>
                  )}
                  <button
                    type="submit"
                    className="w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                    aria-label="Submit search"
                  >
                    <Search size={13} />
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Desktop Search Dropdown — rendered via portal at fixed position to escape header stacking context */}
          {searchFocused && dropdownRect && createPortal(
            <div
              className="fixed z-[9999] bg-white dark:bg-zinc-900 border border-emerald-500/40 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-emerald-500/20"
              style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
            >
              {/* Header with Title and Close Button */}
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                  <TrendingUp size={14} className="text-amber-500" />
                  <span>Trending Recommendations</span>
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSearchFocused(false)}
                  className="w-5 h-5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                  title="Close suggestions"
                >
                  ✕
                </button>
              </div>

              {/* Trending Search Tags */}
              <div className="flex flex-wrap gap-1.5">
                {recommendations.map((rec) => (
                  <button
                    key={rec}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSearch(rec);
                      navigate(`/search?q=${encodeURIComponent(rec)}`);
                      setSearchFocused(false);
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-full bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/25 text-foreground transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1"
                  >
                    <Search size={11} className="text-emerald-500/70" />
                    <span>{rec}</span>
                  </button>
                ))}
              </div>

              {/* Live Matching Predictions */}
              {search.trim().length > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                    <div className="flex items-center gap-1">
                      <Sparkles size={13} className="text-amber-400" />
                      <span>Matching Products</span>
                    </div>
                    {predictions.length > 0 && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={submitSearch}
                        className="text-[10px] text-muted-foreground hover:text-emerald-500 underline cursor-pointer"
                      >
                        View all results
                      </button>
                    )}
                  </div>

                  {predictions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">No products matching "{search}"</p>
                  ) : (
                    <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                      {predictions.map((p) => (
                        <div
                          key={p.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleProductSearchClick(p.id)}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-emerald-500/15 cursor-pointer transition-colors group/item"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {p.image ? (
                              <img src={imgUrl(p.image)} alt={p.name} className="w-8 h-8 rounded-lg object-cover shrink-0 border border-border/50" />
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
            </div>,
            document.body
          )}


          {/* Right Section: Theme Toggle, Star Tier, Account Dropdown, Admin Portal, Cart */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-secondary/80 hover:bg-secondary border border-border flex items-center justify-center text-foreground transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-xs shrink-0"
              aria-label="Toggle theme"
              title="Toggle Light / Dark theme"
            >
              {theme === "dark" ? (
                <Sun size={15} className="text-amber-400 animate-spin-slow" />
              ) : (
                <Moon size={15} className="text-emerald-700" />
              )}
            </button>

            {/* 🌟 VIBRANT STAR TIER BADGE (Reflects Star Colors, Glowing Accents & Pulse) 🌟 */}
            {user && (
              <div
                className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm transition-all duration-300 ${currentHeaderStarTheme.badgeClass}`}
                style={{
                  borderColor: currentHeaderStarTheme.fillColor + "70",
                  backgroundColor: currentHeaderStarTheme.fillColor + "18",
                  boxShadow: `0 0 14px ${currentHeaderStarTheme.fillColor}30`,
                }}
                title={`${currentHeaderStarTheme.label} (${starsCount} Stars)`}
              >
                {/* Visual Stars */}
                {starsCount === 0 ? (
                  <span className="text-xs font-black tracking-tight text-muted-foreground flex items-center gap-1">
                    <span>⭐</span> 0★
                  </span>
                ) : (
                  <>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: Math.min(starsCount, 6) }).map((_, i) => (
                        <span
                          key={i}
                          className={`text-xs leading-none ${currentHeaderStarTheme.starColor} ${currentHeaderStarTheme.glowClass} ${
                            starsCount === 6 ? "animate-pulse" : ""
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span
                      className="text-xs font-black tracking-tight ml-0.5"
                      style={{ color: currentHeaderStarTheme.fillColor }}
                    >
                      {starsCount === 6 ? "👑 6★" : `${starsCount}★`}
                    </span>
                  </>
                )}
              </div>
            )}


            {/* 🌟 VIBRANT USER ACCOUNT DROPDOWN WITH TIER THEME HIGHLIGHTS 🌟 */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full border text-foreground text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer shrink-0"
                    style={{
                      borderColor: currentHeaderStarTheme.fillColor + "60",
                      backgroundColor: currentHeaderStarTheme.fillColor + "15",
                      boxShadow: `0 0 10px ${currentHeaderStarTheme.fillColor}20`,
                    }}
                    data-testid="button-account"
                  >
                    {user.profilePhoto ? (
                      <img
                        src={user.profilePhoto}
                        alt={user.name || "User"}
                        className="w-5 h-5 rounded-full object-cover border-2"
                        style={{ borderColor: currentHeaderStarTheme.fillColor }}
                      />
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-inner"
                        style={{
                          backgroundColor: currentHeaderStarTheme.fillColor + "30",
                          color: currentHeaderStarTheme.fillColor,
                        }}
                      >
                        {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={12} />}
                      </div>
                    )}
                    <span className="hidden sm:inline max-w-[90px] truncate">{user.name || "Account"}</span>
                    {isUserVerified && <VerifiedBadge size="sm" />}
                    <ChevronDown size={11} className="text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-60 rounded-2xl border border-emerald-500/30 bg-card/98 backdrop-blur-2xl p-2 shadow-2xl z-50">
                  <DropdownMenuLabel className="p-2.5 font-normal rounded-xl bg-secondary/50 mb-1 border border-border/50">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-xs font-black text-foreground leading-none truncate">{user.name || "User"}</p>
                        {isUserVerified && <VerifiedBadge size="sm" />}
                      </div>
                      <p className="text-[11px] leading-none text-muted-foreground truncate">{user.email || user.phone || ""}</p>
                      <div className="pt-1.5 flex items-center gap-1.5">
                        <span
                          className="text-[10px] font-black px-2.5 py-0.5 rounded-full border shadow-xs"
                          style={{
                            backgroundColor: currentHeaderStarTheme.fillColor + "20",
                            borderColor: currentHeaderStarTheme.fillColor + "60",
                            color: currentHeaderStarTheme.fillColor,
                          }}
                        >
                          {isSuperAdmin ? "👑 Master Admin (6★ Gold)" : isStaff ? "🛡️ Staff Member" : currentHeaderStarTheme.label}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => navigate("/profile")} className="rounded-xl font-semibold cursor-pointer" data-testid="menu-profile">
                    <UserCircle2 size={15} className="mr-2 text-sky-400" />
                    <span>My Profile</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => navigate("/orders")} className="rounded-xl font-semibold cursor-pointer" data-testid="menu-orders">
                    <ShoppingBag size={15} className="mr-2 text-emerald-500" />
                    <span>My Orders</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => navigate("/account/subscriptions")} className="rounded-xl font-semibold cursor-pointer" data-testid="menu-subscriptions">
                    <PackageCheck size={15} className="mr-2 text-emerald-400" />
                    <span>Subscriptions</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => navigate("/account/referrals")} className="rounded-xl font-semibold cursor-pointer" data-testid="menu-referrals">
                    <Gift size={15} className="mr-2 text-amber-400" />
                    <span>Refer & Earn</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => navigate("/account")} className="rounded-xl font-semibold cursor-pointer" data-testid="menu-tickets">
                    <Ticket size={15} className="mr-2 text-violet-400" />
                    <span>Support Tickets</span>
                  </DropdownMenuItem>

                  {/* Admin & Staff Shortcut in Dropdown */}
                  {["admin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin", "customer_rep", "local_grievance_officer", "zonal_grievance_officer", "chief_grievance_officer"].includes(user.role) && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="rounded-xl font-bold text-amber-500 cursor-pointer" data-testid="menu-admin">
                      <Shield size={15} className="mr-2 text-amber-500" />
                      <span>Admin Control Panel</span>
                    </DropdownMenuItem>
                  )}

                  {/* Delivery Partner Portal in Dropdown */}
                  {user.role === "delivery_partner" && (
                    <DropdownMenuItem onClick={() => navigate("/partner-portal")} className="rounded-xl font-bold text-emerald-400 cursor-pointer" data-testid="menu-partner-portal">
                      <Truck size={15} className="mr-2 text-emerald-400" />
                      <span>Delivery Partner Portal</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleLogout} className="rounded-xl font-semibold text-destructive cursor-pointer focus:text-destructive" data-testid="menu-logout">
                    <LogOut size={15} className="mr-2" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full border border-emerald-500/30 bg-secondary/70 hover:bg-secondary text-foreground text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-xs shrink-0"
                data-testid="button-login"
              >
                <UserIcon size={14} className="text-emerald-500" />
                <span className="hidden sm:inline">Login</span>
              </Link>
            )}

            {/* 🔔 Notifications & Announcements Bell */}
            <NotificationBell />

            {/* Animated Dynamic Cart Button */}
            <Link
              href="/cart"
              className={`relative group inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs shadow-[0_4px_18px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 shrink-0 ${
                cartPopped ? "scale-110 ring-4 ring-amber-400/40" : ""
              }`}
              data-testid="link-cart"
            >
              <ShoppingCart
                size={15}
                className={`transition-transform duration-300 group-hover:-rotate-12 ${
                  cartPopped ? "animate-bounce" : ""
                }`}
              />
              <span className="hidden sm:inline font-black tracking-wide">Cart</span>
              {count > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-4 sm:min-w-5 h-4 sm:h-5 px-1 sm:px-1.5 rounded-full bg-slate-950 text-amber-400 border border-amber-300 text-[9px] sm:text-[10px] font-black shadow-sm transition-all duration-300 ${
                    cartPopped ? "scale-125 bg-emerald-950 text-white border-emerald-400" : ""
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>

            {/* Mobile Menu Toggle (Hamburger / 3 lines) */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors shrink-0"
              aria-label="Toggle mobile menu"
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div
            ref={mobileSearchBoxRef}
            className={`md:hidden border-t border-emerald-500/20 bg-card/95 backdrop-blur-xl relative z-[100] ${
              mobileClosing ? "animate-out fade-out slide-out-to-top duration-200" : "animate-in fade-in slide-in-from-top duration-200"
            }`}
          >
            {/* ── Search bar ── */}
            <div className="px-4 pt-3 pb-2">
              <form onSubmit={submitSearch} className="relative">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="Search fruits, sweets, pickles..."
                  className="w-full rounded-full border border-emerald-500/30 bg-secondary/80 pl-10 pr-10 py-2.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
            </div>

            {/* ── Search suggestions / predictions (always shown) ── */}
            <div className="px-4 pb-2 relative z-[200]">
                {search.trim().length > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-black text-emerald-600 dark:text-emerald-400 px-1 mb-1.5">
                      <div className="flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-400" />
                        <span>Matching Products</span>
                      </div>
                      {predictions.length > 0 && (
                        <button
                          type="button"
                          onClick={submitSearch}
                          className="text-[10px] text-muted-foreground hover:text-emerald-500 underline"
                        >
                          View all
                        </button>
                      )}
                    </div>

                    {predictions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">No products matching "{search}"</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {predictions.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleProductSearchClick(p.id)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-emerald-500/15 cursor-pointer transition-colors group/item bg-secondary/40"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {p.image ? (
                                <img src={imgUrl(p.image)} alt={p.name} className="w-7 h-7 rounded-lg object-cover shrink-0 border border-border/50" />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-emerald-950/30 flex items-center justify-center text-xs shrink-0">🌱</div>
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
                ) : (
                  /* Recommendation chips */
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {recommendations.slice(0, 4).map((rec) => (
                      <button
                        key={rec}
                        onClick={() => {
                          setSearch(rec);
                          navigate(`/search?q=${encodeURIComponent(rec)}`);
                          closeMobileMenu();
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-500/10 border border-emerald-500/20 text-foreground active:scale-95 transition-transform"
                      >
                        {rec}
                      </button>
                    ))}
                  </div>
                )}
            </div>

            {/* ── Quick links (Profile / Orders / Subscriptions / Login) ── */}
            <div className="flex flex-wrap gap-2 px-4 pt-1 pb-3 border-t border-emerald-500/20">
              {user ? (
                <>
                  <Link
                    href="/profile"
                    onClick={closeMobileMenu}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-secondary text-foreground"
                  >
                    <UserCircle2 size={13} className="text-sky-400" />
                    <span>Profile</span>
                  </Link>
                  <Link
                    href="/orders"
                    onClick={closeMobileMenu}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-secondary text-foreground"
                  >
                    <ShoppingBag size={13} className="text-emerald-400" />
                    <span>Orders</span>
                  </Link>
                  <Link
                    href="/account/subscriptions"
                    onClick={closeMobileMenu}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-secondary text-foreground"
                  >
                    <PackageCheck size={13} className="text-emerald-400" />
                    <span>Subscriptions</span>
                  </Link>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={closeMobileMenu}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-emerald-600 text-white"
                >
                  <UserIcon size={13} />
                  <span>Login / Register</span>
                </Link>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── 🌟 CENTERED CATEGORY RIBBON (Centered on Desktop/Tablet, Smooth Scroll on Mobile) 🌟 ── */}
      <div className="w-full bg-card/75 dark:bg-zinc-950/70 backdrop-blur-md border-b border-border/60 overflow-x-auto no-scrollbar py-2 relative z-10">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 flex items-center justify-start md:justify-center gap-2 min-w-max">
          {categories.map((c) => {
            const isActive = location === `/category/${c.slug}`;
            return (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className={`group relative flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/80 hover:scale-105 active:scale-95"
                }`}
              >
                <span>{c.name}</span>
                <DietDot tag={c.dietTag} size={10} />
                {isActive && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
