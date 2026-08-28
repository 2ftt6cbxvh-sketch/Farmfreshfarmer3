import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Bell, AlertTriangle, ShieldAlert, Sparkles, X, CheckCircle2,
  ExternalLink, ShoppingBag, ArrowRight, ShieldCheck, Package
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

  // readIds = notifications marked as read (count clears on open)
  const [readIds, setReadIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem("read_notification_ids");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // dismissedIds = notifications permanently hidden with ✕ (persisted in localStorage)
  const [dismissedIds, setDismissedIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem("dismissed_notification_ids");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: allAnnouncements = [] } = useQuery<AnnouncementItem[]>({
    queryKey: ["/api/announcements/active"],
    queryFn: () => apiGet<AnnouncementItem[]>("/api/announcements/active"),
    refetchInterval: 10000,
    staleTime: 0,
  });

  // Visible = not individually dismissed
  const announcements = allAnnouncements.filter((a) => !dismissedIds.includes(a.id));

  const { data: requireVerificationSetting } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/require_superadmin_verification_to_order"],
    queryFn: () => apiGet<{ value: string }>("/api/settings/require_superadmin_verification_to_order").catch(() => ({ value: "false" })),
  });

  const isVerificationMandatory = requireVerificationSetting?.value === "true";
  const showUnverifiedWarning = Boolean(user && !user.isVerified && isVerificationMandatory && user.role === "customer");

  const unreadCount = announcements.filter((a) => !readIds.includes(a.id)).length + (showUnverifiedWarning ? 1 : 0);
  const totalCount = announcements.length + (showUnverifiedWarning ? 1 : 0);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markAllAsRead = () => {
    const allIds = announcements.map((a) => a.id);
    setReadIds(allIds);
    try { localStorage.setItem("read_notification_ids", JSON.stringify(allIds)); } catch {}
  };

  const dismissOne = (id: number) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try { localStorage.setItem("dismissed_notification_ids", JSON.stringify(next)); } catch {}
    // Also mark as read
    const nextRead = [...readIds, id];
    setReadIds(nextRead);
    try { localStorage.setItem("read_notification_ids", JSON.stringify(nextRead)); } catch {}
  };

  const clearAll = () => {
    const allIds = allAnnouncements.map((a) => a.id);
    setDismissedIds(allIds);
    setReadIds(allIds);
    try {
      localStorage.setItem("dismissed_notification_ids", JSON.stringify(allIds));
      localStorage.setItem("read_notification_ids", JSON.stringify(allIds));
    } catch {}
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) markAllAsRead();
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

        {/* Counter Badge — shows unread count, collapses to dot when all read but still have notifications */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white shadow-[0_0_8px_rgba(220,38,38,0.7)] animate-pulse">
            {unreadCount}
          </span>
        )}
        {unreadCount === 0 && totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-slate-400" />
        )}
      </button>

      {/* 📋 Notification Drop Box Modal */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-[#0f172a] dark:bg-[#090d16] text-slate-100 border-2 border-slate-700 shadow-[0_25px_60px_rgba(0,0,0,0.95)] z-[99999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 bg-[#1e293b] dark:bg-[#0f172a] border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-emerald-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-white">Notifications & Alerts</h3>
              {totalCount > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">
                  {totalCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {totalCount > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] text-slate-400 hover:text-red-400 font-bold transition-colors px-1.5 py-0.5 rounded hover:bg-red-950/40"
                  title="Clear all notifications"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="w-5 h-5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
          </div>

          {/* List of Notifications */}
          <div className="max-h-96 overflow-y-auto p-3 space-y-2.5 bg-[#0f172a] dark:bg-[#090d16]">
            {/* Account Verification Warning Banner if user is unverified and verification is required */}
            {showUnverifiedWarning && (
              <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 space-y-1.5 animate-pulse">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-black">
                  <AlertTriangle size={15} />
                  <span>Account Pending Verification</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Your account is pending Super Admin review. Order placement will be unlocked once your profile is verified with the Blue Badge.
                </p>
                <Link
                  href="/account"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:underline pt-0.5"
                >
                  <span>View Account Status</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {/* Verified Genuine Account Badge Card if user is verified */}
            {user && user.isVerified && (
              <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <div>
                    <p className="text-xs font-bold text-blue-400">Verified Genuine Account</p>
                    <p className="text-[10px] text-slate-400">You have verified status & unrestricted ordering.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Announcements & Ads */}
            {announcements.map((item) => {
              const isWarning = item.category === "warning";
              const isCritical = item.category === "critical";
              const isAd = item.category === "advertisement";
              const isUnread = !readIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all space-y-2 relative ${
                    isCritical
                      ? "bg-red-950/70 border-red-500/50"
                      : isWarning
                      ? "bg-amber-950/70 border-amber-500/50"
                      : "bg-slate-800/80 border-slate-700 hover:border-slate-600"
                  } ${isUnread ? "ring-1 ring-emerald-500/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isCritical && <ShieldAlert size={14} className="text-red-400 shrink-0" />}
                      {isWarning && <AlertTriangle size={14} className="text-amber-400 shrink-0" />}
                      {isAd && <Sparkles size={14} className="text-emerald-400 shrink-0" />}
                      <span className="text-xs font-black text-white truncate">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" title="New notice" />
                      )}
                      {/* Individual ✕ Dismiss button */}
                      <button
                        onClick={() => dismissOne(item.id)}
                        title="Dismiss this notification"
                        className="w-5 h-5 rounded-full bg-slate-700/60 hover:bg-red-900/60 text-slate-400 hover:text-red-300 flex items-center justify-center transition-all"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{item.message}</p>

                  {/* Attached Product Card if advertisement is linked to a product */}
                  {item.product && (
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.product.image ? (
                          <img
                            src={imgUrl(item.product.image)}
                            alt={item.product.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                            <Package size={16} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-white">{item.product.name}</p>
                          <p className="text-[11px] font-black text-emerald-400">
                            {formatINR(Number(item.product.price))}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/products/${item.product.slug}`}
                          onClick={() => setIsOpen(false)}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
                        >
                          View
                        </Link>
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
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

                  <div className="text-[9px] text-slate-500 text-right">
                    {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                </div>
              );
            })}

            {totalCount === 0 && !showUnverifiedWarning && (
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
