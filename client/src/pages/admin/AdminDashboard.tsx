import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ShoppingBag, IndianRupee, Receipt, Repeat, AlertTriangle, CalendarClock,
  Wrench, ShieldAlert, CreditCard, Banknote, Truck, Mail, Globe,
  Smartphone, BellRing, Send, CheckCircle2, AlertOctagon, SlidersHorizontal,
  RefreshCw, Sparkles, Clock, Lock, Unlock
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import { AdminLayout } from "./AdminLayout";
import { apiGet, apiRequest } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Product } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface SalesSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  activeSubscriptions: number;
  upcomingDeliveries: { date: string; day: string }[];
  lowStockCount: number;
}

interface OperationsStatus {
  maintenance: {
    active: boolean;
    headline: string;
    message: string;
    estimatedEnd?: string | null;
    estimatedMinutes?: number | null;
    allowAdminBypass: boolean;
  };
  lockdown: {
    active: boolean;
    reason: string;
  };
  storeOrderingEnabled: boolean;
  codEnabled: boolean;
  onlinePaymentsEnabled: boolean;
  freeDeliveryBanner: boolean;
  emailAuthEnabled: boolean;
  googleAuthEnabled: boolean;
  phoneOtpEnforced: boolean;
  telegramAlertsEnabled: boolean;
}

