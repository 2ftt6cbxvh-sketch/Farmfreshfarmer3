import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { apiGet, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, RefreshCw, PlusCircle, AlertTriangle, TrendingUp,
  Search, HeartPulse, MapPin, CheckCircle2, ShieldCheck,
  Package, Boxes, ArrowRight, Zap, ShoppingBag, Leaf, ExternalLink
} from "lucide-react";
import { formatINR } from "@/lib/types";

interface UnmetDemandItem {
  keyword: string;
  searchCount: number;
  categorySuggestion: string;
  lostRevenuePotential: string;
  sourcingAction: string;
}

interface RecommendedNewProduct {
  name: string;
  nameTe: string;
  categorySlug: string;
  suggestedPrice: number;
  suggestedUnit: string;
  description: string;
  sourcingReason: string;
  clinicalHealthBenefits: string;
  urgency: "high" | "medium" | "low";
  targetSeason: string;
  suggestedImage: string;
}

interface RestockAlertItem {
  productId?: number;
  productName: string;
  categorySlug: string;
  currentStock: number;
  demandVelocity: string;
  recommendedRestockQty: number;
  rationale: string;
}

interface SeasonalGuidanceItem {
  crop: string;
  growingRegion: string;
  peakProcurementWindow: string;
  healthDefenseProfile: string;
}

interface ProcurementAiResult {
  generatedAt: string;
  modelUsed: string;
  executiveSummary: string;
  unmetDemands: UnmetDemandItem[];
  recommendedNewProducts: RecommendedNewProduct[];
  restockAlerts: RestockAlertItem[];
  seasonalHarvestGuidance: SeasonalGuidanceItem[];
}

