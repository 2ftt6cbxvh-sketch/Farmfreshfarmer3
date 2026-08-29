import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, KeyRound, Copy, Check, ShieldCheck, Clock, Mail, Tag, Sparkles } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Coupon } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function AdminCoupons() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"all" | "standard" | "onetime">("all");
  const [open, setOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Standard Coupon Form State
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("10");
  const [minOrder, setMinOrder] = useState("0");
  const [maxUses, setMaxUses] = useState("100");
  const [isOneTime, setIsOneTime] = useState(false);

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons"],
    queryFn: () => apiGet<Coupon[]>("/api/coupons"),
  });

  const create = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/coupons", {
        code: code.trim().toUpperCase(),
        discountPercent: parseFloat(discount) || 0,
        minOrder: parseFloat(minOrder) || 0,
        maxUses: parseInt(maxUses, 10) || (isOneTime ? 1 : 100),
        isOneTime,
        active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setOpen(false);
      setCode("");
      setDiscount("10");
      setMinOrder("0");
      setMaxUses("100");
      setIsOneTime(false);
      toast({ title: "Coupon created successfully!" });
    },
    onError: () => toast({ title: "Could not create coupon", description: "Code may already exist.", variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: async (c: Coupon) => {
      await apiRequest("PATCH", `/api/coupons/${c.id}`, { active: !c.active });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/coupons"] }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/coupons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({ title: "Coupon deleted" });
    },
  });

  const copyToClipboard = (couponCode: string) => {
    navigator.clipboard.writeText(couponCode);
    setCopiedCode(couponCode);
    toast({ title: "Copied!", description: `Code ${couponCode} copied to clipboard.` });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredCoupons = useMemo(() => {
    if (activeTab === "standard") return coupons.filter((c) => !c.isOneTime);
    if (activeTab === "onetime") return coupons.filter((c) => c.isOneTime);
    return coupons;
  }, [coupons, activeTab]);

  const oneTimeCount = coupons.filter((c) => c.isOneTime).length;
  const standardCount = coupons.filter((c) => !c.isOneTime).length;

  return (
    <AdminLayout title="Coupons & Promo Codes">
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-foreground flex items-center gap-2">
              <Tag size={22} className="text-emerald-500" /> Coupons &amp; Discount Codes
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage standard site-wide promo codes and cryptographic 1-time recovery vouchers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setOpen(true)} className="text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 cursor-pointer">
              <Plus size={15} className="mr-1.5" /> Create Coupon
            </Button>
          </div>
        </div>

        {/* Tab Filters */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
          <TabsList className="bg-secondary/40 p-1 rounded-2xl border border-card-border">
            <TabsTrigger value="all" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
              All Codes ({coupons.length})
            </TabsTrigger>
            <TabsTrigger value="standard" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
              Standard Promo Codes ({standardCount})
            </TabsTrigger>
            <TabsTrigger value="onetime" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
              <KeyRound size={13} className="text-emerald-400" /> 1-Time Recovery Vault ({oneTimeCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="m-0">
            {isLoading ? (
              <Skeleton className="h-64 rounded-2xl" />
            ) : (
              <div className="rounded-2xl border border-card-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/60 text-left border-b border-card-border">
                      <tr>
                        <th className="p-3.5 font-bold">Code</th>
                        <th className="p-3.5 font-bold">Type</th>
                        <th className="p-3.5 font-bold">Discount</th>
                        <th className="p-3.5 font-bold">Min Order</th>
                        <th className="p-3.5 font-bold">Usage Status</th>
                        <th className="p-3.5 font-bold">Email Lock / Recipient</th>
                        <th className="p-3.5 font-bold">Expiry</th>
                        <th className="p-3.5 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border">
                      {filteredCoupons.map((c) => {
                        const isExpired = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
                        const isConsumed = c.isOneTime && (c.usedCount || 0) >= (c.maxUses || 1);

                        return (
                          <tr key={c.id} className="hover:bg-secondary/20 transition-colors">
                            {/* Code */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-extrabold text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                                  {c.code}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyToClipboard(c.code)}
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Copy Code"
                                >
                                  {copiedCode === c.code ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                </Button>
                              </div>
                            </td>

                            {/* Type */}
                            <td className="p-3.5">
                              {c.isOneTime ? (
                                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 gap-1">
                                  <KeyRound size={10} /> 1-Time Secure
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  Standard
                                </Badge>
                              )}
                            </td>

                            {/* Discount */}
                            <td className="p-3.5 font-bold text-foreground">
                              {Number(c.discountPercent)}% OFF
                            </td>

                            {/* Min Order */}
                            <td className="p-3.5 text-muted-foreground">
                              {Number(c.minOrder) > 0 ? formatINR(Number(c.minOrder)) : "No Minimum"}
                            </td>

                            {/* Usage Status */}
                            <td className="p-3.5">
                              {isConsumed ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md">
                                  🔴 Consumed ({c.usedCount || 0}/{c.maxUses || 1})
                                </span>
                              ) : isExpired ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                  ⏰ Expired
                                </span>
                              ) : c.active ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                                  🟢 Active ({c.usedCount || 0}/{c.maxUses || 1})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                                  ⚪ Disabled
                                </span>
                              )}
                            </td>

                            {/* Email Lock */}
                            <td className="p-3.5">
                              {c.restrictedEmail ? (
                                <span className="font-mono text-[11px] text-foreground font-semibold flex items-center gap-1">
                                  <Mail size={12} className="text-emerald-400" /> {c.restrictedEmail}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">🌐 Any Customer</span>
                              )}
                            </td>

                            {/* Expiry */}
                            <td className="p-3.5 text-muted-foreground text-[11px]">
                              {c.expiresAt ? (
                                <div className="flex items-center gap-1">
                                  <Clock size={11} />
                                  <span>{new Date(c.expiresAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
                                </div>
                              ) : (
                                "Never"
                              )}
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggle.mutate(c)}
                                  disabled={isConsumed}
                                  className="h-7 text-[11px] font-bold rounded-lg cursor-pointer"
                                >
                                  {c.active ? "Disable" : "Enable"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm(`Permanently delete coupon ${c.code}?`)) del.mutate(c.id);
                                  }}
                                  className="h-7 w-7 text-muted-foreground hover:text-red-400 cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredCoupons.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-muted-foreground">
                            No coupons found in this category.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Coupon Modal */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold flex items-center gap-2">
                <Tag size={18} className="text-emerald-500" /> Create New Coupon
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure discount rates, minimum basket threshold, and usage limits.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 py-1">
              <div>
                <Label className="text-xs font-bold">Coupon Code</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HARVEST20"
                  className="mt-1 rounded-xl text-xs font-mono font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold">Discount (%)</Label>
                  <Input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="mt-1 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Min Order (₹)</Label>
                  <Input
                    type="number"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold">Max Uses</Label>
                  <Input
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="100"
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOneTime(!isOneTime);
                      if (!isOneTime) setMaxUses("1");
                    }}
                    className={`h-9 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isOneTime
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <KeyRound size={13} /> {isOneTime ? "1-Time Single Use" : "Multi-Use Code"}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button
                onClick={() => create.mutate()}
                disabled={create.isPending || !code.trim()}
                className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {create.isPending ? "Creating…" : "Create Coupon"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
