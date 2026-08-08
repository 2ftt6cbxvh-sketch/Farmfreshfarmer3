import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { apiGet, apiRequest, queryClient } from "@/lib/queryClient";
import { Product, formatINR } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Percent, Save, RefreshCw, Info, Lock } from "lucide-react";
import { useAuth } from "@/lib/store";
import Forbidden403 from "../Forbidden403";

interface GstSettings {
  defaultGstPercent: number;
  gstEnabled: boolean;
}

export default function AdminGST() {
  const { toast } = useToast();
  const { user } = useAuth();

  let adminUser = user;
  if (!adminUser && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("adminUser");
      if (stored) adminUser = JSON.parse(stored);
    } catch {}
  }

  const isSuperAdmin =
    adminUser?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    adminUser?.isPrimaryAdmin === true ||
    adminUser?.role === "admin" ||
    adminUser?.role === "superadmin";

  const { data: gstSettings, isLoading: loadingGst } = useQuery<GstSettings>({
    queryKey: ["/api/admin/gst-settings"],
    queryFn: () => apiGet<GstSettings>("/api/admin/gst-settings"),
    enabled: isSuperAdmin,
  });

  const { data: productList = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: () => apiGet<Product[]>("/api/products"),
    enabled: isSuperAdmin,
  });

  const [globalGst, setGlobalGst] = useState<string>("");
  const [gstEnabled, setGstEnabled] = useState<boolean>(true);
  const [editingGst, setEditingGst] = useState<Record<number, string>>({});

  // Sync state once fetched
  if (gstSettings && globalGst === "" && !loadingGst) {
    setGlobalGst(String(gstSettings.defaultGstPercent));
    setGstEnabled(gstSettings.gstEnabled);
  }

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/admin/gst-settings", {
        defaultGstPercent: parseFloat(globalGst) || 5,
        gstEnabled,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gst-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/price/quote"] });
      toast({ title: "GST Settings Saved", description: "Global GST tax settings updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Save Failed", description: err.message || "Failed to update GST settings", variant: "destructive" });
    },
  });

  const saveProductGstMutation = useMutation({
    mutationFn: async ({ productId, gstPercent }: { productId: number; gstPercent: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/products/${productId}/gst`, {
        gstPercent: gstPercent === "" ? null : parseFloat(gstPercent),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/price/quote"] });
      toast({ title: "Product GST Updated", description: "Individual product GST rate updated." });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message || "Failed to update product GST", variant: "destructive" });
    },
  });

  if (!isSuperAdmin) {
    return (
      <AdminLayout title="GST & Tax Settings">
        <Forbidden403 />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="GST & Tax Settings (Super Admin Only)">
      <div className="space-y-6 max-w-6xl">
        {/* Super Admin Security Banner */}
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                Super Admin Tax Authority Gateway
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-black">Restricted</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure India GST Tax percentages (0%, 5%, 12%, 18%) for storewide defaults and individual products.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/admin/gst-settings"] });
              queryClient.invalidateQueries({ queryKey: ["/api/products"] });
            }}
            className="gap-2"
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>

        {/* Global GST Settings Card */}
        <Card className="border-emerald-500/25 bg-card/90 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <Percent className="text-emerald-500" size={20} />
              Global Storewide GST Rate Settings
            </CardTitle>
            <CardDescription>
              This default GST percentage applies to all products unless an individual product rate is specified below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="global-gst">Default Global GST Rate (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="global-gst"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={globalGst}
                    onChange={(e) => setGlobalGst(e.target.value)}
                    placeholder="e.g. 5"
                    className="font-mono text-base"
                  />
                  <span className="font-bold text-muted-foreground">%</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gst-toggle">GST Tax Itemization in Checkout</Label>
                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    id="gst-toggle"
                    checked={gstEnabled}
                    onCheckedChange={(checked) => setGstEnabled(checked)}
                  />
                  <span className="text-xs font-semibold text-muted-foreground">
                    {gstEnabled ? "Active (Show GST Breakdown on Checkout)" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Tax Rate Presets */}
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground font-semibold">Presets:</span>
              {[0, 5, 12, 18].map((rate) => (
                <Button
                  key={rate}
                  type="button"
                  size="sm"
                  variant={globalGst === String(rate) ? "default" : "outline"}
                  onClick={() => setGlobalGst(String(rate))}
                  className="h-8 text-xs font-mono font-bold"
                >
                  {rate}% GST
                </Button>
              ))}
            </div>

            <Button
              onClick={() => saveSettingsMutation.mutate()}
              disabled={saveSettingsMutation.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <Save size={16} /> Save Global Tax Config
            </Button>
          </CardContent>
        </Card>

        {/* Product-Level GST Customization Table */}
        <Card className="border-border shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <Lock className="text-amber-500" size={18} />
              Individual Product GST Overrides (Super Admin Only)
            </CardTitle>
            <CardDescription>
              Set specific GST rates per product (e.g., 5% for Fresh Fruits, 12% for Prepared Pickles/Ghee). Leave blank to inherit global default ({globalGst || 5}%).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingProducts ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading product tax matrix...</div>
            ) : (
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price (Incl. GST)</TableHead>
                      <TableHead>Effective GST Rate</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productList.map((prod) => {
                      const currentVal = editingGst[prod.id] !== undefined
                        ? editingGst[prod.id]
                        : (prod.gstPercent != null ? String(prod.gstPercent) : "");
                      const effectiveGst = prod.gstPercent != null ? Number(prod.gstPercent) : (parseFloat(globalGst) || 5);

                      return (
                        <TableRow key={prod.id}>
                          <TableCell className="font-semibold text-xs">
                            {prod.name} <span className="text-muted-foreground font-normal">({prod.unit})</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground capitalize">
                            {prod.categorySlug}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-bold">
                            {formatINR(Number(prod.price))}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                placeholder={`Default (${globalGst || 5}%)`}
                                value={currentVal}
                                onChange={(e) => setEditingGst((prev) => ({ ...prev, [prod.id]: e.target.value }))}
                                className="w-32 h-8 text-xs font-mono"
                              />
                              <span className="font-bold text-muted-foreground text-xs">%</span>
                              {prod.gstPercent != null ? (
                                <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 px-1.5 py-0.5 rounded font-mono font-bold">
                                  Custom
                                </span>
                              ) : (
                                <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                                  Global
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveProductGstMutation.mutate({ productId: prod.id, gstPercent: currentVal })}
                              disabled={saveProductGstMutation.isPending}
                              className="h-8 text-xs font-bold gap-1"
                            >
                              <Save size={12} /> Save
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
