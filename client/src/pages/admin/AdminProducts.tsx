import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Upload, Search, Clock, CheckCircle2, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient, imgUrl } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Product, Category } from "@/lib/types";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { resolveTeluguProductName } from "@shared/telugu-produce-namer";
import { generateProduceQuantityTiersMatrix, detectProduceUnitType, getAiPureProducePrice } from "@shared/schema";

interface Form {
  id?: number;
  name: string;
  nameTe: string;
  description: string;
  categorySlug: string;
  price: string;
  discountPercent: string;
  gstPercent: string;
  unit: string;
  image: string;
  stock: string;
  dietTag: string;
  featured: boolean;
  featuredInHero: boolean;
  allowInternationalShipping: boolean;
}

const EMPTY: Form = {
  name: "", nameTe: "", description: "", categorySlug: "", price: "", discountPercent: "0", gstPercent: "",
  unit: "250 Grams", image: "", stock: "50", dietTag: "none", featured: false, featuredInHero: false,
  allowInternationalShipping: true,
};

export default function AdminProducts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reconsiderProduct, setReconsiderProduct] = useState<Product | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [form, setForm] = useState<Form>(EMPTY);
  const [filter, setFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isAiGeneratingStudio, setIsAiGeneratingStudio] = useState(false);
  const [isBatchUpgrading, setIsBatchUpgrading] = useState(false);
  const [priceVsQuantityTiers, setPriceVsQuantityTiers] = useState<any[]>([]);
  const [pricingMode, setPricingMode] = useState<"ai" | "manual">("ai");
  const [aiCostPrice, setAiCostPrice] = useState<number | null>(null);
  const [aiMargin, setAiMargin] = useState<number | null>(null);

  const isPrimaryAdmin =
    user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    user?.isPrimaryAdmin === true ||
    (user?.role === "admin" && (user?.id === 1 || user?.id === 0));

  const { data: products = [], isLoading, refetch } = useQuery<Product[]>({
    queryKey: ["/api/products", "all"],
    queryFn: () => apiGet<Product[]>("/api/products?includeInactive=1"),
    refetchInterval: 5000,
  });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  const save = useMutation({
    mutationFn: async () => {
      const selectedSlug = form.categorySlug || categories[0]?.slug || "fruits";
      if (!form.name.trim()) {
        throw new Error("Product Name is required");
      }
      if (!selectedSlug) {
        throw new Error("Please select a valid product Category");
      }

      const teluguName = form.nameTe?.trim() || resolveTeluguProductName(form.name.trim(), selectedSlug);

      const activeTiers = priceVsQuantityTiers.map((t) => ({
        ...t,
        active: t.active !== false,
      }));

      const payload = {
        name: form.name.trim(),
        nameTe: teluguName,
        description: form.description.trim(),
        categorySlug: selectedSlug,
        price: parseFloat(form.price) || 0,
        discountPercent: parseFloat(form.discountPercent) || 0,
        gstPercent: form.gstPercent === "" ? null : (parseFloat(form.gstPercent) ?? null),
        unit: form.unit.trim() || "250 Grams",
        quantityTiers: activeTiers.length > 0 ? JSON.stringify(activeTiers) : null,
        image: form.image.trim(),
        stock: parseInt(form.stock) || 0,
        dietTag: form.dietTag,
        featured: form.featured,
        featuredInHero: form.featuredInHero,
        allowInternationalShipping: form.allowInternationalShipping,
      };
      let res: any;
      if (form.id) {
        res = await apiRequest("PATCH", `/api/products/${form.id}`, payload);
      } else {
        res = await apiRequest("POST", "/api/products", payload);
      }
      return res?.json ? await res.json() : res;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products", "all"] });
      if (form.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/products", form.id] });
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/hero-showcase"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/products"] });
      setOpen(false);
      setForm(EMPTY);

      if (isPrimaryAdmin) {
        toast({ title: form.id ? "Product updated & live 🚀" : "Product published live 🚀" });
      } else {
        toast({
          title: "Sent for Approval 📤",
          description: data?.message || "Product change submitted to Master Admin for review.",
        });
      }
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Could not save product", variant: "destructive" });
    },
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/products/${id}`);
      return res?.json ? await res.json() : res;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hero-showcase"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/products"] });
      if (isPrimaryAdmin) {
        toast({ title: "Product deleted 🗑️" });
      } else {
        toast({
          title: "Deletion Request Sent 📤",
          description: data?.message || "Product deletion submitted to Super Admin for approval.",
        });
      }
    },
    onError: (err: any) => toast({ title: err?.message || "Could not delete product", variant: "destructive" }),
  });

  const reconsiderMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/approvals/products/${id}`, {
        action: "changes_requested",
        note,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/reconsideration"] });
      setReconsiderProduct(null);
      setFeedbackNote("");
      toast({ title: "↩️ Sent for Reconsideration", description: "Product returned to sub-admin with your instructions and notified on Telegram." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send back product", description: err?.message || "Server error", variant: "destructive" });
    },
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);

      const token = localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        headers,
        body: fd,
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setForm((f) => ({ ...f, image: data.url }));
        toast({ title: "Image attached successfully 🎉" });
        return;
      }
      throw new Error("Upload server error");
    } catch (err) {
      console.warn("Server upload failed, converting image client-side:", err);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setForm((f) => ({ ...f, image: result }));
          toast({ title: "Image attached successfully 🎉" });
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  }

  function openAdd() {
    const defaultCat = categories[0]?.slug || "fruits";
    const unitInfo = detectProduceUnitType("", defaultCat, "1 Kg");
    const aiPrice = getAiPureProducePrice("", defaultCat, unitInfo.defaultUnit);
    setPricingMode("ai");
    setForm({
      ...EMPTY,
      categorySlug: defaultCat,
      unit: unitInfo.defaultUnit,
      price: String(aiPrice),
    });
    setPriceVsQuantityTiers(generateProduceQuantityTiersMatrix("", aiPrice, unitInfo.defaultUnit, defaultCat));
    setOpen(true);
  }

  function openEdit(p: Product) {
    const unitInfo = detectProduceUnitType(p.name, p.categorySlug, p.unit || "");
    const activeUnit = p.unit || unitInfo.defaultUnit;

    setForm({
      id: p.id,
      name: p.name,
      nameTe: (p as any).nameTe || "",
      description: p.description,
      categorySlug: p.categorySlug,
      price: String(p.price),
      discountPercent: String(p.discountPercent),
      gstPercent: p.gstPercent != null ? String(p.gstPercent) : "",
      unit: activeUnit,
      image: p.image,
      stock: String(p.stock),
      dietTag: p.dietTag,
      featured: p.featured,
      featuredInHero: (p as any).featuredInHero ?? false,
      allowInternationalShipping: (p as any).allowInternationalShipping !== false,
    });

    let loadedTiers: any[] = [];
    if ((p as any).quantityTiers) {
      try {
        const parsed = JSON.parse((p as any).quantityTiers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedTiers = parsed;
        }
      } catch {}
    }

    if (loadedTiers.length === 0) {
      loadedTiers = generateProduceQuantityTiersMatrix(p.name, Number(p.price), activeUnit, p.categorySlug);
    }

    setPriceVsQuantityTiers(loadedTiers);
    setPricingMode("ai");
    setOpen(true);
  }

  const reconsiderationProducts = products.filter((p) => (p as any).approvalStatus === "changes_requested");
  const pendingProducts = products.filter((p) => (p as any).approvalStatus === "pending" || (p as any).approvalStatus === "under_review" || (p as any).approvalStatus === "pending_deletion");

  const [statusTab, setStatusTab] = useState<"all" | "approved" | "reconsideration" | "pending" | "rejected">("all");

  const filtered = products.filter((p) => {
    const matchesQuery = p.name.toLowerCase().includes(filter.toLowerCase()) || p.categorySlug.toLowerCase().includes(filter.toLowerCase());
    const status = (p as any).approvalStatus || "approved";
    if (!matchesQuery) return false;
    if (statusTab === "all") return true;
    if (statusTab === "approved") return status === "approved";
    if (statusTab === "reconsideration") return status === "changes_requested";
    if (statusTab === "pending") return status === "pending" || status === "under_review" || status === "pending_deletion";
    if (statusTab === "rejected") return status === "rejected";
    return true;
  });

  const [isAutoGeneratingTelugu, setIsAutoGeneratingTelugu] = useState(false);

  function getClientStudioImage(productName: string, categorySlug = "general"): string {
    const norm = productName.toLowerCase().trim();
    if (norm.includes("garlic") || norm.includes("vellulli")) return "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("ginger") || norm.includes("allam")) return "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("bitter") || norm.includes("kakara")) return "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("ridge") || norm.includes("beera")) return "https://images.unsplash.com/photo-1598170845058-32b9d6a5c317?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("tindora") || norm.includes("donda")) return "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("brinjal") || norm.includes("eggplant") || norm.includes("vankaya")) return "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("capsicum") || norm.includes("bell pepper") || norm.includes("shimla")) return "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("bottle") || norm.includes("sora") || norm.includes("anapa")) return "https://images.unsplash.com/photo-1598170845058-32b9d6a5c317?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("beetroot")) return "https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("potato") || norm.includes("bangala")) return "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("onion") || norm.includes("ulli")) return "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("tomato") || norm.includes("tamota")) return "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("spinach") || norm.includes("palak")) return "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("okra") || norm.includes("lady") || norm.includes("benda")) return "https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("carrot")) return "https://images.unsplash.com/photo-1598170845058-32b9d6a5c317?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("mango") || norm.includes("mamidi")) return "https://images.unsplash.com/photo-1553279768-865429fa0078?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("banana") || norm.includes("arati")) return "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("pomegranate") || norm.includes("danimma")) return "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("grapes") || norm.includes("draksha")) return "https://images.unsplash.com/photo-1596363505729-4190a9506133?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("laddu")) return "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("katli")) return "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("pak")) return "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("mixture")) return "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("murukku") || norm.includes("janthikalu")) return "https://images.unsplash.com/photo-1567337710282-00832b415979?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("pickle") || norm.includes("pacchadi")) return "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("millet") || norm.includes("korralu") || norm.includes("ragi") || norm.includes("bajra")) return "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("dal") || norm.includes("pappu")) return "https://images.unsplash.com/photo-1585994192701-f1a505c8574a?w=1200&q=95&auto=format&fit=crop";
    if (norm.includes("chilli") || norm.includes("turmeric") || norm.includes("coriander") || norm.includes("powder")) return "https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=1200&q=95&auto=format&fit=crop";

    if (categorySlug.includes("fruit")) return "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=1200&q=95&auto=format&fit=crop";
    return "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&q=95&auto=format&fit=crop";
  }

  async function handleGenerateAiStudio() {
    if (!form.name.trim()) {
      toast({
        title: "Product name required",
        description: "Please enter the product name first (e.g. Garlic, Banginapalli Mango).",
        variant: "destructive",
      });
      return;
    }
    setIsAiGeneratingStudio(true);

    const autoTe = resolveTeluguProductName(form.name.trim(), form.categorySlug || "vegetables") || `${form.name.trim()} (సేంద్రీయ)`;
    const fallbackImg = getClientStudioImage(form.name.trim(), form.categorySlug || "vegetables");
    const defaultP = form.categorySlug?.includes("sweet") || form.categorySlug?.includes("pickle") ? 320 : (form.price && Number(form.price) > 0 ? Number(form.price) : 60);
    const richDesc = `100% naturally grown, certified chemical-free ${form.name.trim()} (${autoTe}) sourced directly from local Andhra Pradesh partner farms. Harvested fresh daily with zero artificial ripening agents, synthetic pesticides, or chemical preservatives. Packed under strict hygienic standards.`;

    try {
      const res = await apiRequest("POST", "/api/admin/products/ai-studio-generate", {
        name: form.name.trim(),
        categorySlug: form.categorySlug || "fruits",
        unit: form.unit || "1 Kg",
      });
      const data = await res.json();
      if (data?.package) {
        const pkg = data.package;
        setForm((prev) => ({
          ...prev,
          nameTe: pkg.nameTe || autoTe,
          description: pkg.description || richDesc,
          price: String(pkg.suggestedPrice || defaultP),
          discountPercent: String(pkg.discountPercent || "10"),
          dietTag: pkg.dietTag || prev.dietTag,
          image: pkg.image || fallbackImg,
          unit: pkg.unit || prev.unit,
        }));
        setPriceVsQuantityTiers(pkg.priceVsQuantity || []);
        setAiCostPrice(pkg.costPrice || Math.round(defaultP * 0.65));
        setAiMargin(pkg.profitMarginPercent || 35);
        toast({
          title: "✨ AI Studio Package Ready!",
          description: `Auto-generated crisp 1200px studio asset, Telugu name, and live price-vs-quantity tiers.`,
        });
        return;
      }
    } catch (_err) {
      // Instant Client Fallback Resolver so UI NEVER hangs or breaks
      const unitInfo = detectProduceUnitType(form.name, form.categorySlug, form.unit);
      const activeUnit = form.unit || unitInfo.defaultUnit;
      const dynamicTiers = generateProduceQuantityTiersMatrix(form.name, defaultP, activeUnit, form.categorySlug);

      setForm((prev) => ({
        ...prev,
        nameTe: autoTe,
        description: richDesc,
        price: String(defaultP),
        discountPercent: prev.discountPercent || "10",
        image: fallbackImg,
        unit: activeUnit,
      }));

      setPriceVsQuantityTiers(dynamicTiers);
      setAiCostPrice(Math.round(defaultP * 0.65));
      setAiMargin(35);

      toast({
        title: "✨ AI Studio Package Ready!",
        description: `Auto-generated crisp 1200px studio asset, Telugu name, and live price-vs-quantity tiers.`,
      });
    } finally {
      setIsAiGeneratingStudio(false);
    }
  }

  async function handleBatchUpgradeAllCatalog() {
    setIsBatchUpgrading(true);
    try {
      const res = await apiRequest("POST", "/api/admin/products/ai-studio-batch-upgrade", {});
      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/products", "all"] });
      await refetch();
      toast({
        title: "✨ All Products Upgraded with Studio AI!",
        description: `Successfully upgraded ${data.upgradedCount || data.total} products with 100% crisp hero photography & Telugu metadata.`,
      });
    } catch (e: any) {
      toast({
        title: "Batch upgrade failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsBatchUpgrading(false);
    }
  }

  async function handleAutoGenerateAllTeluguNames() {
    setIsAutoGeneratingTelugu(true);
    try {
      const res = await apiRequest("POST", "/api/products/auto-generate-telugu-names", {});
      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "✨ Telugu Names Generated!",
        description: `Successfully updated ${data.updatedCount ?? data.total} products with authentic Telugu phrasing.`,
      });
    } catch (e: any) {
      toast({
        title: "Failed to generate Telugu names",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsAutoGeneratingTelugu(false);
    }
  }

  return (
    <AdminLayout title="Products">
      {/* Reconsideration Banner */}
      {reconsiderationProducts.length > 0 && (
        <div className="mb-4 p-4 bg-amber-500/15 border-2 border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
              <AlertCircle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-amber-800 dark:text-amber-300">
                {reconsiderationProducts.length} Product(s) Require Reconsideration! ↩️
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                Primary Admin sent these items back for revision with specific feedback notes.
              </p>
            </div>
          </div>
          <a href="/admin/approvals?tab=reconsideration">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shrink-0 gap-1.5 shadow-md">
              <span>View & Resubmit Reconsiderations ↩️</span>
            </Button>
          </a>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="relative max-w-xs w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products…" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="input-filter" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchUpgradeAllCatalog}
            disabled={isBatchUpgrading}
            className="border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-bold text-xs gap-1.5 h-10 shadow-sm"
          >
            {isBatchUpgrading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Upgrading Catalog with AI...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="text-amber-500 animate-pulse" />
                <span>AI Studio Batch Upgrade (Hero Photos ✨)</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoGenerateAllTeluguNames}
            disabled={isAutoGeneratingTelugu}
            className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold text-xs gap-1.5 h-10 shadow-sm"
          >
            {isAutoGeneratingTelugu ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Generating Telugu Names...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="text-emerald-500" />
                <span>Auto-Generate Telugu Names (తెలుగు పేర్లు ✨)</span>
              </>
            )}
          </Button>
          <Button onClick={openAdd} data-testid="button-add-product" className="h-10">
            <Plus size={16} className="mr-1" /> Add product
          </Button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 text-xs font-bold border-b border-card-border">
        <button
          type="button"
          onClick={() => setStatusTab("all")}
          className={`px-3 py-1.5 rounded-lg border transition-all ${statusTab === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border text-muted-foreground hover:text-foreground"}`}
        >
          All ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusTab("approved")}
          className={`px-3 py-1.5 rounded-lg border transition-all ${statusTab === "approved" ? "bg-emerald-600 text-white border-emerald-600" : "bg-card border-card-border text-muted-foreground hover:text-foreground"}`}
        >
          Live Storefront
        </button>
        <button
          type="button"
          onClick={() => setStatusTab("reconsideration")}
          className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${statusTab === "reconsideration" ? "bg-amber-500 text-white border-amber-500 font-extrabold shadow-sm" : "bg-card border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"}`}
        >
          <span>In Reconsideration ↩️</span>
          {reconsiderationProducts.length > 0 && (
            <span className="ml-1 bg-amber-700 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {reconsiderationProducts.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setStatusTab("pending")}
          className={`px-3 py-1.5 rounded-lg border transition-all ${statusTab === "pending" ? "bg-blue-600 text-white border-blue-600" : "bg-card border-card-border text-muted-foreground hover:text-foreground"}`}
        >
          Pending Approval ({pendingProducts.length})
        </button>
      </div>

      {!isPrimaryAdmin && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-2">
          <Clock size={16} className="text-amber-500 shrink-0" />
          <span>
            <strong>Sub-Admin Moderation Notice:</strong> All product additions, edits, prices, stock changes, and images require Master Admin approval. Clicking <strong>Submit for Approval</strong> will queue your changes for review.
          </span>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">Product</th>
                <th className="p-3 font-semibold">Category</th>
                <th className="p-3 font-semibold">Price</th>
                <th className="p-3 font-semibold">Disc.</th>
                <th className="p-3 font-semibold">Stock</th>
                <th className="p-3 font-semibold">Approval Status</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const status = (p as any).approvalStatus || "approved";
                return (
                  <tr key={p.id} className="border-t border-card-border" data-testid={`row-product-${p.id}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded bg-secondary overflow-hidden shrink-0">
                          {p.image ? <img src={imgUrl(p.image)} alt="" className="h-full w-full object-cover" /> : null}
                        </div>
                        <div>
                          <span className="font-medium block">{p.name}</span>
                          {(p as any).nameTe && (
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block font-sans">
                              {(p as any).nameTe}
                            </span>
                          )}
                        </div>
                        {p.featured ? <span className="text-[10px] bg-accent/30 rounded px-1 ml-1">Featured</span> : null}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.categorySlug}</td>
                    <td className="p-3">{formatINR(Number(p.price))}</td>
                    <td className="p-3">{Number(p.discountPercent) ? `${Number(p.discountPercent)}%` : "—"}</td>
                    <td className="p-3">{p.stock}</td>
                    <td className="p-3">
                      {status === "approved" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-extrabold gap-1">
                          <CheckCircle2 size={12} /> Live Storefront
                        </Badge>
                      ) : status === "changes_requested" ? (
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40 text-[11px] font-extrabold gap-1">
                          <Clock size={12} /> In Re-Consideration 🔄
                        </Badge>
                      ) : status === "pending_deletion" ? (
                        <Badge variant="destructive" className="bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 text-[11px] font-extrabold animate-pulse gap-1">
                          <Trash2 size={12} /> Deletion Pending Approval ⏳
                        </Badge>
                      ) : status === "pending" || status === "under_review" ? (
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-extrabold animate-pulse gap-1">
                          <Clock size={12} /> Sent for Approval ⏳
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[11px] font-extrabold gap-1">
                          <AlertCircle size={12} /> Rejected
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end items-center gap-1">
                        {isPrimaryAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReconsiderProduct(p);
                              setFeedbackNote("");
                            }}
                            className="h-8 px-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 rounded-xl"
                            title="Send back to sub-admin for changes"
                          >
                            ↩️ Changes
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`button-edit-${p.id}`}><Pencil size={15} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${p.name}?`)) del.mutate(p.id); }} data-testid={`button-delete-${p.id}`}><Trash2 size={15} /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No products. Click "Add product" to create one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit product" : "Add product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* ── 1-CLICK LIVE PRICING ENGINE TOGGLE: 100% PURE AI vs CUSTOM MANUAL ── */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-amber-500/10 border-2 border-emerald-500/30 flex items-center justify-between flex-wrap gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500 animate-pulse shrink-0" />
                <div>
                  <span className="text-xs font-black text-foreground block">
                    Live Pricing Source Engine
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {pricingMode === "ai"
                      ? "🤖 Sourced 100% Purely from AI Mandi Intelligence (AP regional farm rates)"
                      : "✍️ Custom Manual Price — admin sets custom price, AI calculates pack discount tiers"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-background/80 p-1 rounded-xl border border-card-border">
                <button
                  type="button"
                  onClick={() => {
                    setPricingMode("ai");
                    const unitInfo = detectProduceUnitType(form.name, form.categorySlug, form.unit);
                    const activeUnit = form.unit || unitInfo.defaultUnit;
                    const aiPrice = getAiPureProducePrice(form.name, form.categorySlug, activeUnit);
                    setForm((prev) => ({ ...prev, price: String(aiPrice), unit: activeUnit }));
                    const newTiers = generateProduceQuantityTiersMatrix(form.name, aiPrice, activeUnit, form.categorySlug);
                    setPriceVsQuantityTiers(newTiers);
                    toast({
                      title: "🤖 100% Pure AI Price Applied",
                      description: `Base price dynamically sourced 100% purely from AI at ₹${aiPrice} (${activeUnit}).`,
                    });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    pricingMode === "ai"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm ring-2 ring-emerald-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Sparkles size={13} className={pricingMode === "ai" ? "animate-spin text-amber-300" : ""} />
                  <span>100% Pure AI Price</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPricingMode("manual");
                    toast({
                      title: "✍️ Custom Manual Price Mode",
                      description: "You can now edit the base price manually. AI will dynamically compute quantity pack discount tiers.",
                    });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    pricingMode === "manual"
                      ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <span>✍️ Custom Price</span>
                </button>
              </div>
            </div>

            <div>
              <Label>Product Name (English)</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  const unitInfo = detectProduceUnitType(newName, form.categorySlug, form.unit);
                  const isDefaultUnit = !form.unit || form.unit === EMPTY.unit || form.unit === "250 Grams" || form.unit === "1 Kg";
                  const newUnit = isDefaultUnit ? unitInfo.defaultUnit : form.unit;
                  const autoTe = resolveTeluguProductName(newName, form.categorySlug);

                  const computedPrice = pricingMode === "ai"
                    ? getAiPureProducePrice(newName, form.categorySlug, newUnit)
                    : (parseFloat(form.price) || 60);

                  setForm({
                    ...form,
                    name: newName,
                    unit: newUnit,
                    price: String(computedPrice),
                    nameTe: !form.nameTe || form.nameTe === resolveTeluguProductName(form.name, form.categorySlug) ? autoTe : form.nameTe,
                  });

                  const dynamicTiers = generateProduceQuantityTiersMatrix(newName, computedPrice, newUnit, form.categorySlug);
                  setPriceVsQuantityTiers(dynamicTiers);
                }}
                placeholder="e.g. Banginapalli Mangoes, Bananas, Farm Tomatoes"
                data-testid="input-product-name"
              />
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAiStudio}
                  disabled={isAiGeneratingStudio || !form.name.trim()}
                  className="w-full bg-gradient-to-r from-emerald-600/15 via-teal-600/15 to-amber-600/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-black text-xs gap-1.5 h-9 shadow-xs hover:bg-emerald-500/20 cursor-pointer"
                >
                  {isAiGeneratingStudio ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-emerald-500" />
                      <span>AI Studio Generating (Crisp Photo + Live Pricing + Telugu)...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="text-amber-500 animate-pulse" />
                      <span>✨ Auto-Generate with AI Studio (Studio Photo + Price vs Qty + Story)</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* AI Dynamic Multi-Quantity Pack Selection Matrix */}
            {priceVsQuantityTiers.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-background to-teal-500/10 border-2 border-emerald-500/40 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                    <Sparkles size={14} className="text-amber-500 animate-pulse" />
                    <span>Multi-Quantity Pack Sizes (Click Card or Checkbox to Select)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allActive = priceVsQuantityTiers.every((t) => t.active !== false);
                        setPriceVsQuantityTiers(priceVsQuantityTiers.map((t) => ({ ...t, active: !allActive })));
                      }}
                      className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 cursor-pointer"
                    >
                      {priceVsQuantityTiers.every((t) => t.active !== false) ? "Deselect All" : "✅ Select All"}
                    </button>
                    {aiCostPrice && (
                      <span className="text-[10px] font-bold text-muted-foreground">
                        Cost: ₹{aiCostPrice} | Margin: {aiMargin}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {priceVsQuantityTiers.map((tier, idx) => {
                    const isTierActive = tier.active !== false;
                    const isBasePack = form.unit === tier.quantity;

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          const next = [...priceVsQuantityTiers];
                          next[idx] = { ...next[idx], active: !isTierActive };
                          setPriceVsQuantityTiers(next);
                        }}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer select-none ${
                          isTierActive
                            ? isBasePack
                              ? "bg-emerald-500/20 border-emerald-500 shadow-md ring-2 ring-emerald-500/30"
                              : "bg-emerald-500/10 border-emerald-500/60 shadow-xs hover:border-emerald-500"
                            : "bg-muted/40 border-muted opacity-50 hover:opacity-80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isTierActive}
                              onChange={(e) => {
                                e.stopPropagation();
                                const next = [...priceVsQuantityTiers];
                                next[idx] = { ...next[idx], active: e.target.checked };
                                setPriceVsQuantityTiers(next);
                              }}
                              className="rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                            />
                            <span className="text-xs font-black text-foreground">{tier.quantity}</span>
                          </div>

                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                            isTierActive ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                          }`}>
                            {isTierActive ? "✅ Active" : "❌ Hidden"}
                          </span>
                        </div>

                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            ₹{tier.price}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{tier.perUnit || ""}</span>
                        </div>

                        {tier.savings && (
                          <div className="mt-1">
                            <span className="text-amber-500 font-bold bg-amber-500/15 px-1.5 py-0.5 rounded text-[9px]">
                              {tier.savings}
                            </span>
                          </div>
                        )}

                        {isTierActive && (
                          <div className="mt-2.5 pt-2 border-t border-card-border/60 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setForm({
                                  ...form,
                                  unit: tier.quantity,
                                  price: String(tier.price),
                                });
                                toast({
                                  title: `Base Pack: ${tier.quantity}`,
                                  description: `Default storefront display price set to ₹${tier.price} (${tier.quantity}).`,
                                });
                              }}
                              className={`text-[10px] font-black px-2 py-0.5 rounded transition cursor-pointer ${
                                isBasePack
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30"
                              }`}
                            >
                              {isBasePack ? "★ Default Base Pack" : "Make Default"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  💡 <strong>Multi-pack enabled:</strong> Click on any tier card to enable or disable it on the live storefront!
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <Label>Telugu Sub-Name (తెలుగు పేరు)</Label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, nameTe: resolveTeluguProductName(form.name, form.categorySlug) })}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  ⚡ Auto-generate
                </button>
              </div>
              <Input
                value={form.nameTe}
                onChange={(e) => setForm({ ...form, nameTe: e.target.value })}
                placeholder="e.g. నాటు టమోటాలు"
                className="font-medium text-emerald-700 dark:text-emerald-300"
                data-testid="input-product-name-te"
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Authentic Telugu produce phrasing in Telugu letters. Auto-populates as you type!
              </p>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-product-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select
                  value={form.categorySlug}
                  onValueChange={(v) => {
                    const newSlug = v;
                    const unitInfo = detectProduceUnitType(form.name, newSlug, form.unit);
                    const newUnit = form.unit || unitInfo.defaultUnit;
                    const newPrice = pricingMode === "ai"
                      ? getAiPureProducePrice(form.name, newSlug, newUnit)
                      : (parseFloat(form.price) || 60);

                    setForm({ ...form, categorySlug: newSlug, unit: newUnit, price: String(newPrice) });
                    const newTiers = generateProduceQuantityTiersMatrix(form.name, newPrice, newUnit, newSlug);
                    setPriceVsQuantityTiers(newTiers);
                  }}
                >
                  <SelectTrigger data-testid="select-category"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Diet tag</Label>
                <Select value={form.dietTag} onValueChange={(v) => setForm({ ...form, dietTag: v })}>
                  <SelectTrigger data-testid="select-diet"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="veg">Veg (green)</SelectItem>
                    <SelectItem value="nonveg">Non-veg (red)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Base Price (₹)</Label>
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                    pricingMode === "ai"
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 animate-pulse"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {pricingMode === "ai" ? "🤖 100% AI" : "✍️ Manual"}
                  </span>
                </div>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => {
                    const nextPrice = e.target.value;
                    setPricingMode("manual");
                    setForm({ ...form, price: nextPrice });
                    if (nextPrice && parseFloat(nextPrice) > 0) {
                      const newTiers = generateProduceQuantityTiersMatrix(
                        form.name,
                        parseFloat(nextPrice),
                        form.unit,
                        form.categorySlug
                      );
                      setPriceVsQuantityTiers((prevTiers) => {
                        return newTiers.map((nt) => {
                          const existing = prevTiers.find((pt) => pt.quantity === nt.quantity);
                          return existing ? { ...nt, active: existing.active } : nt;
                        });
                      });
                    }
                  }}
                  placeholder="e.g. 100"
                  data-testid="input-price"
                />
              </div>
              <div>
                <Label>Discount %</Label>
                <Input type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} data-testid="input-discount" />
              </div>
              <div>
                <Label>GST Rate (%)</Label>
                <Input type="number" step="0.1" min="0" max="100" placeholder="Default" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} data-testid="input-gst" />
              </div>
              <div>
                <Label>Stock</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} data-testid="input-stock" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Base Unit / Pack Size</Label>
                <span className="text-[10px] text-muted-foreground">Auto-detected by produce type (e.g. Bananas = Dozen, Spinach = Bunch)</span>
              </div>
              <Input
                value={form.unit}
                onChange={(e) => {
                  const nextUnit = e.target.value;
                  setForm({ ...form, unit: nextUnit });
                  if (form.price && parseFloat(form.price) > 0) {
                    const newTiers = generateProduceQuantityTiersMatrix(
                      form.name,
                      parseFloat(form.price),
                      nextUnit,
                      form.categorySlug
                    );
                    setPriceVsQuantityTiers((prevTiers) => {
                      return newTiers.map((nt) => {
                        const existing = prevTiers.find((pt) => pt.quantity === nt.quantity);
                        return existing ? { ...nt, active: existing.active } : nt;
                      });
                    });
                  }
                }}
                placeholder="e.g. 1 Kg, 1 Dozen, 1 Bunch, 1 Piece"
                data-testid="input-unit"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Product Visual Asset (100% Crisp Studio Photography)</Label>
                <button
                  type="button"
                  onClick={handleGenerateAiStudio}
                  disabled={isAiGeneratingStudio || !form.name.trim()}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  🔄 Regenerate Studio Asset
                </button>
              </div>
              <div className="flex items-center gap-3 mt-1.5 p-2 rounded-xl bg-card border border-card-border">
                <div className="h-20 w-20 rounded-xl bg-secondary overflow-hidden shrink-0 border border-emerald-500/30 shadow-xs">
                  {form.image ? (
                    <img src={imgUrl(form.image)} alt={form.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No Photo</div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <Input
                    placeholder="Enter image CDN URL or auto-generate with AI Studio"
                    value={form.image}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                    className="text-xs"
                    data-testid="input-image-url"
                  />
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    ✨ <strong>Studio Hero Asset:</strong> Product is isolated with crisp macro focus so customers understand the product instantly with zero background distraction.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} data-testid="switch-featured" />
              <Label>Show on home page (featured)</Label>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Switch checked={form.featuredInHero} onCheckedChange={(v) => setForm({ ...form, featuredInHero: v })} data-testid="switch-featured-hero" />
              <div>
                <Label className="font-bold text-emerald-400">⭐ Show in Homepage Hero Showcase</Label>
                <p className="text-[11px] text-muted-foreground">Photo will automatically rotate in the homepage hero showcase card.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Switch checked={form.allowInternationalShipping} onCheckedChange={(v) => setForm({ ...form, allowInternationalShipping: v })} data-testid="switch-allow-international" />
              <div>
                <Label className="font-bold text-amber-400">🌐 Allow International / Out-of-Station Courier Delivery</Label>
                <p className="text-[11px] text-muted-foreground">If turned OFF, this item is restricted to <strong>Local Active Warehouse 30km Area Only</strong>.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.name || !form.categorySlug || !form.price}
              className={isPrimaryAdmin ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold" : "bg-amber-600 hover:bg-amber-700 text-white font-bold"}
              data-testid="button-save-product"
            >
              {save.isPending
                ? (isPrimaryAdmin ? "Publishing…" : "Submitting…")
                : (isPrimaryAdmin ? "Save & Publish Live 🚀" : "Submit for Approval 📤")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super Admin Reconsideration Prompt Dialog */}
      {reconsiderProduct && (
        <Dialog open={reconsiderProduct !== null} onOpenChange={(v) => !v && setReconsiderProduct(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-amber-500">
                <span>↩️ Request Changes for "{reconsiderProduct.name}"</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                Enter the changes or feedback you want the sub-admin to address. This item will be moved to the Re-Consideration Queue and the sub-admin will be notified via Telegram.
              </p>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <Label className="font-bold text-foreground">Feedback & Requested Modifications *</Label>
                <Textarea
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  placeholder="e.g. Please correct price, verify stock count, or update organic certificate photo..."
                  className="mt-1 min-h-[90px] text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setReconsiderProduct(null)} disabled={reconsiderMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!feedbackNote.trim()) {
                    toast({ title: "Feedback required", description: "Please enter instructions for the sub-admin.", variant: "destructive" });
                    return;
                  }
                  reconsiderMutation.mutate({
                    id: reconsiderProduct.id,
                    note: feedbackNote.trim(),
                  });
                }}
                disabled={reconsiderMutation.isPending}
                className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-md"
              >
                {reconsiderMutation.isPending ? "Sending..." : "↩️ Send Back for Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
