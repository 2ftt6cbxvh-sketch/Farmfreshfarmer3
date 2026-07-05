import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Package, FolderTree, Boxes, ClipboardList, Repeat,
  Users, Star, Ticket, Percent, Gift, CreditCard, Settings, LogOut, Store,
} from "lucide-react";
import { useAuth } from "@/lib/store";
import AdminLogin from "./AdminLogin";

const NAV = [
  { section: "Overview", items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  ]},
  { section: "Catalog", items: [
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/categories", label: "Categories", icon: FolderTree },
    { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  ]},
  { section: "Sales", items: [
    { href: "/admin/orders", label: "Orders", icon: ClipboardList },
    { href: "/admin/subscriptions", label: "Subscriptions", icon: Repeat },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
  ]},
  { section: "Growth", items: [
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/reviews", label: "Reviews", icon: Star },
    { href: "/admin/coupons", label: "Coupons", icon: Ticket },
    { href: "/admin/discounts", label: "Discounts", icon: Percent },
    { href: "/admin/referrals", label: "Referrals", icon: Gift },
  ]},
  { section: "System", items: [
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ]},
];

const FLAT_NAV = NAV.flatMap((s) => s.items);

export function AdminLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, loading, logout } = useAuth();
  const [location, navigate] = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user || user.role !== "admin") {
    return <AdminLogin />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-5 border-b border-sidebar-border">
          <span className="font-serif text-lg font-bold">FarmFreshFarmer</span>
          <p className="text-xs opacity-70">Admin panel</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-4" data-testid="nav-sidebar">
          {NAV.map((section) => (
            <div key={section.section}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-50">{section.section}</p>
              <div className="space-y-1">
                {section.items.map((n) => {
                  const active = location === n.href;
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover-elevate"}`}
                      data-testid={`nav-${n.label.toLowerCase()}`}
                    >
                      <Icon size={18} /> {n.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover-elevate" data-testid="link-view-store">
            <Store size={18} /> View store
          </Link>
          <button
            onClick={async () => { await logout(); navigate("/admin"); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover-elevate"
            data-testid="button-admin-logout"
          >
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 overflow-x-auto bg-sidebar text-sidebar-foreground px-3 py-2">
          {FLAT_NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`text-sm whitespace-nowrap px-2 py-1 rounded ${location === n.href ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}>
              {n.label}
            </Link>
          ))}
          <button onClick={async () => { await logout(); navigate("/admin"); }} className="text-sm whitespace-nowrap px-2 py-1">Log out</button>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          <h1 className="font-serif text-xl font-bold mb-6">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
