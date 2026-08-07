import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck, Phone, MapPin, CheckCircle2, AlertTriangle, Power,
  Clock, PackageCheck, ShoppingBag, RefreshCw, Navigation, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/store";
import { Link, useLocation } from "wouter";

export default function DeliveryPartnerPortal() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"assigned" | "unassigned">("assigned");

  // Fetch Delivery Partner Profile & Availability Status
  const { data: partnerData, isLoading: loadingPartner, refetch: refetchPartner } = useQuery<{ partner: any }>({
    queryKey: ["/api/partner/me"],
    refetchInterval: 5000,
  });

  // Fetch Delivery Orders
  const { data: ordersData, isLoading: loadingOrders, refetch: refetchOrders } = useQuery<{
    assignedOrders: any[];
    availableUnassignedOrders: any[];
  }>({
    queryKey: ["/api/partner/orders"],
    refetchInterval: 5000,
  });

  const partner = partnerData?.partner;
  const assignedOrders = ordersData?.assignedOrders || [];
  const availableUnassignedOrders = ordersData?.availableUnassignedOrders || [];

  const isAvailable = partner?.availabilityStatus === "available";
  const isBlocked = partner?.isBlockedByAdmin;

  // Toggle Availability Mutation
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (status: "available" | "offline") => {
      const res = await apiRequest("POST", "/api/partner/availability", { status });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/me"] });
      toast({
        title: data.partner.availabilityStatus === "available" ? "🟢 Now Available" : "🔴 Now Offline",
        description: data.message,
      });
    },
    onError: (err: any) => {
      toast({ title: "Status Change Failed", description: err.message, variant: "destructive" });
    },
  });

  // Accept/Pick Unassigned Order Mutation
  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("POST", `/api/partner/orders/${orderId}/accept`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/me"] });
      toast({ title: "✨ Order Picked", description: data.message });
      setActiveTab("assigned");
    },
    onError: (err: any) => {
      toast({ title: "Failed to pick order", description: err.message, variant: "destructive" });
    },
  });

  // Update Order Delivery Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      const res = await apiRequest("POST", `/api/partner/orders/${orderId}/status`, { status });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/me"] });
      toast({ title: "✨ Status Updated", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Status Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    // Automatically set partner to offline when logging out
    if (isAvailable) {
      try {
        await apiRequest("POST", "/api/partner/availability", { status: "offline" });
      } catch {}
    }
    await logout();
    navigate("/login");
  };

  if (loadingPartner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-xs">
        Loading Delivery Partner Portal…
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-center space-y-4">
        <Truck className="w-12 h-12 text-destructive" />
        <h2 className="text-lg font-bold text-foreground">Delivery Partner Account Required</h2>
        <p className="text-xs text-muted-foreground max-w-sm">Your account does not have a registered delivery partner profile. Please contact the Primary Admin to configure your credentials.</p>
        <Button onClick={handleLogout} variant="outline" className="rounded-xl text-xs font-bold">Log Out</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Delivery Partner Header */}
      <header className="bg-card border-b border-border p-4 sticky top-0 z-40 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl">
              🚚
            </div>
            <div>
              <h1 className="text-base font-extrabold text-foreground flex items-center gap-1.5">
                {partner.name}
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">
                  {partner.vehicleType || "Bike"} • {partner.vehicleNumber}
                </span>
              </h1>
              <p className="text-[11px] text-muted-foreground">📱 {partner.phone} • {partner.partnerType?.replace("_", " ")}</p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={handleLogout} className="rounded-xl text-xs font-bold border border-border">
            Log out
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-5">
        {/* Availability Control Card */}
        <div className={`p-6 rounded-3xl border shadow-xl transition-all ${
          isBlocked
            ? "bg-red-500/10 border-red-500/30"
            : isAvailable
            ? "bg-gradient-to-r from-emerald-950/80 via-card to-card border-emerald-500/50 shadow-emerald-950/40"
            : "bg-gradient-to-r from-slate-900/80 via-card to-card border-slate-700"
        }`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className={`w-3 h-3 rounded-full animate-pulse ${isBlocked ? "bg-red-500" : isAvailable ? "bg-emerald-400" : "bg-slate-500"}`} />
                <h2 className="text-lg font-black text-foreground">
                  {isBlocked ? "Availability Blocked by Admin" : isAvailable ? "🟢 YOU ARE AVAILABLE FOR ORDERS" : "🔴 YOU ARE NOT AVAILABLE"}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isBlocked
                  ? "Superadmin has disabled availability mode for your account. Please contact Primary Admin."
                  : isAvailable
                  ? "System will automatically allocate incoming orders to you based on First-Come-First-Serve arrival."
                  : "Turn on availability when ready to start accepting customer deliveries."}
              </p>
            </div>

            {!isBlocked && (
              <Button
                onClick={() => toggleAvailabilityMutation.mutate(isAvailable ? "offline" : "available")}
                disabled={toggleAvailabilityMutation.isPending}
                className={`py-6 px-6 rounded-2xl font-black text-sm shadow-xl transition-all hover:scale-105 gap-2 ${
                  isAvailable
                    ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/30"
                    : "bg-red-600 text-white hover:bg-red-500 shadow-red-600/30"
                }`}
              >
                <Power size={18} />
                <span>{isAvailable ? "I AM AVAILABLE (ACTIVE)" : "CLICK TO BECOME AVAILABLE"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-card border border-border">
          <button
            onClick={() => setActiveTab("assigned")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
              activeTab === "assigned"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PackageCheck size={16} />
            <span>My Assigned Orders ({assignedOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("unassigned")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
              activeTab === "unassigned"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingBag size={16} />
            <span>Available for Pickup ({availableUnassignedOrders.length})</span>
          </button>
        </div>

        {/* Tab 1: My Assigned Orders */}
        {activeTab === "assigned" && (
          <div className="space-y-4">
            {assignedOrders.length === 0 ? (
              <div className="p-8 text-center bg-card border border-border rounded-3xl space-y-2">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No Active Deliveries Assigned</h3>
                <p className="text-xs text-muted-foreground">Keep "I am Available" turned ON to receive automatic orders, or check the "Available for Pickup" tab.</p>
              </div>
            ) : (
              assignedOrders.map((ord) => (
                <div key={ord.id} className="p-5 rounded-3xl bg-card border border-emerald-500/30 shadow-xl space-y-4">
                  {/* Order Header */}
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-400">Order #{ord.id}</span>
                      <h3 className="text-base font-extrabold text-foreground">{ord.customerName}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-400">₹{ord.total}</span>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{ord.paymentMethod} • {ord.paymentStatus}</p>
                    </div>
                  </div>

                  {/* Customer Contact & Address Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-secondary/30 border border-border">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Customer Phone</p>
                      <a
                        href={`tel:${ord.phone}`}
                        className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-extrabold text-xs border border-emerald-500/40 hover:bg-emerald-500/30"
                      >
                        <Phone size={13} /> Call Customer ({ord.phone})
                      </a>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                        <MapPin size={11} /> Delivery Address
                      </p>
                      <p className="text-xs font-bold text-foreground mt-1">{ord.address}</p>
                    </div>
                  </div>

                  {/* Items List */}
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Order Items ({ord.items?.length || 0})</p>
                    <div className="space-y-1">
                      {ord.items?.map((it: any) => (
                        <div key={it.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-background/50">
                          <span className="font-semibold">{it.name} ({it.unit})</span>
                          <span className="font-mono text-muted-foreground">x{it.qty} = ₹{it.lineTotal}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Status Controller */}
                  <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">Status:</span>
                      <span className="bg-primary/20 text-primary text-xs font-black px-3 py-1 rounded-full border border-primary/30 capitalize">
                        {ord.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {ord.status !== "Out for delivery" && ord.status !== "Delivered" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ orderId: ord.id, status: "Out for delivery" })}
                          disabled={updateStatusMutation.isPending}
                          className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs"
                        >
                          <Navigation size={13} className="mr-1" /> Mark Out for Delivery
                        </Button>
                      )}

                      {ord.status !== "Delivered" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ orderId: ord.id, status: "Delivered" })}
                          disabled={updateStatusMutation.isPending}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-900/30"
                        >
                          <CheckCircle2 size={13} className="mr-1" /> Mark Delivered & Collect ₹{ord.total}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Available Unassigned Orders */}
        {activeTab === "unassigned" && (
          <div className="space-y-4">
            {availableUnassignedOrders.length === 0 ? (
              <div className="p-8 text-center bg-card border border-border rounded-3xl space-y-2">
                <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No Unassigned Orders Available</h3>
                <p className="text-xs text-muted-foreground">All pending orders have been picked or auto-assigned.</p>
              </div>
            ) : (
              availableUnassignedOrders.map((ord) => (
                <div key={ord.id} className="p-5 rounded-3xl bg-card border border-border shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Order #{ord.id}</span>
                      <h3 className="text-base font-extrabold text-foreground">{ord.customerName}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin size={12} /> {ord.address}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-400">₹{ord.total}</span>
                      <Button
                        onClick={() => acceptOrderMutation.mutate(ord.id)}
                        disabled={acceptOrderMutation.isPending}
                        className="mt-2 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md"
                      >
                        Pick & Accept Order
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
