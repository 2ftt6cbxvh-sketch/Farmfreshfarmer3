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

// Eager load core customer landing & discovery pages for instant initial load
import Home from "@/pages/Home";
import Category from "@/pages/Category";
import SearchPage from "@/pages/SearchPage";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Login from "@/pages/Login";

// Helper to auto-recover when newer chunks are deployed
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      console.warn("[Chunk Load Error] Fetching fresh deployment...", err);
      const reloadKey = "fff_chunk_retry_" + window.location.pathname;
      const lastRetry = parseInt(sessionStorage.getItem(reloadKey) || "0", 10);
      if (!lastRetry || Date.now() - lastRetry > 8000) {
        sessionStorage.setItem(reloadKey, String(Date.now()));
        window.location.reload();
        return new Promise(() => {}) as any;
      }
      throw err;
    }
  });
}

// Lazy load secondary customer pages
const Orders = lazyWithRetry(() => import("@/pages/Orders"));
const PaymentSimulate = lazyWithRetry(() => import("@/pages/PaymentSimulate"));
const PaymentCallback = lazyWithRetry(() => import("@/pages/PaymentCallback"));
const PaymentSuccess = lazyWithRetry(() => import("@/pages/PaymentResult").then(m => ({ default: m.PaymentSuccess })));
const PaymentFailure = lazyWithRetry(() => import("@/pages/PaymentResult").then(m => ({ default: m.PaymentFailure })));
const MySubscriptions = lazyWithRetry(() => import("@/pages/MySubscriptions"));
const MyReferrals = lazyWithRetry(() => import("@/pages/MyReferrals"));
const Account = lazyWithRetry(() => import("@/pages/Account"));
const ForgotPassword = lazyWithRetry(() => import("@/pages/ForgotPassword"));
const NotFound = lazyWithRetry(() => import("@/pages/not-found"));

// Lazy load Legal pages
const TermsPage = lazyWithRetry(() => import("@/pages/LegalPages").then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazyWithRetry(() => import("@/pages/LegalPages").then(m => ({ default: m.PrivacyPage })));
const RefundPage = lazyWithRetry(() => import("@/pages/LegalPages").then(m => ({ default: m.RefundPage })));
const ReturnPage = lazyWithRetry(() => import("@/pages/LegalPages").then(m => ({ default: m.ReturnPage })));
const ShippingPage = lazyWithRetry(() => import("@/pages/LegalPages").then(m => ({ default: m.ShippingPage })));
const GrievancePage = lazyWithRetry(() => import("@/pages/LegalPages").then(m => ({ default: m.GrievancePage })));

// Lazy load Admin pages
const AdminDashboard = lazyWithRetry(() => import("@/pages/admin/AdminDashboard"));
const AdminProducts = lazyWithRetry(() => import("@/pages/admin/AdminProducts"));
const AdminCategories = lazyWithRetry(() => import("@/pages/admin/AdminCategories"));
const AdminApprovals = lazyWithRetry(() => import("@/pages/admin/AdminApprovals"));
const AdminInventory = lazyWithRetry(() => import("@/pages/admin/AdminInventory"));
const AdminOrders = lazyWithRetry(() => import("@/pages/admin/AdminOrders"));
const AdminSubscriptions = lazyWithRetry(() => import("@/pages/admin/AdminSubscriptions"));
const AdminCustomers = lazyWithRetry(() => import("@/pages/admin/AdminCustomers"));
const AdminReviews = lazyWithRetry(() => import("@/pages/admin/AdminReviews"));
const AdminCoupons = lazyWithRetry(() => import("@/pages/admin/AdminCoupons"));
const AdminDiscounts = lazyWithRetry(() => import("@/pages/admin/AdminDiscounts"));
const AdminStarDiscountRules = lazyWithRetry(() => import("@/pages/admin/AdminStarDiscountRules"));
const AdminReferrals = lazyWithRetry(() => import("@/pages/admin/AdminReferrals"));
const AdminPayments = lazyWithRetry(() => import("@/pages/admin/AdminPayments"));
const AdminSettings = lazyWithRetry(() => import("@/pages/admin/AdminSettings"));
const AdminSecurity = lazyWithRetry(() => import("@/pages/admin/AdminSecurity"));
const AdminWarehouses = lazyWithRetry(() => import("@/pages/admin/AdminWarehouses"));
const AdminDelivery = lazyWithRetry(() => import("@/pages/admin/AdminDelivery"));
const AdminLogin = lazyWithRetry(() => import("@/pages/admin/AdminLogin"));
const AdminUsers = lazyWithRetry(() => import("@/pages/admin/AdminUsers"));
const AdminStaff = lazyWithRetry(() => import("@/pages/admin/AdminStaff"));
const AdminDeliveryPartners = lazyWithRetry(() => import("@/pages/admin/AdminDeliveryPartners"));
const AdminGST = lazyWithRetry(() => import("@/pages/admin/AdminGST"));
const AdminLiveChat = lazyWithRetry(() => import("@/pages/admin/AdminLiveChat").then(m => ({ default: m.AdminLiveChat })));
const AdminTickets = lazyWithRetry(() => import("@/pages/admin/AdminTickets"));
const AdminRefunds = lazyWithRetry(() => import("@/pages/admin/AdminRefunds"));
const AdminAdvertisements = lazyWithRetry(() => import("@/pages/admin/AdminAdvertisements"));

// Lazy load Delivery Partner pages
const DeliveryPartnerPortal = lazyWithRetry(() => import("@/pages/DeliveryPartnerPortal"));

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
    </div>
  );
}

function AppRouter() {
  const [, setLocation] = useLocation();

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

  return (
    <Suspense fallback={<RouteFallback />}>
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
        <Route path="/product/:id" component={ProductDetail} />
        <Route path="/cart" component={Cart} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
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

        {/* Admin & Partner Portal Routes */}
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/live-chat" component={AdminLiveChat} />
        <Route path="/admin/tickets" component={AdminTickets} />
        <Route path="/admin/refunds" component={AdminRefunds} />
        <Route path="/admin/products" component={AdminProducts} />
        <Route path="/admin/categories" component={AdminCategories} />
        <Route path="/admin/approvals" component={AdminApprovals} />
        <Route path="/admin/inventory" component={AdminInventory} />
        <Route path="/admin/orders" component={AdminOrders} />
        <Route path="/admin/subscriptions" component={AdminSubscriptions} />
        <Route path="/admin/customers" component={AdminCustomers} />
        <Route path="/admin/reviews" component={AdminReviews} />
        <Route path="/admin/coupons" component={AdminCoupons} />
        <Route path="/admin/discounts" component={AdminDiscounts} />
        <Route path="/admin/star-discount-rules" component={AdminStarDiscountRules} />
        <Route path="/admin/referrals" component={AdminReferrals} />
        <Route path="/admin/payments" component={AdminPayments} />
        <Route path="/admin/security" component={AdminSecurity} />
        <Route path="/admin/warehouses" component={AdminWarehouses} />
        <Route path="/admin/delivery" component={AdminDelivery} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/staff" component={AdminStaff} />
        <Route path="/admin/delivery-partners" component={AdminDeliveryPartners} />
        <Route path="/admin/gst" component={AdminGST} />
        <Route path="/admin/advertisements" component={AdminAdvertisements} />
        <Route path="/admin/announcements" component={AdminAdvertisements} />
        <Route path="/partner-portal" component={DeliveryPartnerPortal} />
        <Route path="/admin/settings" component={AdminSettings} />

        {/* Root Home Route */}
        <Route path="/" component={Home} />

        {/* Fallback 404 Route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
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
