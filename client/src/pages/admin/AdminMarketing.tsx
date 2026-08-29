import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiGet } from "@/lib/queryClient";
import {
  Mail,
  Send,
  ShoppingCart,
  Sparkles,
  Shield,
  KeyRound,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  User,
  Ticket,
  FileText,
  Smartphone,
  ExternalLink,
} from "lucide-react";

interface AbandonedCartItem {
  cartId: number;
  userId: number;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  customerStars: number | null;
  updatedAt: string;
  items: Array<{ productId: number; name: string; price: number; qty: number; image?: string }>;
}

interface CampaignItem {
  id: number;
  title: string;
  subject: string;
  category: string;
  targetType: string;
  targetEmail: string | null;
  couponCode: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
}

export default function AdminMarketing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("abandoned-carts");

  // Broadcast & Composer Form State
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignCategory, setCampaignCategory] = useState("promotional");
  const [targetType, setTargetType] = useState<"all" | "individual">("all");
  const [targetEmail, setTargetEmail] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [contentHtml, setContentHtml] = useState(`
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
  <div style="background: linear-gradient(135deg, #0d3820, #15803d); padding: 28px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 800;">🌿 FarmFreshFarmer</h1>
    <p style="margin: 4px 0 0; font-size: 12px; color: #bbf7d0;">Fresh Organic Produce</p>
  </div>
  <div style="padding: 28px;">
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">Namaste {{name}}! 🙏</h2>
    <p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">
      We have an exciting announcement for your FarmFreshFarmer account ({{email}}).
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://farmfreshfarmer.com" style="background: #16a34a; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">
        🛒 Shop Fresh Harvest
      </a>
    </div>
  </div>
  <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
    © ${new Date().getFullYear()} FarmFreshFarmer · Visakhapatnam & Vijayawada
  </div>
</div>
`.trim());

  // 1-Time Coupon Vault Generator State
  const [vaultDiscount, setVaultDiscount] = useState("10");
  const [vaultPrefix, setVaultPrefix] = useState("RCV10");
  const [vaultEmail, setVaultEmail] = useState("");
  const [vaultHours, setVaultHours] = useState("48");

  // Query: Abandoned Carts
  const { data: cartsData, isLoading: cartsLoading, refetch: refetchCarts } = useQuery<{ carts: AbandonedCartItem[] }>({
    queryKey: ["/api/admin/marketing/abandoned-carts"],
    queryFn: () => apiGet<{ carts: AbandonedCartItem[] }>("/api/admin/marketing/abandoned-carts"),
    refetchInterval: 15000,
  });

  // Query: Campaigns History
  const { data: campaignsData, isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery<{ campaigns: CampaignItem[] }>({
    queryKey: ["/api/admin/marketing/campaigns"],
    queryFn: () => apiGet<{ campaigns: CampaignItem[] }>("/api/admin/marketing/campaigns"),
  });

  // Mutation: Send 10% Recovery Coupon
  const sendRecoveryMutation = useMutation({
    mutationFn: async (cart: AbandonedCartItem) => {
      const cartTotal = (cart.items || []).reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
      const res = await apiRequest("POST", "/api/admin/marketing/abandoned-carts/send-recovery", {
        userId: cart.userId,
        customerName: cart.userName,
        customerEmail: cart.userEmail,
        items: cart.items,
        cartTotal,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "⚡ 10% Recovery Email Sent!",
        description: data.message,
      });
      refetchCarts();
      refetchCampaigns();
    },
    onError: (err: any) => {
      toast({
        title: "Dispatch Failed",
        description: err.message || "Failed to send recovery email",
        variant: "destructive",
      });
    },
  });

  // Mutation: Generate 1-Time Secure Coupon
  const createSecureCouponMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/coupons/create-secure", {
        discountPercent: Number(vaultDiscount),
        prefix: vaultPrefix,
        restrictedEmail: vaultEmail || undefined,
        expiresInHours: Number(vaultHours),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🔑 Secure One-Time Coupon Created!",
        description: `Code ${data.coupon.code} is now active and locked.`,
      });
      setVaultEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
    },
    onError: (err: any) => {
      toast({
        title: "Coupon Creation Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Mutation: Send Test Email
  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/test-email", {
        subject: campaignSubject || "Test Marketing Campaign",
        html: contentHtml,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "✉️ Test Email Dispatched!", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Test Failed", description: err.message, variant: "destructive" });
    },
  });

  // Mutation: Broadcast Campaign
  const sendCampaignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/campaigns/send", {
        title: campaignTitle,
        subject: campaignSubject,
        category: campaignCategory,
        targetType,
        targetEmail: targetType === "individual" ? targetEmail : undefined,
        contentHtml,
        couponCode: couponCode || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "🚀 Campaign Launched!", description: data.message });
      refetchCampaigns();
    },
    onError: (err: any) => {
      toast({ title: "Campaign Failed", description: err.message, variant: "destructive" });
    },
  });

  // Pre-load templates
  const loadTemplate = (type: "flash" | "legal" | "security") => {
    if (type === "flash") {
      setCampaignTitle("Weekend Flash Sale 20% OFF");
      setCampaignSubject("⚡ Weekend Flash Sale: 20% OFF on Fresh Organic Mangoes & Sitaphal!");
      setCampaignCategory("promotional");
      setContentHtml(`
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
  <div style="background: linear-gradient(135deg, #0d3820, #15803d); padding: 32px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 26px; font-weight: 800;">🌿 FarmFreshFarmer</h1>
    <p style="margin: 6px 0 0; font-size: 12px; color: #bbf7d0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Weekend Flash Sale</p>
  </div>
  <div style="padding: 32px 28px;">
    <h2 style="margin: 0 0 14px; font-size: 20px; color: #0f172a; font-weight: 800;">Namaste {{name}}! 🥭</h2>
    <p style="margin: 0 0 18px; font-size: 14px; color: #475569; line-height: 1.6;">
      Fresh morning harvest has just arrived from our local organic farms in Andhra Pradesh. Enjoy an exclusive <strong>20% discount</strong> this weekend on fresh Sitaphal, Banganapalli mangoes, and traditional homemade avakaya pickles!
    </p>
    <div style="background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 14px; padding: 18px; text-align: center; margin: 24px 0;">
      <div style="font-size: 11px; font-weight: 800; color: #15803d; text-transform: uppercase;">Use Coupon Code at Checkout:</div>
      <div style="font-family: monospace; font-size: 26px; font-weight: 800; color: #166534; margin: 6px 0;">WEEKEND20</div>
      <div style="font-size: 12px; color: #15803d; font-weight: 600;">Valid on all orders above ₹299</div>
    </div>
    <div style="text-align: center; margin: 28px 0 10px;">
      <a href="https://farmfreshfarmer.com" style="background: linear-gradient(135deg, #15803d, #16a34a); color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 12px; display: inline-block;">
        🛒 Claim 20% OFF &amp; Shop Fresh
      </a>
    </div>
  </div>
  <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
    © ${new Date().getFullYear()} FarmFreshFarmer · 30–90 Mins Express Organic Farm Delivery
  </div>
</div>
`.trim());
    } else if (type === "legal") {
      setCampaignTitle("Terms of Service & DPDP Policy Update Notice");
      setCampaignSubject("📜 Important Notice: Update to FarmFreshFarmer Terms & Privacy Policies");
      setCampaignCategory("legal");
      setContentHtml(`
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
  <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 30px; text-align: center; color: #ffffff; border-bottom: 3px solid #22c55e;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 800;">🌿 FarmFreshFarmer</h1>
    <p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">Customer Policy &amp; DPDP Notice</p>
  </div>
  <div style="padding: 30px 28px;">
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a; font-weight: 800;">Hello {{name}},</h2>
    <p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">
      We have updated our <strong>Terms &amp; Conditions</strong> and <strong>Privacy Policy</strong> to strengthen customer rights and align with the Digital Personal Data Protection (DPDP) Act 2023.
    </p>
    <div style="background: #f8fafc; border-radius: 12px; padding: 18px; margin-bottom: 20px; font-size: 13px; color: #334155; line-height: 1.5;">
      • <strong>Freshness Assurance:</strong> 2-hour doorstep return window for perishable organic produce.<br/>
      • <strong>Data Security:</strong> Zero-trust hardware encryption and full control over your profile data.<br/>
      • <strong>Transparent Pricing:</strong> Clear GST breakdowns with zero hidden fees.
    </div>
    <div style="text-align: center; margin: 24px 0 10px;">
      <a href="https://farmfreshfarmer.com/terms" style="background: #0f172a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 10px; display: inline-block;">
        📄 Review Full Terms &amp; Conditions
      </a>
    </div>
  </div>
  <div style="background: #f8fafc; padding: 18px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
    FarmFreshFarmer Legal &amp; Compliance Team · admin@farmfreshfarmer.com
  </div>
</div>
`.trim());
    } else if (type === "security") {
      setCampaignTitle("Platform Security Engine v10.1.0 Activated");
      setCampaignSubject("🛡️ Security Alert: Next-Gen Zero-Trust Passkey Security is Now Live");
      setCampaignCategory("emergency");
      setContentHtml(`
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
  <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 30px; text-align: center; color: #ffffff; border-bottom: 3px solid #3b82f6;">
    <h1 style="margin: 0; font-size: 22px; font-weight: 800;">🛡️ FarmFreshFarmer Security Shield</h1>
    <p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">Security Core v10.1.0 Notification</p>
  </div>
  <div style="padding: 30px 28px;">
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a; font-weight: 800;">Namaste {{name}},</h2>
    <p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">
      We have upgraded our platform with <strong>Zero-Trust WebAuthn &amp; Passkey Protection</strong> to keep your payments, delivery address, and account completely secure.
    </p>
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; font-size: 13px; color: #1e40af; line-height: 1.5; margin-bottom: 20px;">
      🔒 <strong>What this means for you:</strong><br/>
      • Automated instant login alerts whenever your account is accessed.<br/>
      • Secure 1-click password reset via Email OTP in your profile.<br/>
      • 100% encrypted payment gateways.
    </div>
    <div style="text-align: center; margin: 24px 0 10px;">
      <a href="https://farmfreshfarmer.com/account" style="background: #2563eb; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 10px; display: inline-block;">
        👤 View Your Security Profile
      </a>
    </div>
  </div>
  <div style="background: #f8fafc; padding: 18px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
    FarmFreshFarmer Automated Security Guardian · admin@farmfreshfarmer.com
  </div>
</div>
`.trim());
    }
  };

  const carts = cartsData?.carts || [];
  const campaigns = campaignsData?.campaigns || [];

  return (
    <AdminLayout title="Email Marketing & Communications Studio">
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-foreground flex items-center gap-2">
              <Mail size={22} className="text-emerald-500" />
              Promotions, Abandoned Carts &amp; Legal Broadcasts
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send 10% recovery coupons, targeted VIP offers, legal terms notices, and emergency security broadcasts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black px-3 py-1 rounded-full">
              ⚡ Anti-Spam Engine: Active
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 bg-secondary/40 p-1 rounded-2xl border border-card-border">
            <TabsTrigger value="abandoned-carts" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
              <ShoppingCart size={14} /> Abandoned Carts ({carts.length})
            </TabsTrigger>
            <TabsTrigger value="campaign-studio" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
              <Send size={14} /> Campaign Studio
            </TabsTrigger>
            <TabsTrigger value="coupon-vault" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
              <KeyRound size={14} /> 1-Time Secure Vault
            </TabsTrigger>
            <TabsTrigger value="campaign-history" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
              <Clock size={14} /> History &amp; Logs
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Abandoned Cart 10% Recovery Engine */}
          <TabsContent value="abandoned-carts" className="space-y-4 m-0">
            <Card className="rounded-3xl border-card-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-extrabold flex items-center gap-2">
                    <ShoppingCart size={18} className="text-emerald-500" /> Pending Carts &amp; 10% Recovery Automation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Customers who added organic harvest to their cart &gt; 1 hour ago without checking out.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchCarts()}
                  disabled={cartsLoading}
                  className="h-8 text-xs rounded-xl cursor-pointer"
                >
                  <RefreshCw size={12} className={`mr-1.5 ${cartsLoading ? "animate-spin" : ""}`} /> Refresh Carts
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {carts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground space-y-2">
                    <ShoppingCart size={32} className="mx-auto opacity-40 mb-2" />
                    <p className="text-sm font-bold">No Pending Abandoned Carts</p>
                    <p className="text-xs">All customer carts in the last 7 days have either checked out or are currently active!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {carts.map((cart) => {
                      const total = (cart.items || []).reduce(
                        (acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 1),
                        0
                      );
                      const isPending = sendRecoveryMutation.isPending && sendRecoveryMutation.variables?.cartId === cart.cartId;

                      return (
                        <div
                          key={cart.cartId}
                          className="p-4 rounded-2xl bg-secondary/20 border border-card-border hover:border-emerald-500/40 transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-foreground">{cart.userName}</span>
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                  {cart.customerStars || 0}★ Tier
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{cart.userEmail}</p>
                              {cart.userPhone && <p className="text-[11px] text-muted-foreground/80 font-mono">📞 +91 {cart.userPhone}</p>}
                            </div>
                            <div className="text-right">
                              <span className="text-base font-black text-emerald-400">₹{total}</span>
                              <p className="text-[10px] text-muted-foreground">{cart.items?.length || 0} items</p>
                            </div>
                          </div>

                          {/* Item Pills */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(cart.items || []).slice(0, 4).map((it, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-lg bg-card border border-border text-[11px] font-medium text-foreground truncate max-w-[140px]"
                              >
                                {it.qty}× {it.name}
                              </span>
                            ))}
                            {(cart.items || []).length > 4 && (
                              <span className="text-[10px] text-muted-foreground font-bold">
                                +{(cart.items || []).length - 4} more
                              </span>
                            )}
                          </div>

                          {/* Recovery Button */}
                          <div className="pt-1 flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">
                              Cart active: {new Date(cart.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={() => sendRecoveryMutation.mutate(cart)}
                              className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl cursor-pointer"
                            >
                              {isPending ? (
                                "Sending..."
                              ) : (
                                <>
                                  <Sparkles size={12} className="mr-1" /> Send 10% One-Time Code
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Campaign Studio & Broadcast Composer */}
          <TabsContent value="campaign-studio" className="space-y-4 m-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Composer Form */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="rounded-3xl border-card-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-extrabold flex items-center gap-2">
                      <Send size={18} className="text-emerald-500" /> Email Campaign Composer
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Compose customized emails with dynamic tags (<code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{coupon_code}}"}</code>).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Quick Template Presets */}
                    <div>
                      <Label className="text-xs font-bold mb-1.5 block">⚡ 1-Click Luxury Templates</Label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => loadTemplate("flash")}
                          className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer"
                        >
                          🌿 20% Flash Sale
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => loadTemplate("legal")}
                          className="h-7 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 rounded-lg cursor-pointer"
                        >
                          📜 Terms &amp; Policy Revision
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => loadTemplate("security")}
                          className="h-7 text-xs border-blue-500/40 text-blue-400 hover:bg-blue-500/10 rounded-lg cursor-pointer"
                        >
                          🛡️ Security Core Alert
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="campTitle" className="text-xs font-bold">Internal Campaign Title</Label>
                        <Input
                          id="campTitle"
                          value={campaignTitle}
                          onChange={(e) => setCampaignTitle(e.target.value)}
                          placeholder="e.g. Weekend Flash Sale"
                          className="mt-1 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="campCat" className="text-xs font-bold">Category</Label>
                        <select
                          id="campCat"
                          value={campaignCategory}
                          onChange={(e) => setCampaignCategory(e.target.value)}
                          className="mt-1 w-full rounded-xl text-xs bg-background border border-input px-3 py-2 text-foreground font-semibold"
                        >
                          <option value="promotional">Promotional Offer</option>
                          <option value="legal">Terms &amp; Policy Update</option>
                          <option value="emergency">Security &amp; Emergency Alert</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="campSub" className="text-xs font-bold">Email Subject Line</Label>
                      <Input
                        id="campSub"
                        value={campaignSubject}
                        onChange={(e) => setCampaignSubject(e.target.value)}
                        placeholder="e.g. 🌿 Special 20% OFF on Today's Morning Harvest!"
                        className="mt-1 rounded-xl text-xs font-semibold"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-bold">Target Audience</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Button
                            type="button"
                            variant={targetType === "all" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTargetType("all")}
                            className="rounded-xl text-xs flex-1 cursor-pointer"
                          >
                            🌐 All Customers
                          </Button>
                          <Button
                            type="button"
                            variant={targetType === "individual" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTargetType("individual")}
                            className="rounded-xl text-xs flex-1 cursor-pointer"
                          >
                            👤 Individual
                          </Button>
                        </div>
                      </div>

                      {targetType === "individual" ? (
                        <div>
                          <Label htmlFor="targetEmail" className="text-xs font-bold">Recipient Email</Label>
                          <Input
                            id="targetEmail"
                            value={targetEmail}
                            onChange={(e) => setTargetEmail(e.target.value)}
                            placeholder="customer@example.com"
                            className="mt-1 rounded-xl text-xs"
                          />
                        </div>
                      ) : (
                        <div>
                          <Label htmlFor="couponCode" className="text-xs font-bold">Attached Coupon Code (Optional)</Label>
                          <Input
                            id="couponCode"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            placeholder="e.g. WEEKEND20"
                            className="mt-1 rounded-xl text-xs font-mono"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="htmlBody" className="text-xs font-bold">HTML Email Template</Label>
                        <span className="text-[10px] text-muted-foreground">Supported: inline CSS, tables, links</span>
                      </div>
                      <Textarea
                        id="htmlBody"
                        value={contentHtml}
                        onChange={(e) => setContentHtml(e.target.value)}
                        rows={12}
                        className="mt-1 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => sendTestMutation.mutate()}
                        disabled={sendTestMutation.isPending}
                        className="text-xs font-bold rounded-xl cursor-pointer"
                      >
                        {sendTestMutation.isPending ? "Sending..." : "✉️ Send Test to Super Admin"}
                      </Button>

                      <Button
                        type="button"
                        onClick={() => sendCampaignMutation.mutate()}
                        disabled={sendCampaignMutation.isPending || !campaignTitle || !campaignSubject}
                        className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl cursor-pointer"
                      >
                        {sendCampaignMutation.isPending ? (
                          "Launching..."
                        ) : (
                          <>
                            <Send size={14} className="mr-1.5" /> Launch Broadcast
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Live Email Preview */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="rounded-3xl border-card-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                      <Eye size={16} className="text-emerald-500" /> Live Preview
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Subject: <strong>{campaignSubject || "Subject preview..."}</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-3 bg-muted/30 border border-card-border rounded-2xl overflow-hidden max-h-[600px] overflow-y-auto">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: contentHtml
                            .replace(/\{\{name\}\}/gi, "Ganesh Varma")
                            .replace(/\{\{email\}\}/gi, "customer@farmfreshfarmer.com")
                            .replace(/\{\{coupon_code\}\}/gi, couponCode || "HARVEST10")
                            .replace(/\{\{star_tier\}\}/gi, "5-Star Diamond Tier"),
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: 1-Time Secure Coupon Vault */}
          <TabsContent value="coupon-vault" className="space-y-4 m-0">
            <Card className="rounded-3xl border-card-border bg-card">
              <CardHeader>
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <KeyRound size={18} className="text-emerald-500" /> Cryptographic 1-Time Coupon Vault
                </CardTitle>
                <CardDescription className="text-xs">
                  Generate unbreachable, single-use coupons with cryptographic random entropy, expiration, and optional user lock.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="vDisc" className="text-xs font-bold">Discount (%)</Label>
                    <Input
                      id="vDisc"
                      type="number"
                      value={vaultDiscount}
                      onChange={(e) => setVaultDiscount(e.target.value)}
                      placeholder="10"
                      min="1"
                      max="100"
                      className="mt-1 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vPrefix" className="text-xs font-bold">Code Prefix</Label>
                    <Input
                      id="vPrefix"
                      value={vaultPrefix}
                      onChange={(e) => setVaultPrefix(e.target.value)}
                      placeholder="RCV10"
                      className="mt-1 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vHours" className="text-xs font-bold">Validity (Hours)</Label>
                    <Input
                      id="vHours"
                      type="number"
                      value={vaultHours}
                      onChange={(e) => setVaultHours(e.target.value)}
                      placeholder="48"
                      className="mt-1 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vEmail" className="text-xs font-bold">Lock to Email (Optional)</Label>
                    <Input
                      id="vEmail"
                      value={vaultEmail}
                      onChange={(e) => setVaultEmail(e.target.value)}
                      placeholder="customer@example.com"
                      className="mt-1 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={() => createSecureCouponMutation.mutate()}
                    disabled={createSecureCouponMutation.isPending}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl cursor-pointer"
                  >
                    {createSecureCouponMutation.isPending ? "Generating..." : "⚡ Generate 1-Time Secure Code"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: Campaign History & Logs */}
          <TabsContent value="campaign-history" className="space-y-4 m-0">
            <Card className="rounded-3xl border-card-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-extrabold flex items-center gap-2">
                    <Clock size={18} className="text-emerald-500" /> Dispatched Campaign History
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Audit log of marketing, cart recovery, and legal email broadcasts.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchCampaigns()}
                  className="h-8 text-xs rounded-xl cursor-pointer"
                >
                  <RefreshCw size={12} className="mr-1.5" /> Refresh History
                </Button>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs font-bold">
                    No past email campaigns recorded.
                  </div>
                ) : (
                  <div className="divide-y divide-card-border">
                    {campaigns.map((camp) => (
                      <div key={camp.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-foreground">{camp.title}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {camp.category}
                            </Badge>
                            {camp.couponCode && (
                              <Badge className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                {camp.couponCode}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{camp.subject}</p>
                        </div>
                        <div className="text-right text-xs">
                          <span className="font-bold text-emerald-400">
                            {camp.sentCount} sent / {camp.totalRecipients} total
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(camp.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
