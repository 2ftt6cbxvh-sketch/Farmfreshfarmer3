import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  X, AlertTriangle, ShieldAlert, Sparkles, ShoppingBag,
  ArrowRight, Check, Star
} from "lucide-react";
import { apiGet, imgUrl } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { useCart, useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { AnnouncementItem } from "./NotificationBell";

export function BroadcastPopupModal() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const isAdminRoute =
    location.startsWith("/admin") ||
    location.startsWith("/subadmin") ||
    location.startsWith("/delivery-partner") ||
    location.startsWith("/delivery-admin") ||
    location.startsWith("/manager") ||
    (typeof window !== "undefined" && window.location.pathname.startsWith("/admin"));

  let addToCart: any = () => {};
  try {
    const cart = useCart();
    if (cart) addToCart = cart.add;
  } catch {}
  const [activePopup, setActivePopup] = useState<AnnouncementItem | null>(null);
  const [shownIds, setShownIds] = useState<number[]>([]);

  const { data: announcements = [] } = useQuery<AnnouncementItem[]>({
    queryKey: ["/api/announcements/active"],
    queryFn: () => apiGet<AnnouncementItem[]>("/api/announcements/active"),
    staleTime: 0,
    refetchInterval: 10000,
    enabled: !isAdminRoute,
  });

  useEffect(() => {
    if (isAdminRoute || !announcements.length) return;

    // Find the highest priority active announcement with showPopup === true that has not been shown this session
    const unshown = announcements.find((item) => {
      if (!item.showPopup) return false;
      // Use session-scoped tracking (not localStorage) so new ads always show on new visit
      if (shownIds.includes(item.id)) return false;
      // Also check localStorage dismiss for a 24h grace period
      const dismissKey = `dismissed_popup_${item.id}`;
      const dismissedAt = localStorage.getItem(dismissKey);
      if (dismissedAt) {
        // Re-show after 24 hours
        const elapsed = Date.now() - Number(dismissedAt);
        if (elapsed < 24 * 60 * 60 * 1000) return false;
        // Expired — clear it so it shows again
        localStorage.removeItem(dismissKey);
      }
      return true;
    });

    if (unshown && !activePopup) {
      // Delay slightly for smooth page entrance
      const timer = setTimeout(() => {
        setActivePopup(unshown);
        setShownIds((prev) => [...prev, unshown.id]);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [announcements, shownIds, activePopup, isAdminRoute]);

  if (isAdminRoute || !activePopup) return null;

  const handleClose = () => {
    if (activePopup) {
      // Store timestamp so ad re-shows after 24 hours
      localStorage.setItem(`dismissed_popup_${activePopup.id}`, String(Date.now()));
    }
    setActivePopup(null);
  };

  const isWarning = activePopup.category === "warning";
  const isCritical = activePopup.category === "critical";
  const isAd = activePopup.category === "advertisement";

  // Color Theme Schemes
  const borderClass = isCritical
    ? "border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.25)]"
    : isWarning
    ? "border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.25)]"
    : "border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.25)]";

  const headerBg = isCritical
    ? "bg-gradient-to-r from-red-950/80 via-red-900/40 to-transparent text-red-400"
    : isWarning
    ? "bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-transparent text-amber-400"
    : "bg-gradient-to-r from-emerald-950/80 via-emerald-900/40 to-transparent text-emerald-400";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-lg rounded-3xl bg-card border ${borderClass} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3.5 right-3.5 z-10 w-8 h-8 rounded-full bg-background/80 hover:bg-muted border border-border text-foreground flex items-center justify-center text-sm font-bold transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-md"
          title="Close announcement"
        >
          ✕
        </button>

        {/* Modal Banner Header */}
        <div className={`px-6 py-4 border-b border-card-border flex items-center gap-3 ${headerBg}`}>
          <div className="w-10 h-10 rounded-2xl bg-card/60 border border-border/50 flex items-center justify-center shrink-0">
            {isCritical && <ShieldAlert size={22} className="text-red-500 animate-pulse" />}
            {isWarning && <AlertTriangle size={22} className="text-amber-500" />}
            {isAd && <Sparkles size={22} className="text-emerald-400" />}
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-card border border-border">
              {activePopup.category}
            </span>
            <h2 className="text-base sm:text-lg font-black text-foreground mt-1 line-clamp-1">
              {activePopup.title}
            </h2>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {activePopup.message}
          </p>

          {/* Interactive Attached Product Card (for Green Advertisements) */}
          {isAd && activePopup.product && (() => {
            const basePrice = Number(activePopup.product.price || 0);
            const discountPct = Number(activePopup.product.discountPercent || 0);
            const currentPrice = discountPct > 0 ? (basePrice * (1 - discountPct / 100)) : basePrice;

            return (
              <div className="p-3.5 rounded-2xl bg-secondary/50 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                  {activePopup.product.image ? (
                    <img
                      src={imgUrl(activePopup.product.image)}
                      alt={activePopup.product.name}
                      className="w-16 h-16 rounded-xl object-cover border border-border shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-emerald-950/30 flex items-center justify-center text-2xl shrink-0">
                      🌱
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-extrabold text-foreground truncate">{activePopup.product.name}</h4>
                      {discountPct > 0 && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {Math.round(discountPct)}% OFF
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-base font-black text-emerald-400">
                        {formatINR(currentPrice)}
                      </span>
                      {discountPct > 0 && (
                        <span className="text-xs text-muted-foreground line-through font-semibold">
                          {formatINR(basePrice)}
                        </span>
                      )}
                    </div>
                    {activePopup.product.unit && (
                      <span className="text-[10px] text-muted-foreground">{activePopup.product.unit}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Link
                    href={`/product/${activePopup.product.id}`}
                    onClick={handleClose}
                    className="flex-1 sm:flex-none text-center px-3 py-2 text-xs font-bold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all"
                  >
                    Details
                  </Link>
                  <Button
                    className="flex-1 sm:flex-none px-4 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md gap-1.5 cursor-pointer"
                    onClick={() => {
                      if (!user) {
                        toast({
                          title: "🔐 Please Sign In",
                          description: "Please sign in to add items to your cart and complete checkout.",
                        });
                        handleClose();
                        navigate("/login");
                        return;
                      }
                      addToCart({
                        ...activePopup.product,
                        price: currentPrice,
                        discountPercent: discountPct,
                      } as any);
                      toast({
                        title: "✨ Added to Cart",
                        description: `${activePopup.product.name} (${formatINR(currentPrice)})`,
                      });
                      handleClose();
                    }}
                  >
                    <ShoppingBag size={14} />
                    <span>Add to Cart</span>
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-2">
            <Button
              variant="default"
              className={`rounded-xl font-extrabold text-xs px-6 ${
                isCritical
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : isWarning
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
              onClick={handleClose}
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
