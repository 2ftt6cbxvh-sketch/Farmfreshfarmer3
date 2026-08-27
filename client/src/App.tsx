import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, CartProvider, useAuth } from "@/lib/store";
import { useEffect, useState } from "react";
import LockdownOverlay from "@/components/LockdownOverlay";
import { ThemeProvider } from "@/lib/theme-provider";
import { IntroLoader } from "@/components/IntroLoader";
import { StarBumpCelebrationModal } from "@/components/StarBumpCelebrationModal";
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
import { TermsPage, PrivacyPage, RefundPage, ReturnPage, ShippingPage, GrievancePage } from "@/pages/LegalPages";
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
import DeliveryPartnerPortal from "@/pages/DeliveryPartnerPortal";
import DeliveryPartnerLogin from "@/pages/DeliveryPartnerLogin";
import ForgotPassword from "@/pages/ForgotPassword";
import NotFound from "@/pages/not-found";
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
      <Route path="/partner-portal" component={DeliveryPartnerPortal} />
      <Route path="/admin/settings" component={AdminSettings} />

      {/* Root Home Route */}
      <Route path="/" component={Home} />

      {/* Fallback 404 Route */}
      <Route component={NotFound} />
    </Switch>
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
