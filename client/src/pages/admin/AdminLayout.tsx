import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiGet } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Package, FolderTree, Boxes, ClipboardList, Repeat,
  Users, Star, Ticket, Percent, Gift, CreditCard, Settings, LogOut, Store,
  Shield, ShieldCheck, ShieldAlert, Warehouse, Truck, UserCheck, Key, CheckCircle, MessageSquare, RotateCcw,
  ExternalLink, Crown, CheckCircle2, Megaphone, Mail, Bot, Sparkles
} from "lucide-react";
import { useAuth } from "@/lib/store";
import { getStarTheme } from "@/lib/starTheme";
import AdminLogin from "./AdminLogin";
import Forbidden403 from "../Forbidden403";
import { AdminDirectAccessWarning } from "./AdminDirectAccessWarning";
import { StaffPromotionOverlay } from "@/components/StaffPromotionOverlay";
import { AdminExecutiveCopilotModal } from "@/components/admin/AdminExecutiveCopilotModal";

const NAV = [
  { section: "Core", items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/lakshmi-ai", label: "Lakshmi AI Assistant 🤖", icon: Bot },
    { href: "/admin/live-chat", label: "Live Support Chat 💬", icon: MessageSquare },
    { href: "/admin/tickets", label: "Support Tickets", icon: Ticket },
  ]},
  { section: "Catalog", items: [
    { href: "/admin/procurement-ai", label: "AI Sourcing & Demand 🌾", icon: Sparkles },
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
    { href: "/admin/marketing", label: "Marketing & Campaigns ✉️", icon: Mail },
    { href: "/admin/advertisements", label: "Advertisements & Ads 📢", icon: Megaphone },
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

function SidebarEnvironmentMasterSwitch({ isPrimaryAdmin }: { isPrimaryAdmin: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settingsData, isLoading: settingsLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/settings"],
    queryFn: () => apiGet<Record<string, string>>("/api/admin/settings"),
    enabled: isPrimaryAdmin,
    staleTime: 60000,
  });

  const { data: staff2faConfig, isLoading: staff2faLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/admin/staff/2fa-config"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/staff/2fa-config")).json(),
    enabled: isPrimaryAdmin,
    staleTime: 60000,
  });

  const isLockdown = settingsData?.stealth_admin_lockdown === "true";
  const isStaff2fa = staff2faConfig?.enabled === true;
  const isProduction = isLockdown && isStaff2fa;

  const masterToggleMutation = useMutation({
    mutationFn: async (targetProduction: boolean) => {
      await apiRequest("POST", "/api/admin/settings", {
        stealth_admin_lockdown: targetProduction ? "true" : "false",
      });
      await apiRequest("POST", "/api/admin/staff/2fa-config", {
        enabled: targetProduction,
      });
      return targetProduction;
    },
    onSuccess: (targetProduction) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/settings/public"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/staff/2fa-config"] });
      toast({
        title: targetProduction ? "🔒 Production Ready Mode Active" : "🛠️ Testing Mode Active",
        description: targetProduction
          ? "Stealth Gateway & Staff 2FA are fully enforced. Direct /admin access is quarantined."
          : "Direct /admin access & staff logins are relaxed for testing.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to switch mode", description: err.message, variant: "destructive" });
    },
  });

  if (!isPrimaryAdmin) return null;

  return (
    <div className="mx-3 my-2 p-2.5 rounded-2xl border transition-all shadow-md bg-gradient-to-br from-secondary/50 via-card to-background border-border/80">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${
            isProduction
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
              : "bg-amber-500/20 text-amber-300 border-amber-500/40"
          }`}>
            {isProduction ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-tight truncate text-foreground flex items-center gap-1">
              <span>{isProduction ? "Production Mode" : "Testing Mode"}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isProduction ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            </p>
            <p className="text-[9px] text-muted-foreground truncate font-medium">
              {isProduction ? "🔒 Secret URL + Staff 2FA" : "🛠️ Relaxed Direct Entry"}
            </p>
          </div>
        </div>

        <Switch
          checked={isProduction}
          disabled={masterToggleMutation.isPending || settingsLoading || staff2faLoading}
          onCheckedChange={(val) => masterToggleMutation.mutate(val)}
          className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-amber-600 shrink-0 cursor-pointer"
          title={isProduction ? "Switch to Testing Mode" : "Switch to Production Ready Mode"}
        />
      </div>
    </div>
  );
}

export function AdminLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, loading, logout } = useAuth();
  const [location, navigate] = useLocation();

  // User with permissions from server cached for 60s
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
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: true,
  });

  // Prefer live server data so any permission changes reflect immediately
  let adminUser = (liveUser && (liveUser as any)?.id) ? liveUser as any : user;
  if (!adminUser) {
    try {
      const stored = localStorage.getItem("adminUser");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.role === "string") {
          adminUser = parsed;
        }
      }
    } catch(e) {}
  }

  const isPrimaryAdmin = Boolean(
    adminUser?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    adminUser?.isPrimaryAdmin === true ||
    adminUser?.role === "superadmin" ||
    adminUser?.id === 1 ||
    adminUser?.id === 0
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
        // Security, Settings, Staff, Delivery Partners, and Narayana Sourcing AI menus are strictly reserved for Primary Admin
        if (item.href === "/admin/staff" || item.href === "/admin/delivery-partners" || item.href === "/admin/security" || item.href === "/admin/settings" || item.href === "/admin/procurement-ai") {
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
    localStorage.removeItem("admin_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("admin_last_activity");
    sessionStorage.removeItem("admin_mfa_verified");
    try {
      await logout();
    } catch {}
    window.location.href = "/admin/login";
  };

  // ========================================================
  // ⏱️ 1-HOUR INACTIVITY AUTO-LOGOUT ENGINE
  // ========================================================
  const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 hour (3,600,000 ms)

  useEffect(() => {
    if (!adminUser) return;

    // Check if previous recorded activity was already more than 1 hour ago
    const lastStored = Number(localStorage.getItem("admin_last_activity") || "0");
    const now = Date.now();

    if (lastStored > 0 && now - lastStored >= INACTIVITY_LIMIT_MS) {
      localStorage.removeItem("adminUser");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("admin_last_activity");
      sessionStorage.removeItem("admin_mfa_verified");
      toast({
        title: "⏱️ Session Expired (1 Hour Inactivity)",
        description: "You have been automatically logged out after 1 hour of idle time for security.",
        variant: "destructive",
      });
      window.location.href = "/admin/login?expired=1";
      return;
    }

    // Set/refresh initial activity timestamp
    localStorage.setItem("admin_last_activity", String(now));

    let lastRecorded = now;
    const recordActivity = () => {
      const current = Date.now();
      // Throttle writes to localStorage every 10 seconds
      if (current - lastRecorded > 10000) {
        lastRecorded = current;
        localStorage.setItem("admin_last_activity", String(current));
      }
    };

    // Listen to user interactions on window
    window.addEventListener("mousemove", recordActivity, { passive: true });
    window.addEventListener("mousedown", recordActivity, { passive: true });
    window.addEventListener("keydown", recordActivity, { passive: true });
    window.addEventListener("scroll", recordActivity, { passive: true });
    window.addEventListener("touchstart", recordActivity, { passive: true });

    // Periodic check every 15 seconds
    const interval = setInterval(() => {
      const currentActivity = Number(localStorage.getItem("admin_last_activity") || String(Date.now()));
      if (Date.now() - currentActivity >= INACTIVITY_LIMIT_MS) {
        clearInterval(interval);
        localStorage.removeItem("adminUser");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("admin_last_activity");
        sessionStorage.removeItem("admin_mfa_verified");
        toast({
          title: "⏱️ Session Expired (1 Hour Inactivity)",
          description: "You have been automatically logged out after 1 hour of idle time for security.",
          variant: "destructive",
        });
        window.location.href = "/admin/login?expired=1";
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("mousemove", recordActivity);
      window.removeEventListener("mousedown", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("scroll", recordActivity);
      window.removeEventListener("touchstart", recordActivity);
    };
  }, [adminUser]);

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

  const { data: liveSessionsData } = useQuery<{ sessions: any[] }>({
    queryKey: ["/api/admin/chatbot/live-sessions"],
    queryFn: () => apiGet<{ sessions: any[] }>("/api/admin/chatbot/live-sessions"),
    enabled: !!adminUser && isStaffOrAdmin,
    refetchInterval: 3000,
  });

  const waitingChatCount = liveSessionsData?.sessions?.filter((s) => s.status === "waiting_for_agent").length || 0;


  if (!adminUser || !isStaffOrAdmin) {
    return <AdminDirectAccessWarning />;
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
              v10.1.0
            </span>
          </div>

          {(() => {
            const rawStars = Number(adminUser?.starRating);
            const adminStars = isPrimaryAdmin ? 6 : Math.max(0, Math.min(6, Number.isFinite(rawStars) ? rawStars : 5));
            const theme = getStarTheme(adminStars, true);
            return (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-sidebar-border/40">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-xs font-extrabold text-foreground truncate">{adminUser?.name || "Admin Panel"}</p>
                  <div className="flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                    {Array.from({ length: Math.max(0, Math.min(6, adminStars)) }).map((_, i) => (
                      <Star key={i} size={10} fill="currentColor" className={`shrink-0 ${theme.starColor} ${theme.glowClass} ${isPrimaryAdmin ? 'animate-pulse' : ''}`} />
                    ))}
                  </div>
                </div>
                {isPrimaryAdmin ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide shadow-xs shrink-0 whitespace-nowrap border ${theme.badgeClass}`}>
                    <Crown size={11} className="shrink-0" />
                    <span>Executive Admin</span>
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold capitalize shrink-0 whitespace-nowrap border ${theme.badgeClass}`}>
                    {adminUser?.isVerified && <CheckCircle2 size={10} className="text-sky-400 fill-sky-400/20 shrink-0" />}
                    <span>{adminUser?.role === "admin" ? "Main Admin" : adminUser?.role?.replace("_", " ")}</span>
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* 👑 Chief Executive Admin Unified Environment Switch (Production Ready vs Testing Mode) */}
        <SidebarEnvironmentMasterSwitch isPrimaryAdmin={isPrimaryAdmin} />

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
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover-elevate"}`}
                      data-testid={`nav-${n.label.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon size={18} className="shrink-0" />
                        <span className="truncate">{n.label}</span>
                      </div>
                      {n.href === "/admin/live-chat" && waitingChatCount > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse shadow-sm shrink-0">
                          {waitingChatCount} WAITING
                        </span>
                      )}
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
            <Link key={n.href} href={n.href} className={`text-sm whitespace-nowrap px-2 py-1 rounded flex items-center gap-1.5 ${location === n.href ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold" : ""}`}>
              <span>{n.label}</span>
              {n.href === "/admin/live-chat" && waitingChatCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-black bg-red-600 text-white animate-pulse">
                  {waitingChatCount}
                </span>
              )}
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

        <main key={location} className="flex-1 p-3 sm:p-6 overflow-x-hidden">
          {title ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-card-border">
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
          ) : null}
          {children}
        </main>
      </div>

      {/* ── Narayana AI Floating Trigger & Assistant Modal ── */}
      <AdminExecutiveCopilotModal />
    </div>
  );
}
