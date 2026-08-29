import React, { Suspense, useEffect, useState } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, CartProvider, useAuth } from "@/lib/store";
import LockdownOverlay from "@/components/LockdownOverlay";
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
import PaymentSimulate from "@/pages/PaymentSimulate";
import PaymentCallback from "@/pages/PaymentCallback";
import { PaymentSuccess, PaymentFailure } from "@/pages/PaymentResult";
import MySubscriptions from "@/pages/MySubscriptions";
import MyReferrals from "@/pages/MyReferrals";
import Account from "@/pages/Account";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";

// Legal pages
import {
  TermsPage, PrivacyPage, RefundPage, ReturnPage, ShippingPage, GrievancePage
} from "@/pages/LegalPages";

// Admin & Partner Portal pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminApprovals from "@/pages/admin/AdminApprovals";
import AdminInventory from "@/pages/admin/AdminInventory";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminSubscriptions from "@/pages/admin/AdminSubscriptions";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import AdminReviews from "@/pages/admin/AdminReviews";
import AdminCoupons from "@/pages/admin/AdminCoupons";
import AdminDiscounts from "@/pages/admin/AdminDiscounts";
import AdminStarDiscountRules from "@/pages/admin/AdminStarDiscountRules";
import AdminReferrals from "@/pages/admin/AdminReferrals";
import AdminPayments from "@/pages/admin/AdminPayments";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminSecurity from "@/pages/admin/AdminSecurity";
import AdminWarehouses from "@/pages/admin/AdminWarehouses";
import AdminDelivery from "@/pages/admin/AdminDelivery";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminStaff from "@/pages/admin/AdminStaff";
import AdminDeliveryPartners from "@/pages/admin/AdminDeliveryPartners";
import AdminGST from "@/pages/admin/AdminGST";
import { AdminLiveChat } from "@/pages/admin/AdminLiveChat";
import AdminTickets from "@/pages/admin/AdminTickets";
import AdminRefunds from "@/pages/admin/AdminRefunds";
import AdminAdvertisements from "@/pages/admin/AdminAdvertisements";
import AdminMarketing from "@/pages/admin/AdminMarketing";
import DeliveryPartnerPortal from "@/pages/DeliveryPartnerPortal";
import { AdminDirectAccessWarning } from "@/pages/admin/AdminDirectAccessWarning";

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

  useEffect(() => {
    const checkLockdown = async () => {
      try {
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
      } catch {
        // ignore network errors
      }
    };
    checkLockdown();
    const interval = setInterval(checkLockdown, 60000);
    return () => clearInterval(interval);
  }, []);

  // Strictly verify Super Admin session during lockdown
  const isSuperAdminUser = (() => {
    try {
      const user = JSON.parse(localStorage.getItem("adminUser") || localStorage.getItem("user") || "null");
      const token = localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token");
      return !!(token && user && (user.email?.toLowerCase() === "admin@farmfreshfarmer.com" || user.role === "admin" || user.role === "superadmin" || user.isPrimaryAdmin));
    } catch {
      return false;
    }
  })();

  // If lockdown is active and user is NOT Primary Super Admin, completely UNMOUNT the app DOM
  // so inspecting or deleting elements via Web Inspector / DevTools / Extensions reveals ZERO content.
  if (lockdownActive && !isSuperAdminUser) {
    return <LockdownOverlay active={true} reason={lockdownReason} />;
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
              <AppRouter />
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
