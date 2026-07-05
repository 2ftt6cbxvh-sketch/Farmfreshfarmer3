import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingCart, User as UserIcon, Menu, X, LogOut, Shield, PackageCheck, Gift } from "lucide-react";
import { Logo } from "./Logo";
import { DietDot } from "./DietDot";
import { useAuth, useCart } from "@/lib/store";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
  const { count } = useCart();
  const { user, logout } = useAuth();

  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`);
      setMobileOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-50">
      {/* Delivery banner */}
      <div className="bg-primary text-primary-foreground text-center text-xs sm:text-sm py-1.5 px-4">
        Visakhapatnam: Instant Delivery · Other locations: 2–5 days · Fresh from the farm, naturally
      </div>

      {/* Main bar */}
      <div className="bg-card border-b border-card-border">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <button
            className="lg:hidden p-1"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <Link href="/" data-testid="link-home">
            <Logo />
          </Link>

          {/* Search */}
          <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-xl mx-auto">
            <div className="relative w-full">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for fruits, sweets, pickles…"
                className="w-full rounded-full border border-input bg-background pl-4 pr-11 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="input-search"
              />
              <button
                type="submit"
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground p-1.5"
                aria-label="Search"
                data-testid="button-search"
              >
                <Search size={16} />
              </button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            {/* Account */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="button-account">
                    <UserIcon size={18} />
                    <span className="hidden sm:inline max-w-[100px] truncate">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/orders")} data-testid="menu-orders">
                    My Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/account/subscriptions")} data-testid="menu-subscriptions">
                    <PackageCheck size={15} className="mr-2" /> Subscriptions
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/account/referrals")} data-testid="menu-referrals">
                    <Gift size={15} className="mr-2" /> Referrals
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="menu-admin">
                      <Shield size={15} className="mr-2" /> Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} data-testid="menu-logout">
                    <LogOut size={15} className="mr-2" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/login")} data-testid="button-login">
                <UserIcon size={18} />
                <span className="hidden sm:inline">Login</span>
              </Button>
            )}

            {/* Cart */}
            <button
              onClick={() => navigate("/cart")}
              className="relative flex items-center gap-2 rounded-full px-3 py-2 hover-elevate"
              data-testid="button-cart"
            >
              <ShoppingCart size={20} />
              <span className="hidden sm:inline text-sm font-medium">Cart</span>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1" data-testid="text-cart-count">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category nav */}
        <nav className="hidden lg:block border-t border-card-border">
          <div className="mx-auto max-w-7xl px-4">
            <ul className="flex items-center gap-1 overflow-x-auto" role="list">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium text-foreground hover:text-primary"
                    data-testid={`nav-${c.slug}`}
                  >
                    {c.name}
                    <DietDot tag={c.dietTag} size={12} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-card border-b border-card-border px-4 py-3 space-y-3">
          <form onSubmit={submitSearch}>
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="w-full rounded-full border border-input bg-background pl-4 pr-11 py-2 text-sm"
                data-testid="input-search-mobile"
              />
              <button type="submit" className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground p-1.5" aria-label="Search">
                <Search size={16} />
              </button>
            </div>
          </form>
          <ul className="grid grid-cols-2 gap-1" role="list">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/category/${c.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-1.5 px-2 py-2 text-sm rounded-md hover-elevate"
                  data-testid={`nav-mobile-${c.slug}`}
                >
                  {c.name}
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
