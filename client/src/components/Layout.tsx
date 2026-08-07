import { ReactNode } from "react";
import { useLocation } from "wouter";
import DeliveryBanner from "./DeliveryBanner";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      <DeliveryBanner />
      <Header />
      {/* 3D Parallax Page Transition Wrapper */}
      <main key={location} className="flex-1 animate-page-enter-3d">
        {children}
      </main>
      <Footer />
    </div>
  );
}
