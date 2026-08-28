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

// Lazy load secondary customer pages
const Orders = React.lazy(() => import("@/pages/Orders"));
const PaymentSimulate = React.lazy(() => import("@/pages/PaymentSimulate"));
const PaymentCallback = React.lazy(() => import("@/pages/PaymentCallback"));
const PaymentSuccess = React.lazy(() => import("@/pages/PaymentResult").then(m => ({ default: m.PaymentSuccess })));
const PaymentFailure = React.lazy(() => import("@/pages/PaymentResult").then(m => ({ default: m.PaymentFailure })));
const MySubscriptions = React.lazy(() => import("@/pages/MySubscriptions"));
const MyReferrals = React.lazy(() => import("@/pages/MyReferrals"));
const Account = React.lazy(() => import("@/pages/Account"));
const ForgotPassword = React.lazy(() => import("@/pages/ForgotPassword"));
const NotFound = React.lazy(() => import("@/pages/not-found"));

// Lazy load Legal pages
const TermsPage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.TermsPage })));
const PrivacyPage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.PrivacyPage })));
const RefundPage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.RefundPage })));
const ReturnPage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.ReturnPage })));
const ShippingPage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.ShippingPage })));
const GrievancePage = React.lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.GrievancePage })));

// Lazy load Admin pages
const AdminDashboard = React.lazy(() => import("@/pages/admin/AdminDashboard"));
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

// Lazy load Delivery Partner pages
const DeliveryPartnerPortal = React.lazy(() => import("@/pages/DeliveryPartnerPortal"));

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
