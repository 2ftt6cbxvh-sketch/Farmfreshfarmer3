import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, CartProvider } from "@/lib/store";

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
      <Route path="/orders" component={Orders} />
      <Route path="/payment/simulate" component={PaymentSimulate} />
      <Route path="/payment/callback" component={PaymentCallback} />
      <Route path="/payment/success/:merchantOrderId" component={PaymentSuccess} />
      <Route path="/payment/failure/:merchantOrderId" component={PaymentFailure} />
      <Route path="/account/subscriptions" component={MySubscriptions} />
      <Route path="/account/referrals" component={MyReferrals} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/refund-policy" component={RefundPage} />
      <Route path="/shipping-policy" component={ShippingPage} />
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
      <Route path="/admin/settings" component={AdminSettings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CartProvider>
            <Toaster />
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </CartProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
