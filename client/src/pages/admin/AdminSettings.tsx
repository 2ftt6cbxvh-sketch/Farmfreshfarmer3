import { useEffect, useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, Percent, Gift, Truck, Store, Save, MapPin, Plus, Trash2, CreditCard, Sparkles, Upload } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiGet, apiRequest, queryClient, imgUrl } from "@/lib/queryClient";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SettingsMap = Record<string, string>;

interface DeliveryCity {
  name: string;
  charge: number;
  freeAbove: number;
}
interface DeliveryRules {
  enabled: boolean;
  cities: DeliveryCity[];
}

function parseDelivery(raw: string | undefined): DeliveryRules {
  if (!raw) return { enabled: false, cities: [] };
  try {
    const p = JSON.parse(raw);
    const cities: DeliveryCity[] = Array.isArray(p?.cities)
      ? p.cities.map((c: any) => ({
          name: String(c?.name ?? ""),
          charge: Number(c?.charge) || 0,
          freeAbove: Number(c?.freeAbove) || 0,
        }))
      : [];
    return { enabled: p?.enabled !== false, cities };
  } catch {
    return { enabled: false, cities: [] };
  }
}

/** Editor for per-city delivery charges. Reads/writes the `delivery_rules`
 *  JSON setting via the shared settings form. */
