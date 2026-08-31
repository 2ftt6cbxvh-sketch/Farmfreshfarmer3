import React, { Suspense, useEffect, useState } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, CartProvider, useAuth } from "@/lib/store";
import LockdownOverlay from "@/components/LockdownOverlay";
import MaintenanceOverlay from "@/components/MaintenanceOverlay";
import { ThemeProvider } from "@/lib/theme-provider";
import { IntroLoader } from "@/components/IntroLoader";
import { StarBumpCelebrationModal } from "@/components/StarBumpCelebrationModal";
import { BroadcastPopupModal } from "@/components/BroadcastPopupModal";
import { BlockedUserOverlay } from "@/components/BlockedUserOverlay";

// Core customer discovery & checkout pages
import Home from "@/pages/Home";
import Category from "@/pages/Category";
import SearchPage from "@/pages/SearchPage";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Login from "@/pages/Login";
import Orders from "@/pages/Orders";
import Account from "@/pages/Account";
import NotFound from "@/pages/not-found";

// Secondary customer pages lazily loaded
const MySubscriptions = React.lazy(() => import("@/pages/MySubscriptions"));
const MyReferrals = React.lazy(() => import("@/pages/MyReferrals"));
const PaymentSimulate = React.lazy(() => import("@/pages/PaymentSimulate"));
const PaymentCallback = React.lazy(() => import("@/pages/PaymentCallback"));
const PaymentSuccess = React.lazy(() => import("@/pages/PaymentResult").then(m => ({ default: m.PaymentSuccess })));
const PaymentFailure = React.lazy(() => import("@/pages/PaymentResult").then(m => ({ default: m.PaymentFailure })));
const ForgotPassword = React.lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = React.lazy(() => import("@/pages/ResetPassword"));

// Legal policy pages lazily loaded
const TermsPage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.TermsPage })));
const PrivacyPage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.PrivacyPage })));
const RefundPage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.RefundPage })));
const ReturnPage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.ReturnPage })));
const ShippingPage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.ShippingPage })));
const GrievancePage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.GrievancePage })));

// Admin & Partner Portal pages (Lazily loaded for lightning-fast customer initial load)
const AdminDashboard = React.lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminProcurementAI = React.lazy(() => import("@/pages/admin/AdminProcurementAI"));
const AdminProducts = React.lazy(() => import("@/pages/admin/AdminProducts"));
const AdminCategories = React.lazy(() => import("@/pages/admin/AdminCategories"));
const AdminApprovals = React.lazy(() => import("@/pages/admin/AdminApprovals"));
const AdminInventory = React.lazy(() => import("@/pages/admin/AdminInventory"));
const AdminOrders = React.lazy(() => import("@/pages/admin/AdminOrders"));
const AdminSubscriptions = React.lazy(() => import("@/pages/admin/AdminSubscriptions"));
const AdminCustomers = React.lazy(() => import("@/pages/admin/AdminCustomers"));
const AdminReviews = React.lazy(() => import("@/pages/admin/AdminReviews"));
const AdminCoupons = React.lazy(() => import("@/pages/admin/AdminCoupons"));
const AdminDiscounts = React.lazy(() => import("@/pages/admin/AdminDiscounts"));
const AdminStarDiscountRules = React.lazy(() => import("@/pages/admin/AdminStarDiscountRules"));
const AdminReferrals = React.lazy(() => import("@/pages/admin/AdminReferrals"));
const AdminPayments = React.lazy(() => import("@/pages/admin/AdminPayments"));
const AdminSettings = React.lazy(() => import("@/pages/admin/AdminSettings"));
const AdminSecurity = React.lazy(() => import("@/pages/admin/AdminSecurity"));
const AdminWarehouses = React.lazy(() => import("@/pages/admin/AdminWarehouses"));
const AdminDelivery = React.lazy(() => import("@/pages/admin/AdminDelivery"));
const AdminLogin = React.lazy(() => import("@/pages/admin/AdminLogin"));
const AdminUsers = React.lazy(() => import("@/pages/admin/AdminUsers"));
const AdminStaff = React.lazy(() => import("@/pages/admin/AdminStaff"));
const AdminDeliveryPartners = React.lazy(() => import("@/pages/admin/AdminDeliveryPartners"));
const AdminGST = React.lazy(() => import("@/pages/admin/AdminGST"));
const AdminLiveChat = React.lazy(() => import("@/pages/admin/AdminLiveChat").then(m => ({ default: m.AdminLiveChat })));
const AdminTickets = React.lazy(() => import("@/pages/admin/AdminTickets"));
const AdminRefunds = React.lazy(() => import("@/pages/admin/AdminRefunds"));
const AdminAdvertisements = React.lazy(() => import("@/pages/admin/AdminAdvertisements"));
const AdminMarketing = React.lazy(() => import("@/pages/admin/AdminMarketing"));
const AdminLakshmiAI = React.lazy(() => import("@/pages/admin/AdminLakshmiAI"));
const DeliveryPartnerPortal = React.lazy(() => import("@/pages/DeliveryPartnerPortal"));
const AdminDirectAccessWarning = React.lazy(() => import("@/pages/admin/AdminDirectAccessWarning").then(m => ({ default: m.AdminDirectAccessWarning })));

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("[React App ErrorBoundary caught error]:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
          <div className="max-w-md space-y-4 p-8 rounded-3xl bg-card border border-border shadow-2xl">
            <h2 className="text-xl font-bold">Something went wrong</h2>
            <p className="text-xs text-muted-foreground">The page encountered an error. Click below to reload.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function useIsAdminHost() {
  const [isAdminHost, setIsAdminHost] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      if ((window as any).__IS_ADMIN_HOST__ === true) return true;
      const hostname = window.location.hostname.toLowerCase();
      const isPrivateSubdomain =
        hostname.endsWith("farmfreshfarmer.com") &&
        !hostname.startsWith("www.") &&
        hostname !== "farmfreshfarmer.com";

      if (
        isPrivateSubdomain ||
        hostname.includes("admin") ||
        hostname.includes("aihhytdgagthawswghsgs") ||
        (window.location.port && localStorage.getItem("dev_admin_mode") === "true")
      ) {
        return true;
      }
    }
    return false;
  });

  useEffect(() => {
    fetch("/api/auth/host-context")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.isAdminHost === "boolean") {
          setIsAdminHost(d.isAdminHost);
        }
      })
      .catch(() => {});
  }, []);

  return isAdminHost;
}