export default function AdminProcurementAI() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addedProductNames, setAddedProductNames] = useState<Set<string>>(new Set());

  // Fetch AI Procurement recommendations
  const { data, isLoading, isFetching, refetch } = useQuery<ProcurementAiResult>({
    queryKey: ["/api/admin/procurement-ai/recommendations"],
    queryFn: () => apiGet<ProcurementAiResult>("/api/admin/procurement-ai/recommendations"),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Mutation to force re-analyze
  const reanalyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiGet<ProcurementAiResult>("/api/admin/procurement-ai/recommendations?force=true");
      return res;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(["/api/admin/procurement-ai/recommendations"], newData);
      toast({
        title: "🧠 Demand Intelligence Refreshed",
        description: `Analyzed with Google ${newData.modelUsed || "Gemini"} based on live consumer signals.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "AI Analysis Failed",
        description: err?.message || "Could not reach Gemini AI. Check API key.",
        variant: "destructive",
      });
    },
  });

  // 1-Click Add Product Mutation
  const addProductMutation = useMutation({
    mutationFn: async (prod: RecommendedNewProduct) => {
      const res = await apiRequest("POST", "/api/admin/procurement-ai/add-product", {
        name: prod.name,
        nameTe: prod.nameTe,
        categorySlug: prod.categorySlug,
        price: prod.suggestedPrice,
        unit: prod.suggestedUnit,
        description: prod.description,
        image: prod.suggestedImage,
        stock: 50,
      });
      return { res: await res.json(), prodName: prod.name };
    },
    onSuccess: ({ res, prodName }) => {
      setAddedProductNames((prev) => new Set([...prev, prodName]));
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({
        title: "🎉 Product Added to Catalog!",
        description: res.message || `"${prodName}" is now active in the store catalog.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to Add Product",
        description: err?.message || "Could not create product in catalog.",
        variant: "destructive",
      });
    },
  });

  // Autonomous Radar Action Mutations
  const briefingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/radar/trigger-briefing", {});
      return res.json();
    },
    onSuccess: (res) => {
      toast({
        title: "🌾 Morning Harvest Briefing Dispatched",
        description: res.message || "Briefing sent to your Super Admin Telegram channel!",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to Dispatch Briefing", description: err.message, variant: "destructive" });
    },
  });

  const digestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/radar/trigger-digest", {});
      return res.json();
    },
    onSuccess: (res) => {
      toast({
        title: "🌙 Financial Settlement Digest Dispatched",
        description: res.message || "Nightly digest sent to your Telegram channel!",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to Dispatch Digest", description: err.message, variant: "destructive" });
    },
  });

  const testAlertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/radar/test-alert", {
        keyword: "Organic Dragon Fruit & Ginger",
        count: 24,
      });
      return res.json();
    },
    onSuccess: (res) => {
      toast({
        title: "🚨 Sourcing Spike Alert Dispatched",
        description: res.message || "Alert sent to your Telegram channel!",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to Send Alert", description: err.message, variant: "destructive" });
    },
  });

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case "high":
        return <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold">🚨 High Sourcing Urgency</Badge>;
      case "medium":
        return <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold">⚡ Medium Priority</Badge>;
      default:
        return <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">🌱 Seasonal Opportunity</Badge>;
    }
  };

  return (
    <AdminLayout title="AI Sourcing & Demand Intelligence">
      <div className="space-y-6 max-w-7xl mx-auto pb-10">

        {/* ── HEADER BANNER ── */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-amber-950/50 border-2 border-emerald-500/30 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center text-black font-black text-xl shadow-lg shrink-0">
                <Sparkles size={24} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                    Lakshmi AI • Inventory Sourcing &amp; Demand Radar
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-extrabold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Live Gemini AI Intelligence
                  </span>
                </div>
                <p className="text-xs md:text-sm text-gray-300 max-w-3xl leading-relaxed">
                  Real-time agricultural procurement advisor. Analyzes customer search queries, zero-result keyword demand, Lakshmi health inquiries, and regional harvest calendars to tell you exactly what crops to source and stock.
                </p>
              </div>
            </div>

            <Button
              onClick={() => reanalyzeMutation.mutate()}
              disabled={reanalyzeMutation.isPending || isFetching}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black shadow-xl shrink-0 gap-2 h-11 px-5 rounded-2xl cursor-pointer"
            >
              <RefreshCw size={16} className={reanalyzeMutation.isPending || isFetching ? "animate-spin" : ""} />
              <span>{reanalyzeMutation.isPending || isFetching ? "Analyzing Live Demand..." : "Re-analyze Customer Demand"}</span>
            </Button>
          </div>

          {/* Model info & timestamp */}
          {data && (
            <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-emerald-500/20 pt-3 flex-wrap gap-2">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck size={13} className="text-emerald-400" />
                Model: <strong className="text-emerald-300">{data.modelUsed}</strong> (Pure Dynamic Inference • Zero Hardcoded Rules)
              </span>
              <span>
                Last Generated: <strong className="text-gray-200">{new Date(data.generatedAt).toLocaleTimeString()}</strong>
              </span>
            </div>
          )}
        </div>

        {/* ── LOADING SKELETON ── */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        ) : (
          <>
            {/* ── EXECUTIVE BRIEFING CARD ── */}
            {data?.executiveSummary && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-card to-emerald-500/10 border border-amber-500/30 shadow-md flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  💡
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Executive Sourcing &amp; Harvest Strategy
                  </h3>
                  <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                    {data.executiveSummary}
                  </p>
                </div>
              </div>
            )}

            {/* ── KPI METRIC CARDS ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <Card className="border-card-border/80 bg-card/60 backdrop-blur">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-bold uppercase tracking-wider">Unmet Searches</span>
                    <Search size={16} className="text-amber-400" />
                  </div>
                  <p className="text-2xl font-black text-amber-400">
                    {data?.unmetDemands?.length || 0} Gaps
                  </p>
                  <p className="text-[10px] text-muted-foreground">Searched items missing from catalog</p>
                </CardContent>
              </Card>

              <Card className="border-card-border/80 bg-card/60 backdrop-blur">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-bold uppercase tracking-wider">New Crop Picks</span>
                    <Leaf size={16} className="text-emerald-400" />
                  </div>
                  <p className="text-2xl font-black text-emerald-400">
                    {data?.recommendedNewProducts?.length || 0} Crops
                  </p>
                  <p className="text-[10px] text-muted-foreground">Ready for 1-Click Catalog Addition</p>
                </CardContent>
              </Card>

              <Card className="border-card-border/80 bg-card/60 backdrop-blur">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-bold uppercase tracking-wider">Restock Velocity</span>
                    <Boxes size={16} className="text-sky-400" />
                  </div>
                  <p className="text-2xl font-black text-sky-400">
                    {data?.restockAlerts?.length || 0} Alerts
                  </p>
                  <p className="text-[10px] text-muted-foreground">High inquiry &amp; low stock items</p>
                </CardContent>
              </Card>

              <Card className="border-card-border/80 bg-card/60 backdrop-blur">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-bold uppercase tracking-wider">Harvest Belts</span>
                    <MapPin size={16} className="text-purple-400" />
                  </div>
                  <p className="text-2xl font-black text-purple-400">
                    {data?.seasonalHarvestGuidance?.length || 0} Regions
                  </p>
                  <p className="text-[10px] text-muted-foreground">Andhra &amp; Telangana organic hubs</p>
                </CardContent>
              </Card>
            </div>

            {/* ── SECTION 1: AI RECOMMENDED NEW PRODUCTS (1-CLICK ADD) ── */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                    <span>🌾 Recommended New Crops to Procure &amp; Stock</span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                      1-Click Catalog Addition
                    </Badge>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Synthesized by Gemini AI based on customer demand trails, seasonal disease defense, and unmet searches.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data?.recommendedNewProducts?.map((prod, idx) => {
                  const isAdded = addedProductNames.has(prod.name);
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-3.5 ${
                        isAdded
                          ? "bg-emerald-950/20 border-emerald-500/40 shadow-inner"
                          : "bg-card border-card-border hover:border-emerald-500/40 hover:shadow-lg"
                      }`}
                    >
                      <div className="space-y-2.5">
                        {/* Header: Badges */}
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          {getUrgencyBadge(prod.urgency)}
                          <Badge variant="secondary" className="text-[10px] font-bold capitalize">
                            📁 {prod.categorySlug.replace(/-/g, " ")}
                          </Badge>
                        </div>

                        {/* Title & Telugu name */}
                        <div>
                          <h3 className="text-base font-black text-foreground">
                            {prod.name}
                          </h3>
                          {prod.nameTe && (
                            <p className="text-xs font-bold text-amber-500/90 font-telugu">
                              {prod.nameTe}
                            </p>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {prod.description}
                        </p>

                        {/* Price & Unit */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-background/80 border border-card-border/80">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Suggested Price</span>
                            <span className="text-sm font-black text-emerald-400">
                              ₹{prod.suggestedPrice}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Unit Pack</span>
                            <span className="text-xs font-bold text-foreground">{prod.suggestedUnit}</span>
                          </div>
                        </div>

                        {/* Clinical / Sourcing Rationale */}
                        <div className="space-y-1 pt-1 border-t border-card-border/60">
                          <p className="text-[11px] text-foreground/90 font-medium">
                            <strong className="text-amber-400">Why Procure: </strong>
                            {prod.sourcingReason}
                          </p>
                          {prod.clinicalHealthBenefits && (
                            <p className="text-[10px] text-muted-foreground">
                              <strong className="text-emerald-400">Health Profile: </strong>
                              {prod.clinicalHealthBenefits}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 1-Click Action Button */}
                      <Button
                        onClick={() => addProductMutation.mutate(prod)}
                        disabled={isAdded || addProductMutation.isPending}
                        className={`w-full font-black text-xs h-10 rounded-xl transition-all ${
                          isAdded
                            ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default"
                            : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        }`}
                      >
                        {isAdded ? (
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-400" />
                            ✓ Active in Catalog
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <PlusCircle size={14} />
                            ⚡ 1-Click Add to Catalog
                          </span>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── SECTION 2: UNMET CUSTOMER DEMAND RADAR ── */}
            <div className="space-y-4 pt-4">
              <div>
                <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                  <Search size={18} className="text-amber-400" />
                  <span>Unmet Customer Demand Radar (Zero-Match Searches)</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Queries typed by visitors with 0 product matches in the catalog — indicates immediate lost revenue opportunities.
                </p>
              </div>

              <div className="rounded-2xl border border-card-border bg-card overflow-x-auto shadow-md">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60 text-left font-bold text-muted-foreground">
                    <tr>
                      <th className="p-3">Customer Search Query</th>
                      <th className="p-3">Search Volume</th>
                      <th className="p-3">Target Category</th>
                      <th className="p-3">Est. Unrealized Revenue</th>
                      <th className="p-3">Recommended Sourcing Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border/60">
                    {data?.unmetDemands && data.unmetDemands.length > 0 ? (
                      data.unmetDemands.map((u, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition">
                          <td className="p-3 font-bold text-foreground capitalize">
                            "{u.keyword}"
                          </td>
                          <td className="p-3 font-semibold text-amber-400">
                            {u.searchCount} searches
                          </td>
                          <td className="p-3 capitalize">
                            <Badge variant="outline" className="text-[10px]">
                              {u.categorySuggestion}
                            </Badge>
                          </td>
                          <td className="p-3 font-extrabold text-emerald-400">
                            {u.lostRevenuePotential}
                          </td>
                          <td className="p-3 text-muted-foreground font-medium">
                            {u.sourcingAction}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-muted-foreground italic">
                          No major unmet search demand gaps detected.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── SECTION 3: RESTOCK VELOCITY & LOW STOCK ALERTS ── */}
            {data?.restockAlerts && data.restockAlerts.length > 0 && (
              <div className="space-y-4 pt-4">
                <div>
                  <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                    <Boxes size={18} className="text-sky-400" />
                    <span>Restock Velocity &amp; Stockout Risk Radar</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Catalog items with accelerating inquiry velocity and low warehouse stock.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.restockAlerts.map((r, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-card border border-sky-500/30 space-y-2.5 shadow-md">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-sm text-foreground">{r.productName}</h4>
                        <Badge className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px]">
                          {r.demandVelocity}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-background/80 border border-card-border">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Current Stock</span>
                          <span className={`font-black ${r.currentStock <= 5 ? "text-red-400" : "text-amber-400"}`}>
                            {r.currentStock} Units
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Recommended Reorder</span>
                          <span className="font-black text-emerald-400">+{r.recommendedRestockQty} Units</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{r.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SECTION 4: REGIONAL HARVEST GUIDANCE (AP / TELANGANA) ── */}
            {data?.seasonalHarvestGuidance && data.seasonalHarvestGuidance.length > 0 && (
              <div className="space-y-4 pt-4">
                <div>
                  <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                    <MapPin size={18} className="text-purple-400" />
                    <span>Regional Organic Harvest Belts (Andhra Pradesh &amp; Telangana)</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Direct-from-farm procurement windows across local agricultural farming belts.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.seasonalHarvestGuidance.map((g, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-card border border-purple-500/30 space-y-2 shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-purple-300">{g.crop}</span>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          📍 {g.growingRegion}
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground/90 font-semibold">
                        🗓️ Harvest Window: <span className="text-emerald-400 font-bold">{g.peakProcurementWindow}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-card-border/60">
                        {g.healthDefenseProfile}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SECTION 5: AUTONOMOUS TELEGRAM ALERTING & DAILY RADAR PIPELINE ── */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-card via-card to-emerald-950/30 border-2 border-emerald-500/30 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl shrink-0">
                    🛰️
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                      Autonomous Proactive Radar &amp; Telegram Pipeline
                      <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 text-[10px] font-extrabold">
                        24/7 Active
                      </Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Proactively monitors customer search spikes, warehouse stockouts, and payment gateways with 2-way Telegram bot commands.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                <div className="p-4 rounded-2xl bg-background/80 border border-card-border space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
                      <span>🌾 06:00 AM Harvest Briefing</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      AI-generated daily farm harvest procurement briefing dispatched to Super Admin Telegram.
                    </p>
                  </div>
                  <Button
                    onClick={() => briefingMutation.mutate()}
                    disabled={briefingMutation.isPending}
                    className="w-full text-xs font-bold h-9 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl cursor-pointer"
                  >
                    {briefingMutation.isPending ? "Generating..." : "⚡ Dispatch Harvest Briefing"}
                  </Button>
                </div>

                <div className="p-4 rounded-2xl bg-background/80 border border-card-border space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-sky-400">
                      <span>🌙 11:30 PM Financial Digest</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Daily settlement, total GMV, delivered order count, and GST liability summary.
                    </p>
                  </div>
                  <Button
                    onClick={() => digestMutation.mutate()}
                    disabled={digestMutation.isPending}
                    className="w-full text-xs font-bold h-9 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-xl cursor-pointer"
                  >
                    {digestMutation.isPending ? "Generating..." : "⚡ Dispatch Financial Digest"}
                  </Button>
                </div>

                <div className="p-4 rounded-2xl bg-background/80 border border-card-border space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-red-400">
                      <span>🚨 Sourcing Spike Test Alert</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Tests the real-time high-velocity unlisted crop search alert sent to your Telegram channel.
                    </p>
                  </div>
                  <Button
                    onClick={() => testAlertMutation.mutate()}
                    disabled={testAlertMutation.isPending}
                    className="w-full text-xs font-bold h-9 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl cursor-pointer"
                  >
                    {testAlertMutation.isPending ? "Sending..." : "⚡ Test Sourcing Spike Alert"}
                  </Button>
                </div>
              </div>

              {/* 2-Way Telegram Bot Cheat Sheet */}
              <div className="p-4 rounded-2xl bg-secondary/40 border border-card-border space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    📱 <strong>2-Way Telegram Bot Quick Commands (Manage from Phone)</strong>
                  </span>
                  <Badge variant="outline" className="text-[10px]">Super Admin Only</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div className="p-2 rounded-xl bg-background border border-card-border">
                    <code className="text-emerald-400 font-bold">/briefing</code>
                    <p className="text-[10px] text-muted-foreground">Morning farm sourcing advice</p>
                  </div>
                  <div className="p-2 rounded-xl bg-background border border-card-border">
                    <code className="text-sky-400 font-bold">/digest</code>
                    <p className="text-[10px] text-muted-foreground">Today's GMV &amp; GST totals</p>
                  </div>
                  <div className="p-2 rounded-xl bg-background border border-card-border">
                    <code className="text-amber-400 font-bold">/stock 3 100</code>
                    <p className="text-[10px] text-muted-foreground">Update crop stock to 100 kg</p>
                  </div>
                  <div className="p-2 rounded-xl bg-background border border-card-border">
                    <code className="text-purple-400 font-bold">/coupon FLASH15 15</code>
                    <p className="text-[10px] text-muted-foreground">Create 15% 24h flash coupon</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