function DeliveryRulesEditor({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (json: string) => void;
}) {
  const rules = parseDelivery(value);
  const commit = (next: DeliveryRules) => onChange(JSON.stringify(next));

  const setEnabled = (enabled: boolean) => commit({ ...rules, enabled });
  const addCity = () => commit({ ...rules, cities: [...rules.cities, { name: "", charge: 0, freeAbove: 0 }] });
  const removeCity = (idx: number) => commit({ ...rules, cities: rules.cities.filter((_, i) => i !== idx) });
  const updateCity = (idx: number, patch: Partial<DeliveryCity>) =>
    commit({ ...rules, cities: rules.cities.map((c, i) => (i === idx ? { ...c, ...patch } : c)) });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between py-2">
        <Label htmlFor="set-delivery-enabled" className="cursor-pointer">Enable per-city delivery charges</Label>
        <Switch
          id="set-delivery-enabled"
          checked={rules.enabled}
          onCheckedChange={setEnabled}
          data-testid="switch-delivery-enabled"
        />
      </div>

      {rules.enabled && (
        <>
          <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
            <div className="col-span-5">City</div>
            <div className="col-span-3">Charge (₹)</div>
            <div className="col-span-3">Free above (₹)</div>
            <div className="col-span-1" />
          </div>
          {rules.cities.length === 0 && (
            <p className="text-sm text-muted-foreground">No cities yet. Add your first serviceable city below.</p>
          )}
          {rules.cities.map((c, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Input
                className="col-span-5"
                placeholder="City name"
                value={c.name}
                onChange={(e) => updateCity(idx, { name: e.target.value })}
                data-testid={`input-city-name-${idx}`}
              />
              <Input
                className="col-span-3"
                type="number"
                min={0}
                placeholder="0"
                value={String(c.charge)}
                onChange={(e) => updateCity(idx, { charge: Number(e.target.value) || 0 })}
                data-testid={`input-city-charge-${idx}`}
              />
              <Input
                className="col-span-3"
                type="number"
                min={0}
                placeholder="0 = never free"
                value={String(c.freeAbove)}
                onChange={(e) => updateCity(idx, { freeAbove: Number(e.target.value) || 0 })}
                data-testid={`input-city-freeabove-${idx}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-span-1"
                onClick={() => removeCity(idx)}
                aria-label="Remove city"
                data-testid={`button-remove-city-${idx}`}
              >
                <Trash2 size={16} className="text-destructive" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addCity} data-testid="button-add-city">
            <Plus size={14} className="mr-1" /> Add city
          </Button>
          <p className="text-xs text-muted-foreground">
            Charge applies at checkout when the customer picks that city. Set “Free above” to the
            cart value at which delivery becomes free (0 = charge always applies). Remember to press
            “Save changes” above.
          </p>
        </>
      )}
    </div>
  );
}

function SearchRecommendationsManager() {
  const { toast } = useToast();
  const [newTag, setNewTag] = useState("");

  const { data, refetch } = useQuery<{ recommendations: string[] }>({
    queryKey: ["/api/admin/search-recommendations"],
    queryFn: () => apiGet("/api/admin/search-recommendations"),
  });

  const recommendations: string[] = data?.recommendations || [];

  const updateMutation = useMutation({
    mutationFn: (recs: string[]) => apiRequest("POST", "/api/admin/search-recommendations", { recommendations: recs }),
    onSuccess: () => {
      toast({ title: "Search recommendations updated!" });
      refetch();
    },
  });

  const addTag = () => {
    if (!newTag.trim()) return;
    const next = [...recommendations, newTag.trim()];
    updateMutation.mutate(next);
    setNewTag("");
  };

  const removeTag = (idx: number) => {
    const next = recommendations.filter((_, i) => i !== idx);
    updateMutation.mutate(next);
  };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-card p-6 space-y-4 shadow-md">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-400" />
        <h2 className="font-serif text-lg font-bold">Search Recommendations Manager</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Customize trending search suggestions displayed when customers click or type in the header search bar.
      </p>

      <div className="flex gap-2">
        <Input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="e.g. Alphonso Mango, Avakaya Pickle..."
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
        />
        <Button onClick={addTag} className="bg-emerald-600 hover:bg-emerald-500 font-bold">
          <Plus className="w-4 h-4 mr-1" /> Add Tag
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {recommendations.map((tag, idx) => (
          <span key={idx} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-full text-xs font-bold shadow-sm">
            {tag}
            <button onClick={() => removeTag(idx)} className="hover:text-destructive text-muted-foreground ml-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function HeroShowcaseCustomizer() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState("featured_products");
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customSubtitle, setCustomSubtitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["/api/hero-showcase"],
    queryFn: async () => {
      const res = await fetch("/api/hero-showcase");
      return res.json();
    },
  });

  useEffect(() => {
    if (data) {
      setMode(data.mode || "featured_products");
      setCustomImageUrl(data.customImageUrl || "");
      setCustomTitle(data.customTitle || "Direct Farm Harvest");
      setCustomSubtitle(data.customSubtitle || "Picked this morning");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/hero-showcase/settings", {
        mode,
        customImageUrl: customImageUrl.trim(),
        customTitle: customTitle.trim(),
        customSubtitle: customSubtitle.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Hero Showcase Settings Saved!" });
      queryClient.invalidateQueries({ queryKey: ["/api/hero-showcase"] });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Could not save hero settings", description: err.message, variant: "destructive" });
    },
  });

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/admin/hero-showcase/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: localStorage.getItem("accessToken") ? { Authorization: `Bearer ${localStorage.getItem("accessToken")}` } : undefined,
      });
      if (!res.ok) throw new Error("Image upload failed");
      const result = await res.json();
      setCustomImageUrl(result.imageUrl);
      setMode("custom_image");
      toast({ title: "Custom photo uploaded & activated!" });
      queryClient.invalidateQueries({ queryKey: ["/api/hero-showcase"] });
      refetch();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const featuredProducts = data?.featuredProducts || [];

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-card p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Sparkles className="w-5 h-5 text-amber-400" /> Homepage Hero Showcase Card Manager
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose whether to automatically rotate through selected product photos or display a single custom image from an internet URL or your device.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-500 font-bold gap-2">
          <Save size={16} /> {saveMutation.isPending ? "Saving…" : "Save Showcase"}
        </Button>
      </div>

      <div className="space-y-4">
        {/* Mode Selector */}
        <div>
          <Label className="font-bold">Showcase Mode</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <button
              type="button"
              onClick={() => setMode("featured_products")}
              className={`p-4 rounded-xl border text-left transition-all ${
                mode === "featured_products"
                  ? "border-emerald-500 bg-emerald-500/15 font-bold shadow-lg"
                  : "border-card-border bg-secondary/30 hover:bg-secondary/50"
              }`}
            >
              <p className="text-sm font-bold flex items-center gap-2">
                <span>📸 Featured Products Carousel</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Rotates photos of products toggled ON in Products page ({featuredProducts.length} selected).
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("custom_image")}
              className={`p-4 rounded-xl border text-left transition-all ${
                mode === "custom_image"
                  ? "border-emerald-500 bg-emerald-500/15 font-bold shadow-lg"
                  : "border-card-border bg-secondary/30 hover:bg-secondary/50"
              }`}
            >
              <p className="text-sm font-bold flex items-center gap-2">
                <span>🖼️ Custom Image (URL or Device Upload)</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Displays a single custom photo of your choice from an internet URL or uploaded from your computer.
              </p>
            </button>
          </div>
        </div>

        {/* Custom Image Controls */}
        {mode === "custom_image" && (
          <div className="p-4 rounded-xl bg-secondary/30 border border-emerald-500/20 space-y-4">
            <h3 className="text-sm font-bold text-emerald-400">Custom Photo Options</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Photo Source (Internet URL or Device Upload)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="https://example.com/mango.jpg or upload..."
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="shrink-0"
                  >
                    <Upload size={15} className="mr-1" /> {uploading ? "Uploading…" : "Upload File"}
                  </Button>
                </div>
              </div>

              <div>
                <Label>Card Badge Title</Label>
                <Input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Direct Farm Harvest" className="mt-1" />
              </div>

              <div className="md:col-span-2">
                <Label>Card Badge Subtitle</Label>
                <Input value={customSubtitle} onChange={(e) => setCustomSubtitle(e.target.value)} placeholder="Picked this morning" className="mt-1" />
              </div>
            </div>
          </div>
        )}

        {/* Active Hero Showcase Preview */}
        <div className="p-4 rounded-xl bg-card border border-card-border">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Hero Showcase Items</Label>
          {mode === "featured_products" ? (
            <div className="flex flex-wrap gap-3 mt-2">
              {featuredProducts.length === 0 ? (
                <p className="text-xs text-amber-400">No products toggled ON for hero showcase yet. Go to Products menu and turn ON 'Show in Hero Showcase' for products!</p>
              ) : (
                featuredProducts.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary border border-emerald-500/20">
                    <img src={imgUrl(p.image)} alt={p.name} className="w-8 h-8 rounded-md object-cover" />
                    <div>
                      <p className="text-xs font-bold">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">₹{p.price}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-2">
              {customImageUrl ? (
                <img src={customImageUrl} alt="Custom Preview" className="w-16 h-16 rounded-xl object-cover border border-emerald-500/30" />
              ) : null}
              <div>
                <p className="text-xs font-bold text-emerald-400">{customTitle || "Direct Farm Harvest"}</p>
                <p className="text-[11px] text-muted-foreground">{customSubtitle || "Picked this morning"}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeePerksCustomizer() {
  const { toast } = useToast();
  const [subadminDiscountPercent, setSubadminDiscountPercent] = useState("15");
  const [subadminMaxCap, setSubadminMaxCap] = useState("500");
  const [subadminMonthlyLimit, setSubadminMonthlyLimit] = useState("4");
  const [deliveryPartnerDiscountPercent, setDeliveryPartnerDiscountPercent] = useState("20");
  const [deliveryPartnerMaxCap, setDeliveryPartnerMaxCap] = useState("300");
  const [deliveryPartnerMonthlyLimit, setDeliveryPartnerMonthlyLimit] = useState("6");

  const { data, refetch } = useQuery({
    queryKey: ["/api/admin/perks/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/perks/settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (data) {
      setSubadminDiscountPercent(String(data.subadminDiscountPercent ?? 15));
      setSubadminMaxCap(String(data.subadminMaxCap ?? 500));
      setSubadminMonthlyLimit(String(data.subadminMonthlyLimit ?? 4));
      setDeliveryPartnerDiscountPercent(String(data.deliveryPartnerDiscountPercent ?? 20));
      setDeliveryPartnerMaxCap(String(data.deliveryPartnerMaxCap ?? 300));
      setDeliveryPartnerMonthlyLimit(String(data.deliveryPartnerMonthlyLimit ?? 6));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/perks/settings", {
        subadminDiscountPercent: parseFloat(subadminDiscountPercent) || 15,
        subadminMaxCap: parseFloat(subadminMaxCap) || 500,
        subadminMonthlyLimit: parseInt(subadminMonthlyLimit, 10) || 4,
        deliveryPartnerDiscountPercent: parseFloat(deliveryPartnerDiscountPercent) || 20,
        deliveryPartnerMaxCap: parseFloat(deliveryPartnerMaxCap) || 300,
        deliveryPartnerMonthlyLimit: parseInt(deliveryPartnerMonthlyLimit, 10) || 6,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Employee & Partner Perk Settings Saved!" });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Failed to save perks", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-card p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Gift className="w-5 h-5 text-emerald-400" /> Employee & Delivery Partner Perk Discounts
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure purchase discount rates, maximum discount caps (₹), and monthly usage limits for sub-admins and delivery partners when buying from the store.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-500 font-bold gap-2">
          <Save size={16} /> {saveMutation.isPending ? "Saving…" : "Save Perks"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sub-Admin Perks */}
        <div className="p-4 rounded-xl bg-secondary/30 border border-emerald-500/20 space-y-4">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            🛡️ Sub-Admin Staff Discounts
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <Label>Discount Percentage (%)</Label>
              <Input type="number" value={subadminDiscountPercent} onChange={(e) => setSubadminDiscountPercent(e.target.value)} placeholder="15" className="mt-1" />
            </div>
            <div>
              <Label>Max Discount Cap per Order (₹)</Label>
              <Input type="number" value={subadminMaxCap} onChange={(e) => setSubadminMaxCap(e.target.value)} placeholder="500" className="mt-1" />
            </div>
            <div>
              <Label>Monthly Allowed Purchases (Orders/Month)</Label>
              <Input type="number" value={subadminMonthlyLimit} onChange={(e) => setSubadminMonthlyLimit(e.target.value)} placeholder="4" className="mt-1" />
            </div>
          </div>
        </div>

        {/* Delivery Partner Perks */}
        <div className="p-4 rounded-xl bg-secondary/30 border border-emerald-500/20 space-y-4">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            🚚 Delivery Partner Perks
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <Label>Discount Percentage (%)</Label>
              <Input type="number" value={deliveryPartnerDiscountPercent} onChange={(e) => setDeliveryPartnerDiscountPercent(e.target.value)} placeholder="20" className="mt-1" />
            </div>
            <div>
              <Label>Max Discount Cap per Order (₹)</Label>
              <Input type="number" value={deliveryPartnerMaxCap} onChange={(e) => setDeliveryPartnerMaxCap(e.target.value)} placeholder="300" className="mt-1" />
            </div>
            <div>
              <Label>Monthly Allowed Purchases (Orders/Month)</Label>
              <Input type="number" value={deliveryPartnerMonthlyLimit} onChange={(e) => setDeliveryPartnerMonthlyLimit(e.target.value)} placeholder="6" className="mt-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SiteTextCustomizer() {
  const { toast } = useToast();
  const [formText, setFormText] = useState<Record<string, string>>({});

  const { data, refetch } = useQuery<{ textMap: Record<string, string> }>({
    queryKey: ["/api/content/site-text"],
    queryFn: () => apiGet("/api/content/site-text"),
  });

  useEffect(() => {
    if (data?.textMap) setFormText(data.textMap);
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (map: Record<string, string>) => apiRequest("POST", "/api/admin/content/site-text", { textMap: map }),
    onSuccess: () => {
      toast({ title: "✨ Site pills, badges & headlines updated live!" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/content/site-text"] });
    },
  });

  const handleChange = (key: string, val: string) => {
    setFormText((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    updateMutation.mutate(formText);
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-card p-6 space-y-6 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Website Badges, Pills & Headlines Customizer
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Customize all pill badges, hero headlines, promise text, and bento cards across the website.
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-emerald-600 hover:bg-emerald-500 font-bold">
          <Save className="w-4 h-4 mr-1.5" /> Save Site Text
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="space-y-1">
          <Label className="text-xs font-bold text-emerald-400">Hero Section Pill Badge</Label>
          <Input
            value={formText.hero_badge_text || ""}
            onChange={(e) => handleChange("hero_badge_text", e.target.value)}
            placeholder="Visakhapatnam's #1 Instant Organic Farm Delivery"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-bold text-amber-400">Promise Section Pill Badge</Label>
          <Input
            value={formText.promise_badge_text || ""}
            onChange={(e) => handleChange("promise_badge_text", e.target.value)}
            placeholder="Visakhapatnam Farm to Fork"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs font-bold">Hero Headline Text</Label>
          <Input
            value={formText.hero_headline_text || ""}
            onChange={(e) => handleChange("hero_headline_text", e.target.value)}
            placeholder="Fresh from local farms, delivered straight to your doorstep."
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs font-bold">Promise Section Title</Label>
          <Input
            value={formText.promise_title_text || ""}
            onChange={(e) => handleChange("promise_title_text", e.target.value)}
            placeholder="Our Farm-to-Home Promise"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs font-bold">Promise Section Description</Label>
          <Input
            value={formText.promise_desc_text || ""}
            onChange={(e) => handleChange("promise_desc_text", e.target.value)}
            placeholder="Connecting households directly with local organic farms..."
          />
        </div>

        {/* Bento Card 1 */}
        <div className="space-y-1">
          <Label className="text-xs font-bold">Bento Card 1 Title</Label>
          <Input
            value={formText.promise_card1_title || ""}
            onChange={(e) => handleChange("promise_card1_title", e.target.value)}
            placeholder="100% Organic"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold">Bento Card 1 Description</Label>
          <Input
            value={formText.promise_card1_desc || ""}
            onChange={(e) => handleChange("promise_card1_desc", e.target.value)}
            placeholder="Sourced daily from certified local organic farms..."
          />
        </div>

        {/* Bento Card 2 */}
        <div className="space-y-1">
          <Label className="text-xs font-bold">Bento Card 2 Title</Label>
          <Input
            value={formText.promise_card2_title || ""}
            onChange={(e) => handleChange("promise_card2_title", e.target.value)}
            placeholder="Combined ETA"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold">Bento Card 2 Description</Label>
          <Input
            value={formText.promise_card2_desc || ""}
            onChange={(e) => handleChange("promise_card2_desc", e.target.value)}
            placeholder="Haversine distance transit calculation..."
          />
        </div>

        {/* Bento Card 3 */}
        <div className="space-y-1">
          <Label className="text-xs font-bold">Bento Card 3 Title</Label>
          <Input
            value={formText.promise_card3_title || ""}
            onChange={(e) => handleChange("promise_card3_title", e.target.value)}
            placeholder="Authentic Recipes"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold">Bento Card 3 Description</Label>
          <Input
            value={formText.promise_card3_desc || ""}
            onChange={(e) => handleChange("promise_card3_desc", e.target.value)}
            placeholder="Handcrafted ghee boondi laddus..."
          />
        </div>

        {/* Bento Card 4 */}
        <div className="space-y-1">
          <Label className="text-xs font-bold">Bento Card 4 Title</Label>
          <Input
            value={formText.promise_card4_title || ""}
            onChange={(e) => handleChange("promise_card4_title", e.target.value)}
            placeholder="Rated 4.9/5 Stars"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold">Bento Card 4 Description</Label>
          <Input
            value={formText.promise_card4_desc || ""}
            onChange={(e) => handleChange("promise_card4_desc", e.target.value)}
            placeholder="Trusted by 1,200+ households..."
          />
        </div>
      </div>
    </div>
  );
}

// Known keys grouped for a friendlier form. Anything else discovered from the
// API is rendered generically below so we never drop unknown settings.
const DISCOUNT_KEYS = [
  { key: "first_order_discount_enabled", label: "Enable first-order discount", type: "bool" as const },
  { key: "first_order_discount_percent", label: "First order discount %", type: "percent" as const },
];
const REFERRAL_KEYS = [
  { key: "referral_enabled", label: "Enable referral program", type: "bool" as const },
  { key: "referral_new_customer_percent", label: "New customer referral discount %", type: "percent" as const },
  { key: "referral_reward_percent", label: "Referrer reward %", type: "percent" as const },
  { key: "referral_reward_max_percent_per_order", label: "Max referral reward cap % per order", type: "percent" as const },
];
const DELIVERY_KEYS = [
  { key: "subscription_delivery_days", label: "Subscription delivery days", type: "delivery_days" as const },
  { key: "flat_delivery_enabled", label: "Charge a standard delivery fee on all orders", type: "bool" as const },
  { key: "flat_delivery_fee", label: "Standard delivery fee (₹)", type: "amount" as const },
  { key: "flat_delivery_free_above", label: "Standard delivery free above (₹, 0 = never)", type: "amount" as const },
];
const STORE_KEYS = [
  { key: "store_name", label: "Store name", type: "text" as const },
];
const PAYMENT_KEYS = [
  { key: "cod_enabled", label: "Allow Cash on Delivery at checkout", type: "bool" as const },
];
const LEGAL_CONTACT_KEYS = [
  { key: "contact_phone", label: "Customer Support Phone / WhatsApp", type: "text" as const },
  { key: "contact_email", label: "Customer Support Email Address", type: "text" as const },
  { key: "contact_address", label: "Company Headquarters Address", type: "text" as const },
  { key: "operating_hours", label: "Customer Support Operating Hours", type: "text" as const },
  { key: "return_window_hours", label: "Perishable Claim Return Window (Hours)", type: "text" as const },
  { key: "shipping_policy_custom_notes", label: "Custom Shipping Policy Notes", type: "text" as const },
  { key: "grievance_officer_name", label: "Grievance Officer Full Name", type: "text" as const },
  { key: "grievance_officer_designation", label: "Grievance Officer Designation", type: "text" as const },
  { key: "grievance_officer_email", label: "Grievance Officer Email Address", type: "text" as const },
  { key: "grievance_officer_phone", label: "Grievance Officer Direct Phone", type: "text" as const },
  { key: "grievance_officer_address", label: "Grievance Officer Office Address", type: "text" as const },
  { key: "complaint_ack_hours", label: "Complaint Acknowledgment SLA (hours)", type: "text" as const },
  { key: "complaint_resolve_days", label: "Complaint Resolution Timeline (working days)", type: "text" as const },
];

const CHATBOT_KEYS = [
  { key: "chatbot_enabled", label: "Enable Laxshmi AI Chatbot", type: "bool" as const },
  { key: "gemini_api_key", label: "Google Gemini API Key (Free tier at ai.google.dev)", type: "text" as const },
  { key: "chatbot_welcome_message", label: "Chatbot Welcome Message", type: "text" as const },
  { key: "telegram_bot_token", label: "Telegram Bot Token (from @BotFather)", type: "text" as const },
];

const ALL_KNOWN_KEYS = [
  ...DISCOUNT_KEYS, ...REFERRAL_KEYS, ...DELIVERY_KEYS, ...STORE_KEYS, ...PAYMENT_KEYS, ...LEGAL_CONTACT_KEYS, ...CHATBOT_KEYS,
].map((k) => k.key).concat("delivery_rules", "telegram_chat_ids");

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: { key: string; label: string; type: "bool" | "percent" | "amount" | "text" | "delivery_days" };
  value: string | undefined;
  onChange: (key: string, value: string) => void;
}) {
  const v = value ?? "";
  if (field.type === "bool") {
    return (
      <div className="flex items-center justify-between py-2">
        <Label htmlFor={`set-${field.key}`} className="cursor-pointer">{field.label}</Label>
        <Switch
          id={`set-${field.key}`}
          checked={v === "true"}
          onCheckedChange={(checked) => onChange(field.key, checked ? "true" : "false")}
          data-testid={`switch-setting-${field.key}`}
        />
      </div>
    );
  }
  if (field.type === "delivery_days") {
    return (
      <div className="py-2">
        <Label htmlFor={`set-${field.key}`}>{field.label}</Label>
        <Select value={v || "both"} onValueChange={(val) => onChange(field.key, val)}>
          <SelectTrigger id={`set-${field.key}`} className="mt-1" data-testid={`select-setting-${field.key}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="saturday">Saturday only</SelectItem>
            <SelectItem value="sunday">Sunday only</SelectItem>
            <SelectItem value="both">Both Saturday &amp; Sunday</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "percent") {
    return (
      <div className="py-2">
        <Label htmlFor={`set-${field.key}`}>{field.label}</Label>
        <div className="relative mt-1">
          <Input
            id={`set-${field.key}`}
            type="number"
            min={0}
            max={100}
            value={v}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`input-setting-${field.key}`}
          />
          <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (field.type === "amount") {
    return (
      <div className="py-2">
        <Label htmlFor={`set-${field.key}`}>{field.label}</Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
          <Input
            id={`set-${field.key}`}
            type="number"
            min={0}
            value={v}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="pl-7"
            data-testid={`input-setting-${field.key}`}
          />
        </div>
      </div>
    );
  }
  if (field.key === "gemini_api_key") {
    const isValidPrefix = v.trim().startsWith("AIzaSy");
    const isInvalidKey = v.trim().length > 0 && !isValidPrefix;
    return (
      <div className="py-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={`set-${field.key}`} className="font-bold text-foreground">{field.label}</Label>
          <a
            href="https://aistudio.google.dev/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Get Free Key at Google AI Studio (aistudio.google.dev) 🔑</span>
          </a>
        </div>
        <Input
          id={`set-${field.key}`}
          type="text"
          value={v}
          placeholder="Paste your Google Gemini API key starting with AIzaSy..."
          onChange={(e) => onChange(field.key, e.target.value)}
          className={`mt-1 font-mono text-xs ${isInvalidKey ? "border-amber-500/80 bg-amber-500/10 text-amber-300" : ""}`}
          data-testid={`input-setting-${field.key}`}
        />
        {isInvalidKey && (
          <div className="text-[11px] font-bold text-amber-300 bg-amber-500/15 p-2.5 rounded-xl border border-amber-500/30 space-y-1">
            <p className="flex items-center gap-1">
              ⚠️ <strong>Invalid API Key Format Detected:</strong>
            </p>
            <p className="font-normal opacity-90">
              Google Gemini API keys ALWAYS start with <code>AIzaSy...</code> (obtained from <a href="https://aistudio.google.dev/app/apikey" target="_blank" rel="noopener noreferrer" className="underline font-black text-amber-200">aistudio.google.dev</a>). Your current key starts with <code>{v.trim().substring(0, 7)}...</code> which is not a Google Gemini key.
            </p>
          </div>
        )}
        {isValidPrefix && (
          <p className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
            ✓ Valid Google Gemini API Key format (starts with AIzaSy)
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="py-2">
      <Label htmlFor={`set-${field.key}`}>{field.label}</Label>
      <Input
        id={`set-${field.key}`}
        value={v}
        onChange={(e) => onChange(field.key, e.target.value)}
        className="mt-1"
        data-testid={`input-setting-${field.key}`}
      />
    </div>
  );
}

function TelegramChatIdsEditor({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (key: string, val: string) => void;
}) {
  // value is JSON array stored as string e.g. "[\"-100123\",\"-100456\"]"
  let ids: string[] = [];
  try { ids = JSON.parse(value || "[]"); } catch { ids = []; }
  if (!Array.isArray(ids)) ids = [];

  const commit = (newIds: string[]) => onChange("telegram_chat_ids", JSON.stringify(newIds));

  return (
    <div className="space-y-2">
      <Label>Telegram Alert Chat IDs</Label>
      <p className="text-xs text-muted-foreground">Add the Chat IDs of Telegram groups/channels to receive customer support alerts. Get IDs by adding your bot to a group, then visiting: api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</p>
      {ids.length === 0 && <p className="text-sm text-muted-foreground italic">No Chat IDs added yet.</p>}
      {ids.map((chatId, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <Input
            value={chatId}
            placeholder="e.g. -100123456789"
            onChange={(e) => {
              const updated = [...ids];
              updated[idx] = e.target.value;
              commit(updated);
            }}
            data-testid={`input-telegram-chat-id-${idx}`}
          />
          <Button
            type="button" variant="ghost" size="icon"
            onClick={() => commit(ids.filter((_, i) => i !== idx))}
            data-testid={`btn-remove-chat-id-${idx}`}
          >
            <Trash2 size={16} className="text-destructive" />
          </Button>
        </div>
      ))}
      <Button
        type="button" variant="outline" size="sm"
        onClick={() => commit([...ids, ""])}
        className="gap-2"
        data-testid="btn-add-chat-id"
      >
        <Plus size={14} /> Add Chat ID
      </Button>
    </div>
  );
}

function SmtpEmailCustomizer() {
  const { toast } = useToast();
  const [smtpHost, setSmtpHost] = useState("smtp.resend.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("resend");
  const [smtpPass, setSmtpPass] = useState("");
  const [fromEmail, setFromEmail] = useState("orders@farmfreshfarmer.com");
  const [resendApiKey, setResendApiKey] = useState("");
  const [testEmail, setTestEmail] = useState("");

  const { data: settingsData, refetch } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/settings"],
    queryFn: () => apiGet<Record<string, string>>("/api/admin/settings"),
  });

  useEffect(() => {
    if (settingsData) {
      if (settingsData.smtp_host) setSmtpHost(settingsData.smtp_host);
      if (settingsData.smtp_port) setSmtpPort(settingsData.smtp_port);
      if (settingsData.smtp_user) setSmtpUser(settingsData.smtp_user);
      if (settingsData.smtp_pass) setSmtpPass(settingsData.smtp_pass);
      if (settingsData.from_email) setFromEmail(settingsData.from_email);
      if (settingsData.resend_api_key) setResendApiKey(settingsData.resend_api_key);
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/settings", {
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        from_email: fromEmail,
        resend_api_key: resendApiKey,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "✨ SMTP & Resend Email Credentials Saved!", description: "All OTP codes, password resets, and confirmations will now use these credentials." });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Save Error", description: err.message, variant: "destructive" });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/smtp/test", { to: testEmail || undefined });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "📧 Test Email Dispatched!", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Test Email Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-card p-6 space-y-6 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-bold flex items-center gap-2 text-foreground">
            <span>📧 Production Email & SMTP Settings (Resend / Custom SMTP)</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure live Resend API key or custom SMTP server details for dispatching 6-Digit OTPs, Password Resets, and Order Confirmations.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-500 font-bold">
          <Save className="w-4 h-4 mr-1.5" /> Save Email Settings
        </Button>
      </div>

      <div className="space-y-4">
        {/* Resend API Key Section */}
        <div className="p-4 rounded-xl bg-secondary/30 border border-emerald-500/20 space-y-2">
          <Label className="text-xs font-bold text-emerald-400">Resend API Key (Recommended Alternative to SMTP)</Label>
          <Input
            type="password"
            placeholder="re_123456789..."
            value={resendApiKey}
            onChange={(e) => setResendApiKey(e.target.value)}
            className="font-mono text-xs rounded-xl"
          />
          <p className="text-[10px] text-muted-foreground">If provided, Resend HTTPS API will be prioritized over SMTP for instant delivery.</p>
        </div>

        {/* Custom SMTP Configuration */}
        <div className="p-4 rounded-xl bg-secondary/30 border border-emerald-500/20 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Standard SMTP Server Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold">SMTP Host (e.g. smtp.resend.com or smtp.gmail.com)</Label>
              <Input
                placeholder="smtp.resend.com"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className="mt-1 font-mono text-xs rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">SMTP Port (e.g. 587 or 465)</Label>
              <Input
                placeholder="587"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                className="mt-1 font-mono text-xs rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">SMTP Username (e.g. resend or your-email@gmail.com)</Label>
              <Input
                placeholder="resend"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className="mt-1 font-mono text-xs rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">SMTP Password / API Key</Label>
              <Input
                type="password"
                placeholder="SMTP Password or API Token"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                className="mt-1 font-mono text-xs rounded-xl"
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs font-bold text-emerald-400">Sender Email Address (FROM_EMAIL)</Label>
              <Input
                placeholder="orders@farmfreshfarmer.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="mt-1 font-mono text-xs rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Must be verified with your domain in Resend/SMTP provider.</p>
            </div>
          </div>
        </div>

        {/* Test Email Dispatcher */}
        <div className="p-4 rounded-xl bg-card border border-card-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 w-full">
            <Label className="text-xs font-bold">Test Email Recipient Address</Label>
            <Input
              type="email"
              placeholder="Enter your email to receive a test message..."
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="mt-1 rounded-xl text-xs"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => testEmailMutation.mutate()}
            disabled={testEmailMutation.isPending}
            className="mt-5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-bold shrink-0 text-xs py-5"
          >
            {testEmailMutation.isPending ? "Sending..." : "📧 Dispatch Test Verification Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AuthMethodsCustomizer() {
  const { toast } = useToast();
  const [emailAuthEnabled, setEmailAuthEnabled] = useState(true);
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(true);

  const { data: settingsData, refetch } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/settings"],
    queryFn: () => apiGet<Record<string, string>>("/api/admin/settings"),
  });

  useEffect(() => {
    if (settingsData) {
      if (settingsData.auth_email_enabled !== undefined) {
        setEmailAuthEnabled(settingsData.auth_email_enabled !== "false");
      }
      if (settingsData.auth_google_enabled !== undefined) {
        setGoogleAuthEnabled(settingsData.auth_google_enabled !== "false");
      }
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/settings", {
        auth_email_enabled: emailAuthEnabled ? "true" : "false",
        auth_google_enabled: googleAuthEnabled ? "true" : "false",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/methods"] });
      toast({
        title: "✨ Auth Controls Updated!",
        description: `Email Login is ${emailAuthEnabled ? "ENABLED" : "DISABLED"} | Google Login is ${googleAuthEnabled ? "ENABLED" : "DISABLED"}.`,
      });
      refetch();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-card p-6 space-y-6 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-bold flex items-center gap-2 text-foreground">
            <span>🔐 Customer Login & Authentication Method Controls</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enable or disable Email/OTP login and Google One-Tap authentication methods across the platform.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-500 font-bold">
          <Save className="w-4 h-4 mr-1.5" /> Save Auth Controls
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-secondary/30 border border-emerald-500/20 flex items-center justify-between">
          <div>
            <Label className="text-sm font-bold text-foreground block">Email & 6-Digit OTP Login</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Allow users to register and log in using Email + Password / 6-Digit OTP.
            </p>
          </div>
          <Switch
            checked={emailAuthEnabled}
            onCheckedChange={setEmailAuthEnabled}
          />
        </div>

        <div className="p-4 rounded-xl bg-secondary/30 border border-emerald-500/20 flex items-center justify-between">
          <div>
            <Label className="text-sm font-bold text-foreground block">Google One-Tap & OAuth Login</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Allow 1-click Google Sign-In button on the login screen.
            </p>
          </div>
          <Switch
            checked={googleAuthEnabled}
            onCheckedChange={setGoogleAuthEnabled}
          />
        </div>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<"delivery" | "legal" | "branding" | "payments" | "security" | "chatbot">("delivery");

  // ---------- Business settings ----------
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: () => apiGet<SettingsMap>("/api/admin/settings"),
  });

  const [form, setForm] = useState<SettingsMap>({});

  useEffect(() => {
    if (settingsData) setForm({ cod_enabled: "true", ...settingsData });
  }, [settingsData]);

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const saveSettings = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/settings", form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Settings saved", description: "Business & Legal settings updated successfully." });
    },
    onError: () => {
      toast({ title: "Could not save settings", description: "Please try again.", variant: "destructive" });
    },
  });

  const testGeminiMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/gemini/test", { apiKey: form["gemini_api_key"] });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "🤖 Gemini AI Connection Success!", description: data.message });
    },
    onError: (e: any) => {
      toast({ title: "Gemini API Test Failed", description: e?.message || "Verify your API key at ai.google.dev.", variant: "destructive" });
    },
  });

  const unknownKeys = Object.keys(form).filter((k) => !ALL_KNOWN_KEYS.includes(k));

  // ---------- Password change ----------
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totpCode, setTotpCode] = useState("");

  const change = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/update-password", {
        currentPassword: current,
        newPassword: next,
        totpCode,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setCurrent(""); setNext(""); setConfirm(""); setTotpCode("");
      toast({ title: "🔑 Super Admin Password Changed!", description: data.message || "Use your new password next time you log in." });
    },
    onError: (e: any) => {
      toast({ title: "Security Validation Failed", description: e?.message || "Please check your current password & 6-digit TOTP code.", variant: "destructive" });
    },
  });

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return toast({ title: "Current password required", variant: "destructive" });
    if (next.length < 6) return toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
    if (next !== confirm) return toast({ title: "Passwords do not match", variant: "destructive" });
    if (totpCode.length < 6) return toast({ title: "2FA TOTP code required", description: "Enter 6-digit code from your Authenticator App.", variant: "destructive" });
    change.mutate();
  }

  return (
    <AdminLayout title="Settings">
      <div className="max-w-4xl space-y-6">
        {/* Header & Quick Save Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-card-border p-5 rounded-2xl shadow-sm">
          <div>
            <h2 className="font-serif text-xl font-bold text-foreground">Super Admin Platform Controls</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Manage delivery fees, legal policy terms, contact details, payment gateways, and security.</p>
          </div>
          <Button
            size="sm"
            onClick={() => saveSettings.mutate()}
            disabled={saveSettings.isPending || settingsLoading}
            className="bg-emerald-600 hover:bg-emerald-500 font-extrabold gap-2 self-start sm:self-auto shadow-md"
            data-testid="button-save-settings"
          >
            <Save size={16} />
            {saveSettings.isPending ? "Saving..." : "Save All Settings"}
          </Button>
        </div>

        {/* Organized Category Sub-Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-card-border pb-3">
          <button
            onClick={() => setActiveCategory("delivery")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === "delivery" ? "bg-emerald-600 text-white shadow-md scale-[1.02]" : "bg-card hover:bg-secondary border border-card-border text-muted-foreground"
            }`}
          >
            <Truck size={16} /> 🚚 Delivery & Logistics
          </button>
          <button
            onClick={() => setActiveCategory("legal")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === "legal" ? "bg-emerald-600 text-white shadow-md scale-[1.02]" : "bg-card hover:bg-secondary border border-card-border text-muted-foreground"
            }`}
          >
            <MapPin size={16} /> 📜 Legal & Contact Info
          </button>
          <button
            onClick={() => setActiveCategory("branding")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === "branding" ? "bg-emerald-600 text-white shadow-md scale-[1.02]" : "bg-card hover:bg-secondary border border-card-border text-muted-foreground"
            }`}
          >
            <Sparkles size={16} /> 🎨 Storefront & Branding
          </button>
          <button
            onClick={() => setActiveCategory("payments")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === "payments" ? "bg-emerald-600 text-white shadow-md scale-[1.02]" : "bg-card hover:bg-secondary border border-card-border text-muted-foreground"
            }`}
          >
            <CreditCard size={16} /> 💳 Payments & Discounts
          </button>
          <button
            onClick={() => setActiveCategory("security")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === "security" ? "bg-emerald-600 text-white shadow-md scale-[1.02]" : "bg-card hover:bg-secondary border border-card-border text-muted-foreground"
            }`}
          >
            <KeyRound size={16} /> 🔐 Security & Accounts
          </button>
          <button
            onClick={() => setActiveCategory("chatbot")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === "chatbot" ? "bg-emerald-600 text-white shadow-md scale-[1.02]" : "bg-card hover:bg-secondary border border-card-border text-muted-foreground"
            }`}
          >
            🤖 Chatbot & Alerts
          </button>
        </div>

        {/* ── TAB 1: 🚚 DELIVERY & LOGISTICS ────────────────────────────── */}
        {activeCategory === "delivery" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-card-border bg-card p-6 space-y-6 shadow-sm">
              <section>
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-primary">
                  <Truck size={16} /> Instant Local & Subscription Delivery Rules
                </div>
                <div className="divide-y divide-card-border">
                  {DELIVERY_KEYS.map((f) => (
                    <FieldRow key={f.key} field={f} value={form[f.key]} onChange={setField} />
                  ))}
                </div>
              </section>

              <section className="pt-4 border-t border-card-border">
                <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-primary">
                  <MapPin size={16} /> Per-City Express Delivery Fees & Free Thresholds
                </div>
                <DeliveryRulesEditor
                  value={form["delivery_rules"]}
                  onChange={(json) => setField("delivery_rules", json)}
                />
              </section>
            </div>
          </div>
        )}

        {/* ── TAB 2: 📜 LEGAL, CONTACT & SUPPORT ───────────────────────── */}
        {activeCategory === "legal" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-card-border bg-card p-6 space-y-6 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-primary">
                <MapPin size={16} /> Customer Support & Operational Hub Contact Info
              </div>
              <p className="text-xs text-muted-foreground">
                These settings control the contact details, phone numbers, HQ address, operating hours, and return policy terms displayed across Web & Mobile App.
              </p>
              <div className="divide-y divide-card-border">
                {LEGAL_CONTACT_KEYS.map((f) => (
                  <FieldRow key={f.key} field={f} value={form[f.key]} onChange={setField} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: 🎨 STOREFRONT & BRANDING ──────────────────────────── */}
        {activeCategory === "branding" && (
          <div className="space-y-6">
            <HeroShowcaseCustomizer />
            <SiteTextCustomizer />
            <SearchRecommendationsManager />
            <EmployeePerksCustomizer />
          </div>
        )}

        {/* ── TAB 4: 💳 PAYMENTS & DISCOUNTS ───────────────────────────── */}
        {activeCategory === "payments" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-card-border bg-card p-6 space-y-6 shadow-sm">
              <section>
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-primary">
                  <CreditCard size={16} /> Checkout Payment Gateways
                </div>
                <div className="divide-y divide-card-border">
                  {PAYMENT_KEYS.map((f) => (
                    <FieldRow key={f.key} field={f} value={form[f.key]} onChange={setField} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  When COD is toggled OFF, customers must pay online via PhonePe/UPI/Card at checkout.
                </p>
              </section>

              <section className="pt-4 border-t border-card-border">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-primary">
                  <Percent size={16} /> First Order Discounts
                </div>
                <div className="divide-y divide-card-border">
                  {DISCOUNT_KEYS.map((f) => (
                    <FieldRow key={f.key} field={f} value={form[f.key]} onChange={setField} />
                  ))}
                </div>
              </section>

              <section className="pt-4 border-t border-card-border">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-primary">
                  <Gift size={16} /> Referral Rewards Program
                </div>
                <div className="divide-y divide-card-border">
                  {REFERRAL_KEYS.map((f) => (
                    <FieldRow key={f.key} field={f} value={form[f.key]} onChange={setField} />
                  ))}
                </div>
              </section>

              <section className="pt-4 border-t border-card-border">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-primary">
                  <Store size={16} /> Store Identity
                </div>
                <div className="divide-y divide-card-border">
                  {STORE_KEYS.map((f) => (
                    <FieldRow key={f.key} field={f} value={form[f.key]} onChange={setField} />
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── TAB 5: 🔐 SECURITY & ACCOUNTS ────────────────────────────── */}
        {activeCategory === "security" && (
          <div className="space-y-6">
            <AuthMethodsCustomizer />
            <SmtpEmailCustomizer />

            {/* Password change */}
            <div className="rounded-xl border border-emerald-500/30 bg-card p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound size={18} className="text-emerald-400" />
                <h2 className="font-serif font-bold text-lg text-foreground">Change Super Admin Password</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Logged in as <strong>{user?.email}</strong>. Requires validating Current Password AND live 6-Digit Authenticator TOTP 2FA code.
              </p>
              <form onSubmit={submitPassword} className="space-y-4">
                <div>
                  <Label htmlFor="cur" className="text-xs font-bold">Current (Old) Password *</Label>
                  <Input id="cur" type="password" placeholder="Enter current password" value={current} onChange={(e) => setCurrent(e.target.value)} required data-testid="input-current-password" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="new" className="text-xs font-bold">New Password (min 6 chars) *</Label>
                  <Input id="new" type="password" placeholder="Enter new password" value={next} onChange={(e) => setNext(e.target.value)} required data-testid="input-new-password" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="conf" className="text-xs font-bold">Confirm New Password *</Label>
                  <Input id="conf" type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required data-testid="input-confirm-password" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="totp" className="text-xs font-bold text-emerald-400">🔑 6-Digit Authenticator TOTP 2FA Code *</Label>
                  <Input
                    id="totp"
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    className="mt-1 text-center font-mono text-lg font-extrabold tracking-widest border-emerald-500/50"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={change.isPending || !current || next.length < 6 || next !== confirm || totpCode.length < 6}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 font-extrabold text-white rounded-xl shadow-lg"
                  data-testid="button-change-password"
                >
                  {change.isPending ? "Validating Password & TOTP..." : "Verify Current Password + TOTP & Update Password 🔑"}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* ── TAB 6: 🤖 CHATBOT & ALERTS ────────────────────────────── */}
        {activeCategory === "chatbot" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-card-border bg-card p-6 space-y-6 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-primary">
                🤖 Laxshmi AI Chatbot & Telegram Integration
              </div>
              <p className="text-xs text-muted-foreground">
                Configure your Gemini API key for the AI chatbot, welcome messages, and Telegram notifications for customer support alerts.
              </p>
              <div className="divide-y divide-card-border">
                {CHATBOT_KEYS.map((f) => (
                  <FieldRow key={f.key} field={f} value={form[f.key]} onChange={setField} />
                ))}
              </div>
              <div className="pt-3 flex items-center justify-between gap-3 bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-emerald-400">⚡ Test Gemini API Key in Real Time</p>
                  <p className="text-[11px] text-muted-foreground">Click to verify if your entered API key can connect to Google Gemini AI servers.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testGeminiMutation.mutate()}
                  disabled={testGeminiMutation.isPending}
                  className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 font-bold text-xs gap-2 shrink-0 py-4 shadow-sm"
                >
                  <Sparkles size={14} className={testGeminiMutation.isPending ? "animate-spin text-yellow-400" : "text-yellow-400"} />
                  {testGeminiMutation.isPending ? "Testing API Connection..." : "Test Connection ⚡"}
                </Button>
              </div>
              <div className="pt-4 border-t border-card-border">
                <TelegramChatIdsEditor
                  value={form["telegram_chat_ids"]}
                  onChange={setField}
                />
              </div>
            </div>
          </div>
        )}

        {unknownKeys.length > 0 && (
          <div className="rounded-xl border border-card-border bg-card p-6">
            <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-primary">
              Other Custom Settings
            </div>
            <div className="divide-y divide-card-border">
              {unknownKeys.map((key) => (
                <div key={key} className="py-2">
                  <Label htmlFor={`set-${key}`}>{key}</Label>
                  <Input
                    id={`set-${key}`}
                    value={form[key] ?? ""}
                    onChange={(e) => setField(key, e.target.value)}
                    className="mt-1"
                    data-testid={`input-setting-${key}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
