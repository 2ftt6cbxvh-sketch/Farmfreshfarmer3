import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
  Search,
  Check,
  ChevronDown,
  X,
  Code2,
  SlidersHorizontal,
  Palette,
  Gift,
  Phone,
  FileText,
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

interface CustomerOption {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  customerStars: number;
  totalOrders: number;
}

export default function AdminMarketing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("campaign-studio");

  // Visual Builder vs. Raw Code Mode
  const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");

  // Core Campaign Metadata
  const [campaignTitle, setCampaignTitle] = useState("Special Harvest Announcement");
  const [campaignSubject, setCampaignSubject] = useState("🌿 Special Announcement for Your FarmFreshFarmer Account!");
  const [campaignCategory, setCampaignCategory] = useState("promotional");
  const [targetType, setTargetType] = useState<"all" | "individual">("all");
  const [couponCode, setCouponCode] = useState("");

  // Searchable Customer Combobox State
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  // Visual Form Fields (0% HTML Knowledge Required)
  const [themeStyle, setThemeStyle] = useState<"green" | "gold" | "blue" | "slate">("green");
  const [headerBadge, setHeaderBadge] = useState("Fresh Organic Produce");
  const [greetingHeading, setGreetingHeading] = useState("Namaste {{name}}! 🙏");
  const [bodyMessage, setBodyMessage] = useState(
    "Fresh morning harvest has arrived directly from our certified organic cultivators in Andhra Pradesh. We are excited to offer you the season's finest fruits, vegetables, and traditional homemade Andhra pickles."
  );

  // Optional Highlight / Voucher Box
  const [showHighlightBox, setShowHighlightBox] = useState(true);
  const [highlightTitle, setHighlightTitle] = useState("🎁 Your Special Offer Code");
  const [highlightCode, setHighlightCode] = useState("{{coupon_code}}");
  const [highlightSubtitle, setHighlightSubtitle] = useState("✨ 10% Extra Discount · Valid for 48 Hours");

  // Optional Key Points List
  const [showKeyPoints, setShowKeyPoints] = useState(true);
  const [keyPoint1, setKeyPoint1] = useState("🌱 100% Chemical-Free Fresh Produce");
  const [keyPoint2, setKeyPoint2] = useState("⚡ 30–90 Mins Express Local Doorstep Delivery");
  const [keyPoint3, setKeyPoint3] = useState("🛡️ 2-Hour Doorstep Return & Full Refund Guarantee");

  // Call-To-Action Button
  const [ctaText, setCtaText] = useState("🛒 Shop Today's Harvest");
  const [ctaLink, setCtaLink] = useState("https://farmfreshfarmer.com");

  // Advanced Raw HTML State (for power users)
  const [rawHtmlContent, setRawHtmlContent] = useState("");

  // 1-Time Coupon Vault Generator State
  const [vaultDiscount, setVaultDiscount] = useState("10");
  const [vaultPrefix, setVaultPrefix] = useState("RCV10");
  const [vaultEmail, setVaultEmail] = useState("");
  const [vaultHours, setVaultHours] = useState("48");

  // Query: Customers for Searchable Dropdown
  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ["/api/admin/customers"],
    queryFn: () => apiGet<CustomerOption[]>("/api/admin/customers"),
  });

  // Filtered Customers based on Search Query
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers.slice(0, 20);
    const q = customerSearchQuery.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q))
      )
      .slice(0, 30);
  }, [customers, customerSearchQuery]);

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

  // Dynamically Compile Clean HTML from Visual Form
  const compiledHtml = useMemo(() => {
    if (editorMode === "code" && rawHtmlContent) {
      return rawHtmlContent;
    }

    const themeGradients = {
      green: "linear-gradient(135deg, #0d3820 0%, #15803d 100%)",
      gold: "linear-gradient(135deg, #854d0e 0%, #d97706 100%)",
      blue: "linear-gradient(135deg, #0f172a 0%, #2563eb 100%)",
      slate: "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
    };

    const headerGradient = themeGradients[themeStyle] || themeGradients.green;
    const buttonBg =
      themeStyle === "gold"
        ? "#d97706"
        : themeStyle === "blue"
        ? "#2563eb"
        : themeStyle === "slate"
        ? "#0f172a"
        : "#16a34a";

    const formattedParagraphs = bodyMessage
      .split("\n")
      .filter((p) => p.trim())
      .map(
        (p) =>
          `<p style="margin: 0 0 14px; font-size: 14px; color: #475569; line-height: 1.6;">${p.trim()}</p>`
      )
      .join("");

    const highlightBoxHtml = showHighlightBox
      ? `
      <div style="background-color: #f0fdf4; border: 2px dashed #22c55e; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0;">
        <div style="font-size: 11px; font-weight: 800; color: #15803d; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
          ${highlightTitle}
        </div>
        <div style="font-family: 'Courier New', monospace; font-size: 26px; font-weight: 800; letter-spacing: 3px; color: #166534; padding: 4px 0;">
          ${highlightCode}
        </div>
        <div style="font-size: 12px; color: #15803d; font-weight: 700; margin-top: 4px;">
          ${highlightSubtitle}
        </div>
      </div>
    `
      : "";

    const keyPointsHtml = showKeyPoints
      ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin: 20px 0;">
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
          ✨ Key Features &amp; Highlights:
        </div>
        ${keyPoint1 ? `<div style="margin-bottom: 8px; font-size: 12px; color: #334155; line-height: 1.5;">${keyPoint1}</div>` : ""}
        ${keyPoint2 ? `<div style="margin-bottom: 8px; font-size: 12px; color: #334155; line-height: 1.5;">${keyPoint2}</div>` : ""}
        ${keyPoint3 ? `<div style="font-size: 12px; color: #334155; line-height: 1.5;">${keyPoint3}</div>` : ""}
      </div>
    `
      : "";

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${campaignSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <span style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${bodyMessage.substring(0, 100)}...
  </span>
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td align="center" style="background: ${headerGradient}; padding: 32px 24px; color: #ffffff;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff;">🌿 FarmFreshFarmer</h1>
              <p style="margin: 6px 0 0; font-size: 12px; color: #bbf7d0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">${headerBadge}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 30px 28px;">
              <h2 style="margin: 0 0 14px; font-size: 20px; color: #0f172a; font-weight: 800;">${greetingHeading}</h2>
              ${formattedParagraphs}
              ${highlightBoxHtml}
              ${keyPointsHtml}

              <!-- Action CTA Button -->
              ${
                ctaText && ctaLink
                  ? `
                <div style="text-align: center; margin: 28px 0 16px;">
                  <a href="${ctaLink}" style="background: ${buttonBg}; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 34px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
                    ${ctaText}
                  </a>
                </div>
              `
                  : ""
              }

              <!-- Support Footer Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; font-size: 11px; color: #64748b; margin-top: 24px;">
                <strong>Need assistance with your orders?</strong><br/>
                • 📧 Email: <a href="mailto:admin@farmfreshfarmer.com" style="color: #15803d; font-weight: 700;">admin@farmfreshfarmer.com</a><br/>
                • 📞 Helpline &amp; WhatsApp: <a href="tel:+917989793669" style="color: #15803d; font-weight: 700;">+91 79897 93669</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
              <p style="margin: 0 0 4px;">Sent by FarmFreshFarmer · <a href="https://farmfreshfarmer.com" style="color: #16a34a; text-decoration: none;">farmfreshfarmer.com</a></p>
              <p style="margin: 0;">© ${new Date().getFullYear()} FarmFreshFarmer. All rights reserved. Visakhapatnam &amp; Vijayawada.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }, [
    editorMode,
    rawHtmlContent,
    themeStyle,
    headerBadge,
    greetingHeading,
    bodyMessage,
    showHighlightBox,
    highlightTitle,
    highlightCode,
    highlightSubtitle,
    showKeyPoints,
    keyPoint1,
    keyPoint2,
    keyPoint3,
    ctaText,
    ctaLink,
    campaignSubject,
  ]);

  // Keep rawHtml in sync when switching to code mode
  useEffect(() => {
    if (editorMode === "code" && !rawHtmlContent) {
      setRawHtmlContent(compiledHtml);
    }
  }, [editorMode]);

  // Insert Dynamic Tag at cursor or append
  const insertTag = (tag: string) => {
    setGreetingHeading((prev) => `${prev} ${tag}`);
    toast({ title: `Inserted ${tag}`, description: "Dynamic tag added to heading" });
  };

  // Pre-load templates into visual form
  const loadPresetTemplate = (type: "flash" | "legal" | "security") => {
    setEditorMode("visual");
    if (type === "flash") {
      setThemeStyle("green");
      setCampaignTitle("Weekend Flash Sale 20% OFF");
      setCampaignSubject("⚡ Weekend Flash Sale: 20% OFF on Fresh Organic Harvest!");
      setCampaignCategory("promotional");
      setHeaderBadge("Weekend Flash Harvest");
      setGreetingHeading("Namaste {{name}}! 🥭");
      setBodyMessage(
        "Fresh morning harvest has just arrived from our local organic farms in Andhra Pradesh!\n\nEnjoy an exclusive 20% discount this weekend on fresh Sitaphal, Banganapalli mangoes, sun-dried spices, and homemade avakaya pickles."
      );
      setShowHighlightBox(true);
      setHighlightTitle("🎁 Use Coupon Code at Checkout:");
      setHighlightCode("WEEKEND20");
      setHighlightSubtitle("✨ 20% Extra Discount · Valid on orders above ₹299");
      setShowKeyPoints(true);
      setKeyPoint1("🌱 100% Chemical-Free Certified Natural Produce");
      setKeyPoint2("⚡ 30–90 Mins Express Morning Delivery");
      setKeyPoint3("⭐ Earn VIP Stars towards lifetime discounts");
      setCtaText("🛒 Claim 20% OFF & Shop Fresh");
      setCtaLink("https://farmfreshfarmer.com");
    } else if (type === "legal") {
      setThemeStyle("slate");
      setCampaignTitle("Terms of Service & DPDP Policy Update Notice");
      setCampaignSubject("📜 Important Notice: Update to FarmFreshFarmer Terms & Privacy Policies");
      setCampaignCategory("legal");
      setHeaderBadge("Customer Policy & DPDP Notice");
      setGreetingHeading("Hello {{name}},");
      setBodyMessage(
        "We have updated our Terms & Conditions and Privacy Policy to strengthen customer rights and align with the Digital Personal Data Protection (DPDP) Act 2023.\n\nYour trust and data security remain our highest priority."
      );
      setShowHighlightBox(false);
      setShowKeyPoints(true);
      setKeyPoint1("🌱 100% Chemical-Free Organic Guarantee with transparent farmer sourcing");
      setKeyPoint2("🛡️ 2-Hour Doorstep Return & Full Refund window for perishable items");
      setKeyPoint3("🔒 Complete data encryption with zero selling of customer information");
      setCtaText("📄 Review Full Terms & Conditions");
      setCtaLink("https://farmfreshfarmer.com/terms");
    } else if (type === "security") {
      setThemeStyle("blue");
      setCampaignTitle("Platform Security Engine v10.1.0 Activated");
      setCampaignSubject("🛡️ Security Alert: Next-Gen Zero-Trust Passkey Security is Now Live");
      setCampaignCategory("emergency");
      setHeaderBadge("Security Core v10.1.0 Notification");
      setGreetingHeading("Namaste {{name}},");
      setBodyMessage(
        "We have upgraded FarmFreshFarmer with Zero-Trust Passkey & Email OTP Protection to keep your payments, delivery address, and account completely secure.\n\nYou can now update your password directly in your profile or reset it instantly via Email OTP."
      );
      setShowHighlightBox(true);
      setHighlightTitle("🔒 What this means for your account:");
      setHighlightCode("ZERO-TRUST ACTIVE");
      setHighlightSubtitle("Automated instant login alerts & 100% encrypted transactions");
      setShowKeyPoints(true);
      setKeyPoint1("🛡️ Instant email alerts whenever your account is accessed");
      setKeyPoint2("🔑 1-Click secure password reset in your profile settings");
      setKeyPoint3("💳 PCI-DSS encrypted payment gateways");
      setCtaText("👤 View Your Security Profile");
      setCtaLink("https://farmfreshfarmer.com/account");
    }
  };

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
        html: compiledHtml,
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
        targetEmail: targetType === "individual" ? selectedCustomer?.email : undefined,
        targetUserId: targetType === "individual" ? selectedCustomer?.id : undefined,
        contentHtml: compiledHtml,
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
              Visual No-Code Email Studio with real-time preview, searchable customer selector &amp; 10% recovery engine
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Anti-Spam Engine: Active
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 bg-secondary/40 p-1 rounded-2xl border border-card-border">
            <TabsTrigger value="campaign-studio" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
              <Send size={14} /> Campaign Studio
            </TabsTrigger>
            <TabsTrigger value="abandoned-carts" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
              <ShoppingCart size={14} /> Abandoned Carts ({carts.length})
            </TabsTrigger>
            <TabsTrigger value="coupon-vault" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
              <KeyRound size={14} /> 1-Time Secure Vault
            </TabsTrigger>
            <TabsTrigger value="campaign-history" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
              <Clock size={14} /> History &amp; Logs
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Visual Campaign Studio & Broadcast Composer */}
          <TabsContent value="campaign-studio" className="space-y-4 m-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Easy Visual Form Composer */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="rounded-3xl border-card-border bg-card">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-extrabold flex items-center gap-2">
                        <SlidersHorizontal size={18} className="text-emerald-500" />
                        {editorMode === "visual" ? "Visual Email Builder (No-Code)" : "Advanced HTML Code Source"}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {editorMode === "visual"
                          ? "Fill in simple fields below. The system automatically creates a luxury, anti-spam email layout."
                          : "Directly edit raw HTML tags, inline styles, and markup."}
                      </CardDescription>
                    </div>
                    {/* Toggle between Visual and Code mode */}
                    <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-card-border">
                      <button
                        type="button"
                        onClick={() => setEditorMode("visual")}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          editorMode === "visual"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Visual Form
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorMode("code")}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          editorMode === "code"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Code2 size={12} className="inline mr-1" /> HTML Code
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 1-Click Preset Templates */}
                    <div>
                      <Label className="text-xs font-bold mb-1.5 block">⚡ 1-Click Luxury Templates</Label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => loadPresetTemplate("flash")}
                          className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer"
                        >
                          🌿 20% Flash Sale
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => loadPresetTemplate("legal")}
                          className="h-7 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 rounded-lg cursor-pointer"
                        >
                          📜 Terms &amp; Policy Revision
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => loadPresetTemplate("security")}
                          className="h-7 text-xs border-blue-500/40 text-blue-400 hover:bg-blue-500/10 rounded-lg cursor-pointer"
                        >
                          🛡️ Security Core Alert
                        </Button>
                      </div>
                    </div>

                    {/* Campaign Title & Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="campTitle" className="text-xs font-bold">Campaign Internal Title</Label>
                        <Input
                          id="campTitle"
                          value={campaignTitle}
                          onChange={(e) => setCampaignTitle(e.target.value)}
                          placeholder="e.g. Weekend Flash Sale"
                          className="mt-1 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="campCat" className="text-xs font-bold">Campaign Category</Label>
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

                    {/* Email Subject Line */}
                    <div>
                      <Label htmlFor="campSub" className="text-xs font-bold">Email Subject Line (What customer sees in inbox)</Label>
                      <Input
                        id="campSub"
                        value={campaignSubject}
                        onChange={(e) => setCampaignSubject(e.target.value)}
                        placeholder="e.g. 🌿 Special 20% OFF on Today's Harvest!"
                        className="mt-1 rounded-xl text-xs font-semibold"
                      />
                    </div>

                    {/* Target Audience & SEARCHABLE CUSTOMER DROPDOWN */}
                    <div className="p-3.5 rounded-2xl bg-secondary/30 border border-card-border space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-extrabold text-foreground">Target Audience</Label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetType("all");
                              setSelectedCustomer(null);
                            }}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              targetType === "all"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            🌐 All Customers (Broadcast)
                          </button>
                          <button
                            type="button"
                            onClick={() => setTargetType("individual")}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              targetType === "individual"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            👤 Individual Customer
                          </button>
                        </div>
                      </div>

                      {/* INDIVIDUAL CUSTOMER SELECTOR / SEARCH DROPDOWN */}
                      {targetType === "individual" && (
                        <div className="space-y-2 pt-1">
                          <Label className="text-xs font-bold text-foreground">
                            Search &amp; Select Customer by Name, Email, or Phone:
                          </Label>

                          {selectedCustomer ? (
                            <div className="p-3 rounded-xl bg-card border border-emerald-500/40 flex items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-xs text-foreground">{selectedCustomer.name}</span>
                                  <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    {selectedCustomer.customerStars}★ Tier
                                  </Badge>
                                </div>
                                <div className="text-xs font-mono text-emerald-400 font-bold mt-0.5">
                                  📧 {selectedCustomer.email}
                                </div>
                                {selectedCustomer.phone && (
                                  <div className="text-[11px] text-muted-foreground">
                                    📞 +91 {selectedCustomer.phone} · {selectedCustomer.totalOrders} past orders
                                  </div>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedCustomer(null);
                                  setIsCustomerDropdownOpen(true);
                                }}
                                className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <X size={14} className="mr-1" /> Change
                              </Button>
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  value={customerSearchQuery}
                                  onChange={(e) => {
                                    setCustomerSearchQuery(e.target.value);
                                    setIsCustomerDropdownOpen(true);
                                  }}
                                  onFocus={() => setIsCustomerDropdownOpen(true)}
                                  placeholder="Type name, email address (e.g. ganesh@...) or mobile number..."
                                  className="pl-9 rounded-xl text-xs"
                                />
                              </div>

                              {/* Search Results Dropdown List */}
                              {isCustomerDropdownOpen && (
                                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-60 overflow-y-auto rounded-2xl bg-popover border border-border shadow-xl divide-y divide-border/60">
                                  {filteredCustomers.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-muted-foreground">
                                      No customers found matching &quot;{customerSearchQuery}&quot;
                                    </div>
                                  ) : (
                                    filteredCustomers.map((cust) => (
                                      <button
                                        key={cust.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCustomer(cust);
                                          setIsCustomerDropdownOpen(false);
                                          setCustomerSearchQuery("");
                                        }}
                                        className="w-full text-left p-3 hover:bg-secondary/60 transition-colors flex items-start justify-between gap-3 cursor-pointer"
                                      >
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-xs text-foreground">{cust.name}</span>
                                            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-md text-muted-foreground font-semibold">
                                              {cust.customerStars}★
                                            </span>
                                          </div>
                                          {/* Email displayed clearly below the name to resolve any duplicates */}
                                          <div className="text-[11px] font-mono text-emerald-400 font-bold mt-0.5">
                                            📧 {cust.email}
                                          </div>
                                          {cust.phone && (
                                            <div className="text-[10px] text-muted-foreground">
                                              📞 +91 {cust.phone}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
                                          {cust.totalOrders} orders
                                        </div>
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* VISUAL BUILDER FIELDS */}
                    {editorMode === "visual" ? (
                      <div className="space-y-4 pt-1">
                        {/* Theme Style Selector */}
                        <div>
                          <Label className="text-xs font-bold mb-1.5 block">🎨 Header Style &amp; Theme Color</Label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { id: "green", label: "🌿 Organic Green", color: "bg-emerald-700" },
                              { id: "gold", label: "⚡ Festive Gold", color: "bg-amber-600" },
                              { id: "blue", label: "🛡️ Security Blue", color: "bg-blue-600" },
                              { id: "slate", label: "📜 Legal Slate", color: "bg-slate-800" },
                            ].map((th) => (
                              <button
                                key={th.id}
                                type="button"
                                onClick={() => setThemeStyle(th.id as any)}
                                className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                                  themeStyle === th.id
                                    ? "border-emerald-500 bg-emerald-500/10 text-foreground shadow-xs"
                                    : "border-border text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                <span className={`w-3 h-3 rounded-full ${th.color}`} />
                                <span>{th.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Header Tagline & Greeting */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="headBadge" className="text-xs font-bold">Header Sub-Tagline</Label>
                            <Input
                              id="headBadge"
                              value={headerBadge}
                              onChange={(e) => setHeaderBadge(e.target.value)}
                              placeholder="e.g. Special Harvest Reward"
                              className="mt-1 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="greetHead" className="text-xs font-bold">Greeting Heading</Label>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => insertTag("{{name}}")}
                                  className="text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer"
                                >
                                  + {"{{name}}"}
                                </button>
                              </div>
                            </div>
                            <Input
                              id="greetHead"
                              value={greetingHeading}
                              onChange={(e) => setGreetingHeading(e.target.value)}
                              placeholder="e.g. Namaste {{name}}! 🥭"
                              className="mt-1 rounded-xl text-xs font-semibold"
                            />
                          </div>
                        </div>

                        {/* Email Body Message (Normal Text / Paragraphs) */}
                        <div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="bodyMsg" className="text-xs font-bold">
                              Email Message (Normal text / paragraphs — no code needed)
                            </Label>
                            <span className="text-[10px] text-muted-foreground">Press Enter for new paragraph</span>
                          </div>
                          <Textarea
                            id="bodyMsg"
                            value={bodyMessage}
                            onChange={(e) => setBodyMessage(e.target.value)}
                            rows={4}
                            placeholder="Write your email content here normally..."
                            className="mt-1 rounded-xl text-xs leading-relaxed"
                          />
                        </div>

                        {/* Offer / Voucher Highlight Box (Toggle) */}
                        <div className="p-3.5 rounded-2xl bg-secondary/20 border border-card-border space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Gift size={15} className="text-emerald-400" />
                              <span className="text-xs font-extrabold text-foreground">Include Special Offer / Voucher Box</span>
                            </div>
                            <Switch checked={showHighlightBox} onCheckedChange={setShowHighlightBox} />
                          </div>

                          {showHighlightBox && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                              <div>
                                <Label htmlFor="hlTitle" className="text-xs font-bold">Box Title</Label>
                                <Input
                                  id="hlTitle"
                                  value={highlightTitle}
                                  onChange={(e) => setHighlightTitle(e.target.value)}
                                  placeholder="e.g. 🎁 Your Voucher Code"
                                  className="mt-1 rounded-xl text-xs"
                                />
                              </div>
                              <div>
                                <Label htmlFor="hlCode" className="text-xs font-bold">Code / Highlight Text</Label>
                                <Input
                                  id="hlCode"
                                  value={highlightCode}
                                  onChange={(e) => setHighlightCode(e.target.value)}
                                  placeholder="e.g. WEEKEND20 or {{coupon_code}}"
                                  className="mt-1 rounded-xl text-xs font-mono font-bold"
                                />
                              </div>
                              <div>
                                <Label htmlFor="hlSub" className="text-xs font-bold">Validity / Subtitle</Label>
                                <Input
                                  id="hlSub"
                                  value={highlightSubtitle}
                                  onChange={(e) => setHighlightSubtitle(e.target.value)}
                                  placeholder="e.g. Valid on all orders above ₹299"
                                  className="mt-1 rounded-xl text-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Key Points / Features (Toggle) */}
                        <div className="p-3.5 rounded-2xl bg-secondary/20 border border-card-border space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={15} className="text-emerald-400" />
                              <span className="text-xs font-extrabold text-foreground">Include Key Highlights / Feature Bullets</span>
                            </div>
                            <Switch checked={showKeyPoints} onCheckedChange={setShowKeyPoints} />
                          </div>

                          {showKeyPoints && (
                            <div className="space-y-2 pt-1">
                              <Input
                                value={keyPoint1}
                                onChange={(e) => setKeyPoint1(e.target.value)}
                                placeholder="Bullet point 1..."
                                className="rounded-xl text-xs"
                              />
                              <Input
                                value={keyPoint2}
                                onChange={(e) => setKeyPoint2(e.target.value)}
                                placeholder="Bullet point 2..."
                                className="rounded-xl text-xs"
                              />
                              <Input
                                value={keyPoint3}
                                onChange={(e) => setKeyPoint3(e.target.value)}
                                placeholder="Bullet point 3..."
                                className="rounded-xl text-xs"
                              />
                            </div>
                          )}
                        </div>

                        {/* Call-To-Action Button */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="ctaT" className="text-xs font-bold">Action Button Text</Label>
                            <Input
                              id="ctaT"
                              value={ctaText}
                              onChange={(e) => setCtaText(e.target.value)}
                              placeholder="e.g. 🛒 Shop Fresh Harvest"
                              className="mt-1 rounded-xl text-xs font-bold"
                            />
                          </div>
                          <div>
                            <Label htmlFor="ctaL" className="text-xs font-bold">Button Link URL</Label>
                            <Input
                              id="ctaL"
                              value={ctaLink}
                              onChange={(e) => setCtaLink(e.target.value)}
                              placeholder="https://farmfreshfarmer.com"
                              className="mt-1 rounded-xl text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* RAW HTML SOURCE CODE MODE */
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="rawHtml" className="text-xs font-bold">Custom HTML Source Code</Label>
                          <span className="text-[10px] text-muted-foreground">Full HTML markup</span>
                        </div>
                        <Textarea
                          id="rawHtml"
                          value={rawHtmlContent}
                          onChange={(e) => setRawHtmlContent(e.target.value)}
                          rows={14}
                          className="mt-1 rounded-xl text-xs font-mono"
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
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
                        disabled={
                          sendCampaignMutation.isPending ||
                          !campaignTitle ||
                          !campaignSubject ||
                          (targetType === "individual" && !selectedCustomer)
                        }
                        className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl cursor-pointer"
                      >
                        {sendCampaignMutation.isPending ? (
                          "Launching..."
                        ) : (
                          <>
                            <Send size={14} className="mr-1.5" />
                            {targetType === "individual"
                              ? `Send to ${selectedCustomer?.name || "Customer"}`
                              : "🚀 Launch Broadcast"}
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
                    <CardDescription className="text-xs truncate">
                      Subject: <strong>{campaignSubject || "Subject preview..."}</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-3 bg-muted/30 border border-card-border rounded-2xl overflow-hidden max-h-[660px] overflow-y-auto">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: compiledHtml
                            .replace(/\{\{name\}\}/gi, selectedCustomer?.name || "Ganesh Varma")
                            .replace(/\{\{email\}\}/gi, selectedCustomer?.email || "customer@farmfreshfarmer.com")
                            .replace(/\{\{coupon_code\}\}/gi, couponCode || "WEEKEND20")
                            .replace(
                              /\{\{star_tier\}\}/gi,
                              selectedCustomer ? `${selectedCustomer.customerStars}★ Tier` : "5-Star Diamond Tier"
                            ),
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Abandoned Cart 10% Recovery Engine */}
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
                              <p className="text-xs font-mono text-emerald-400 font-bold">{cart.userEmail}</p>
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

          {/* TAB 3: 1-Time Secure Coupon Vault */}
          <TabsContent value="coupon-vault" className="space-y-4 m-0">
            <Card className="rounded-3xl border-card-border bg-card">
              <CardHeader>
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <KeyRound size={18} className="text-emerald-500" /> Cryptographic 1-Time Coupon Vault
                </CardTitle>
                <CardDescription className="text-xs">
                  Generate unbreachable, single-use coupons with cryptographic random entropy, expiration, and optional customer email lock.
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
