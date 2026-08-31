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
  Package, Boxes, ArrowRight, Zap, ShoppingBag, Leaf, ExternalLink,
  Send, Tag, Layers, Check, Clock, Radio
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
  id?: string;
  crop: string;
  cropTe: string;
  growingRegion: string;
  district: string;
  peakProcurementWindow: string;
  healthDefenseProfile: string;
  farmerHub: string;
  currentMarketYield: string;
  recommendedPrice: number;
  suggestedUnit: string;
  suggestedCategory: string;
  suggestedAction: string;
  suggestedImage: string;
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
  const [restockedProductNames, setRestockedProductNames] = useState<Set<string>>(new Set());
  const [dispatchedBelts, setDispatchedBelts] = useState<Set<string>>(new Set());
  const [promoCreatedBelts, setPromoCreatedBelts] = useState<Set<string>>(new Set());

  // Fetch AI Procurement recommendations
  const { data, isLoading, isFetching, refetch } = useQuery<ProcurementAiResult>({
    queryKey: ["/api/admin/procurement-ai/recommendations"],
    queryFn: () => apiGet<ProcurementAiResult>("/api/admin/procurement-ai/recommendations"),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Fetch live zero-result search stream (auto-refreshed every 10 seconds)
  const { data: liveStreamData } = useQuery<{
    totalRecent: number;
    events: {
      id: number;
      query: string;
      sessionId: string;
      city: string;
      pincode?: string;
      resultCount: number;
      createdAt: string;
    }[];
  }>({
    queryKey: ["/api/admin/demand/live-unmet-stream"],
    queryFn: () => apiGet("/api/admin/demand/live-unmet-stream"),
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Mutation to force re-analyze with Gemini
  const reanalyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiGet<ProcurementAiResult>("/api/admin/procurement-ai/recommendations?force=true");
      return res;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(["/api/admin/procurement-ai/recommendations"], newData);
      toast({
        title: "🧠 Demand & Harvest Intelligence Refreshed",
        description: `Analyzed with Google ${newData.modelUsed || "Gemini"} based on live farm & consumer signals.`,
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

  // 1-Click Auto Restock Mutation
  const autoRestockMutation = useMutation({
    mutationFn: async ({ productId, productName, restockQty }: { productId?: number; productName: string; restockQty: number }) => {
      const res = await apiRequest("POST", "/api/admin/procurement-ai/auto-restock", {
        productId,
        productName,
        restockQty,
      });
      return { res: await res.json(), productName };
    },
    onSuccess: ({ res, productName }) => {
      setRestockedProductNames((prev) => new Set([...prev, productName]));
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/procurement-ai/recommendations"] });
      toast({
        title: "📦 Stock Replenished via AI",
        description: res.message || `Added stock to catalog successfully!`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Auto-Restock Failed", description: err.message, variant: "destructive" });
    },
  });

  // 1-Click Dispatch Farm PO to Telegram Mutation
  const dispatchPoTelegramMutation = useMutation({
    mutationFn: async (belt: SeasonalGuidanceItem) => {
      const res = await apiRequest("POST", "/api/admin/procurement-ai/dispatch-po-telegram", {
        crop: belt.crop,
        cropTe: belt.cropTe,
        growingRegion: belt.growingRegion,
        district: belt.district,
        farmerHub: belt.farmerHub,
        peakProcurementWindow: belt.peakProcurementWindow,
        targetQty: "100 Kg",
        recommendedPrice: belt.recommendedPrice,
      });
      return { res: await res.json(), beltKey: belt.crop };
    },
    onSuccess: ({ res, beltKey }) => {
      setDispatchedBelts((prev) => new Set([...prev, beltKey]));
      toast({
        title: "📢 Farm Procurement PO Dispatched",
        description: res.message || "Dispatch alert broadcast to operations channel!",
      });
    },
    onError: (err: any) => {
      toast({ title: "Dispatch Failed", description: err.message, variant: "destructive" });
    },
  });

  // 1-Click Launch Flash Harvest Promo Mutation
  const launchFlashPromoMutation = useMutation({
    mutationFn: async ({ crop, discountPercent }: { crop: string; discountPercent: string }) => {
      const res = await apiRequest("POST", "/api/admin/procurement-ai/launch-flash-promo", {
        crop,
        discountPercent,
      });
      return { res: await res.json(), crop };
    },
    onSuccess: ({ res, crop }) => {
      setPromoCreatedBelts((prev) => new Set([...prev, crop]));
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({
        title: "🚀 Flash Harvest Promo Activated!",
        description: res.message || `Coupon ${res.couponCode} activated for ${crop}!`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Promo Creation Failed", description: err.message, variant: "destructive" });
    },
  });

  // 1-Click Add Unmet Demand Crop to Catalog Mutation
  const addUnmetCropMutation = useMutation({
    mutationFn: async (u: UnmetDemandItem) => {
      const res = await apiRequest("POST", "/api/admin/procurement-ai/add-product", {
        name: u.keyword.charAt(0).toUpperCase() + u.keyword.slice(1),
        categorySlug: u.categorySuggestion.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        price: "120.00",
        unit: "1 Kg",
        description: `Fresh organically grown ${u.keyword} procured directly from Andhra & Telangana farmer belts.`,
        image: "/images/cat-vegetables.jpg",
        stock: 50,
      });
      return { res: await res.json(), keyword: u.keyword };
    },
    onSuccess: ({ res, keyword }) => {
      setAddedProductNames((prev) => new Set([...prev, keyword]));
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({
        title: "🎉 Unmet Demand Crop Added!",
        description: res.message || `"${keyword}" is now in your catalog with 50 units stock!`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to Add Crop", description: err.message, variant: "destructive" });
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
        crop: "Dragonfruit (Kamalam)",
        searchesCount: 42,
        region: "Madanapalle Horticulture Belt",
      });
      return res.json();
    },
    onSuccess: (res) => {
      toast({
        title: "🚨 Test Radar Alert Dispatched",
        description: res.message || "High-velocity search spike alert sent to Telegram!",
      });
    },
    onError: (err: any) => {
      toast({ title: "Test Alert Failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AdminLayout title="AI Sourcing & Demand Intelligence">
      <div className="space-y-6 pb-12">
        {/* ── HEADER BANNER ── */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/70 via-card to-emerald-950/40 border-2 border-emerald-500/30 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
                  <span>Vishnu AI Sourcing &amp; Procurement Radar</span>
                  <span className="text-xl">🌾</span>
                </h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-extrabold uppercase tracking-wider">
                  Live AI Autonomous
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
                Real-time harvest belt analysis across Andhra Pradesh &amp; Telangana, correlating customer search demand, Lakshmi AI wellness queries, and warehouse stock levels.
              </p>
            </div>

            <Button
              onClick={() => reanalyzeMutation.mutate()}
              disabled={reanalyzeMutation.isPending || isFetching}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg shadow-emerald-900/40 gap-2 shrink-0 rounded-xl"
            >
              <RefreshCw size={14} className={reanalyzeMutation.isPending || isFetching ? "animate-spin" : ""} />
              <span>{reanalyzeMutation.isPending || isFetching ? "Analyzing Farm Data…" : "Re-Analyze with Gemini AI"}</span>
            </Button>
          </div>

          {/* Model info & timestamp */}
          {data && (
            <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-emerald-500/20 pt-3 flex-wrap gap-2">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck size={13} className="text-emerald-400" />
                Model: <strong className="text-emerald-300">{data.modelUsed}</strong> (Pure Dynamic Inference • Active Farm Signals)
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
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-lg">
                  💡
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <span>Executive Sourcing &amp; Harvest Strategy</span>
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">Daily Directive</Badge>
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
                    {(liveStreamData?.events && liveStreamData.events.length > 0) ? liveStreamData.events.length : (data?.unmetDemands?.length || 0)} Gaps
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
                    {data?.seasonalHarvestGuidance?.length || 0} Belts Active
                  </p>
                  <p className="text-[10px] text-muted-foreground">Andhra &amp; Telangana organic hubs</p>
                </CardContent>
              </Card>
            </div>

            {/* ── SECTION 1: REGIONAL ORGANIC HARVEST BELTS WITH INTERACTIVE ACTION BUTTONS ── */}
            {data?.seasonalHarvestGuidance && data.seasonalHarvestGuidance.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-card-border pb-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                      <MapPin size={20} className="text-purple-400" />
                      <span>Regional Organic Harvest Belts (Andhra Pradesh &amp; Telangana)</span>
                      <Badge className="bg-purple-500/20 text-purple-300 border border-purple-400/40 text-[10px] font-bold">
                        {data.seasonalHarvestGuidance.length} Active Farm Belts
                      </Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Direct-from-farm procurement windows with 1-click PO dispatch, catalog addition, and flash campaign triggers.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.seasonalHarvestGuidance.map((belt, i) => {
                    const isDispatched = dispatchedBelts.has(belt.crop);
                    const isPromoCreated = promoCreatedBelts.has(belt.crop);
                    const isAdded = addedProductNames.has(belt.crop);

                    return (
                      <div
                        key={belt.id || i}
                        className="p-5 rounded-2xl bg-card border border-purple-500/30 hover:border-purple-400/60 transition-all space-y-4 shadow-lg flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-black text-base text-purple-300 leading-snug">
                                {belt.crop}
                              </h3>
                              {belt.cropTe && (
                                <p className="text-xs font-serif text-amber-300/90 font-medium">
                                  {belt.cropTe}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-[10px] font-extrabold border-purple-500/40 text-purple-300 shrink-0">
                              📍 {belt.district || belt.growingRegion}
                            </Badge>
                          </div>

                          {/* Meta pill box */}
                          <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-xl bg-background/80 border border-card-border">
                            <div>
                              <span className="text-[10px] text-muted-foreground block font-medium">🗓️ Harvest Window</span>
                              <span className="font-black text-emerald-400">{belt.peakProcurementWindow}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block font-medium">🚜 Farmer Hub</span>
                              <span className="font-bold text-foreground truncate block">{belt.farmerHub || belt.growingRegion}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block font-medium">💰 Est. Farm Rate</span>
                              <span className="font-extrabold text-sky-400">₹{belt.recommendedPrice || 140} / {belt.suggestedUnit || "1 Kg"}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block font-medium">📊 Market Yield</span>
                              <span className="font-bold text-amber-300 truncate block">{belt.currentMarketYield || "Peak Season"}</span>
                            </div>
                          </div>

                          {/* Clinical Health Benefits */}
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-black tracking-wider text-purple-400 block">
                              🌿 Clinical &amp; Nutritional Profile:
                            </span>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {belt.healthDefenseProfile}
                            </p>
                          </div>
                        </div>

                        {/* 3 Interactive Action Buttons */}
                        <div className="space-y-2 pt-2 border-t border-card-border/70">
                          <div className="grid grid-cols-2 gap-2">
                            {/* 1. Add to Store Catalog */}
                            <Button
                              size="sm"
                              disabled={isAdded || addProductMutation.isPending}
                              onClick={() =>
                                addProductMutation.mutate({
                                  name: belt.crop,
                                  nameTe: belt.cropTe || belt.crop,
                                  categorySlug: belt.suggestedCategory || "vegetables",
                                  suggestedPrice: belt.recommendedPrice || 120,
                                  suggestedUnit: belt.suggestedUnit || "1 Kg",
                                  description: `${belt.crop} freshly harvested from ${belt.growingRegion}. ${belt.healthDefenseProfile}`,
                                  sourcingReason: `Direct farm-gate procurement from ${belt.farmerHub}`,
                                  clinicalHealthBenefits: belt.healthDefenseProfile,
                                  urgency: "high",
                                  targetSeason: belt.peakProcurementWindow,
                                  suggestedImage: belt.suggestedImage || "/images/cat-vegetables.jpg",
                                })
                              }
                              className={`h-8 text-xs font-bold rounded-xl ${
                                isAdded
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
                              }`}
                            >
                              {isAdded ? (
                                <span className="flex items-center gap-1"><Check size={12} /> Added</span>
                              ) : (
                                <span className="flex items-center gap-1"><PlusCircle size={12} /> Add to Store</span>
                              )}
                            </Button>

                            {/* 2. Launch Flash Promo */}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isPromoCreated || launchFlashPromoMutation.isPending}
                              onClick={() =>
                                launchFlashPromoMutation.mutate({
                                  crop: belt.crop,
                                  discountPercent: "15.00",
                                })
                              }
                              className={`h-8 text-xs font-bold rounded-xl border-amber-500/40 text-amber-300 hover:bg-amber-500/10 ${
                                isPromoCreated ? "bg-amber-500/20 text-amber-200" : ""
                              }`}
                            >
                              {isPromoCreated ? (
                                <span className="flex items-center gap-1"><Check size={12} /> Promo Active</span>
                              ) : (
                                <span className="flex items-center gap-1"><Tag size={12} /> Flash 15% Promo</span>
                              )}
                            </Button>
                          </div>

                          {/* 3. Dispatch Farm PO to Telegram */}
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isDispatched || dispatchPoTelegramMutation.isPending}
                            onClick={() => dispatchPoTelegramMutation.mutate(belt)}
                            className={`w-full h-8 text-xs font-bold rounded-xl ${
                              isDispatched
                                ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                : "bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30"
                            }`}
                          >
                            {isDispatched ? (
                              <span className="flex items-center justify-center gap-1.5"><Check size={12} /> PO Dispatched to Telegram</span>
                            ) : (
                              <span className="flex items-center justify-center gap-1.5"><Send size={12} /> 📡 Dispatch Farm PO to Telegram</span>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── SECTION 2: NEW CROP RECOMMENDATIONS WITH 1-CLICK ADD ── */}
            {data?.recommendedNewProducts && data.recommendedNewProducts.length > 0 && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between border-b border-card-border pb-3">
                  <div>
                    <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                      <Sparkles size={18} className="text-emerald-400" />
                      <span>Curated Organic Crops to Add to Catalog</span>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      AI-recommended seasonal crops for Andhra Pradesh &amp; Telangana based on customer searches and wellness inquiries.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {data.recommendedNewProducts.map((p, i) => {
                    const isAdded = addedProductNames.has(p.name);
                    return (
                      <div
                        key={i}
                        className="p-4 rounded-2xl bg-card border border-emerald-500/30 hover:border-emerald-400 transition-all space-y-3 shadow-md flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-1.5">
                            <div>
                              <h4 className="font-extrabold text-sm text-foreground leading-tight">{p.name}</h4>
                              <p className="text-xs text-amber-300/90 font-serif">{p.nameTe}</p>
                            </div>
                            <Badge
                              className={`text-[9px] font-black uppercase ${
                                p.urgency === "high"
                                  ? "bg-red-500/20 text-red-300 border-red-500/40"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              }`}
                            >
                              {p.urgency}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-background/80 border border-card-border">
                            <span className="font-black text-emerald-400">
                              ₹{p.suggestedPrice} <span className="text-[10px] text-muted-foreground font-normal">/ {p.suggestedUnit}</span>
                            </span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {p.categorySlug}
                            </Badge>
                          </div>

                          <p className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</p>
                          <p className="text-[10px] text-emerald-300/80 font-medium">💡 {p.sourcingReason}</p>
                        </div>

                        <Button
                          size="sm"
                          disabled={isAdded || addProductMutation.isPending}
                          onClick={() => addProductMutation.mutate(p)}
                          className={`w-full text-xs font-bold rounded-xl gap-1.5 ${
                            isAdded
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white"
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <CheckCircle2 size={13} className="text-emerald-400" />
                              <span>Added to Catalog</span>
                            </>
                          ) : (
                            <>
                              <PlusCircle size={13} />
                              <span>1-Click Add to Store</span>
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── SECTION 3: RESTOCK VELOCITY & 1-CLICK AUTO-RESTOCK ── */}
            {data?.restockAlerts && data.restockAlerts.length > 0 && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between border-b border-card-border pb-3">
                  <div>
                    <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                      <Boxes size={18} className="text-sky-400" />
                      <span>Restock Velocity &amp; Stockout Risk Radar</span>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Low warehouse stock items with 1-click instant replenishment.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.restockAlerts.map((r, i) => {
                    const isRestocked = restockedProductNames.has(r.productName);

                    return (
                      <div key={i} className="p-4 rounded-2xl bg-card border border-sky-500/30 space-y-3 shadow-md flex flex-col justify-between">
                        <div className="space-y-2">
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

                        {/* 1-Click Auto Restock Button */}
                        <Button
                          size="sm"
                          disabled={isRestocked || autoRestockMutation.isPending}
                          onClick={() =>
                            autoRestockMutation.mutate({
                              productId: r.productId,
                              productName: r.productName,
                              restockQty: r.recommendedRestockQty || 50,
                            })
                          }
                          className={`w-full text-xs font-bold rounded-xl gap-1.5 ${
                            isRestocked
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                              : "bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-900/30"
                          }`}
                        >
                          {isRestocked ? (
                            <>
                              <CheckCircle2 size={13} className="text-sky-400" />
                              <span>Restocked +{r.recommendedRestockQty} Units</span>
                            </>
                          ) : (
                            <>
                              <Zap size={13} />
                              <span>⚡ Auto-Restock +{r.recommendedRestockQty} Units</span>
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── SECTION 4: UNMET SEARCH DEMAND GAPS TABLE WITH 1-CLICK SOURCE BUTTON ── */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-b border-card-border pb-3">
                <div>
                  <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                    <Search size={18} className="text-amber-400" />
                    <span>Customer Unmet Search Demand Gaps</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Produce customers explicitly searched for that returned 0 results in the store.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-card-border bg-card overflow-hidden shadow-md">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase font-bold text-muted-foreground">
                    <tr>
                      <th className="p-3">Searched Keyword</th>
                      <th className="p-3">Demand Velocity</th>
                      <th className="p-3">Suggested Category</th>
                      <th className="p-3">Lost Revenue Gap</th>
                      <th className="p-3">Sourcing Action</th>
                      <th className="p-3 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border/60">
                    {data?.unmetDemands && data.unmetDemands.length > 0 ? (
                      data.unmetDemands.map((u, i) => {
                        const isAdded = addedProductNames.has(u.keyword);
                        return (
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
                            <td className="p-3 text-muted-foreground font-medium text-xs">
                              {u.sourcingAction}
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                size="sm"
                                disabled={isAdded || addUnmetCropMutation.isPending}
                                onClick={() => addUnmetCropMutation.mutate(u)}
                                className={`h-7 text-xs font-bold rounded-lg ${
                                  isAdded
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                                }`}
                              >
                                {isAdded ? "Added" : "+ Add to Store"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    ) : liveStreamData?.events && liveStreamData.events.length > 0 ? (
                      liveStreamData.events.map((ev, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition">
                          <td className="p-3 font-bold text-foreground capitalize flex items-center gap-2">
                            <span>"{ev.query}"</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-extrabold">LIVE</span>
                          </td>
                          <td className="p-3 font-semibold text-amber-400">
                            1+ searches
                          </td>
                          <td className="p-3 capitalize">
                            <Badge variant="outline" className="text-[10px]">
                              📍 {ev.city}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            Session: {ev.sessionId.slice(0, 10)}...
                          </td>
                          <td className="p-3 text-emerald-400 font-medium text-xs">
                            Captured {new Date(ev.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              onClick={() =>
                                addUnmetCropMutation.mutate({
                                  keyword: ev.query,
                                  searchCount: 1,
                                  categorySuggestion: "Vegetables",
                                  lostRevenuePotential: "₹250",
                                  sourcingAction: "Direct farmer pickup",
                                })
                              }
                              className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                            >
                              + Add to Store
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground italic">
                          No major unmet search demand gaps detected. Live search monitoring is active.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

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
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      AI-generated daily farm harvest procurement briefing dispatched to Super Admin Telegram.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={briefingMutation.isPending}
                    onClick={() => briefingMutation.mutate()}
                    className="w-full text-xs font-bold border-amber-500/40 text-amber-300 hover:bg-amber-500/10 rounded-xl"
                  >
                    <Zap size={13} className="mr-1.5 text-amber-400" />
                    <span>{briefingMutation.isPending ? "Dispatching…" : "Dispatch Harvest Briefing"}</span>
                  </Button>
                </div>

                <div className="p-4 rounded-2xl bg-background/80 border border-card-border space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-sky-400">
                      <span>🌙 11:30 PM Financial Digest</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Daily settlement, total GMV, delivered order count, and GST liability summary.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={digestMutation.isPending}
                    onClick={() => digestMutation.mutate()}
                    className="w-full text-xs font-bold border-sky-500/40 text-sky-300 hover:bg-sky-500/10 rounded-xl"
                  >
                    <Zap size={13} className="mr-1.5 text-sky-400" />
                    <span>{digestMutation.isPending ? "Dispatching…" : "Dispatch Financial Digest"}</span>
                  </Button>
                </div>

                <div className="p-4 rounded-2xl bg-background/80 border border-card-border space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-red-400">
                      <span>🚨 Sourcing Spike Test Alert</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Tests the real-time high-velocity unlisted crop search alert sent to your Telegram channel.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={testAlertMutation.isPending}
                    onClick={() => testAlertMutation.mutate()}
                    className="w-full text-xs font-bold border-red-500/40 text-red-300 hover:bg-red-500/10 rounded-xl"
                  >
                    <Zap size={13} className="mr-1.5 text-red-400" />
                    <span>{testAlertMutation.isPending ? "Sending…" : "Test Sourcing Spike Alert"}</span>
                  </Button>
                </div>
              </div>

              {/* Telegram Bot Commands Cheatsheet */}
              <div className="p-3.5 rounded-2xl bg-background/60 border border-card-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-foreground flex items-center gap-1.5">
                    📱 2-Way Telegram Bot Quick Commands (Manage from Phone)
                  </span>
                  <Badge variant="outline" className="text-[9px] font-bold border-muted">Super Admin Only</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-card/80 border border-card-border">
                    <span className="text-emerald-400 font-bold block">/briefing</span>
                    <span className="text-muted-foreground text-[10px]">Morning farm sourcing advice</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card/80 border border-card-border">
                    <span className="text-sky-400 font-bold block">/digest</span>
                    <span className="text-muted-foreground text-[10px]">Today's GMV &amp; GST totals</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card/80 border border-card-border">
                    <span className="text-amber-400 font-bold block">/stock 3 100</span>
                    <span className="text-muted-foreground text-[10px]">Update crop stock to 100 kg</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card/80 border border-card-border">
                    <span className="text-purple-400 font-bold block">/coupon FLASH15 15</span>
                    <span className="text-muted-foreground text-[10px]">Create 15% 24h flash coupon</span>
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
