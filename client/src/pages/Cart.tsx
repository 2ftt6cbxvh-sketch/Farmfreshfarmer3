import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2, ShoppingBag, Tag, Gift, Wallet, Smartphone, Globe, Navigation, AlertTriangle, Sparkles, LogIn, Mail, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useCart, useAuth } from "@/lib/store";
import { formatINR } from "@/lib/types";
import { getStarTheme } from "@/lib/starTheme";
import { apiRequest, apiGet, imgUrl, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneVerificationModal } from "@/components/PhoneVerificationModal";
import { EmailVerificationModal } from "@/components/EmailVerificationModal";
import { VerifiedBadge } from "@/components/VerifiedBadge";

interface CouponResult {
  valid: boolean;
  code?: string;
  discountPercent?: number;
  message?: string;
}

interface ReferralValidateResult {
  valid: boolean;
  code?: string;
  message?: string;
}

interface ReferralSummary {
  code: string;
  totalReferrals: number;
  successfulReferrals: number;
  totalEarned: number;
  availableBalance: number;
  referrals: unknown[];
  rewards: unknown[];
}

interface PriceBreakdownLine {
  ruleType: string;
  label: string;
  amount: number;
}

interface PriceQuote {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  deliveryCity: string | null;
  total: number;
  firstOrderDiscount: number;
  referralDiscount: number;
  referralRewardApplied: number;
  couponDiscount: number;
  starDiscountAmount?: number;
  starDiscountPercent?: number;
  breakdown: PriceBreakdownLine[];
}

interface DeliveryCity {
  name: string;
  charge: number;
  freeAbove: number;
}
interface DeliveryRules {
  enabled: boolean;
  cities: DeliveryCity[];
}

interface InitiatePaymentResult {
  paymentId: number;
  merchantOrderId: string;
  redirectUrl: string;
  simulated: boolean;
}

type PaymentMethod = "COD" | "PHONEPE";

