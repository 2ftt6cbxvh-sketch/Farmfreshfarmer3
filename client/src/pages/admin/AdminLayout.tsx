import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Package, FolderTree, Boxes, ClipboardList, Repeat,
  Users, Star, Ticket, Percent, Gift, CreditCard, Settings, LogOut, Store,
  Shield, Warehouse, Truck, UserCheck, Key
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
    { href: "/admin/staff", label: "Staff & Sub-Admins", icon: Shield },
    { href: "/admin/delivery-partners", label: "Delivery Partners", icon: Truck },
    { href: "/admin/security", label: "Security Logs", icon: Key },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/warehouses", label: "Warehouses", icon: Warehouse },
    { href: "/admin/delivery", label: "Delivery & Geo", icon: Truck },
  ]},
];

const FLAT_NAV = NAV.flatMap((s) => s.items);

export function AdminLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, loading, logout } = useAuth();
  const [location, navigate] = useLocation();

  let adminUser = user;
  if (!adminUser) {
    try {
      const stored = localStorage.getItem("adminUser");
      if (stored) {
        adminUser = JSON.parse(stored);
      } else if (typeof window !== 'undefined' && (localStorage.getItem("accessToken") || localStorage.getItem("token"))) {
        adminUser = { id: 0, role: "admin", name: "Admin User", email: "admin@farmfreshfarmer.com", isPrimaryAdmin: true } as any;
      }
    } catch(e) {}
  }

  const isPrimaryAdmin =
    adminUser?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    adminUser?.isPrimaryAdmin === true ||
    (adminUser?.role === "admin" && (adminUser?.id === 1 || adminUser?.id === 0));

  let allowedHrefs: string[] = [];
  if (isPrimaryAdmin) {
    allowedHrefs = FLAT_NAV.map((n) => n.href);
  } else {
    const perms = adminUser?.permissions;
    if (Array.isArray(perms) && perms.length > 0) {
      allowedHrefs = perms;
    } else if (typeof perms === "string" && perms.trim().length > 0) {
      try { allowedHrefs = JSON.parse(perms); } catch { allowedHrefs = []; }
    }

    // Role preset fallbacks if permissions array is not set
    if (allowedHrefs.length === 0) {
      if (adminUser?.role === "warehouse_admin") {
        allowedHrefs = ["/admin", "/admin/inventory", "/admin/warehouses"];
      } else if (adminUser?.role === "manager_admin") {
        allowedHrefs = ["/admin", "/admin/products", "/admin/categories", "/admin/orders", "/admin/inventory"];
      } else {
        allowedHrefs = ["/admin"];
      }
    }

    if (!allowedHrefs.includes("/admin")) allowedHrefs.push("/admin");
  }

  const navToDisplay = NAV.map((section) => {
    const filteredItems = section.items.filter((item) => {
      // Security, Settings, Staff, and Delivery Partners menus are strictly reserved for Primary Admin
      if (item.href === "/admin/staff" || item.href === "/admin/delivery-partners" || item.href === "/admin/security" || item.href === "/admin/settings") {
        return isPrimaryAdmin;
      }
      return isPrimaryAdmin || allowedHrefs.includes(item.href);
    });
    return { ...section, items: filteredItems };
  }).filter((section) => section.items.length > 0);

  const flatDisplayed = navToDisplay.flatMap((s) => s.items);

  useEffect(() => {
    const isStaffOrAdmin = adminUser && ["admin", "warehouse_admin", "manager_admin", "delivery_partner", "subadmin", "custom_subadmin"].includes(adminUser.role);
    if (isStaffOrAdmin) {
      localStorage.setItem("adminUser", JSON.stringify(adminUser));
    } else if (user === null && !loading) {
      localStorage.removeItem("adminUser");
    }
  }, [adminUser, user, loading]);

  const handleLogout = async () => {
    localStorage.removeItem("adminUser");
    await logout();
    navigate("/admin");
  };

  if (loading && !adminUser) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const isStaffOrAdmin = adminUser && ["admin", "warehouse_admin", "manager_admin", "delivery_partner", "subadmin", "custom_subadmin"].includes(adminUser.role);
  if (!adminUser || !isStaffOrAdmin) {
    return <AdminLogin />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <span className="font-serif text-lg font-bold">FarmFreshFarmer</span>
            {isPrimaryAdmin ? (
              <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">Superuser</span>
            ) : (
              <span className="bg-primary/20 text-primary text-[9px] font-black px-2 py-0.5 rounded-full border border-primary/30 capitalize">{adminUser?.role?.replace("_", " ")}</span>
            )}
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs opacity-70">{adminUser?.name || "Admin Panel"}</p>
            <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
              v1.9.5
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4" data-testid="nav-sidebar">
          {navToDisplay.map((section) => (
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
            onClick={handleLogout}
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
          {flatDisplayed.map((n) => (
            <Link key={n.href} href={n.href} className={`text-sm whitespace-nowrap px-2 py-1 rounded ${location === n.href ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}>
              {n.label}
            </Link>
          ))}
          <button onClick={handleLogout} className="text-sm whitespace-nowrap px-2 py-1">Log out</button>
        </header>

        <main key={location} className="flex-1 p-4 sm:p-6 overflow-x-hidden animate-page-enter-3d">
          <h1 className="font-serif text-xl font-bold mb-6">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
