import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Bell, AlertTriangle, ShieldAlert, Sparkles, X, CheckCircle2,
  ExternalLink, ShoppingBag, ArrowRight, ShieldCheck
} from "lucide-react";
import { apiGet, imgUrl } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { useAuth, useCart } from "@/lib/store";
import { Button } from "@/components/ui/button";

export interface AnnouncementItem {
  id: number;
  title: string;
  message: string;
  category: "warning" | "critical" | "advertisement";
  productId?: number | null;
  isActive: boolean;
  showPopup: boolean;
  priority: number;
  createdAt: string;
  product?: {
    id: number;
    name: string;
    slug: string;
    price: string | number;
    originalPrice?: string | number;
    image?: string;
    categorySlug?: string;
    unit?: string;
  } | null;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { add: addToCart } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem("read_notification_ids");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: announcements = [] } = useQuery<AnnouncementItem[]>({
    queryKey: ["/api/announcements/active"],
    queryFn: () => apiGet<AnnouncementItem[]>("/api/announcements/active"),
    refetchInterval: 30000,
  });

  const { data: requireVerificationSetting } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/require_superadmin_verification_to_order"],
    queryFn: () => apiGet<{ value: string }>("/api/settings/require_superadmin_verification_to_order").catch(() => ({ value: "false" })),
  });

  const isVerificationMandatory = requireVerificationSetting?.value === "true";
  const showUnverifiedWarning = Boolean(user && !user.isVerified && isVerificationMandatory && user.role === "customer");

  const unreadCount = announcements.filter((a) => !readIds.includes(a.id)).length + (showUnverifiedWarning ? 1 : 0);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markAllAsRead = () => {
    const allIds = announcements.map((a) => a.id);
    setReadIds(allIds);
    try {
      localStorage.setItem("read_notification_ids", JSON.stringify(allIds));
    } catch {}
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      markAllAsRead();
    }
  };

  return (
    <div className="relative z-[9999]" ref={dropdownRef}>
      {/* 🔔 Animated Bell Button */}
      <button
        onClick={handleToggle}
        className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border transition-all duration-300 shadow-xs cursor-pointer ${
          unreadCount > 0
            ? "bg-amber-500/10 border-amber-500/40 text-amber-500 hover:bg-amber-500/20"
            : "bg-secondary/80 hover:bg-secondary border-border text-foreground hover:scale-105"
        }`}
        aria-label="View Notifications"
        title="View Notifications & Announcements"
      >
        <Bell
          size={16}
          className={`${
            unreadCount > 0
              ? "animate-[wiggle_1s_ease-in-out_infinite] text-amber-500 dark:text-amber-400"
              : "text-foreground"
          }`}
        />

        {/* Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white shadow-[0_0_8px_rgba(220,38,38,0.7)] animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* 📋 Notification Drop Box Modal */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-card/98 backdrop-blur-2xl border border-card-border shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[99999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 bg-secondary/70 border-b border-card-border">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-emerald-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Notifications & Alerts</h3>
            </div>
            <div className="flex items-center gap-2">
              {announcements.length > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[10px] text-muted-foreground hover:text-foreground font-semibold"
                >
                  Mark read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="w-5 h-5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
          </div>

          {/* List of Notifications */}
          <div className="max-h-96 overflow-y-auto p-3 space-y-2.5 divide-y divide-border/20">
            {/* Account Verification Warning Banner if user is unverified and verification is required */}
            {showUnverifiedWarning && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 animate-pulse">
                <div className="flex items-center gap-2 text-amber-500 text-xs font-black">
                  <AlertTriangle size={15} />
                  <span>Account Pending Verification</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Your account is pending Super Admin review. Order placement will be unlocked once your profile is verified with the Blue Badge.
                </p>
                <Link
                  href="/account"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:underline pt-0.5"
                >
                  <span>View Account Status</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {/* Verified Genuine Account Badge Card if user is verified */}
            {user && user.isVerified && (
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">✓</span>
                  <div>
                    <p className="text-xs font-bold text-blue-400">Verified Genuine Account</p>
                    <p className="text-[10px] text-muted-foreground">You have verified status & unrestricted ordering.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Announcements & Ads */}
            {announcements.map((item) => {
              const isWarning = item.category === "warning";
              const isCritical = item.category === "critical";
              const isAd = item.category === "advertisement";

              const themeClasses = isCritical
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : isWarning
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all ${themeClasses} space-y-2`}
                >
                  {/* Category Title & Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-black text-xs">
                      {isCritical && <ShieldAlert size={14} className="text-red-500" />}
                      {isWarning && <AlertTriangle size={14} className="text-amber-500" />}
                      {isAd && <Sparkles size={14} className="text-emerald-500" />}
                      <span className="text-foreground">{item.title}</span>
                    </div>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-background/80 border border-border">
                      {item.category}
                    </span>
                  </div>

                  {/* Message */}
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {item.message}
                  </p>

                  {/* Interactive Product Card in Ad */}
                  {isAd && item.product && (
                    <div className="p-2 rounded-lg bg-card border border-emerald-500/20 flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.product.image ? (
                          <img
                            src={imgUrl(item.product.image)}
                            alt={item.product.name}
                            className="w-10 h-10 rounded-md object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-emerald-950/20 flex items-center justify-center text-sm shrink-0">
                            🌱
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{item.product.name}</p>
                          <p className="text-[11px] font-black text-emerald-500">
                            {formatINR(Number(item.product.price))}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/product/${item.product.slug}`}
                          onClick={() => setIsOpen(false)}
                          className="px-2 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground rounded-md border border-border hover:bg-muted"
                        >
                          View
                        </Link>
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md"
                          onClick={() => {
                            addToCart(item.product as any);
                            setIsOpen(false);
                          }}
                        >
                          + Cart
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="text-[9px] text-muted-foreground/60 text-right">
                    {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                </div>
              );
            })}

            {announcements.length === 0 && !showUnverifiedWarning && (
              <div className="p-6 text-center text-muted-foreground space-y-1">
                <Bell size={24} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs font-bold">No active notifications</p>
                <p className="text-[10px] text-muted-foreground/70">You are all caught up with recent updates.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