export default function Cart() {
  const { items, setQty, remove, subtotal, clear } = useCart();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.isPrimaryAdmin || user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" || user?.id === 1);
  const isStaffRole = Boolean(user && !isSuperAdmin && user.role !== "customer");
  const userStarsCount = isSuperAdmin ? 6 : isStaffRole ? Math.max(0, Number(user?.starRating) ?? 5) : Number(user?.customerStars || 0);
  const cartStarTheme = getStarTheme(userStarsCount, true);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discountPercent: number } | null>(null);

  const [referralInput, setReferralInput] = useState("");
  const [referralValidated, setReferralValidated] = useState<string | null>(null);
  const [redeemReward, setRedeemReward] = useState(false);
  const [isInternationalDelivery, setIsInternationalDelivery] = useState(false);

  const [deliveryRes, setDeliveryRes] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem("deliveryResolution") || "null"); } catch { return null; }
  });

  const { data: publicSettings } = useQuery<{
    free_delivery_min?: string;
    delivery_fee?: string;
  }>({ 
    queryKey: ["/api/settings/public"],
    queryFn: () => apiGet("/api/settings/public"),
    staleTime: 5 * 60 * 1000,
  });

  const [inputPincode, setInputPincode] = useState<string>(deliveryRes?.pincode || "");

  useEffect(() => {
    if (deliveryRes?.pincode) {
      setInputPincode(deliveryRes.pincode);
    }
  }, [deliveryRes?.pincode]);

  const resolvePincodeMutation = useMutation({
    mutationFn: async (p: string) => {
      const res = await apiRequest("POST", "/api/delivery/resolve", { pincode: p });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data) {
        setDeliveryRes(data);
        localStorage.setItem("deliveryResolution", JSON.stringify(data));
        window.dispatchEvent(new CustomEvent("deliveryResolutionUpdated", { detail: data }));
        if (data.locationArea) {
          setCityArea(data.locationArea);
        }
        toast({ title: "📍 Location & Delivery Fee Updated", description: `${data.locationArea || data.pincode} — Fee: ${data.fee > 0 ? "₹" + data.fee : "Free"}` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Resolution Failed", description: err.message || "Invalid PIN code", variant: "destructive" });
    },
  });

  const handleCheckPincode = (p: string) => {
    const clean = p.trim();
    if (/^[1-9][0-9]{5}$/.test(clean)) {
      resolvePincodeMutation.mutate(clean);
    } else {
      toast({ title: "Invalid PIN Code", description: "Please enter a valid 6-digit Indian postal code (e.g. 522502)", variant: "destructive" });
    }
  };

  const resolveGpsMutation = useMutation({
    mutationFn: async (payload: { lat: number; lng: number }) => {
      const res = await apiRequest("POST", "/api/delivery/resolve", payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data) {
        setDeliveryRes(data);
        localStorage.setItem("deliveryResolution", JSON.stringify(data));
        window.dispatchEvent(new CustomEvent("deliveryResolutionUpdated", { detail: data }));
        if (data.pincode) setInputPincode(data.pincode);
        if (data.locationArea) setCityArea(data.locationArea);
        toast({ title: "📍 Location Detected", description: `${data.locationArea || data.pincode}` });
      }
    },
    onError: () => {
      toast({ title: "GPS Detection Failed", description: "Please enter PIN code manually", variant: "destructive" });
    },
  });

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation Unsupported", description: "Please enter your 6-digit PIN code manually.", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolveGpsMutation.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.warn("GPS failed, using default PIN", err);
        resolvePincodeMutation.mutate("522502");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [cityArea, setCityArea] = useState(deliveryRes?.locationArea || "");
  const [streetAddress, setStreetAddress] = useState(user?.address || "");

  useEffect(() => {
    if (user?.phone && !phone) setPhone(user.phone);
    if (user?.name && !name) setName(user.name);
    if (user?.address && !streetAddress) setStreetAddress(user.address);
  }, [user?.phone, user?.name, user?.address]);

  useEffect(() => {
    if (deliveryRes?.locationArea) {
      setCityArea(deliveryRes.locationArea);
    }
  }, [deliveryRes?.locationArea]);

  useEffect(() => {
    const handleLocationUpdate = (e: any) => {
      const updatedRes = e.detail || (() => {
        try { return JSON.parse(localStorage.getItem("deliveryResolution") || "null"); } catch { return null; }
      })();
      if (updatedRes) {
        setDeliveryRes(updatedRes);
        if (updatedRes.locationArea) {
          setCityArea(updatedRes.locationArea);
        }
      }
    };

    window.addEventListener("deliveryResolutionUpdated", handleLocationUpdate);
    window.addEventListener("storage", handleLocationUpdate);
    return () => {
      window.removeEventListener("deliveryResolutionUpdated", handleLocationUpdate);
      window.removeEventListener("storage", handleLocationUpdate);
    };
  }, []);

  const activeRadiusKm = deliveryRes?.maxRadiusKm || 30;

  const [city, setCity] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");

  // Serviceable cities + delivery charges (admin-configured).
  const { data: deliveryRules } = useQuery<DeliveryRules>({
    queryKey: ["/api/delivery-rules"],
    queryFn: () => apiGet<DeliveryRules>("/api/delivery-rules"),
  });
  const deliveryEnabled = deliveryRules?.enabled ?? false;

  // Checkout config — whether Cash on Delivery is offered (admin toggle).
  const { data: checkoutConfig } = useQuery<{ codEnabled: boolean }>({
    queryKey: ["/api/checkout-config"],
    queryFn: () => apiGet<{ codEnabled: boolean }>("/api/checkout-config"),
  });
  const codEnabled = checkoutConfig?.codEnabled !== false;

  // If COD is disabled, make sure the selected method isn't COD.
  useEffect(() => {
    if (checkoutConfig && !codEnabled && paymentMethod === "COD") {
      setPaymentMethod("PHONEPE");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutConfig, codEnabled]);

  const [quote, setQuote] = useState<PriceQuote | null>(null);

  // Referral summary (only meaningful for logged-in users) to surface the "use my reward" toggle.
  const { data: referralSummary } = useQuery<ReferralSummary>({
    queryKey: ["/api/referral/summary"],
    queryFn: () => apiGet<ReferralSummary>("/api/referral/summary"),
    enabled: !!user,
  });

  const { data: allProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: () => apiGet<any[]>("/api/products"),
    staleTime: 10000,
  });

  const { data: allPlans = [] } = useQuery<any[]>({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      return res.json();
    },
  });

  const isServiceable = isInternationalDelivery || !deliveryRes || deliveryRes.serviceable !== false;

  // Subscription items in cart (strictly local Visakhapatnam delivery)
  const subscriptionCartItems = items.filter((cartItem) => {
    const isPlan = (allPlans || []).some((p: any) =>
      p.name?.toLowerCase() === cartItem.name?.toLowerCase() ||
      cartItem.name?.toLowerCase().includes(p.name?.toLowerCase()) ||
      p.productId === cartItem.productId
    );
    const prod = allProducts.find((p) => p.id === cartItem.productId);
    return isPlan || prod?.categorySlug === "subscriptions" || cartItem.unit?.toLowerCase().includes("weekly box");
  });

  const hasSubscriptionInCart = subscriptionCartItems.length > 0;

  // Items in cart that are restricted to local warehouse delivery only (including subscriptions)
  const localOnlyConflictItems = items.filter((cartItem) => {
    const isSub = subscriptionCartItems.some((s) => s.productId === cartItem.productId);
    if (isSub) return true;
    const p = allProducts.find((prod) => prod.id === cartItem.productId);
    return p && p.allowInternationalShipping === false;
  });

  const handleRemoveSubscriptionItems = () => {
    subscriptionCartItems.forEach((it) => remove(it.productId));
    setIsInternationalDelivery(true);
    toast({
      title: "Subscription Box Removed",
      description: "International / Out-of-Station Shipping mode activated.",
    });
  };

  const handleToggleInternational = (checked: boolean) => {
    if (checked && hasSubscriptionInCart) {
      setIsInternationalDelivery(false);
      toast({
        title: "Subscriptions Cannot Be Shipped Internationally",
        description: "Weekly subscription boxes are fresh produce delivered in Visakhapatnam only. Please remove the subscription to enable International / Out-of-Station Shipping.",
        variant: "destructive",
      });
      return;
    }
    if (checked && localOnlyConflictItems.length > 0) {
      setIsInternationalDelivery(false);
      toast({
        title: "Cannot Enable Out-of-Station Shipping",
        description: `Your cart contains ${localOnlyConflictItems.length} item(s) restricted to local warehouse delivery only.`,
        variant: "destructive",
      });
      return;
    }
    setIsInternationalDelivery(checked);
  };

  const handleRemoveLocalOnlyItems = () => {
    localOnlyConflictItems.forEach((it) => remove(it.productId));
    setIsInternationalDelivery(true);
    toast({
      title: "Local-Only Items Removed",
      description: "International / Out-of-Station Shipping mode activated.",
    });
  };

  const quoteMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/price/quote", {
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        couponCode: coupon?.code ?? null,
        referralCode: referralInput.trim() || null,
        redeemReward,
        city: city || null,
        pincode: deliveryRes?.pincode || "522502",
      }).then((r) => r.json() as Promise<PriceQuote>),
    onSuccess: (data) => setQuote(data),
    onError: () => setQuote(null),
  });

  // Re-fetch the live quote whenever items/coupon/referral/redeem toggle change.
  const itemsFingerprint = items.map((i) => `${i.productId}:${i.qty}:${i.price}`).join(",");
  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      return;
    }
    quoteMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsFingerprint, coupon?.code, referralInput, redeemReward, city, deliveryRes?.pincode]);

  const isLocationUnserviceable = !isInternationalDelivery && deliveryRes && deliveryRes.serviceable === false;

  // Calculate subscription plan bundle discount / savings across cart items
  const planSavingsInfo = items.map((cartItem) => {
    const matchingPlan = (allPlans || []).find((p: any) =>
      p.name?.toLowerCase() === cartItem.name?.toLowerCase() ||
      cartItem.name?.toLowerCase().includes(p.name?.toLowerCase()) ||
      p.productId === cartItem.productId
    );
    if (!matchingPlan) return null;
    const storeVal = matchingPlan.items?.reduce((sum: number, it: any) => sum + (Number(it.productPrice) || 0) * it.qty, 0) || 0;
    const planP = Number(matchingPlan.price) || 0;
    const savings = Math.max(0, storeVal - planP);
    return {
      planName: matchingPlan.name,
      storeValue: storeVal * cartItem.qty,
      planPrice: planP * cartItem.qty,
      savings: savings * cartItem.qty,
    };
  }).filter(Boolean);

  const totalBundleSavings = planSavingsInfo.reduce((sum, s) => sum + (s?.savings || 0), 0);
  const totalStoreValue = planSavingsInfo.reduce((sum, s) => sum + (s?.storeValue || 0), 0);

  const displaySubtotal = quote ? Number(quote.subtotal) : subtotal;
  const displayDiscount = quote ? Number(quote.discount) : coupon ? Math.round(subtotal * (coupon.discountPercent / 100) * 100) / 100 : 0;
  const totalOrderSavings = displayDiscount + totalBundleSavings;
  const freeDeliveryThreshold = Number(deliveryRes?.freeDeliveryAbove ?? (publicSettings?.free_delivery_min ?? (deliveryRules?.freeAbove ?? 500)));
  const isFreeDelivery = subtotal >= freeDeliveryThreshold;

  const fallbackDeliveryFee = (isInternationalDelivery || isLocationUnserviceable || isFreeDelivery)
    ? 0
    : ((deliveryRes && typeof deliveryRes.fee === "number" && deliveryRes.fee > 0)
        ? Number(deliveryRes.fee)
        : (Number(publicSettings?.delivery_fee) || 30));

  const effectiveDeliveryFee = (isInternationalDelivery || isLocationUnserviceable || isFreeDelivery)
    ? 0
    : (quote ? Number(quote.deliveryFee) : fallbackDeliveryFee);

  const displayTotal = (isInternationalDelivery || isLocationUnserviceable || isFreeDelivery)
    ? (quote ? Math.round((Number(quote.total) - Number(quote.deliveryFee)) * 100) / 100 : Math.round((subtotal - displayDiscount) * 100) / 100)
    : (quote ? Number(quote.total) : Math.round((subtotal - displayDiscount + fallbackDeliveryFee) * 100) / 100);

  const applyCoupon = useMutation({
    mutationFn: () => apiGet<CouponResult>(`/api/coupons/validate?code=${encodeURIComponent(couponInput.trim())}&subtotal=${subtotal}`),
    onSuccess: (res: any) => {
      const discountPct = parseFloat(String(res.discountPercent ?? res.discount ?? 0));
      if (res.valid && res.code && discountPct > 0) {
        setCoupon({ code: res.code, discountPercent: discountPct });
        toast({ title: "Coupon applied", description: `${discountPct}% off` });
      } else {
        setCoupon(null);
        toast({ title: "Coupon not valid", description: res.message || "Please check the code.", variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Invalid coupon", variant: "destructive" }),
  });

  const validateReferral = useMutation({
    mutationFn: () => apiGet<ReferralValidateResult>(`/api/referral/validate?code=${encodeURIComponent(referralInput.trim())}`),
    onSuccess: (res) => {
      if (res.valid && res.code) {
        setReferralValidated(res.code);
        toast({ title: "Referral code looks good", description: "It will be applied on your first order." });
      } else {
        setReferralValidated(null);
        toast({ title: "Referral code not valid", description: res.message || "Please check the code.", variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Could not validate referral code", variant: "destructive" }),
  });

  const initiatePayment = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("POST", `/api/payments/phonepe/initiate`, { orderId });
      return res.json() as Promise<{ merchantOrderId: string; redirectUrl: string }>;
    },
  });

  const placeOrder = useMutation({
    mutationFn: async () => {
      const fullAddress = `${streetAddress.trim()}, ${cityArea.trim()}${inputPincode ? ` - ${inputPincode}` : ""}`;
      const payload = {
        userId: user?.id ?? null,
        customerName: name.trim(),
        phone: phone.trim(),
        address: fullAddress,
        pincode: inputPincode.trim() || undefined,
        items: items.map((i) => ({ productId: i.productId, name: i.name, unit: i.unit, price: i.price, qty: i.qty })),
        couponCode: coupon?.code ?? undefined,
        referralCode: referralInput.trim() || undefined,
        redeemReward,
        paymentMethod,
        city: city || cityArea || undefined,
      };
      const res = await apiRequest("POST", "/api/orders", payload);
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: async (order) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/mine"] });
      if (paymentMethod === "PHONEPE") {
        try {
          const pay = await initiatePayment.mutateAsync(order.id);
          clear();
          if (pay.redirectUrl.startsWith("http")) {
            window.location.href = pay.redirectUrl;
          } else {
            const hashIdx = pay.redirectUrl.indexOf("#");
            const target = hashIdx >= 0 ? pay.redirectUrl.slice(hashIdx + 1) : pay.redirectUrl;
            navigate(target);
          }
        } catch {
          toast({ title: "Order placed, but payment could not start", description: "Please retry payment from your orders.", variant: "destructive" });
          navigate("/orders");
        }
        return;
      }
      clear();
      toast({ title: "🎉 Order placed successfully!", description: `Order #${order.id} — pay cash on delivery.` });
      navigate(user ? "/orders" : "/");
    },
    onError: (err: any) => {
      toast({
        title: "Could not place order",
        description: err?.message || "Please check your delivery details and try again.",
        variant: "destructive",
      });
    },
  });

  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);
  const [showCartVerifyModal, setShowCartVerifyModal] = useState(false);

  function handleCheckout() {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in or register to complete your order.",
        variant: "destructive",
      });
      navigate("/login?redirect=/cart");
      return;
    }
    if (!user.isEmailVerified) {
      toast({
        title: "Mandatory Step 1: Email Verification Required",
        description: "Please verify your email address via 6-digit red security code before making payment.",
        variant: "destructive",
      });
      setShowEmailVerifyModal(true);
      return;
    }
    if (!user.isPhoneVerified) {
      toast({
        title: "Mandatory Step 2: Mobile Phone Verification Required",
        description: "Please verify your 10-digit mobile number via WhatsApp or SMS before placing your order.",
        variant: "destructive",
      });
      setShowCartVerifyModal(true);
      return;
    }
    if ((isInternationalDelivery || isLocationUnserviceable) && hasSubscriptionInCart) {
      toast({
        title: "Cannot Deliver Subscriptions Out-of-Station",
        description: "Weekly subscription boxes are fresh produce delivered in Visakhapatnam only. Please remove the subscription to proceed with international / out-of-station shipping.",
        variant: "destructive",
      });
      return;
    }
    if (!isServiceable) {
      toast({ title: "Delivery unavailable", description: "Your current location is not serviceable right now. Please change location to proceed.", variant: "destructive" });
      return;
    }
    if (!name.trim() || !phone.trim() || !cityArea.trim() || !streetAddress.trim()) {
      toast({ title: "Please fill complete delivery details", description: "Name, Phone, City/Area, and Complete Street Address are required.", variant: "destructive" });
      return;
    }
    if (deliveryEnabled && !city) {
      toast({ title: "Please select your delivery city", variant: "destructive" });
      return;
    }
    placeOrder.mutate();
  }

  if (items.length === 0) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center space-y-6">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 animate-ping absolute" />
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary/20 to-accent/20 flex items-center justify-center text-primary shadow-xl border border-primary/30 relative z-10">
              <ShoppingBag size={44} className="text-primary animate-bounce" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-3xl font-bold">Your Farm-Fresh Cart is Empty</h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              You haven't added any fresh fruits, sweets, or pickles to your basket yet. Start exploring our daily harvest!
            </p>
          </div>
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-8 py-3.5 text-sm font-semibold shadow-lg hover:shadow-primary/30 hover:scale-105 transition-all duration-300"
              data-testid="link-continue-shopping"
            >
              Start Shopping Now
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const availableBalance = referralSummary ? Number(referralSummary.availableBalance) : 0;
  const isFullyVerified = Boolean(isSuperAdmin || (user && user.isEmailVerified && user.isPhoneVerified));
  const needsEmailVerification = Boolean(user && !user.isEmailVerified);
  const needsPhoneVerification = Boolean(user && user.isEmailVerified && !user.isPhoneVerified);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Top Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4 border-b border-card-border pb-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2.5">
              <ShoppingBag className="text-emerald-500 shrink-0" size={28} />
              <span>Shopping Cart &amp; Checkout</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Review your fresh harvest basket, complete mandatory security verification, and confirm delivery.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFullyVerified ? (
              <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <ShieldCheck size={14} /> Account &amp; Phone Verified ✓
              </span>
            ) : (
              <span className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm animate-pulse">
                <AlertTriangle size={14} /> Verification Required
              </span>
            )}
          </div>
        </div>

        {/* 2-Column Balanced Responsive Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Cart Items + Delivery Form (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Basket Items Card */}
            <div className="rounded-2xl border border-card-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-card-border pb-3">
                <h2 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                  <span>Basket Items</span>
                  <span className="text-xs font-mono font-bold bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clear}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  <Trash2 size={13} className="mr-1" /> Clear Cart
                </Button>
              </div>

              <div className="divide-y divide-card-border">
                {items.map((i) => (
                  <div key={i.productId} className="py-3.5 first:pt-0 last:pb-0 flex gap-3.5 sm:gap-4 items-center" data-testid={`cart-item-${i.productId}`}>
                    <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl overflow-hidden bg-secondary border border-card-border">
                      {i.image ? <img src={imgUrl(i.image)} alt={i.name} className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-foreground truncate">{i.name}</h3>
                      <p className="text-[11px] text-muted-foreground">{i.unit}</p>
                      {(() => {
                        const prod = (allProducts || []).find((p: any) => p.id === i.productId);
                        const baseP = prod ? Number(prod.price) : Number(i.price);
                        const disc = prod ? Number(prod.discountPercent || 0) : 0;
                        const effPrice = disc > 0 ? (baseP * (1 - disc / 100)) : baseP;
                        return (
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs sm:text-sm font-extrabold text-emerald-500">{formatINR(effPrice)}</span>
                            {disc > 0 && (
                              <span className="text-[11px] text-muted-foreground line-through font-semibold">
                                {formatINR(baseP)}
                              </span>
                            )}
                            {disc > 0 && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                {Math.round(disc)}% OFF
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                      <button
                        onClick={() => remove(i.productId)}
                        className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
                        aria-label="Remove"
                        data-testid={`button-remove-${i.productId}`}
                      >
                        <Trash2 size={15} />
                      </button>
                      <div className="flex items-center rounded-lg border border-input bg-secondary/40">
                        <button
                          onClick={() => setQty(i.productId, i.qty - 1)}
                          className="px-2 py-1 hover:bg-secondary rounded-l-lg transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                          aria-label="Decrease"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-xs font-mono font-bold" data-testid={`qty-${i.productId}`}>
                          {i.qty}
                        </span>
                        <button
                          onClick={() => {
                            const prodStock = (allProducts || []).find((p: any) => p.id === i.productId)?.stock;
                            if (typeof prodStock === "number" && prodStock > 0 && i.qty >= prodStock) {
                              toast({
                                title: "Stock Limit Reached",
                                description: `Only ${prodStock} unit(s) available in stock for ${i.name}.`,
                                variant: "destructive",
                              });
                              return;
                            }
                            setQty(i.productId, i.qty + 1);
                          }}
                          className="px-2 py-1 hover:bg-secondary rounded-r-lg transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                          aria-label="Increase"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Details & Checkout Form Card */}
            <div className="rounded-2xl border border-card-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-card-border pb-3">
                <h2 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                  <span>📍 Delivery Details &amp; Address</span>
                </h2>
                {isFullyVerified && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    Unlocked ✓
                  </Badge>
                )}
              </div>

              {/* Lock Warning if Unverified */}
              {!isFullyVerified && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 space-y-1.5 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 font-extrabold text-xs text-red-500">
                    <ShieldCheck size={16} />
                    <span>Mandatory Verification Required Before Placing Order</span>
                  </div>
                  <p className="text-[11px] text-red-300/90 leading-relaxed">
                    Please complete the mandatory <strong>Email &amp; Mobile Phone verification</strong> on the right using your 6-digit red security codes. Once verified, order placement is instantly unlocked.
                  </p>
                </div>
              )}

              {/* International / Out-of-Station Delivery Toggle Switch */}
              <div className="p-3.5 rounded-2xl bg-secondary/40 border border-emerald-500/30 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3 pr-2">
                  <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shrink-0">
                    <Globe size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>✈️ International / Out-of-Station Shipping</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight">
                      Turn on to ship to any city, state, or international country (bypasses local warehouse radius limit).
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isInternationalDelivery}
                  onCheckedChange={handleToggleInternational}
                  data-testid="switch-international-delivery"
                />
              </div>

              {/* Subscription Conflict Warning */}
              {hasSubscriptionInCart && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs space-y-2 shadow-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                    <span>Subscriptions are Local Fresh Harvest Delivery Only (Visakhapatnam)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-300/90 font-medium">
                    Weekly subscription boxes contain fresh perishable vegetables/fruits harvested locally and cannot be delivered out of station or internationally.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveSubscriptionItems}
                    className="w-full text-xs font-bold border-amber-500/50 text-amber-300 hover:bg-amber-500/20 h-auto py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer whitespace-normal leading-tight"
                  >
                    <Trash2 size={13} className="shrink-0" />
                    <span>Remove Subscription Box ({subscriptionCartItems.length}) &amp; Enable Out-of-Station Shipping</span>
                  </Button>
                </div>
              )}

              {localOnlyConflictItems.length > 0 && !hasSubscriptionInCart && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/50 text-red-200 text-xs space-y-2.5 shadow-md">
                  <div className="flex items-center gap-2 font-extrabold text-red-400">
                    <AlertTriangle size={18} />
                    <span>Cannot Enable Out-of-Station Shipping</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-red-200 font-medium">
                    Your cart contains <strong>{localOnlyConflictItems.length} item(s)</strong> restricted to <strong>Local Warehouse {activeRadiusKm}km Area Only</strong>:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 font-extrabold text-white">
                    {localOnlyConflictItems.map((it) => (
                      <li key={it.productId}>{it.name} ({it.unit})</li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleRemoveLocalOnlyItems}
                    className="w-full h-auto py-2.5 px-3 text-[11px] font-black leading-tight whitespace-normal text-center gap-1.5 cursor-pointer mt-1 rounded-xl flex items-center justify-center"
                  >
                    <Trash2 size={14} className="shrink-0" />
                    <span>Remove Local-Only Items ({localOnlyConflictItems.length}) &amp; Activate Out-of-Station Delivery</span>
                  </Button>
                </div>
              )}

              {/* Warehouse Live ETA Card */}
              {deliveryRes && deliveryRes.serviceable !== false && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs shadow-md">
                  <div className="flex items-center justify-between font-bold text-emerald-400 mb-2">
                    <span className="flex items-center gap-1.5 font-extrabold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      🏢 {deliveryRes.warehouseName || "Assigned Warehouse"}
                    </span>
                    <span className="text-emerald-300 font-black">⏱️ {deliveryRes.etaMinutes} mins</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-emerald-200/90 border-t border-emerald-500/30">
                    <div>📍 Area: <span className="font-extrabold text-emerald-100">{deliveryRes.locationArea || "Current Location"}</span></div>
                    <div>⏱️ ETA: <span className="font-extrabold text-emerald-100">{deliveryRes.packingTimeMinutes || 30}m pack + {deliveryRes.travelTimeMinutes || 0}m ride</span></div>
                    <div>🚚 Fee: <span className="font-extrabold text-emerald-100">{effectiveDeliveryFee > 0 ? formatINR(effectiveDeliveryFee) : "Free"}</span></div>
                  </div>
                </div>
              )}

              {/* Dedicated PIN Code Input Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="ck-pincode" className="text-xs font-bold text-foreground">
                    PIN Code / Postal Code
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDetectLocation}
                    disabled={resolveGpsMutation.isPending}
                    className="h-6 px-2.5 text-[11px] font-extrabold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center gap-1 cursor-pointer"
                  >
                    <Navigation size={12} className={resolveGpsMutation.isPending ? "animate-spin" : "animate-pulse"} />
                    <span>{resolveGpsMutation.isPending ? "Detecting…" : "Detect Location"}</span>
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="ck-pincode"
                    type="text"
                    placeholder="e.g. 522502"
                    maxLength={6}
                    value={inputPincode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setInputPincode(val);
                      if (val.length === 6) handleCheckPincode(val);
                    }}
                    className="font-mono text-sm font-extrabold rounded-xl border-emerald-500/40 bg-background text-foreground tracking-widest"
                    data-testid="input-checkout-pincode"
                  />
                  <Button
                    type="button"
                    onClick={() => handleCheckPincode(inputPincode)}
                    disabled={resolvePincodeMutation.isPending || inputPincode.length < 6}
                    className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer shrink-0"
                  >
                    {resolvePincodeMutation.isPending ? "Checking…" : "Update PIN"}
                  </Button>
                </div>
              </div>

              {/* Customer Contact & Address Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ck-name" className="text-xs font-bold text-foreground">Recipient Name</Label>
                  <Input
                    id="ck-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ganesh Varma"
                    className="mt-1 font-medium rounded-xl text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="ck-phone" className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Mobile Phone</span>
                    {user?.phone && (
                      <span className="text-[10px] text-emerald-400 font-bold">Verified ✓</span>
                    )}
                  </Label>
                  <Input
                    id="ck-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="mt-1 font-medium rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ck-city-area" className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>City / Area / District</span>
                  <span className="text-[10px] text-emerald-400 font-bold">Auto-detected location</span>
                </Label>
                <Input
                  id="ck-city-area"
                  value={cityArea}
                  onChange={(e) => setCityArea(e.target.value)}
                  placeholder="e.g. Narsipatnam, Visakhapatnam"
                  className="mt-1 font-extrabold bg-secondary/40 text-foreground rounded-xl text-xs"
                />
              </div>

              <div>
                <Label htmlFor="ck-street-address" className="text-xs font-bold text-foreground">
                  Complete Address (Door No, Street Name, Landmark)
                </Label>
                <Textarea
                  id="ck-street-address"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="Enter complete door no, building name, street, landmark..."
                  className="mt-1 font-medium min-h-[75px] rounded-xl text-xs"
                />
              </div>

              {/* Payment Method Selector */}
              <div>
                <Label className="text-xs font-bold mb-2 block text-foreground">Payment Method</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="space-y-2">
                  {codEnabled && (
                    <div className="flex items-center gap-2 rounded-xl border border-input p-3 bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer">
                      <RadioGroupItem value="COD" id="pay-cod" />
                      <Label htmlFor="pay-cod" className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                        <Wallet size={15} className="text-emerald-400" /> Cash on Delivery (COD)
                      </Label>
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-xl border border-input p-3 bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer">
                    <RadioGroupItem value="PHONEPE" id="pay-phonepe" />
                    <Label htmlFor="pay-phonepe" className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                      <Smartphone size={15} className="text-emerald-400" /> Pay Online with PhonePe / UPI / Cards
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Primary Place Order Button */}
              <div className="pt-2">
                <Button
                  className="w-full h-auto py-3.5 px-4 text-xs font-extrabold rounded-2xl shadow-xl transition-all cursor-pointer whitespace-normal leading-snug text-center bg-gradient-to-r from-emerald-600 via-primary to-green-500 hover:from-emerald-500 hover:to-green-400 text-white disabled:opacity-50"
                  onClick={handleCheckout}
                  disabled={!isFullyVerified || !isServiceable || ((isInternationalDelivery || isLocationUnserviceable) && hasSubscriptionInCart) || placeOrder.isPending || initiatePayment.isPending}
                  data-testid="button-place-order"
                >
                  {placeOrder.isPending || initiatePayment.isPending ? (
                    "Placing Order…"
                  ) : !isFullyVerified ? (
                    "🔒 Email & Phone Verification Required to Order"
                  ) : (isInternationalDelivery || isLocationUnserviceable) && hasSubscriptionInCart ? (
                    "⚠️ Remove Subscription to Proceed with Out-of-Station Shipping"
                  ) : !isServiceable ? (
                    "🔒 Delivery Unavailable for this PIN Code"
                  ) : (
                    `Place Order · ${formatINR(displayTotal)}`
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Summary & Verification Cards (5 Cols) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            {/* Order Summary Card */}
            <div className="rounded-2xl border border-card-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-sm sm:text-base text-foreground border-b border-card-border pb-3">
                Order Summary
              </h2>

              {/* Coupon Code Input */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Coupon code (e.g. FRESH10)"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="font-mono font-bold text-xs uppercase rounded-xl"
                  data-testid="input-coupon"
                />
                <Button
                  variant="outline"
                  onClick={() => applyCoupon.mutate()}
                  disabled={!couponInput.trim() || applyCoupon.isPending}
                  className="rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                  data-testid="button-apply-coupon"
                >
                  <Tag size={14} className="mr-1" /> Apply
                </Button>
              </div>

              {/* Referral Code Check */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Referral code (optional)"
                  value={referralInput}
                  onChange={(e) => { setReferralInput(e.target.value); setReferralValidated(null); }}
                  className="font-mono text-xs uppercase rounded-xl"
                  data-testid="input-referral-code"
                />
                <Button
                  variant="outline"
                  onClick={() => validateReferral.mutate()}
                  disabled={!referralInput.trim() || validateReferral.isPending}
                  className="rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                  data-testid="button-apply-referral"
                >
                  <Gift size={14} className="mr-1" /> Check
                </Button>
              </div>

              {referralValidated && (
                <p className="text-xs text-emerald-400 font-bold">
                  Referral code {referralValidated} will be applied on your first order.
                </p>
              )}

              {/* Referral Balance Toggle */}
              {!!user && availableBalance > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-secondary/50 p-2.5 border border-card-border">
                  <Checkbox
                    id="redeem-reward"
                    checked={redeemReward}
                    onCheckedChange={(v) => setRedeemReward(v === true)}
                  />
                  <Label htmlFor="redeem-reward" className="text-xs font-bold text-foreground cursor-pointer">
                    Use referral wallet — {formatINR(availableBalance)} available
                  </Label>
                </div>
              )}

              {/* Price Calculation Breakdown */}
              <dl className="space-y-2 pt-2 border-t border-card-border text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <dt>Items subtotal</dt>
                  <dd className="font-mono font-bold text-foreground">{formatINR(quote ? quote.subtotal : subtotal)}</dd>
                </div>

                {totalOrderSavings > 0 && (
                  <div className="flex justify-between items-center text-emerald-400 font-bold">
                    <dt>Total discount savings</dt>
                    <dd className="font-mono">- {formatINR(totalOrderSavings)}</dd>
                  </div>
                )}

                {deliveryEnabled && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <dt>Delivery fee</dt>
                    <dd className="font-mono font-bold text-foreground">
                      {effectiveDeliveryFee > 0 ? (
                        <span>
                          {formatINR(effectiveDeliveryFee)}{" "}
                          <span className="text-[10px] text-muted-foreground font-normal">(Free above {formatINR(freeDeliveryThreshold)})</span>
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold">
                          FREE
                        </span>
                      )}
                    </dd>
                  </div>
                )}

                <div className="flex justify-between items-center border-t border-card-border pt-3 mt-2 font-black text-base text-foreground">
                  <dt>Grand Total</dt>
                  <dd className="font-mono text-emerald-400 text-lg">{formatINR(displayTotal)}</dd>
                </div>
              </dl>
            </div>

            {/* MANDATORY VERIFICATION GATEKEEPER CARDS */}
            {!user ? (
              /* Case 1: Not Logged In */
              <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-950/40 via-card to-background p-5 space-y-3.5 shadow-xl text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-md">
                  <LogIn size={24} />
                </div>
                <div className="space-y-1">
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Account Required
                  </span>
                  <h3 className="font-serif text-lg font-bold text-foreground">Sign In to Complete Order</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your fresh items are safely preserved in your cart! Please sign in or create an account to proceed with checkout.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/login?redirect=/cart")}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn size={15} />
                  <span>Sign In / Register to Checkout ➔</span>
                </Button>
              </div>
            ) : needsEmailVerification ? (
              /* Case 2: Email Not Verified (Mandatory Red Security Theme) */
              <div className="rounded-2xl border-2 border-red-500/50 bg-gradient-to-br from-red-950/40 via-card to-background p-5 space-y-3.5 shadow-xl text-center">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-500 border border-red-500/30 flex items-center justify-center mx-auto shadow-md">
                  <Mail size={24} />
                </div>
                <div className="space-y-1">
                  <span className="bg-red-500/20 text-red-400 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-red-500/30">
                    🚨 Mandatory Step 1 of 2: Email Verification
                  </span>
                  <h3 className="font-serif text-lg font-bold text-foreground">Verify Email with Red Security Code</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    To secure customer orders and receive live delivery tracking, please verify your email address (<b>{user.email}</b>) with a 6-digit red security code.
                  </p>
                </div>
                <Button
                  onClick={() => setShowEmailVerifyModal(true)}
                  className="w-full h-auto py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2 whitespace-normal break-words leading-tight"
                >
                  <Mail size={15} className="shrink-0" />
                  <span className="truncate max-w-full">⚡ Verify Email ({user.email}) via Security Code ➔</span>
                </Button>
              </div>
            ) : needsPhoneVerification ? (
              /* Case 3: Phone Not Verified (Mandatory Red Security Theme) */
              <div className="rounded-2xl border-2 border-red-500/50 bg-gradient-to-br from-red-950/40 via-card to-background p-5 space-y-3.5 shadow-xl text-center">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-500 border border-red-500/30 flex items-center justify-center mx-auto shadow-md">
                  <Smartphone size={24} />
                </div>
                <div className="space-y-1">
                  <span className="bg-red-500/20 text-red-400 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-red-500/30">
                    🚨 Mandatory Step 2 of 2: Phone Verification
                  </span>
                  <h3 className="font-serif text-lg font-bold text-foreground">Verify Mobile with Red Security Code</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    To confirm doorstep delivery and activate live SMS driver notifications, please verify your 10-digit mobile number with a 6-digit red security code.
                  </p>
                </div>
                <Button
                  onClick={() => setShowCartVerifyModal(true)}
                  className="w-full h-auto py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2 whitespace-normal break-words leading-tight"
                >
                  <Smartphone size={15} className="shrink-0" />
                  <span className="truncate max-w-full">📱 Verify Mobile Phone ({user.phone || phone || "Add Number"}) via SMS ➔</span>
                </Button>
              </div>
            ) : (
              /* Case 4: Fully Verified! */
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2 shadow-sm text-center">
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-extrabold text-xs">
                  <ShieldCheck size={18} />
                  <span>Account, Email &amp; Mobile Phone Verified</span>
                </div>
                <p className="text-[11px] text-emerald-300/90">
                  Your identity is verified ({user.email} · +91 {user.phone}). 2-Hour Doorstep Return Guarantee &amp; Live Tracking are active.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* 📧 Email Verification Modal */}
      <EmailVerificationModal
        open={showEmailVerifyModal}
        onOpenChange={setShowEmailVerifyModal}
        initialEmail={user?.email}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/me"] });
        }}
      />

      {/* 📱 Firebase Phone Verification Modal */}
      <PhoneVerificationModal
        open={showCartVerifyModal}
        onOpenChange={setShowCartVerifyModal}
        mode="verify_account"
        defaultPhone={phone || user?.phone || ""}
      />
    </Layout>
  );
}
