import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HeartPulse, ShieldAlert, Sparkles, Calendar, Truck, CheckCircle2,
  PauseCircle, PlayCircle, XCircle, MapPin, Phone, ArrowRight, Clock,
  Check, RefreshCw, AlertTriangle, Leaf, ChevronRight
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/store";
import { Link } from "wouter";

interface HealthPlan {
  id: string;
  title: string;
  teluguTitle: string;
  tagline: string;
  price: number;
  badge: string;
  icon: string;
  accentColor: string;
  contents: string[];
  benefits: string[];
}

export default function MySubscriptions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"plans" | "active">("plans");
  const [selectedPlan, setSelectedPlan] = useState<HealthPlan | null>(null);
  const [frequency, setFrequency] = useState<"weekly" | "bi-weekly" | "monthly">("bi-weekly");
  const [deliveryDay, setDeliveryDay] = useState<"Wednesday" | "Saturday">("Saturday");
  const [address, setAddress] = useState(user?.address || "");
  const [phone, setPhone] = useState(user?.phone || "");

  // Fetch Available Plans
  const { data: plansData, isLoading: loadingPlans } = useQuery<{
    plans: HealthPlan[];
    deliveryDays: string[];
    frequencies: string[];
  }>({
    queryKey: ["/api/subscriptions/plans"],
  });

  // Fetch User's Active Subscriptions
  const { data: userSubsData, isLoading: loadingSubs, refetch: refetchSubs } = useQuery<{
    subscriptions: any[];
  }>({
    queryKey: ["/api/subscriptions/mine"],
    enabled: Boolean(user),
  });

  // Subscribe Mutation
  const subscribeMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/subscriptions/subscribe", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "🌾 Subscription Activated!", description: data.message });
      setSelectedPlan(null);
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/mine"] });
      setActiveTab("active");
    },
    onError: (err: any) => {
      toast({ title: "Subscription Failed", description: err.message, variant: "destructive" });
    },
  });

  // Toggle Status Mutation (pause/resume/cancel)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/subscriptions/${id}/status`, { status });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Updated", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/mine"] });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const plans = plansData?.plans || [];
  const userSubs = userSubsData?.subscriptions || [];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/80 via-emerald-900/40 to-background border border-emerald-500/20 p-6 sm:p-10 shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <Leaf size={14} />
              <span>Subhiksha • శుభిక్షా కుటుంబ ఆరోగ్యం</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-serif font-black tracking-tight text-foreground">
              Direct-from-Farm Health Subscription Boxes
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Harvest-on-demand Andhra &amp; Telangana wellness boxes delivered during early morning dew (6:00 AM – 9:00 AM). Zero middlemen, zero chemical cold-storage.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-emerald-500/20">
            <button
              onClick={() => setActiveTab("plans")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === "plans"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30"
                  : "bg-background/40 hover:bg-background/70 text-muted-foreground"
              }`}
            >
              Browse Curated Wellness Boxes
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === "active"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30"
                  : "bg-background/40 hover:bg-background/70 text-muted-foreground"
              }`}
            >
              <span>My Subscriptions</span>
              {userSubs.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-emerald-400 text-emerald-950 font-mono text-[10px] flex items-center justify-center font-bold">
                  {userSubs.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: Available Plans */}
        {activeTab === "plans" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isSelected = selectedPlan?.id === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`rounded-3xl border transition-all duration-300 flex flex-col justify-between overflow-hidden bg-card ${
                    isSelected
                      ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-2xl"
                      : "border-border/80 hover:border-emerald-500/40 shadow-lg"
                  }`}
                >
                  <div className="p-6 space-y-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wide">
                          {plan.badge}
                        </span>
                        <h3 className="text-lg font-black text-foreground">{plan.title}</h3>
                        <p className="text-xs font-serif text-emerald-400/90 font-medium">{plan.teluguTitle}</p>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        {plan.id === "diabetic_care" && <HeartPulse size={20} />}
                        {plan.id === "immunity_defense" && <ShieldAlert size={20} />}
                        {plan.id === "andhra_pickles_sweets" && <Sparkles size={20} />}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-background/60 border border-border/60">
                      <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-foreground">₹{plan.price}</span>
                        <span className="text-xs text-muted-foreground">/ dispatch</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-foreground uppercase tracking-wider">Harvest Contents</p>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        {plan.contents.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-border/50">
                      <p className="text-[11px] font-bold text-emerald-400">Nutritional Rationale:</p>
                      <ul className="space-y-1 text-[11px] text-muted-foreground">
                        {plan.benefits.map((b, i) => (
                          <li key={i} className="leading-snug">• {b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="p-6 pt-0">
                    <Button
                      onClick={() => setSelectedPlan(plan)}
                      className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md"
                    >
                      Subscribe to This Box <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: User's Existing Subscriptions */}
        {activeTab === "active" && (
          <div className="space-y-4">
            {!user ? (
              <div className="p-8 rounded-3xl bg-card border border-border text-center space-y-4">
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
                <h3 className="text-base font-bold text-foreground">Sign In to View Your Subscriptions</h3>
                <p className="text-xs text-muted-foreground">
                  Your Subhiksha recurring subscriptions and early morning delivery schedules will appear here.
                </p>
                <Link href="/login">
                  <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold">
                    Go to Login
                  </Button>
                </Link>
              </div>
            ) : userSubs.length === 0 ? (
              <div className="p-12 rounded-3xl bg-card border border-border text-center space-y-4">
                <Leaf className="w-12 h-12 text-emerald-500/40 mx-auto" />
                <h3 className="text-base font-bold text-foreground">No Active Subscriptions Yet</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Enjoy hassle-free weekly morning dew deliveries of low GI diabetic produce, monsoon immunity boosters, or authentic Andhra artisanal sweets and pickles.
                </p>
                <Button
                  onClick={() => setActiveTab("plans")}
                  className="rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg"
                >
                  Explore Subhiksha Boxes
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userSubs.map((sub) => {
                  const plan = plans.find((p) => p.id === sub.planType);
                  return (
                    <div key={sub.id} className="p-6 rounded-3xl bg-card border border-border shadow-xl space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge
                            className={`rounded-full text-[10px] font-black uppercase ${
                              sub.status === "active"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : sub.status === "paused"
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-red-500/20 text-red-400 border-red-500/30"
                            }`}
                          >
                            {sub.status}
                          </Badge>
                          <h3 className="text-base font-extrabold text-foreground mt-2">
                            {plan?.title || sub.planType}
                          </h3>
                          <p className="text-xs text-muted-foreground capitalize">
                            {sub.frequency} • {sub.deliveryDay} Morning Dew Slot
                          </p>
                        </div>
                        <span className="text-lg font-black text-foreground">₹{sub.price}</span>
                      </div>

                      <div className="p-3 rounded-2xl bg-background/50 border border-border/60 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar size={13} className="text-emerald-400" />
                          <span>Next Dispatch: {sub.nextDeliveryDate ? new Date(sub.nextDeliveryDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "Scheduled"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin size={13} className="text-blue-400" />
                          <span className="truncate">{sub.address}</span>
                        </div>
                      </div>

                      {/* Action controls */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        {sub.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleStatusMutation.mutate({ id: sub.id, status: "paused" })}
                            disabled={toggleStatusMutation.isPending}
                            className="rounded-xl text-xs font-bold flex-1"
                          >
                            <PauseCircle size={13} className="mr-1 text-amber-400" /> Pause
                          </Button>
                        )}
                        {sub.status === "paused" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleStatusMutation.mutate({ id: sub.id, status: "active" })}
                            disabled={toggleStatusMutation.isPending}
                            className="rounded-xl text-xs font-bold flex-1 bg-emerald-600/10 border-emerald-500/30 text-emerald-400"
                          >
                            <PlayCircle size={13} className="mr-1" /> Resume
                          </Button>
                        )}
                        {sub.status !== "cancelled" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Are you sure you want to cancel this recurring wellness box?")) {
                                toggleStatusMutation.mutate({ id: sub.id, status: "cancelled" });
                              }
                            }}
                            disabled={toggleStatusMutation.isPending}
                            className="rounded-xl text-xs text-muted-foreground hover:text-destructive"
                          >
                            <XCircle size={13} className="mr-1" /> Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Subscribe Confirmation Modal */}
        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-card border border-border/80 shadow-2xl rounded-3xl p-6 relative overflow-hidden space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-400">Configure Subscription</span>
                  <h3 className="text-lg font-black text-foreground">{selectedPlan.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="text-muted-foreground hover:text-foreground text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Frequency Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Delivery Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["weekly", "bi-weekly", "monthly"] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setFrequency(freq)}
                      className={`p-2.5 rounded-xl border text-xs font-bold capitalize transition-all ${
                        frequency === freq
                          ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                          : "bg-background border-border text-muted-foreground"
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery Day Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Morning Dew Harvest Slot</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Wednesday", "Saturday"] as const).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setDeliveryDay(day)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                        deliveryDay === day
                          ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                          : "bg-background border-border text-muted-foreground"
                      }`}
                    >
                      <span className="block font-black">{day}s</span>
                      <span className="text-[10px] opacity-80">6:00 AM – 9:00 AM</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Address and Phone */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Delivery Address</label>
                  <Textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter flat/door no, street, colony, city (AP/Telangana)"
                    className="rounded-xl text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Contact Phone</label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="rounded-xl text-xs bg-background"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between">
                <div>
                  <p className="font-black text-emerald-400">Total: ₹{selectedPlan.price} / box</p>
                  <p className="text-[11px] text-muted-foreground">Pay per delivery via UPI / COD on arrival</p>
                </div>
                <Badge className="bg-emerald-600 text-white font-mono text-xs">Zero Middlemen</Badge>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedPlan(null)}
                  className="flex-1 rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!user) {
                      toast({ title: "Login Required", description: "Please sign in to subscribe.", variant: "destructive" });
                      return;
                    }
                    if (!address || !phone) {
                      toast({ title: "Incomplete Details", description: "Please provide your delivery address and phone number.", variant: "destructive" });
                      return;
                    }
                    subscribeMutation.mutate({
                      planType: selectedPlan.id,
                      frequency,
                      deliveryDay,
                      address,
                      phone,
                    });
                  }}
                  disabled={subscribeMutation.isPending}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-900/30"
                >
                  {subscribeMutation.isPending ? "Setting up..." : "Confirm & Subscribe"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
