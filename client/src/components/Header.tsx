import { useState, useRef, useEffect } from "react";
import { imgUrl } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingCart, User as UserIcon, Menu, X, LogOut, Shield, PackageCheck, Gift, TrendingUp, Sparkles, Truck, Ticket } from "lucide-react";
import { Logo } from "./Logo";
import { DietDot } from "./DietDot";
import { useAuth, useCart } from "@/lib/store";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileClosing, setMobileClosing] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const { count } = useCart();
  const { user, logout } = useAuth();

  const [spotlight, setSpotlight] = useState({ x: 500, y: 30, opacity: 0 });
  const headerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  // Live Search Predictions & Admin Recommendations Query
  const { data: suggestionsData } = useQuery({
    queryKey: ["/api/search/suggestions", search],
    queryFn: async () => {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(search.trim())}`);
      return res.json();
    },
    enabled: searchFocused,
  });

  const predictions = suggestionsData?.predictions || [];
  const recommendations: string[] = suggestionsData?.recommendations || [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`);
      setSearchFocused(false);
      closeMobileMenu();
    }
  }

  const closeMobileMenu = () => {
    setMobileClosing(true);
    setTimeout(() => {
      setMobileOpen(false);
      setMobileClosing(false);
    }, 220);
  };

  const handleProductSearchClick = (productId: number) => {
    setSearchFocused(false);
    setSearch("");
    closeMobileMenu();
    navigate(`/product/${productId}`);
  };

  const toggleMobileMenu = () => {
    if (mobileOpen) {
      closeMobileMenu();
    } else {
      setMobileOpen(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!headerRef.current) return;
    const rect = headerRef.current.getBoundingClientRect();
    setSpotlight({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    setSpotlight((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <header className="sticky top-0 z-50 p-2 sm:p-3 w-full max-w-7xl mx-auto">
      {/* Floating Glass Island Navigation Bar */}
      <div
        ref={headerRef}
        className="w-full relative rounded-3xl border border-emerald-500/25 bg-card/90 backdrop-blur-2xl shadow-2xl overflow-visible transition-all duration-300 hover:border-emerald-500/40 group"
      >
        {/* Ambient Subtle Glow */}
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-amber-500/5 to-primary/10 opacity-30 overflow-hidden" />
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-primary/10 opacity-30 md:hidden animate-pulse overflow-hidden" />

        {/* Main Header Bar */}
        <div className="w-full px-3 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 relative z-10">
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="lg:hidden shrink-0 p-2 rounded-xl bg-secondary/80 text-foreground hover:text-primary active:scale-90 transition-all duration-300 transform shadow-sm border border-emerald-500/20"
              onClick={toggleMobileMenu}
              aria-label="Menu"
              data-testid="button-mobile-menu"
            >
              <div className={`transition-transform duration-300 ${mobileOpen ? "rotate-90 scale-110" : "rotate-0 scale-100"}`}>
                {mobileOpen ? <X size={20} className="text-emerald-400" /> : <Menu size={20} />}
              </div>
            </button>

            <Link href="/" data-testid="link-home" className="shrink-0">
              <Logo />
            </Link>
          </div>

          {/* Search Bar with Live Predictions & Admin Recommendations */}
          <div ref={searchRef} className="hidden md:block flex-1 max-w-lg mx-auto relative z-50">
            <form onSubmit={submitSearch} className="relative w-full group/search">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Search organic fruits, ghee sweets, avakaya pickles..."
                className="w-full rounded-full border border-emerald-500/30 bg-background pl-5 pr-12 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/80 transition-all shadow-inner"
                data-testid="input-search"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-600 via-primary to-green-500 text-white p-2 shadow-md hover:scale-105 active:scale-95 transition-transform"
                aria-label="Search"
                data-testid="button-search"
              >
                <Search size={15} />
              </button>
            </form>

            {/* Live Autocomplete Predictions & Admin Recommendations Overlay */}
            {searchFocused && (
              <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-card border-2 border-emerald-500/40 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] z-[100] p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Admin Promoted Recommendations */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-500 dark:text-amber-400 mb-2">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Admin Trending Recommendations</span>
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
                        className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/30 text-foreground transition-all hover:scale-105 cursor-pointer"
                      >
                        {rec}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Predictions matching typed query */}
                {search.trim().length > 0 && (
                  <div className="pt-3 border-t border-emerald-500/20 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Live Product Predictions</span>
                    </div>

                    {predictions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No matching products found.</p>
                    ) : (
                      <div className="space-y-1">
                        {predictions.map((p: any) => (
                          <div
                            key={p.id}
                            onClick={() => handleProductSearchClick(p.id)}
                            onTouchEnd={(e) => {
                              e.preventDefault();
                              handleProductSearchClick(p.id);
                            }}
                            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-500/15 cursor-pointer transition-colors group/item"
                          >
                            <div className="flex items-center gap-3">
                              {p.image ? (
                                <img src={imgUrl(p.image)} alt={p.name} className="w-9 h-9 rounded-lg object-cover" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-emerald-900/40 flex items-center justify-center text-xs">🌱</div>
                              )}
                              <div>
                                <p className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground">{p.unit}</p>
                              </div>
                            </div>
                            <span className="text-xs font-black text-primary">₹{parseFloat(p.price).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions & Controls */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <ThemeToggle />

            {/* Account Menu */}
            {user ? (
              <div className="flex items-center gap-1.5">
                {/* Stars Display for All User Roles — Responsive layout */}
                {user.isPrimaryAdmin || user.email?.toLowerCase() === "admin@farmfreshfarmer.com" ? (
                  <div className="flex flex-col gap-0.5 items-center justify-center shrink-0 px-1.5 py-1 sm:px-2 rounded-xl bg-amber-500/15 border border-amber-400/35 shadow-[0_0_10px_rgba(251,191,36,0.3)]" title="Super Admin — 6 Gold Stars">
                    <div className="hidden sm:flex items-center gap-0.5">
                      {Array.from({ length: 6 }, (_, i) => (
                        <span key={i} className="text-amber-400 text-[11px] leading-none drop-shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-pulse">★</span>
                      ))}
                    </div>
                    <span className="sm:hidden text-amber-400 font-extrabold text-xs">👑 6★</span>
                  </div>
                ) : user.role !== "customer" ? (
                  <div className="flex items-center gap-0.5 shrink-0 px-1.5 py-1 sm:px-2 rounded-xl bg-amber-500/15 border border-amber-400/30 shadow-[0_0_8px_rgba(251,191,36,0.2)]" title={`Staff — ${user.starRating || 5} Gold Stars`}>
                    <div className="hidden sm:flex items-center gap-0.5">
                      {Array.from({ length: Math.min(5, Math.max(1, Number(user.starRating) || 5)) }, (_, i) => (
                        <span key={i} className="text-amber-400 text-[11px] leading-none drop-shadow-[0_0_5px_rgba(251,191,36,0.9)]">★</span>
                      ))}
                    </div>
                    <span className="sm:hidden text-amber-400 font-extrabold text-xs">🛡️ {user.starRating || 5}★</span>
                  </div>
                ) : (user.customerStars ?? 0) > 0 ? (
                  <div className="flex items-center gap-1 shrink-0 px-2 py-1 sm:px-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 font-extrabold text-xs shadow-[0_0_8px_rgba(59,130,246,0.3)]" title={`${user.customerStars} Loyalty Stars`}>
                    <span className="text-blue-400">★</span>
                    <span className="hidden sm:inline">{user.customerStars} Stars</span>
                    <span className="sm:hidden">{user.customerStars}</span>
                  </div>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 rounded-2xl border border-emerald-500/20 bg-secondary/50 hover:bg-secondary font-bold text-xs px-2 sm:px-3" data-testid="button-account">
                      <UserIcon size={16} className="text-primary" />
                      <span className="hidden sm:inline max-w-[100px] truncate">{user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl border border-emerald-500/30 bg-card/95 backdrop-blur-xl p-2 shadow-2xl z-50">
                  <DropdownMenuItem onClick={() => navigate("/orders")} className="rounded-xl font-medium" data-testid="menu-orders">
                    My Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/account/subscriptions")} className="rounded-xl font-medium" data-testid="menu-subscriptions">
                    <PackageCheck size={15} className="mr-2 text-emerald-400" /> Subscriptions
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/account/referrals")} className="rounded-xl font-medium" data-testid="menu-referrals">
                    <Gift size={15} className="mr-2 text-amber-400" /> Referrals
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/account")} className="rounded-xl font-medium" data-testid="menu-tickets">
                    <Ticket size={15} className="mr-2 text-violet-400" /> My Tickets
                  </DropdownMenuItem>
                  {["admin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin", "customer_rep", "local_grievance_officer", "zonal_grievance_officer", "chief_grievance_officer"].includes(user.role) && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="rounded-xl font-bold text-primary" data-testid="menu-admin">
                      <Shield size={15} className="mr-2 text-primary" /> Admin Panel
                    </DropdownMenuItem>
                  )}
                  {user.role === "delivery_partner" && (
                    <DropdownMenuItem onClick={() => navigate("/partner-portal")} className="rounded-xl font-bold text-emerald-400" data-testid="menu-partner-portal">
                      <Truck size={15} className="mr-2 text-emerald-400" /> Delivery Partner Portal
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => { await logout(); window.location.href = "/"; }} className="rounded-xl text-destructive font-medium cursor-pointer" data-testid="menu-logout">
                    <LogOut size={15} className="mr-2" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            ) : (
              <Button variant="ghost" size="sm" className="gap-2 rounded-2xl border border-emerald-500/20 bg-secondary/50 hover:bg-secondary font-bold text-xs px-2 sm:px-3" onClick={() => navigate("/login")} data-testid="button-login">
                <UserIcon size={16} className="text-primary" />
                <span className="hidden sm:inline">Login</span>
              </Button>
            )}

            {/* Cart Button */}
            <button
              onClick={() => navigate("/cart")}
              className="relative flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 text-white px-2 py-2 sm:px-4 shadow-lg shadow-emerald-900/30 hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all duration-300 group"
              data-testid="button-cart"
            >
              <ShoppingCart size={18} className="group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline text-xs font-extrabold tracking-wide">Cart</span>
              {count > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 bg-amber-400 text-black text-[10px] font-black rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1 animate-bounce shadow-lg ring-2 ring-background"
                  data-testid="text-cart-count"
                >
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar Row (Visible on Mobile screens < 768px) */}
        <div className="px-3 pb-3 md:hidden relative z-50">
          <form onSubmit={submitSearch} className="relative w-full group/search">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search organic fruits, sweets, pickles..."
              className="w-full rounded-full border border-emerald-500/35 bg-background/95 backdrop-blur pl-4 pr-11 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/80 transition-all shadow-inner text-foreground placeholder:text-muted-foreground/70"
              data-testid="input-search-mobile"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-600 via-primary to-green-500 text-white p-1.5 shadow-md active:scale-95 transition-transform"
              aria-label="Search"
              data-testid="button-search-mobile"
            >
              <Search size={14} />
            </button>
          </form>

          {/* Mobile Search Overlay Predictions & Recommendations */}
          {searchFocused && (
            <div className="absolute top-[calc(100%+4px)] left-2 right-2 bg-card border-2 border-emerald-500/40 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] z-[100] p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Admin Promoted Recommendations */}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-500 dark:text-amber-400 mb-1.5">
                  <TrendingUp className="w-3 h-3" />
                  <span>Trending Recommendations</span>
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
                      className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/30 text-foreground transition-all active:scale-95 cursor-pointer"
                    >
                      {rec}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Predictions matching typed query */}
              {search.trim().length > 0 && (
                <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                  <div className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-3 h-3" />
                    <span>Matching Products</span>
                  </div>

                  {predictions.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-1">No matching products found.</p>
                  ) : (
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {predictions.map((p: any) => (
                        <div
                          key={p.id}
                          onClick={() => handleProductSearchClick(p.id)}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            handleProductSearchClick(p.id);
                          }}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-emerald-500/15 cursor-pointer transition-colors active:scale-95"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {p.image ? (
                              <img src={imgUrl(p.image)} alt={p.name} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-emerald-900/40 flex items-center justify-center text-[10px] shrink-0">🌱</div>
                            )}
                            <div className="truncate">
                              <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                              <p className="text-[9px] text-muted-foreground">{p.unit}</p>
                            </div>
                          </div>
                          <span className="text-xs font-black text-primary ml-2 shrink-0">₹{parseFloat(p.price).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sleek Minimalist 3D Category Bar */}
        <nav className="hidden lg:block border-t border-emerald-500/15 bg-background/50 backdrop-blur-md relative z-0">
          <div className="px-4 py-2 w-full">
            <ul className="flex items-center justify-start sm:justify-center gap-6 overflow-x-auto scrollbar-none whitespace-nowrap" role="list">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-muted-foreground hover:text-emerald-400 transition-colors duration-200 py-1 relative group/cat"
                    data-testid={`nav-${c.slug}`}
                  >
                    <span>{c.name}</span>
                    <DietDot tag={c.dietTag} size={10} />
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-emerald-500 rounded-full group-hover/cat:w-full transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>

      {/* Mobile Navigation Menu */}
      {(mobileOpen || mobileClosing) && (
        <div className={`lg:hidden mt-2.5 rounded-3xl border border-emerald-500/35 bg-card/95 backdrop-blur-3xl p-4 space-y-4 shadow-2xl shadow-emerald-950/40 ${mobileClosing ? "animate-mobile-drawer-exit" : "animate-mobile-drawer"}`}>
          <form onSubmit={submitSearch}>
            <div className="relative group/msearch">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organic products…"
                className="w-full rounded-2xl border border-emerald-500/30 bg-background/80 pl-4 pr-11 py-2.5 text-xs font-bold text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200 shadow-inner"
                data-testid="input-search-mobile"
              />
              <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl bg-gradient-to-r from-emerald-600 to-primary text-white p-2 shadow-md hover:scale-105 active:scale-95 transition-transform" aria-label="Search">
                <Search size={14} />
              </button>
            </div>
          </form>
          <ul className="grid grid-cols-2 gap-2" role="list">
            {categories.map((c, idx) => (
              <li key={c.slug} className="animate-mobile-item" style={{ animationDelay: `${idx * 30}ms` }}>
                <Link
                  href={`/category/${c.slug}`}
                  onClick={() => closeMobileMenu()}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-secondary/50 border border-emerald-500/15 hover:border-emerald-500/40 hover:bg-emerald-500/15 active:scale-95 transition-all duration-200 shadow-sm"
                  data-testid={`nav-mobile-${c.slug}`}
                >
                  <span className="text-foreground">{c.name}</span>
                  <DietDot tag={c.dietTag} size={11} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
