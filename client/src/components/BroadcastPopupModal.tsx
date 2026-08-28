import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  X, AlertTriangle, ShieldAlert, Sparkles, ShoppingBag,
  ArrowRight, Check, Star
} from "lucide-react";
import { apiGet, imgUrl } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { useCart } from "@/lib/store";
import { Button } from "@/components/ui/button";
import type { AnnouncementItem } from "./NotificationBell";

export function BroadcastPopupModal() {
  const { add: addToCart } = useCart();
  const [activePopup, setActivePopup] = useState<AnnouncementItem | null>(null);

  const { data: announcements = [] } = useQuery<AnnouncementItem[]>({
    queryKey: ["/api/announcements/active"],
    queryFn: () => apiGet<AnnouncementItem[]>("/api/announcements/active"),
    staleTime: 60000,
  });

  useEffect(() => {
    if (!announcements.length) return;

    // Find the highest priority active announcement with showPopup === true that has not been dismissed yet
    const unshown = announcements.find((item) => {
      if (!item.showPopup) return false;
      const dismissedKey = `dismissed_popup_${item.id}`;
      return !localStorage.getItem(dismissedKey);
    });

    if (unshown) {
      // Delay slightly for smooth page entrance
      const timer = setTimeout(() => {
        setActivePopup(unshown);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [announcements]);

  if (!activePopup) return null;

  const handleClose = () => {
    if (activePopup) {
      localStorage.setItem(`dismissed_popup_${activePopup.id}`, "true");
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
          {isAd && activePopup.product && (
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
                  <h4 className="text-sm font-extrabold text-foreground truncate">{activePopup.product.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-black text-emerald-500">
                      {formatINR(Number(activePopup.product.price))}
                    </span>
                    {activePopup.product.originalPrice && Number(activePopup.product.originalPrice) > Number(activePopup.product.price) && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatINR(Number(activePopup.product.originalPrice))}
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
                  href={`/product/${activePopup.product.slug}`}
                  onClick={handleClose}
                  className="flex-1 sm:flex-none text-center px-3 py-2 text-xs font-bold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all"
                >
                  Details
                </Link>
                <Button
                  className="flex-1 sm:flex-none px-4 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md gap-1.5"
                  onClick={() => {
                    addToCart(activePopup.product as any);
                    handleClose();
                  }}
                >
                  <ShoppingBag size={14} />
                  <span>Add to Cart</span>
                </Button>
              </div>
            </div>
          )}

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
