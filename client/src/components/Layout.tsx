import { ReactNode } from "react";
import { useLocation } from "wouter";
import DeliveryBanner from "./DeliveryBanner";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FreeDeliveryBar } from "./FreeDeliveryBar";
import { ChatbotLakshmi } from "./ChatbotLaxshmi";

// Pages where the free delivery bar should NOT show
const EXCLUDE_FREE_DELIVERY_BAR = [
  "/account/referrals",
  "/account/subscriptions",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/shipping-policy",
  "/login",
  "/forgot-password",
  "/payment",
  "/partner-portal",
  "/admin",
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const showFreeDeliveryBar = !EXCLUDE_FREE_DELIVERY_BAR.some((p) =>
    location.startsWith(p)
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      <DeliveryBanner />
      <Header />
      {showFreeDeliveryBar && <FreeDeliveryBar />}
      {/* Smooth Page Content Container */}
      <main key={location} className="flex-1 transition-opacity duration-200">
        {children}
      </main>
      <Footer />
      <ChatbotLakshmi />
    </div>
  );
}