function AppRouter() {
  const [, setLocation] = useLocation();
  const isAdminHost = useIsAdminHost();

  // Instantly redirect legacy PhonePe hash URLs (e.g. https://farmfreshfarmer.com/#/privacy) to clean paths (/privacy)
  useEffect(() => {
    const syncHashRoute = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#/') && hash.length > 2) {
        const cleanPath = hash.substring(1); // e.g. /privacy
        window.history.replaceState(null, '', cleanPath);
        setLocation(cleanPath);
      }
    };
    syncHashRoute();
    window.addEventListener('hashchange', syncHashRoute);
    return () => window.removeEventListener('hashchange', syncHashRoute);
  }, [setLocation]);

  // ========================================================
  // 🏰 ADMIN HOST ROUTING (Dedicated Admin Vault Subdomain)
  // ========================================================
  if (isAdminHost) {
    return (
      <ErrorBoundary>
        <Switch>
          {/* Root & Login routes on Admin Subdomain mount the 3-Factor Multi-Authentication Gateway */}
          <Route path="/login" component={AdminLogin} />
          <Route path="/login/" component={AdminLogin} />
          <Route path="/" component={AdminLogin} />

          {/* Admin Protected Routes */}
          <Route path="/admin">
            {() => <AdminGuard component={AdminDashboard} path="/admin" />}
          </Route>
          <Route path="/admin/">
            {() => <AdminGuard component={AdminDashboard} path="/admin/" />}
          </Route>
          <Route path="/admin/live-chat">
            {() => <AdminGuard component={AdminLiveChat} path="/admin/live-chat" />}
          </Route>
          <Route path="/admin/tickets">
            {() => <AdminGuard component={AdminTickets} path="/admin/tickets" />}
          </Route>
          <Route path="/admin/refunds">
            {() => <AdminGuard component={AdminRefunds} path="/admin/refunds" />}
          </Route>
          <Route path="/admin/procurement-ai">
            {() => <AdminGuard component={AdminProcurementAI} path="/admin/procurement-ai" />}
          </Route>
          <Route path="/admin/products">
            {() => <AdminGuard component={AdminProducts} path="/admin/products" />}
          </Route>
          <Route path="/admin/categories">
            {() => <AdminGuard component={AdminCategories} path="/admin/categories" />}
          </Route>
          <Route path="/admin/approvals">
            {() => <AdminGuard component={AdminApprovals} path="/admin/approvals" />}
          </Route>
          <Route path="/admin/inventory">
            {() => <AdminGuard component={AdminInventory} path="/admin/inventory" />}
          </Route>
          <Route path="/admin/orders">
            {() => <AdminGuard component={AdminOrders} path="/admin/orders" />}
          </Route>
          <Route path="/admin/subscriptions">
            {() => <AdminGuard component={AdminSubscriptions} path="/admin/subscriptions" />}
          </Route>
          <Route path="/admin/customers">
            {() => <AdminGuard component={AdminCustomers} path="/admin/customers" />}
          </Route>
          <Route path="/admin/reviews">
            {() => <AdminGuard component={AdminReviews} path="/admin/reviews" />}
          </Route>
          <Route path="/admin/coupons">
            {() => <AdminGuard component={AdminCoupons} path="/admin/coupons" />}
          </Route>
          <Route path="/admin/discounts">
            {() => <AdminGuard component={AdminDiscounts} path="/admin/discounts" />}
          </Route>
          <Route path="/admin/star-discount-rules">
            {() => <AdminGuard component={AdminStarDiscountRules} path="/admin/star-discount-rules" />}
          </Route>
          <Route path="/admin/referrals">
            {() => <AdminGuard component={AdminReferrals} path="/admin/referrals" />}
          </Route>
          <Route path="/admin/payments">
            {() => <AdminGuard component={AdminPayments} path="/admin/payments" />}
          </Route>
          <Route path="/admin/security">
            {() => <AdminGuard component={AdminSecurity} path="/admin/security" />}
          </Route>
          <Route path="/admin/warehouses">
            {() => <AdminGuard component={AdminWarehouses} path="/admin/warehouses" />}
          </Route>
          <Route path="/admin/delivery">
            {() => <AdminGuard component={AdminDelivery} path="/admin/delivery" />}
          </Route>
          <Route path="/admin/users">
            {() => <AdminGuard component={AdminUsers} path="/admin/users" />}
          </Route>
          <Route path="/admin/staff">
            {() => <AdminGuard component={AdminStaff} path="/admin/staff" />}
          </Route>
          <Route path="/admin/delivery-partners">
            {() => <AdminGuard component={AdminDeliveryPartners} path="/admin/delivery-partners" />}
          </Route>
          <Route path="/admin/gst">
            {() => <AdminGuard component={AdminGST} path="/admin/gst" />}
          </Route>
          <Route path="/admin/advertisements">
            {() => <AdminGuard component={AdminAdvertisements} path="/admin/advertisements" />}
          </Route>
          <Route path="/admin/announcements">
            {() => <AdminGuard component={AdminAdvertisements} path="/admin/announcements" />}
          </Route>
          <Route path="/admin/marketing">
            {() => <AdminGuard component={AdminMarketing} path="/admin/marketing" />}
          </Route>
          <Route path="/admin/campaigns">
            {() => <AdminGuard component={AdminMarketing} path="/admin/campaigns" />}
          </Route>
          <Route path="/admin/lakshmi-ai">
            {() => <AdminGuard component={AdminLakshmiAI} path="/admin/lakshmi-ai" />}
          </Route>
          <Route path="/admin/lakshmi">
            {() => <AdminGuard component={AdminLakshmiAI} path="/admin/lakshmi" />}
          </Route>
          <Route path="/partner-portal" component={DeliveryPartnerPortal} />
          <Route path="/admin/settings">
            {() => <AdminGuard component={AdminSettings} path="/admin/settings" />}
          </Route>

          {/* Any unauthenticated visit to admin subdomain defaults to AdminLogin */}
          <Route component={AdminLogin} />
        </Switch>
      </ErrorBoundary>
    );
  }

  // ========================================================
  // 🛍️ CUSTOMER STOREFRONT ROUTING (Public Website)
  // ========================================================
  return (
    <ErrorBoundary>
      <Switch>
        {/* Legal & Policy Pages for Merchant Onboarding & Public Access */}
        <Route path="/terms" component={TermsPage} />
        <Route path="/terms/" component={TermsPage} />
        <Route path="/terms-and-conditions" component={TermsPage} />
        <Route path="/terms-conditions" component={TermsPage} />

        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/privacy/" component={PrivacyPage} />
        <Route path="/privacy-policy" component={PrivacyPage} />

        <Route path="/refund-policy" component={RefundPage} />
        <Route path="/refund-policy/" component={RefundPage} />
        <Route path="/cancellation-refund-policy" component={RefundPage} />
        <Route path="/cancellation-policy" component={RefundPage} />
        <Route path="/refund" component={RefundPage} />

        <Route path="/return-policy" component={ReturnPage} />
        <Route path="/return-policy/" component={ReturnPage} />
        <Route path="/return_policy" component={ReturnPage} />
        <Route path="/returns" component={ReturnPage} />

        <Route path="/shipping-policy" component={ShippingPage} />
        <Route path="/shipping-policy/" component={ShippingPage} />
        <Route path="/shipping_policy" component={ShippingPage} />
        <Route path="/shipping" component={ShippingPage} />
        <Route path="/delivery-policy" component={ShippingPage} />

        <Route path="/grievance" component={GrievancePage} />
        <Route path="/grievance/" component={GrievancePage} />
        <Route path="/grievance-policy" component={GrievancePage} />
        <Route path="/contact" component={GrievancePage} />
        <Route path="/contact-us" component={GrievancePage} />

        {/* App & Store Feature Routes */}
        <Route path="/category/:slug" component={Category} />
        <Route path="/search" component={SearchPage} />
        <Route path="/products" component={SearchPage} />
        <Route path="/product/:id" component={ProductDetail} />
        <Route path="/products/:id" component={ProductDetail} />
        <Route path="/cart" component={Cart} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/reset-password/" component={ResetPassword} />
        <Route path="/orders" component={Orders} />
        <Route path="/payment/simulate" component={PaymentSimulate} />
        <Route path="/payment/callback" component={PaymentCallback} />
        <Route path="/payment/success/:merchantOrderId" component={PaymentSuccess} />
        <Route path="/payment/failure/:merchantOrderId" component={PaymentFailure} />
        <Route path="/account/subscriptions" component={MySubscriptions} />
        <Route path="/subscriptions" component={MySubscriptions} />
        <Route path="/account/referrals" component={MyReferrals} />
        <Route path="/referrals" component={MyReferrals} />
        <Route path="/account" component={Account} />
        <Route path="/profile" component={Account} />
        <Route path="/my-orders" component={Orders} />
        <Route path="/help" component={GrievancePage} />

        {/* Intercept & Block Direct /admin access on Public Storefront */}
        <Route path="/admin/login" component={AdminDirectAccessWarning} />
        <Route path="/admin/login/" component={AdminDirectAccessWarning} />
        <Route path="/admin">
          {() => <AdminDirectAccessWarning targetRoute="/admin" />}
        </Route>
        <Route path="/admin/">
          {() => <AdminDirectAccessWarning targetRoute="/admin/" />}
        </Route>
        <Route path="/admin/:rest*">
          {() => <AdminDirectAccessWarning targetRoute="/admin" />}
        </Route>

        {/* Root Home Route */}
        <Route path="/" component={Home} />

        {/* Fallback 404 Route */}
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function AdminGuard({ component: Component, path }: { component: React.ComponentType; path?: string }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground bg-black">Loading…</div>;
  }

  const storedAdmin = (() => {
    try {
      return JSON.parse(localStorage.getItem("adminUser") || "null");
    } catch {
      return null;
    }
  })();

  const effectiveUser = (user && user.id) ? user : storedAdmin;

  const STAFF_ROLES = [
    "admin", "warehouse_admin", "manager_admin", "delivery_partner", "subadmin", "custom_subadmin",
    "customer_rep", "local_grievance_officer", "zonal_grievance_officer", "chief_grievance_officer", "superadmin"
  ];

  const isStaffOrAdmin = Boolean(
    effectiveUser && (
      effectiveUser.isPrimaryAdmin === true ||
      effectiveUser.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
      STAFF_ROLES.includes(effectiveUser.role)
    )
  );

  const isAdminHost = useIsAdminHost();

  if (!isStaffOrAdmin) {
    if (isAdminHost) {
      return <AdminLogin />;
    }
    return <AdminDirectAccessWarning targetRoute={path || window.location.pathname} />;
  }

  return <Component />;
}

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);

  return null;
}

function TierThemeSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      document.documentElement.setAttribute("data-tier", "green");
      return;
    }

    const isSuperAdmin = Boolean(
      user.isPrimaryAdmin ||
      user.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
      user.id === 1 ||
      (user.role === "admin" && (user.id === 0 || user.isPrimaryAdmin))
    );
    const isStaff = Boolean(!isSuperAdmin && user.role !== "customer");
    const starsCount = isSuperAdmin
      ? 6
      : isStaff
      ? Math.max(0, Math.min(6, Number(user.starRating) ?? 5))
      : Math.max(0, Math.min(5, Number(user.customerStars) || 0));

    if (starsCount === 6) {
      document.documentElement.setAttribute("data-tier", "gold");
    } else if (starsCount === 5) {
      document.documentElement.setAttribute("data-tier", "blue");
    } else if (starsCount === 4) {
      document.documentElement.setAttribute("data-tier", "silver");
    } else if (starsCount === 3) {
      document.documentElement.setAttribute("data-tier", "bronze");
    } else {
      document.documentElement.setAttribute("data-tier", "green");
    }
  }, [user]);

  return null;
}

function AppContent() {
  const [lockdownActive, setLockdownActive] = useState(false);
  const [lockdownReason, setLockdownReason] = useState("");
  const [maintenanceData, setMaintenanceData] = useState<{
    active: boolean;
    headline: string;
    message: string;
    estimatedEnd?: string | null;
    estimatedMinutes?: number | null;
    allowAdminBypass?: boolean;
  } | null>(null);

  useEffect(() => {
    const checkPlatformStatus = async () => {
      try {
        // 1. Check Lockdown status
        const res = await fetch("/api/delivery/status");
        if (res.status === 423) {
          const data = await res.json();
          setLockdownActive(true);
          setLockdownReason(data.reason || "");
        } else if (res.ok) {
          const data = await res.json();
          if (data.lockdown?.active) {
            setLockdownActive(true);
            setLockdownReason(data.lockdown.reason || "");
          } else {
            setLockdownActive(false);
          }
        }

        // 2. Check Maintenance status
        const maintRes = await fetch("/api/maintenance/status");
        if (maintRes.ok) {
          const mData = await maintRes.json();
          setMaintenanceData(mData);
        }
      } catch {
        // ignore network error
      }
    };

    checkPlatformStatus();
    // Balanced 30s background check (instant on tab visibility & event-driven)
    const interval = setInterval(checkPlatformStatus, 30000);

    // Instant event listeners for zero-latency overlay trigger
    const onMaintenanceActive = (e: any) => {
      if (e?.detail) {
        setMaintenanceData(e.detail);
      }
    };
    window.addEventListener("farmfresh:maintenance_active", onMaintenanceActive);

    const onVisibility = () => {
      if (document.visibilityState === "visible") checkPlatformStatus();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("farmfresh:maintenance_active", onMaintenanceActive);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Strictly verify Super Admin / Staff session
  const isStaffOrAdminUser = (() => {
    try {
      const user = JSON.parse(localStorage.getItem("adminUser") || localStorage.getItem("user") || "null");
      const token = localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token");
      return !!(
        token &&
        user &&
        (user.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
          user.role === "admin" ||
          user.role === "superadmin" ||
          user.role === "manager_admin" ||
          user.role === "subadmin" ||
          user.isPrimaryAdmin)
      );
    } catch {
      return false;
    }
  })();

  const isCurrentAdminPath =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/login"));

  // 🚨 Emergency Cyberattack Lockdown Mode: Unmount everything for non-superadmins
  if (lockdownActive && !isStaffOrAdminUser) {
    return <LockdownOverlay active={true} reason={lockdownReason} />;
  }

  // 🛠️ Scheduled Under Maintenance Mode: Show polite branded maintenance screen for storefront visitors
  if (maintenanceData?.active && !isStaffOrAdminUser && !isCurrentAdminPath) {
    return (
      <MaintenanceOverlay
        headline={maintenanceData.headline}
        message={maintenanceData.message}
        estimatedEnd={maintenanceData.estimatedEnd}
        estimatedMinutes={maintenanceData.estimatedMinutes}
        allowAdminBypass={maintenanceData.allowAdminBypass}
      />
    );
  }

  return (
    <>
      <IntroLoader />
      <TooltipProvider>
        <AuthProvider>
          <BlockedUserOverlay />
          <TierThemeSync />
          <StarBumpCelebrationModal />
          <CartProvider>
            <BroadcastPopupModal />
            <Toaster />
            <Router>
              <ScrollToTop />
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" /></div>}>
                <AppRouter />
              </Suspense>
            </Router>
          </CartProvider>
        </AuthProvider>
      </TooltipProvider>
    </>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
