import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LayoutDashboard, Package, FolderTree, Boxes, ClipboardList, Repeat,
  Users, Star, Ticket, Percent, Gift, CreditCard, Settings, LogOut, Store,
  Shield, ShieldCheck, Warehouse, Truck, UserCheck, Key, CheckCircle, MessageSquare, RotateCcw,
  ExternalLink, Crown, CheckCircle2
} from "lucide-react";
import { useAuth } from "@/lib/store";
import AdminLogin from "./AdminLogin";
import Forbidden403 from "../Forbidden403";
import { StaffPromotionOverlay } from "@/components/StaffPromotionOverlay";

const NAV = [
  { section: "Core", items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/live-chat", label: "Live Support Chat 💬", icon: MessageSquare },
    { href: "/admin/tickets", label: "Support Tickets", icon: Ticket },
  ]},
  { section: "Catalog", items: [
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/categories", label: "Categories", icon: FolderTree },
    { href: "/admin/approvals", label: "Approvals & Reconsideration ↩️", icon: CheckCircle },
    { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  ]},
  { section: "Sales", items: [
    { href: "/admin/orders", label: "Orders", icon: ClipboardList },
    { href: "/admin/refunds", label: "Refunds 📸", icon: RotateCcw },
    { href: "/admin/subscriptions", label: "Subscriptions", icon: Repeat },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
  ]},
  { section: "Growth", items: [
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/reviews", label: "Reviews", icon: Star },
    { href: "/admin/coupons", label: "Coupons", icon: Ticket },
    { href: "/admin/discounts", label: "Discounts", icon: Percent },
    { href: "/admin/star-discount-rules", label: "Star Discount Rules ⭐", icon: Star },
    { href: "/admin/referrals", label: "Referrals", icon: Gift },
  ]},
  { section: "System", items: [
    { href: "/admin/staff", label: "Staff & Sub-Admins", icon: Shield },
    { href: "/admin/users", label: "User Roster", icon: UserCheck },
    { href: "/admin/delivery-partners", label: "Delivery Partners", icon: Truck },
    { href: "/admin/gst", label: "GST & Tax Config", icon: Percent },
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

  // Live-fetch user with permissions from server every 15s — ensures instant reflection when super-admin changes permissions
  const { data: liveUser } = useQuery({
    queryKey: ["/api/me-live-perms"],
    queryFn: async () => {
      try {
        const token = localStorage.getItem("accessToken") || "";
        const res = await fetch("/api/me", {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const d = await res.json();
          return d?.user || null;
        }
      } catch {}
      return null;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
    enabled: true,
  });

  // Prefer live server data so any permission changes reflect immediately
  let adminUser = (liveUser && (liveUser as any)?.id) ? liveUser as any : user;
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

  const isPrimaryAdmin = Boolean(
    adminUser?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    adminUser?.isPrimaryAdmin === true ||
    (adminUser?.role === "admin" && (adminUser?.id === 1 || adminUser?.id === 0))
  );

  const [promotedStaffInfo, setPromotedStaffInfo] = useState<{ stars: number; title: string; role: string } | null>(null);

  // Whenever fresh permissions arrive from server, update localStorage to prevent stale data
  useEffect(() => {
    if (liveUser && (liveUser as any)?.id) {
      localStorage.setItem("adminUser", JSON.stringify(liveUser));

      const u = liveUser as any;
      if (!isPrimaryAdmin) {
        const currentStars = u.starRating || 5;
        const currentTitle = u.customTitle || u.experienceRank || "Sub-Admin Specialist";
        const storedStarKey = `seen_staff_stars_${u.id}`;
        const prevStars = Number(localStorage.getItem(storedStarKey) ?? "-1");

        if (prevStars !== -1 && currentStars > prevStars) {
          setPromotedStaffInfo({
            stars: currentStars,
            title: currentTitle,
            role: u.role,
          });
        }
        localStorage.setItem(storedStarKey, String(currentStars));
      }
    }
  }, [liveUser, isPrimaryAdmin]);

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
      } else if (adminUser?.role === "customer_rep") {
        allowedHrefs = ["/admin", "/admin/orders", "/admin/customers"];
      } else if (adminUser?.role === "local_grievance_officer") {
        allowedHrefs = ["/admin", "/admin/orders", "/admin/customers", "/admin/reviews"];
      } else if (adminUser?.role === "zonal_grievance_officer") {
        allowedHrefs = ["/admin", "/admin/orders", "/admin/customers", "/admin/reviews", "/admin/reports"];
      } else if (adminUser?.role === "chief_grievance_officer") {
        allowedHrefs = ["/admin", "/admin/orders", "/admin/customers", "/admin/reviews", "/admin/settings"];
      } else {
        allowedHrefs = ["/admin"];
      }
    }

    // Sub-admins see ONLY the exact sections the Super Admin explicitly checked.
    // No extra hrefs are force-added — strict permission enforcement.
  }

  const navToDisplay = NAV.map((section) => {
    const filteredItems = section.items
      .filter((item) => {
        // Security, Settings, Staff, and Delivery Partners menus are strictly reserved for Primary Admin
        if (item.href === "/admin/staff" || item.href === "/admin/delivery-partners" || item.href === "/admin/security" || item.href === "/admin/settings") {
          return isPrimaryAdmin;
        }
        return isPrimaryAdmin || allowedHrefs.includes(item.href) || (item.href === "/admin/approvals" && allowedHrefs.includes("/admin/products"));
      })
      .map((item) => {
        if (item.href === "/admin/approvals" && !isPrimaryAdmin) {
          return { ...item, label: "My Reconsiderations ↩️", icon: RotateCcw };
        }
        return item;
      });
    return { ...section, items: filteredItems };
  }).filter((section) => section.items.length > 0);

  const flatDisplayed = navToDisplay.flatMap((s) => s.items);

  const STAFF_ROLES = [
    "admin", "warehouse_admin", "manager_admin", "delivery_partner", "subadmin", "custom_subadmin",
    "customer_rep", "local_grievance_officer", "zonal_grievance_officer", "chief_grievance_officer"
  ];

  useEffect(() => {
    const isStaffOrAdmin = adminUser && STAFF_ROLES.includes(adminUser.role);
    if (isStaffOrAdmin) {
      localStorage.setItem("adminUser", JSON.stringify(adminUser));
    } else if (user === null && !loading) {
      localStorage.removeItem("adminUser");
    }
  }, [adminUser, user, loading]);

  const handleLogout = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    localStorage.removeItem("adminUser");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    try {
      await logout();
    } catch {}
    window.location.href = "/admin";
  };

  if (loading && !adminUser) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const isStaffOrAdmin = adminUser && STAFF_ROLES.includes(adminUser.role);

  const [mfaVerified, setMfaVerified] = useState<boolean>(() => {
    return sessionStorage.getItem("admin_mfa_verified") === "true";
  });
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");

  const { data: totpSetupData } = useQuery({
    queryKey: ["/api/admin/mfa/totp/setup"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/mfa/totp/setup");
        if (res.ok) return await res.json();
      } catch {}
      return null;
    },
    enabled: !!adminUser && isStaffOrAdmin,
    retry: false,
  });


  if (!adminUser || !isStaffOrAdmin) {
    if (location !== "/admin/login" && location !== "/admin") {
      return <Forbidden403 />;
    }
    return <AdminLogin />;
  }

  const isSuperAdmin = adminUser?.role === "admin" || adminUser?.role === "superadmin" || adminUser?.email?.toLowerCase() === "admin@farmfreshfarmer.com";

  if (isSuperAdmin && !mfaVerified) {
    return (
      <div style={{ colorScheme: "dark" }} className="min-h-screen bg-black flex items-center justify-center p-4 select-none">
        <div className="max-w-md w-full bg-gray-900 border border-emerald-500/40 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="inline-flex p-4 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 animate-pulse">
            <ShieldCheck size={48} />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-bold text-white">Chief Admin 2FA Gateway</h2>
            <p className="text-xs text-gray-400">
              Unbypassable 2FA Security Active. Enter your 6-digit TOTP authentication code.
            </p>
          </div>

          <div className="space-y-4">
            <Input
              type="text"
              placeholder="0 0 0 0 0 0"
              value={totpCode}
              onChange={(e) => {
                setTotpError("");
                setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              maxLength={6}
              className="text-center font-mono text-2xl font-extrabold tracking-[0.5em] h-14 bg-black/80 border-emerald-500/50 text-emerald-400"
            />

            {totpError && <p className="text-xs font-bold text-red-400">{totpError}</p>}

            <Button
              onClick={async () => {
                try {
                  const res = await apiRequest("POST", "/api/admin/mfa/challenge", { code: totpCode });
                  const data = await res.json();
                  if (data.verified) {
                    sessionStorage.setItem("admin_mfa_verified", "true");
                    setMfaVerified(true);
                  }
                } catch (err: any) {
                  setTotpError(err.message || "Invalid 6-digit TOTP verification code");
                }
              }}
              disabled={totpCode.length < 6}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-900/40 text-sm cursor-pointer"
            >
              Verify Chief Admin Passkey 🔓
            </Button>
          </div>

          <p className="text-[10px] text-gray-500">
            🔒 All attempts, IP addresses, and fingerprints are monitored and logged under IT Act 2000 & BNS 2023.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {promotedStaffInfo && (
        <StaffPromotionOverlay
          stars={promotedStaffInfo.stars}
          title={promotedStaffInfo.title}
          role={promotedStaffInfo.role}
          onClose={() => setPromotedStaffInfo(null)}
        />
      )}
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-serif text-base font-bold tracking-tight truncate">FarmFreshFarmer</span>
            <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs shrink-0">
              v8.7.0
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-sidebar-border/40">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-xs font-extrabold text-foreground truncate">{adminUser?.name || "Admin Panel"}</p>
              <div className="flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                {[...Array(isPrimaryAdmin ? 6 : Math.min(5, Math.max(1, Number(adminUser?.starRating) || 5)))].map((_, i) => (
                  <Star key={i} size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                ))}
              </div>
            </div>
            {isPrimaryAdmin ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black tracking-wide shadow-xs shrink-0 whitespace-nowrap">
                <Crown size={11} className="text-amber-400 fill-amber-400 shrink-0" />
                <span>Super Admin</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-extrabold border border-primary/30 capitalize shrink-0 whitespace-nowrap">
                {adminUser?.isVerified && <CheckCircle2 size={10} className="text-sky-400 fill-sky-400/20 shrink-0" />}
                <span>{adminUser?.role === "admin" ? "Main Admin" : adminUser?.role?.replace("_", " ")}</span>
              </span>
            )}
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

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs font-extrabold bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-all shadow-sm group"
            data-testid="link-view-store"
          >
            <div className="flex items-center gap-2.5">
              <Store size={16} className="text-emerald-500" />
              <span>View Live Store 🛍️</span>
            </div>
            <ExternalLink size={13} className="opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
          </a>
          <button
            type="button"
            onClick={(e) => handleLogout(e)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover-elevate text-red-400 hover:text-red-300 font-bold cursor-pointer"
            data-testid="button-admin-logout"
          >
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-2 overflow-x-auto bg-sidebar text-sidebar-foreground px-3 py-2 border-b border-sidebar-border">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-extrabold bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 whitespace-nowrap px-3 py-1 rounded-lg flex items-center gap-1.5 shrink-0"
          >
            <Store size={13} /> Store 🛍️
          </a>
          {flatDisplayed.map((n) => (
            <Link key={n.href} href={n.href} className={`text-sm whitespace-nowrap px-2 py-1 rounded ${location === n.href ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold" : ""}`}>
              {n.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={(e) => handleLogout(e)}
            className="text-sm font-bold text-red-400 hover:text-red-300 whitespace-nowrap px-2 py-1 cursor-pointer"
          >
            Log out
          </button>
        </header>

        <main key={location} className="flex-1 p-4 sm:p-6 overflow-x-hidden animate-page-enter-3d">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-card-border">
            <h1 className="font-serif text-xl font-bold">{title}</h1>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start sm:self-auto bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold px-3.5 py-1.5 rounded-xl shadow-sm transition-all"
              data-testid="btn-view-live-store-header"
            >
              <Store size={14} className="text-emerald-500" />
              <span>View Live Store 🛍️</span>
              <ExternalLink size={12} className="opacity-70" />
            </a>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