function KpiCard({ icon: Icon, label, value, testid }: { icon: any; label: string; value: string | number; testid: string }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-4 flex items-center gap-3 shadow-sm hover:border-primary/40 transition-colors" data-testid={testid}>
      <span className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 text-primary shrink-0">
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xl font-extrabold truncate">{value}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog States
  const [maintDialogOpen, setMaintDialogOpen] = useState(false);
  const [maintMinutes, setMaintMinutes] = useState(30);
  const [maintHeadline, setMaintHeadline] = useState("Scheduled Maintenance Underway");
  const [maintMessage, setMaintMessage] = useState("We are currently optimizing our farm-fresh catalog and ultrafast delivery infrastructure. We will be back shortly!");
  const [maintAdminBypass, setMaintAdminBypass] = useState(true);

  const [lockdownDialogOpen, setLockdownDialogOpen] = useState(false);
  const [lockdownReason, setLockdownReason] = useState("Manual Executive Emergency Lockdown");

  // Queries
  const { data: summary, isLoading } = useQuery<SalesSummary>({
    queryKey: ["/api/admin/sales-summary"],
    queryFn: () => apiGet<SalesSummary>("/api/admin/sales-summary"),
  });

  const { data: lowStock = [], isLoading: lowLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/inventory/low-stock"],
    queryFn: () => apiGet<Product[]>("/api/admin/inventory/low-stock"),
  });

  const { data: opsStatus, isLoading: opsLoading, refetch: refetchOps } = useQuery<OperationsStatus>({
    queryKey: ["/api/admin/operations/status"],
    queryFn: () => apiGet<OperationsStatus>("/api/admin/operations/status"),
  });

  // Mutation for toggling operations with instant optimistic UI response
  const toggleMutation = useMutation({
    mutationFn: async ({ key, value, extra }: { key: string; value: any; extra?: any }) => {
      const res = await apiRequest("POST", "/api/admin/operations/toggle", { key, value, extra });
      return res.json();
    },
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/operations/status"] });
      const prevData = queryClient.getQueryData<OperationsStatus>(["/api/admin/operations/status"]);
      if (prevData) {
        queryClient.setQueryData<OperationsStatus>(["/api/admin/operations/status"], {
          ...prevData,
          maintenance: key === "maintenance" ? { ...prevData.maintenance, active: Boolean(value) } : prevData.maintenance,
          lockdown: key === "lockdown" ? { ...prevData.lockdown, active: Boolean(value) } : prevData.lockdown,
          storeOrderingEnabled: key === "store_ordering_enabled" ? Boolean(value) : prevData.storeOrderingEnabled,
          codEnabled: key === "cod_enabled" || key === "allow_cod" ? Boolean(value) : prevData.codEnabled,
          onlinePaymentsEnabled: key === "online_payments_enabled" ? Boolean(value) : prevData.onlinePaymentsEnabled,
          freeDeliveryBanner: key === "promo_free_delivery_banner" ? Boolean(value) : prevData.freeDeliveryBanner,
          emailAuthEnabled: key === "auth_email_enabled" ? Boolean(value) : prevData.emailAuthEnabled,
          googleAuthEnabled: key === "auth_google_enabled" ? Boolean(value) : prevData.googleAuthEnabled,
          phoneOtpEnforced: key === "auth_phone_enforced" ? Boolean(value) : prevData.phoneOtpEnforced,
          telegramAlertsEnabled: key === "telegram_alerts_enabled" ? Boolean(value) : prevData.telegramAlertsEnabled,
        });
      }
      return { prevData };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operations/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/public"] });
      toast({
        title: "⚡ Switch Updated Instantly",
        description: `Successfully toggled "${data.key}"!`,
      });
    },
    onError: (err: any, _vars, context: any) => {
      if (context?.prevData) {
        queryClient.setQueryData(["/api/admin/operations/status"], context.prevData);
      }
      toast({
        title: "Action Failed",
        description: err.message || "Failed to update operation control switch.",
        variant: "destructive",
      });
    },
  });

  // Mutation for sending test alert to Telegram
  const testTelegramMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/operations/test-telegram", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🔔 Telegram Test Alert Sent!",
        description: data.message || "Test ping successfully sent to your Telegram Security Bot.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Telegram Alert Failed",
        description: err.message || "Failed to dispatch Telegram message. Check bot credentials in Settings.",
        variant: "destructive",
      });
    },
  });

  const handleMaintenanceToggle = (active: boolean) => {
    if (active) {
      // Open configuration modal before enabling
      setMaintDialogOpen(true);
    } else {
      toggleMutation.mutate({ key: "maintenance", value: false });
    }
  };

  const handleSaveAndActivateMaintenance = () => {
    toggleMutation.mutate({
      key: "maintenance",
      value: true,
      extra: {
        headline: maintHeadline,
        message: maintMessage,
        estimatedMinutes: maintMinutes,
        allowAdminBypass: maintAdminBypass,
      },
    });
    setMaintDialogOpen(false);
  };

  const handleLockdownToggle = (active: boolean) => {
    if (active) {
      setLockdownDialogOpen(true);
    } else {
      toggleMutation.mutate({ key: "lockdown", value: false });
    }
  };

  const handleConfirmLockdown = () => {
    toggleMutation.mutate({
      key: "lockdown",
      value: true,
      extra: { reason: lockdownReason },
    });
    setLockdownDialogOpen(false);
  };

  const chartData = (summary?.ordersByStatus && typeof summary.ordersByStatus === "object")
    ? Object.entries(summary.ordersByStatus).map(([status, count]) => ({ status, count }))
    : [];

  const upcoming = Array.isArray(summary?.upcomingDeliveries) ? summary.upcomingDeliveries : [];

  return (
    <AdminLayout title="Operations & Control Dashboard">
      {/* ======================================================== */}
      {/* ⚡ MASTER OPERATIONS & CONTROLS HUB                       */}
      {/* ======================================================== */}
      <div className="rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-card via-card/90 to-emerald-950/10 p-5 sm:p-6 mb-6 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                ⚡ Master Store Controls &amp; Emergency Hub
              </h2>
              <p className="text-xs text-muted-foreground">
                Instant executive controls for maintenance mode, security killswitches, payment gateways, and live bots.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchOps()}
              className="rounded-xl text-xs font-bold gap-1.5 h-9"
              disabled={opsLoading}
            >
              <RefreshCw size={13} className={opsLoading ? "animate-spin" : ""} /> Refresh Controls
            </Button>
          </div>
        </div>

        {/* Top 2 Primary Switches: Maintenance & Emergency Lockdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 🛠️ Maintenance Mode Banner Card */}
          <div className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 ${
            opsStatus?.maintenance?.active
              ? "bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10"
              : "bg-card border-card-border/80"
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 ${
                  opsStatus?.maintenance?.active ? "bg-amber-500 shadow-md" : "bg-muted text-muted-foreground"
                }`}>
                  <Wrench size={22} className={opsStatus?.maintenance?.active ? "animate-spin" : ""} style={opsStatus?.maintenance?.active ? { animationDuration: "8s" } : undefined} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-foreground">Under Maintenance Mode</h3>
                    {opsStatus?.maintenance?.active ? (
                      <Badge className="bg-amber-500 text-black font-extrabold text-[10px] px-2 py-0.5">
                        🟡 ACTIVE
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/40 text-[10px] font-bold">
                        🟢 STORE ONLINE
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {opsStatus?.maintenance?.active
                      ? `Customers see polite maintenance screen. (${opsStatus.maintenance.estimatedMinutes || 30}m estimate)`
                      : "Storefront is fully accessible to public customers."}
                  </p>
                </div>
              </div>
              <Switch
                checked={Boolean(opsStatus?.maintenance?.active)}
                onCheckedChange={handleMaintenanceToggle}
                disabled={toggleMutation.isPending}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <Clock size={12} /> Telegram: <code className="text-foreground font-mono">/maintenance on</code>
              </span>
              <button
                type="button"
                onClick={() => setMaintDialogOpen(true)}
                className="text-primary hover:underline font-bold text-xs cursor-pointer flex items-center gap-1"
              >
                <Sparkles size={12} /> Configure Notice &amp; ETA ➔
              </button>
            </div>
          </div>

          {/* 🚨 Emergency Lockdown Killswitch Banner Card */}
          <div className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 ${
            opsStatus?.lockdown?.active
              ? "bg-red-500/10 border-red-500/60 shadow-md shadow-red-500/10"
              : "bg-card border-card-border/80"
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 ${
                  opsStatus?.lockdown?.active ? "bg-red-600 shadow-md" : "bg-muted text-muted-foreground"
                }`}>
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-foreground">Emergency Platform Lockdown</h3>
                    {opsStatus?.lockdown?.active ? (
                      <Badge className="bg-red-600 text-white font-extrabold text-[10px] px-2 py-0.5 animate-pulse">
                        🔴 LOCKED DOWN
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/40 text-[10px] font-bold">
                        🟢 NORMAL
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {opsStatus?.lockdown?.active
                      ? `Siren mode active: ${opsStatus.lockdown.reason || "Platform locked"}`
                      : "Global killswitch for active cyberattack / threat defense."}
                  </p>
                </div>
              </div>
              <Switch
                checked={Boolean(opsStatus?.lockdown?.active)}
                onCheckedChange={handleLockdownToggle}
                disabled={toggleMutation.isPending}
                className="data-[state=checked]:bg-red-600"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <Lock size={12} /> Telegram: <code className="text-foreground font-mono">/lock on</code>
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {opsStatus?.lockdown?.active ? "Police strobe siren active" : "Standby mode"}
              </span>
            </div>
          </div>
        </div>

        {/* Operations Quick Switches Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
          {/* 🛍️ Store Orders */}
          <div className="p-3 rounded-xl border border-card-border bg-card/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate flex items-center gap-1.5 text-foreground">
                <ShoppingBag size={14} className="text-emerald-500" /> New Orders
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {opsStatus?.storeOrderingEnabled ? "Accepting Checkouts" : "Paused"}
              </p>
            </div>
            <Switch
              checked={Boolean(opsStatus?.storeOrderingEnabled)}
              onCheckedChange={(v) => toggleMutation.mutate({ key: "store_ordering_enabled", value: v })}
              disabled={toggleMutation.isPending}
            />
          </div>

          {/* 💵 Cash on Delivery (COD) */}
          <div className="p-3 rounded-xl border border-card-border bg-card/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate flex items-center gap-1.5 text-foreground">
                <Banknote size={14} className="text-amber-500" /> Cash on Delivery
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {opsStatus?.codEnabled ? "Enabled on Cart" : "Disabled"}
              </p>
            </div>
            <Switch
              checked={Boolean(opsStatus?.codEnabled)}
              onCheckedChange={(v) => {
                toggleMutation.mutate({ key: "cod_enabled", value: v });
                toggleMutation.mutate({ key: "allow_cod", value: v });
              }}
              disabled={toggleMutation.isPending}
            />
          </div>

          {/* 💳 Online Payments (UPI / Cards) */}
          <div className="p-3 rounded-xl border border-card-border bg-card/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate flex items-center gap-1.5 text-foreground">
                <CreditCard size={14} className="text-sky-500" /> Online Payments
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {opsStatus?.onlinePaymentsEnabled ? "UPI / Gateway Active" : "Paused"}
              </p>
            </div>
            <Switch
              checked={Boolean(opsStatus?.onlinePaymentsEnabled)}
              onCheckedChange={(v) => toggleMutation.mutate({ key: "online_payments_enabled", value: v })}
              disabled={toggleMutation.isPending}
            />
          </div>

          {/* 🚚 Free Delivery Promo Banner */}
          <div className="p-3 rounded-xl border border-card-border bg-card/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate flex items-center gap-1.5 text-foreground">
                <Truck size={14} className="text-teal-500" /> Free Delivery Banner
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {opsStatus?.freeDeliveryBanner ? "Visible to Visitors" : "Hidden"}
              </p>
            </div>
            <Switch
              checked={Boolean(opsStatus?.freeDeliveryBanner)}
              onCheckedChange={(v) => toggleMutation.mutate({ key: "promo_free_delivery_banner", value: v })}
              disabled={toggleMutation.isPending}
            />
          </div>

          {/* ✉️ Email Password Auth */}
          <div className="p-3 rounded-xl border border-card-border bg-card/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate flex items-center gap-1.5 text-foreground">
                <Mail size={14} className="text-red-500" /> Email Login/Signup
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {opsStatus?.emailAuthEnabled ? "Active" : "Disabled"}
              </p>
            </div>
            <Switch
              checked={Boolean(opsStatus?.emailAuthEnabled)}
              onCheckedChange={(v) => toggleMutation.mutate({ key: "auth_email_enabled", value: v })}
              disabled={toggleMutation.isPending}
            />
          </div>

          {/* 🌐 Google 1-Tap Login */}
          <div className="p-3 rounded-xl border border-card-border bg-card/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate flex items-center gap-1.5 text-foreground">
                <Globe size={14} className="text-blue-500" /> Google Sign-In
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {opsStatus?.googleAuthEnabled ? "Active" : "Disabled"}
              </p>
            </div>
            <Switch
              checked={Boolean(opsStatus?.googleAuthEnabled)}
              onCheckedChange={(v) => toggleMutation.mutate({ key: "auth_google_enabled", value: v })}
              disabled={toggleMutation.isPending}
            />
          </div>

          {/* 📱 Mobile Phone SMS OTP */}
          <div className="p-3 rounded-xl border border-card-border bg-card/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate flex items-center gap-1.5 text-foreground">
                <Smartphone size={14} className="text-emerald-500" /> Mobile OTP Gate
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {opsStatus?.phoneOtpEnforced ? "Mandatory for Orders" : "Optional"}
              </p>
            </div>
            <Switch
              checked={Boolean(opsStatus?.phoneOtpEnforced)}
              onCheckedChange={(v) => toggleMutation.mutate({ key: "auth_phone_enforced", value: v })}
              disabled={toggleMutation.isPending}
            />
          </div>

          {/* 🔔 Telegram Alert System & Test Ping */}
          <div className="p-3 rounded-xl border border-card-border bg-card/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate flex items-center gap-1.5 text-foreground">
                <BellRing size={14} className="text-indigo-500" /> Telegram Alerts
              </p>
              <button
                type="button"
                onClick={() => testTelegramMutation.mutate()}
                disabled={testTelegramMutation.isPending}
                className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Send size={10} /> Test Ping Bot
              </button>
            </div>
            <Switch
              checked={Boolean(opsStatus?.telegramAlertsEnabled)}
              onCheckedChange={(v) => toggleMutation.mutate({ key: "telegram_alerts_enabled", value: v })}
              disabled={toggleMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 📊 KPI SUMMARY CARDS                                     */}
      {/* ======================================================== */}
      {isLoading || !summary || typeof summary.totalOrders !== "number" ? (
        <Skeleton className="h-28 rounded-2xl mb-6" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <KpiCard icon={ShoppingBag} label="Total orders" value={summary.totalOrders} testid="kpi-total-orders" />
          <KpiCard icon={IndianRupee} label="Total revenue" value={formatINR(summary.totalRevenue)} testid="kpi-total-revenue" />
          <KpiCard icon={Receipt} label="Avg order value" value={formatINR(summary.averageOrderValue)} testid="kpi-avg-order" />
          <KpiCard icon={Repeat} label="Active subscriptions" value={summary.activeSubscriptions} testid="kpi-active-subs" />
          <KpiCard icon={AlertTriangle} label="Low stock items" value={summary.lowStockCount} testid="kpi-low-stock" />
        </div>
      )}

      {/* Charts & Deliveries */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Upcoming Sat/Sun deliveries */}
        <div className="rounded-2xl border border-card-border bg-card p-5 lg:col-span-1 shadow-sm" data-testid="card-upcoming-deliveries">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock size={18} className="text-accent" />
            <h2 className="font-bold text-sm">Upcoming Sat/Sun deliveries</h2>
          </div>
          {isLoading || !summary ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming deliveries scheduled.</p>
          ) : (
            <ul className="space-y-2" data-testid="list-upcoming-deliveries">
              {upcoming.map((d, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                  <span className="font-bold">{d.day}</span>
                  <span className="text-muted-foreground text-xs">{new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Orders by status chart */}
        <div className="rounded-2xl border border-card-border bg-card p-5 lg:col-span-2 shadow-sm" data-testid="card-orders-by-status">
          <h2 className="font-bold text-sm mb-3">Orders by status</h2>
          {isLoading || !summary ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--card-border))" />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--card-border))", borderRadius: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Low stock mini table */}
      <div className="rounded-2xl border border-card-border bg-card p-5 mt-4 shadow-sm" data-testid="card-low-stock">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm">Low-stock products</h2>
          <Link href="/admin/inventory" className="text-xs text-primary font-bold hover:underline" data-testid="link-view-inventory">
            View full inventory ➔
          </Link>
        </div>
        {lowLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : lowStock.length === 0 ? (
          <p className="text-sm text-muted-foreground">All products are well stocked.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs">
              <tr><th className="py-1 font-bold">Product</th><th className="py-1 font-bold">Stock</th></tr>
            </thead>
            <tbody>
              {lowStock.slice(0, 8).map((p) => (
                <tr key={p.id} className="border-t border-card-border" data-testid={`row-lowstock-${p.id}`}>
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="py-2 text-destructive font-black">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ======================================================== */}
      {/* 🛠️ CONFIGURE MAINTENANCE MODE MODAL                      */}
      {/* ======================================================== */}
      <Dialog open={maintDialogOpen} onOpenChange={setMaintDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-card border border-amber-500/30 shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 flex items-center justify-center text-black font-black shadow-md">
                <Wrench size={20} />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-foreground">
                  Configure Under Maintenance Mode
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Customers visiting your store will see this polite notice and estimated return countdown.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Quick Duration Buttons */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Estimated Duration</Label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 60, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setMaintMinutes(mins)}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      maintMinutes === mins
                        ? "bg-amber-500 text-black shadow-md"
                        : "bg-secondary/70 text-foreground hover:bg-secondary border border-border"
                    }`}
                  >
                    {mins < 60 ? `${mins} Mins` : `${mins / 60} Hour${mins / 60 > 1 ? "s" : ""}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Minutes Input */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Custom Minutes</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={maintMinutes}
                onChange={(e) => setMaintMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                className="rounded-xl font-mono text-sm"
              />
            </div>

            {/* Headline Input */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Notice Headline</Label>
              <Input
                value={maintHeadline}
                onChange={(e) => setMaintHeadline(e.target.value)}
                placeholder="Scheduled Maintenance Underway"
                className="rounded-xl text-sm"
              />
            </div>

            {/* Message Textarea */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Customer Explanation Message</Label>
              <textarea
                value={maintMessage}
                onChange={(e) => setMaintMessage(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-input bg-background p-3 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                placeholder="Message to display on maintenance page..."
              />
            </div>

            {/* Admin Bypass Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
              <div>
                <p className="text-xs font-bold text-foreground">Allow Executive Staff &amp; Admin Bypass</p>
                <p className="text-[10px] text-muted-foreground">Enables admins to log into Admin Portal during maintenance.</p>
              </div>
              <Switch
                checked={maintAdminBypass}
                onCheckedChange={setMaintAdminBypass}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setMaintDialogOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAndActivateMaintenance}
              disabled={toggleMutation.isPending}
              className="rounded-xl text-xs font-extrabold bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black shadow-lg cursor-pointer"
            >
              {toggleMutation.isPending ? "Activating..." : "Save & Activate Maintenance Mode ➔"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* 🚨 CONFIRM EMERGENCY LOCKDOWN MODAL                      */}
      {/* ======================================================== */}
      <Dialog open={lockdownDialogOpen} onOpenChange={setLockdownDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-card border-2 border-red-500 shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md">
                <AlertOctagon size={20} />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-red-500">
                  Activate Emergency Killswitch?
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  This will immediately freeze all non-superadmin traffic, start police strobe sirens, and log forensic audit records.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Reason for Emergency Lockdown</Label>
              <Input
                value={lockdownReason}
                onChange={(e) => setLockdownReason(e.target.value)}
                placeholder="Reason (e.g. Unauthorised traffic detected)"
                className="rounded-xl text-sm"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setLockdownDialogOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmLockdown}
              disabled={toggleMutation.isPending}
              className="rounded-xl text-xs font-extrabold bg-red-600 hover:bg-red-500 text-white shadow-lg cursor-pointer"
            >
              {toggleMutation.isPending ? "Locking down..." : "Confirm & Trigger Lockdown 🚨"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
