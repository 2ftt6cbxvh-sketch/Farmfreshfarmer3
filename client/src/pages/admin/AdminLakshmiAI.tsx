import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiGet } from "@/lib/queryClient";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Sparkles, Key, Zap, CheckCircle2, AlertCircle, Eye, EyeOff,
  Sliders, Database, MessageSquare, ExternalLink, Send, RefreshCw,
  ShoppingBag, ShieldCheck, HeartPulse, UserCheck, HelpCircle, Activity
} from "lucide-react";

interface LakshmiSettings {
  hasKey: boolean;
  maskedKey: string;
  rawKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  customSystemPrompt: string;
  enableProductsContext: boolean;
  enableOrdersContext: boolean;
  enableCartContext: boolean;
  enableAdsContext: boolean;
  enableHealthGuide: boolean;
  enableCreatorBio: boolean;
  creatorName?: string;
  creatorBio?: string;
  suggestionMode?: "smart" | "admin";
  pinnedProductIds?: number[];
}

export default function AdminLakshmiAI() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState("gemini-3.5-flash");
  const [temperature, setTemperature] = useState(0.5);
  const [maxTokens, setMaxTokens] = useState(450);
  const [customPrompt, setCustomPrompt] = useState("");
  const [enableProducts, setEnableProducts] = useState(true);
  const [enableOrders, setEnableOrders] = useState(true);
  const [enableCart, setEnableCart] = useState(true);
  const [enableAds, setEnableAds] = useState(true);
  const [enableHealth, setEnableHealth] = useState(true);
  const [enableCreator, setEnableCreator] = useState(true);

  // Suggestion Mode & Pinned Products
  const [suggestionMode, setSuggestionMode] = useState<"smart" | "admin">("smart");
  const [pinnedProductIds, setPinnedProductIds] = useState<number[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Live Test Chat Playground State
  const [testQuery, setTestQuery] = useState("what is ideal for high bp");
  const [testLanguage, setTestLanguage] = useState<"en" | "te" | "hi">("en");
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [isTestingChat, setIsTestingChat] = useState(false);

  // Fetch current Lakshmi AI settings
  const { data: settingsData, isLoading } = useQuery<LakshmiSettings>({
    queryKey: ["/api/admin/lakshmi/settings"],
    queryFn: () => apiGet<LakshmiSettings>("/api/admin/lakshmi/settings"),
  });

  // Fetch all active products for the picker
  const { data: allProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: () => apiGet<any[]>("/api/products"),
  });

  useEffect(() => {
    if (settingsData) {
      setApiKeyInput(settingsData.rawKey || "");
      setModel(settingsData.model || "gemini-3.5-flash");
      setTemperature(settingsData.temperature ?? 0.5);
      setMaxTokens(settingsData.maxTokens ?? 450);
      setCustomPrompt(settingsData.customSystemPrompt || "");
      setEnableProducts(settingsData.enableProductsContext ?? true);
      setEnableOrders(settingsData.enableOrdersContext ?? true);
      setEnableCart(settingsData.enableCartContext ?? true);
      setEnableAds(settingsData.enableAdsContext ?? true);
      setEnableHealth(settingsData.enableHealthGuide ?? true);
      setEnableCreator(settingsData.enableCreatorBio ?? true);
      if (settingsData.suggestionMode) setSuggestionMode(settingsData.suggestionMode);
      if (Array.isArray(settingsData.pinnedProductIds)) setPinnedProductIds(settingsData.pinnedProductIds);
    }
  }, [settingsData]);

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/lakshmi/settings", {
        gemini_api_key: apiKeyInput,
        gemini_model: model,
        gemini_temperature: temperature,
        gemini_max_tokens: maxTokens,
        lakshmi_custom_system_prompt: customPrompt,
        lakshmi_enable_products_context: enableProducts,
        lakshmi_enable_orders_context: enableOrders,
        lakshmi_enable_cart_context: enableCart,
        lakshmi_enable_ads_context: enableAds,
        lakshmi_enable_health_guide: enableHealth,
        lakshmi_enable_creator_bio: enableCreator,
        lakshmi_suggestion_mode: suggestionMode,
        lakshmi_pinned_product_ids: pinnedProductIds,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lakshmi/settings"] });
      toast({
        title: "✨ Lakshmi AI Settings Saved",
        description: "Google Gemini AI configuration, suggestion modes, and context settings updated successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to save settings",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Test Gemini API Key Connection Mutation
  const testGeminiMutation = useMutation({
    mutationFn: async (keyToTest?: string) => {
      const res = await apiRequest("POST", "/api/admin/lakshmi/test-gemini", {
        apiKey: keyToTest || apiKeyInput,
        model: model,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🟢 Gemini AI Connected Successfully!",
        description: `Model: ${data.model} | Latency: ${data.latencyMs}ms | Reply: "${data.reply?.slice(0, 80)}..."`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "🔴 Gemini Connection Failed",
        description: err.message || "Invalid API key or network error. Please verify your Google AI Studio key.",
        variant: "destructive",
      });
    },
  });

  // Execute Interactive Test Chat
  const handleRunTestChat = async () => {
    if (!testQuery.trim()) return;
    setIsTestingChat(true);
    setTestResponse(null);
    setTestLatency(null);
    const start = Date.now();
    try {
      const res = await apiRequest("POST", "/api/chatbot/message", {
        message: testQuery,
        language: testLanguage,
        token: `admin-test-${Date.now()}`,
      });
      const data = await res.json();
      setTestLatency(Date.now() - start);
      setTestResponse(data.reply);
    } catch (e: any) {
      setTestLatency(Date.now() - start);
      setTestResponse(`⚠️ Test error: ${e.message}`);
    } finally {
      setIsTestingChat(false);
    }
  };

  const hasConfiguredKey = Boolean(settingsData?.hasKey || (apiKeyInput && apiKeyInput.trim().length > 5));

  return (
    <AdminLayout title="Lakshmi AI Control Center">
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        
        {/* Top Header Card */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-background to-teal-950/20 p-6 md:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                  <Bot size={28} className="animate-pulse" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                    Lakshmi AI Control Center
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-bold">
                      v2.5 (Gemini Powered)
                    </Badge>
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Direct Google Gemini AI brain configuration, prompt engineering, live context feeds, and real-time latency diagnostics.
                  </p>
                </div>
              </div>
            </div>

            {/* Live Engine Status Badge */}
            <div className="flex items-center gap-3 bg-secondary/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-border/80 shadow-md">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${hasConfiguredKey ? "bg-emerald-500 animate-ping" : "bg-rose-500"}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {hasConfiguredKey ? "Gemini Engine Active 🟢" : "API Key Required 🔴"}
                </span>
              </div>
              <Badge variant="secondary" className="font-mono text-xs text-muted-foreground border">
                {model}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT & CENTER (2 COLS): Gemini Key, Model & Context Settings */}
          <div className="lg:col-span-2 space-y-6">

            {/* Card 1: Google Gemini AI Key & Model */}
            <Card className="border-border/80 shadow-lg rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm">
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="text-emerald-500" size={20} />
                    <CardTitle className="text-lg font-bold">Google Gemini AI Engine</CardTitle>
                  </div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline"
                  >
                    <span>Get Free Gemini Key</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <CardDescription>
                  Enter your Google AI Studio Gemini API Key. Lakshmi will use this key directly to answer queries with intelligence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {/* API Key Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="geminiKey" className="text-xs font-bold uppercase text-muted-foreground">
                      Gemini API Key
                    </Label>
                    {hasConfiguredKey && (
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Key Configured
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <Input
                      id="geminiKey"
                      type={showKey ? "text" : "password"}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Paste your Google AI Studio API Key..."
                      className="pr-24 font-mono text-sm border-border/80 bg-background/50 h-11"
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowKey(!showKey)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      >
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Model Selector & Hyperparameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">
                      AI Model Tier
                    </Label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full h-11 rounded-xl bg-background/80 border border-border/80 px-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="gemini-3.5-flash">gemini-3.5-flash (Recommended — Ultra-Fast, Intelligent & Production Ready)</option>
                      <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Low Latency & High Speed)</option>
                      <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Lightweight Fast Responder)</option>
                      <option value="gemini-3-flash-preview">gemini-3-flash-preview (Next-Gen Gemini 3 Preview)</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Classic Flash)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">
                        Temperature: {temperature}
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {temperature <= 0.3 ? "Strict & Accurate" : temperature <= 0.7 ? "Balanced" : "Creative"}
                      </span>
                    </div>
                    <Slider
                      value={[temperature]}
                      min={0.0}
                      max={1.0}
                      step={0.05}
                      onValueChange={(val) => setTemperature(val[0])}
                      className="py-2.5"
                    />
                  </div>
                </div>

                {/* Test Connection Button & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => testGeminiMutation.mutate(apiKeyInput)}
                    disabled={testGeminiMutation.isPending || !apiKeyInput.trim()}
                    className="border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 font-bold gap-2 text-xs"
                  >
                    {testGeminiMutation.isPending ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Zap size={14} />
                    )}
                    Test Gemini Connection ⚡
                  </Button>

                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 shadow-lg shadow-emerald-900/30"
                  >
                    {saveMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Smart Brain Context & Data Feeds */}
            <Card className="border-border/80 shadow-lg rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm">
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex items-center gap-2">
                  <Database className="text-teal-400" size={20} />
                  <CardTitle className="text-lg font-bold">Smart Brain Context & Real-Time Feeds</CardTitle>
                </div>
                <CardDescription>
                  Enable or disable real-time database context feeds injected into Gemini AI prompts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  
                  {/* Toggle 1: Live Products */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-secondary/20">
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <ShoppingBag size={14} className="text-emerald-400" />
                        <span>Live Catalog & Stock</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">All 29 farm-fresh produce with live prices & offers</p>
                    </div>
                    <Switch checked={enableProducts} onCheckedChange={setEnableProducts} />
                  </div>

                  {/* Toggle 2: Order Tracking */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-secondary/20">
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <ShieldCheck size={14} className="text-blue-400" />
                        <span>Live Order History</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Private tracking & dispatch status for signed-in user</p>
                    </div>
                    <Switch checked={enableOrders} onCheckedChange={setEnableOrders} />
                  </div>

                  {/* Toggle 3: Live Cart */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-secondary/20">
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <ShoppingBag size={14} className="text-amber-400" />
                        <span>Live Customer Cart</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Live cart item breakdown and free delivery threshold</p>
                    </div>
                    <Switch checked={enableCart} onCheckedChange={setEnableCart} />
                  </div>

                  {/* Toggle 4: Store Advertisements */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-secondary/20">
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <Sparkles size={14} className="text-purple-400" />
                        <span>Store Announcements & Ads</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Active promotions configured in Admin Ads section</p>
                    </div>
                    <Switch checked={enableAds} onCheckedChange={setEnableAds} />
                  </div>

                  {/* Toggle 5: Clinical Health Nutrition */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-secondary/20">
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <HeartPulse size={14} className="text-rose-400" />
                        <span>Clinical Nutrition Guide</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Accurate guidance for BP, Diabetes, Gut & Immunity</p>
                    </div>
                    <Switch checked={enableHealth} onCheckedChange={setEnableHealth} />
                  </div>

                  {/* Toggle 6: Creator Bio */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-secondary/20">
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <UserCheck size={14} className="text-teal-400" />
                        <span>Creator & Architect Bio</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Information for inquiries regarding Ganesh Varma</p>
                    </div>
                    <Switch checked={enableCreator} onCheckedChange={setEnableCreator} />
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* Card 3: Product Recommendations & Suggestions Engine */}
            <Card className="border-border/80 shadow-lg rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm">
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="text-emerald-400" size={20} />
                    <CardTitle className="text-lg font-bold">Product Suggestions & Spotlight Engine</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    {suggestionMode === "admin" ? "📌 Admin Controlled" : "🎲 Dynamic & Randomized"}
                  </Badge>
                </div>
                <CardDescription>
                  Choose whether Lakshmi AI dynamically suggests relevant randomized produce or exclusively spotlights admin-selected products.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {/* Mode Selector Tabs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSuggestionMode("smart")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      suggestionMode === "smart"
                        ? "bg-emerald-500/10 border-emerald-500 text-foreground ring-2 ring-emerald-500/20 shadow-sm"
                        : "bg-secondary/20 border-border/60 text-muted-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-foreground mb-1">
                      <Sparkles size={14} className="text-emerald-500" />
                      <span>Smart Dynamic & Random Rotation</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      AI analyzes customer queries and health intents, rotating across diverse fresh produce so returning customers see fresh recommendations every time.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSuggestionMode("admin")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      suggestionMode === "admin"
                        ? "bg-amber-500/10 border-amber-500 text-foreground ring-2 ring-amber-500/20 shadow-sm"
                        : "bg-secondary/20 border-border/60 text-muted-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-foreground mb-1">
                      <Sliders size={14} className="text-amber-500" />
                      <span>Admin-Controlled Spotlight</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Lock suggestion cards to specific handpicked products chosen below (e.g. seasonal pickles, mangoes, special combos).
                    </p>
                  </button>
                </div>

                {/* Admin-Controlled Product Picker */}
                {suggestionMode === "admin" && (
                  <div className="space-y-4 pt-2 border-t border-border/40 animate-in fade-in">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">
                        Search & Add Spotlight Products ({pinnedProductIds.length} Selected)
                      </Label>
                      <Input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search produce by English or Telugu name..."
                        className="h-10 text-xs bg-background/50 border-border/80"
                      />
                    </div>

                    {/* Filtered Product Quick-Add Chips */}
                    {productSearch.trim().length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-background/40 border border-border/60">
                        {allProducts
                          .filter((p: any) =>
                            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                            (p.nameTe && p.nameTe.includes(productSearch)) ||
                            (p.categorySlug && p.categorySlug.toLowerCase().includes(productSearch.toLowerCase()))
                          )
                          .slice(0, 8)
                          .map((p: any) => {
                            const isPinned = pinnedProductIds.includes(p.id);
                            return (
                              <div
                                key={p.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-card/60 border border-border/40 hover:bg-secondary/40 transition-colors text-xs"
                              >
                                <div className="flex items-center gap-2.5">
                                  {p.image && <img src={p.image} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />}
                                  <div>
                                    <span className="font-bold text-foreground">{p.name}</span>
                                    {p.nameTe && <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-1.5">({p.nameTe})</span>}
                                    <span className="text-muted-foreground ml-2">₹{p.price}</span>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant={isPinned ? "destructive" : "default"}
                                  className="h-7 text-[10px] font-bold"
                                  onClick={() => {
                                    if (isPinned) {
                                      setPinnedProductIds(pinnedProductIds.filter((id) => id !== p.id));
                                    } else {
                                      setPinnedProductIds([...pinnedProductIds, p.id]);
                                    }
                                  }}
                                >
                                  {isPinned ? "Remove" : "+ Add to Spotlight"}
                                </Button>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Selected Pinned Products Grid */}
                    {pinnedProductIds.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-foreground">
                          Currently Pinned Products (Shown in Lakshmi Chat):
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {pinnedProductIds.map((id) => {
                            const p = allProducts.find((item: any) => item.id === id);
                            if (!p) return null;
                            return (
                              <div
                                key={p.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-amber-500/30 shadow-sm"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {p.image && <img src={p.image} alt={p.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />}
                                  <div className="truncate">
                                    <p className="font-bold text-xs truncate">{p.name}</p>
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                                      {p.nameTe || `₹${p.price}`}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                                  onClick={() => setPinnedProductIds(pinnedProductIds.filter((item) => item !== p.id))}
                                >
                                  ✕
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-amber-500/40 text-center text-xs text-muted-foreground bg-amber-500/5">
                        No products pinned yet. Search above to add spotlight products!
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-xs"
                  >
                    Save Suggestion Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Custom System Persona & Instructions */}
            <Card className="border-border/80 shadow-lg rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm">
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="text-amber-400" size={20} />
                  <CardTitle className="text-lg font-bold">Custom System Persona & Directives</CardTitle>
                </div>
                <CardDescription>
                  Add custom behavioral directives for Lakshmi AI (e.g. tone, local festival greetings, special handling).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Example: Always greet warmly with 'Namaste from FarmFreshFarmer'. Emphasize Vijayawada 30-90 min farm delivery on all vegetable queries..."
                  className="min-h-[120px] font-mono text-xs border-border/80 bg-background/50 leading-relaxed"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-xs"
                  >
                    Save Persona Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT (1 COL): Live Interactive Test Playground */}
          <div className="space-y-6">
            <Card className="border-border/80 shadow-xl rounded-2xl overflow-hidden bg-card/80 backdrop-blur-md sticky top-6">
              <CardHeader className="border-b border-border/40 pb-3 bg-secondary/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="text-emerald-400" size={18} />
                    <CardTitle className="text-base font-bold">Live AI Playground</CardTitle>
                  </div>
                  {testLatency && (
                    <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/40">
                      ⚡ {testLatency}ms
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  Test prompt queries and verify Gemini answers live.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                
                {/* Language Select */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-semibold">Language:</span>
                  <div className="flex gap-1">
                    {(["en", "te", "hi"] as const).map((l) => (
                      <Button
                        key={l}
                        type="button"
                        size="sm"
                        variant={testLanguage === l ? "default" : "outline"}
                        onClick={() => setTestLanguage(l)}
                        className={`h-7 px-2.5 text-xs font-bold ${testLanguage === l ? "bg-emerald-600 text-white" : ""}`}
                      >
                        {l === "en" ? "English" : l === "te" ? "తెలుగు" : "हिंदी"}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Quick Test Prompt Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "what is ideal for high bp",
                    "sugar control foods",
                    "what is fresh today",
                    "who created you",
                    "what is in my cart",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setTestQuery(chip)}
                      className="text-[10px] px-2 py-1 rounded-lg border border-border/70 bg-secondary/40 hover:bg-secondary/80 text-foreground transition-all"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Query Input */}
                <div className="space-y-2">
                  <Input
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRunTestChat()}
                    placeholder="Type test question..."
                    className="text-xs h-10 border-border/80"
                  />
                  <Button
                    type="button"
                    onClick={handleRunTestChat}
                    disabled={isTestingChat || !testQuery.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs gap-1.5"
                  >
                    {isTestingChat ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                    Execute Gemini Test
                  </Button>
                </div>

                {/* Output Display Area */}
                <div className="min-h-[160px] p-3 rounded-xl border border-border/70 bg-background/80 text-xs font-sans whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                  {isTestingChat ? (
                    <div className="flex items-center justify-center h-28 text-muted-foreground gap-2">
                      <RefreshCw size={16} className="animate-spin text-emerald-400" />
                      <span>Thinking with Gemini...</span>
                    </div>
                  ) : testResponse ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-border/40 pb-1">
                        <span className="text-[10px] font-bold uppercase text-emerald-400">Gemini AI Output</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{testLatency}ms</span>
                      </div>
                      <p className="text-foreground">{testResponse}</p>
                    </div>
                  ) : (
                    <div className="text-muted-foreground/60 text-center py-8">
                      Type a query or pick a prompt chip above and click "Execute Gemini Test" to preview live responses.
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          </div>

        </div>

      </div>
    </AdminLayout>
  );
}
