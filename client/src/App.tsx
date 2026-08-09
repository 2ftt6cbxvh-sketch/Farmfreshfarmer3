import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, CartProvider } from "@/lib/store";
import { useEffect, useState } from "react";
import LockdownOverlay from "@/components/LockdownOverlay";
import { ThemeProvider } from "@/lib/theme-provider";

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
import { TermsPage, PrivacyPage, RefundPage, ShippingPage } from "@/pages/LegalPages";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminInventory from "@/pages/admin/AdminInventory";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminSubscriptions from "@/pages/admin/AdminSubscriptions";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import AdminReviews from "@/pages/admin/AdminReviews";
import AdminCoupons from "@/pages/admin/AdminCoupons";
import AdminDiscounts from "@/pages/admin/AdminDiscounts";
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
import DeliveryPartnerPortal from "@/pages/DeliveryPartnerPortal";
import ForgotPassword from "@/pages/ForgotPassword";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
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
      <Route path="/account/referrals" component={MyReferrals} />
      <Route path="/account" component={Account} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/refund-policy" component={RefundPage} />
      <Route path="/shipping-policy" component={ShippingPage} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/products" component={AdminProducts} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/inventory" component={AdminInventory} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/subscriptions" component={AdminSubscriptions} />
      <Route path="/admin/customers" component={AdminCustomers} />
      <Route path="/admin/reviews" component={AdminReviews} />
      <Route path="/admin/coupons" component={AdminCoupons} />
      <Route path="/admin/discounts" component={AdminDiscounts} />
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
    const interval = setInterval(checkLockdown, 5000); // poll every 5s for fast Telegram response
    return () => clearInterval(interval);
  }, []);

  // Strictly verify Super Admin session during lockdown
  const isSuperAdminUser = (() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
      return !!(token && user && (user.email === "admin@farmfreshfarmer.com" || user.role === "superadmin"));
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
      <LockdownOverlay active={lockdownActive} reason={lockdownReason} />
      <TooltipProvider>
        <AuthProvider>
          <CartProvider>
            <Toaster />
            <Router hook={useHashLocation}>
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
