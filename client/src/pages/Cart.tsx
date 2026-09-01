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
import { Badge } from "@/components/ui/badge";

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
        items: items.map((i) => ({ productId: i.productId, name: i.name, unit: i.unit, price: i.price, qty: i.qty })),
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
  const itemsFingerprint = items.map((i) => `${i.productId}:${i.unit}:${i.qty}:${i.price}`).join(",");
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

  // Gross MRP total before any produce discounts
  const grossMrpTotal = items.reduce((sum, item) => {
    const prod = allProducts.find((p) => p.id === item.productId);
    let basePrice = prod ? Number(prod.price) : Number(item.price);
    if (item.unit && prod?.quantityTiers) {
      try {
        const parsed = typeof prod.quantityTiers === "string" ? JSON.parse(prod.quantityTiers) : prod.quantityTiers;
        if (Array.isArray(parsed)) {
          const t = parsed.find((tier: any) => tier.quantity?.trim()?.toLowerCase() === item.unit?.trim()?.toLowerCase());
          if (t && Number(t.price) > 0) basePrice = Number(t.price);
        }
      } catch {}
    }
    return sum + Math.round(basePrice * item.qty);
  }, 0);

  const displaySubtotal = quote ? Number(quote.subtotal) : subtotal;
  const produceDiscountSavings = Math.max(0, grossMrpTotal - displaySubtotal);
  const couponDiscountSavings = (coupon || (quote && Number((quote as any).couponDiscount) > 0))
    ? (quote && (quote as any).couponDiscount !== undefined ? Number((quote as any).couponDiscount) : coupon ? Math.round(displaySubtotal * (coupon.discountPercent / 100)) : 0)
    : 0;
  const firstOrderSavings = quote ? Number(quote.firstOrderDiscount || 0) : 0;
  const referralDiscountSavings = quote ? Number(quote.referralDiscount || 0) : 0;
  const referralRewardSavings = quote ? Number(quote.referralRewardApplied || 0) : 0;
  const starLoyaltySavings = quote ? Number(quote.starDiscountAmount || 0) : 0;

  const totalAllSavings = produceDiscountSavings + couponDiscountSavings + firstOrderSavings + referralDiscountSavings + referralRewardSavings + starLoyaltySavings + totalBundleSavings;

  const taxableBase = quote ? Number(quote.taxableSubtotal) : Math.round(displaySubtotal / 1.05);
  const totalGst = quote ? Number(quote.totalGst) : Math.round(displaySubtotal - taxableBase);
  const cgst = quote ? Number(quote.cgst) : Math.round(totalGst / 2);
  const sgst = quote ? Number(quote.sgst) : Math.round(totalGst / 2);

  const freeDeliveryThreshold = Number(deliveryRes?.freeDeliveryAbove ?? (publicSettings?.free_delivery_min ?? (deliveryRules?.freeAbove ?? 500)));
  const isFreeDelivery = displaySubtotal >= freeDeliveryThreshold;

  const fallbackDeliveryFee = (isInternationalDelivery || isLocationUnserviceable || isFreeDelivery)
    ? 0
    : ((deliveryRes && typeof deliveryRes.fee === "number" && deliveryRes.fee > 0)
        ? Number(deliveryRes.fee)
        : (Number(publicSettings?.delivery_fee) || 30));

  const effectiveDeliveryFee = (isInternationalDelivery || isLocationUnserviceable || isFreeDelivery)
    ? 0
    : (quote ? Number(quote.deliveryFee) : fallbackDeliveryFee);

  const displayTotal = (isInternationalDelivery || isLocationUnserviceable || isFreeDelivery)
    ? (quote ? Math.round(Number(quote.total) - Number(quote.deliveryFee)) : Math.round(displaySubtotal - couponDiscountSavings))
    : (quote ? Math.round(Number(quote.total)) : Math.round(displaySubtotal - couponDiscountSavings + fallbackDeliveryFee));

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
                  <span className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
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
                  <div key={`${i.productId}-${i.unit}`} className="py-3.5 first:pt-0 last:pb-0 flex gap-3.5 sm:gap-4 items-start" data-testid={`cart-item-${i.productId}`}>
                    <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl overflow-hidden bg-secondary border border-card-border mt-0.5">
                      {i.image ? <img src={imgUrl(i.image)} alt={i.name} className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="font-bold text-xs sm:text-sm text-foreground truncate">{i.name}</h3>
                        <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.2 rounded-md">
                          {i.unit}
                        </span>
                      </div>
                      
                      {(() => {
                        const prod = (allProducts || []).find((p: any) => p.id === i.productId);
                        let baseP = prod ? Number(prod.price) : Number(i.price);
                        if (i.unit && prod?.quantityTiers) {
                          try {
                            const parsed = typeof prod.quantityTiers === "string" ? JSON.parse(prod.quantityTiers) : prod.quantityTiers;
                            if (Array.isArray(parsed)) {
                              const t = parsed.find((tier: any) => tier.quantity?.trim()?.toLowerCase() === i.unit?.trim()?.toLowerCase());
                              if (t && Number(t.price) > 0) baseP = Number(t.price);
                            }
                          } catch {}
                        }
                        const disc = prod ? Number(prod.discountPercent || 0) : 0;
                        const effUnitPrice = disc > 0 ? (baseP * (1 - disc / 100)) : baseP;
                        const itemLineTotal = Math.round(effUnitPrice * i.qty);

                        const gstPct = prod?.gstPercent != null ? Number(prod.gstPercent) : 5;
                        const hasGst = gstPct > 0;
                        const taxableItemBase = hasGst ? Math.round((itemLineTotal / (1 + gstPct / 100)) * 100) / 100 : itemLineTotal;
                        const totalItemGst = Math.round((itemLineTotal - taxableItemBase) * 100) / 100;
                        const itemCgst = Math.round((totalItemGst / 2) * 100) / 100;
                        const itemSgst = Math.round((totalItemGst / 2) * 100) / 100;

                        return (
                          <div className="mt-1 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-black text-emerald-500 font-mono">
                                {formatINR(itemLineTotal)}
                              </span>
                              {i.qty > 1 && (
                                <span className="text-[10px] text-muted-foreground">
                                  ({formatINR(effUnitPrice)} × {i.qty})
                                </span>
                              )}
                              {disc > 0 && (
                                <span className="text-[10px] text-muted-foreground line-through font-medium">
                                  {formatINR(baseP * i.qty)}
                                </span>
                              )}
                              {disc > 0 && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  {Math.round(disc)}% OFF
                                </span>
                              )}
                            </div>

                            {/* 🏷️ Item-Level Price & GST Breakdown Details */}
                            <div className="text-[10.5px] text-muted-foreground bg-emerald-500/[0.06] rounded-lg px-2.5 py-1 border border-emerald-500/20 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>Taxable Base: <strong className="text-foreground font-mono">{formatINR(taxableItemBase)}</strong></span>
                              {hasGst ? (
                                <span className="text-emerald-400">
                                  • GST ({gstPct}%): <strong className="font-mono">{formatINR(totalItemGst)}</strong> (CGST {formatINR(itemCgst)} + SGST {formatINR(itemSgst)})
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-bold">• 0% GST (Exempt Produce)</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex flex-col items-end justify-between gap-2 shrink-0 self-center">
                      <button
                        onClick={() => remove(i.productId, i.unit)}
                        className="text-muted-foreground hover:text-red-400 p-1 transition-colors cursor-pointer"
                        aria-label="Remove item"
                        title="Remove from Cart"
                        data-testid={`button-remove-${i.productId}`}
                      >
                        <Trash2 size={15} />
                      </button>
                      <div className="flex items-center rounded-lg border border-emerald-500/30 bg-secondary/50 p-0.5">
                        <button
                          onClick={() => {
                            if (i.qty <= 1) {
                              remove(i.productId, i.unit);
                              toast({ title: "🗑️ Removed from Cart", description: `${i.name} (${i.unit})` });
                            } else {
                              setQty(i.productId, i.qty - 1, i.unit);
                            }
                          }}
                          className="px-1.5 py-1 hover:bg-emerald-500/20 rounded-l-md transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                          aria-label="Decrease quantity"
                          title={i.qty === 1 ? "Remove from cart" : "Decrease quantity"}
                        >
                          {i.qty === 1 ? <Trash2 size={12} className="text-red-400" /> : <Minus size={12} />}
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-black" data-testid={`qty-${i.productId}`}>
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
                            setQty(i.productId, i.qty + 1, i.unit);
                          }}
                          className="px-1.5 py-1 hover:bg-emerald-500/20 rounded-r-md transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
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
                    Verified Customer ✓
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
                      <span>✈️ Out-of-Station / All-India Shipping</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight">
                      Ship to any city across India (bypasses local 2-hour warehouse limit).
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

              {/* Address Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ck-name" className="text-xs font-bold text-foreground">Recipient Name *</Label>
                  <Input
                    id="ck-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    className="mt-1 font-medium rounded-xl text-xs"
                    data-testid="input-customer-name"
                  />
                </div>
                <div>
                  <Label htmlFor="ck-phone" className="text-xs font-bold text-foreground">Mobile Phone Number *</Label>
                  <Input
                    id="ck-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="mt-1 font-medium rounded-xl text-xs"
                    data-testid="input-customer-phone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ck-pincode" className="text-xs font-bold text-foreground">Delivery PIN Code *</Label>
                  <Input
                    id="ck-pincode"
                    value={inputPincode}
                    onChange={(e) => {
                      setInputPincode(e.target.value);
                      handleCheckPincode(e.target.value);
                    }}
                    placeholder="6-digit PIN code (e.g. 522502)"
                    maxLength={6}
                    className="mt-1 font-mono font-bold text-xs rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="ck-city-area" className="text-xs font-bold text-foreground">City / Area *</Label>
                  <Input
                    id="ck-city-area"
                    value={cityArea}
                    onChange={(e) => setCityArea(e.target.value)}
                    placeholder="Area, Locality, City"
                    className="mt-1 font-medium rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ck-street-address" className="text-xs font-bold text-foreground">Complete Door / Street Address *</Label>
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
                    "🔒 Sign In / Verify to Place Order"
                  ) : (isInternationalDelivery || isLocationUnserviceable) && hasSubscriptionInCart ? (
                    "⚠️ Remove Subscription for Out-of-Station Shipping"
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
                Order Summary &amp; Bill Breakdown
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

              {/* 🧾 Mathematically Clear Tax Invoice & Order Breakdown */}
              <div className="space-y-2.5 pt-3 border-t border-card-border text-xs">
                {/* Total MRP / Gross Value */}
                {grossMrpTotal > displaySubtotal && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Total Produce MRP</span>
                    <span className="font-mono line-through text-muted-foreground">{formatINR(grossMrpTotal)}</span>
                  </div>
                )}

                {/* Farm-Direct Produce & Pack Volume Savings */}
                {produceDiscountSavings > 0 && (
                  <div className="flex justify-between items-center text-emerald-500 dark:text-emerald-400 font-semibold">
                    <span>Harvest &amp; Pack Savings</span>
                    <span className="font-mono">- {formatINR(produceDiscountSavings)}</span>
                  </div>
                )}

                {/* Items Subtotal (Inclusive of GST) */}
                <div className="flex justify-between items-center text-foreground font-black text-sm pt-1 border-t border-dashed border-border/60">
                  <span>Items Subtotal</span>
                  <span className="font-mono text-emerald-400 font-black">{formatINR(displaySubtotal)}</span>
                </div>

                {/* 🏛️ Transparent Formal GST & Taxable Value Breakdown Box */}
                <div className="p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20 text-[11px] space-y-1 my-1">
                  <div className="flex justify-between items-center text-emerald-300 font-bold">
                    <span>• Net Taxable Value (Excl. Tax):</span>
                    <span className="font-mono">{formatINR(taxableBase)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground pl-2">
                    <span>Central GST (CGST):</span>
                    <span className="font-mono">{formatINR(cgst)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground pl-2">
                    <span>State GST (SGST):</span>
                    <span className="font-mono">{formatINR(sgst)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-400 font-black pt-1 border-t border-emerald-500/15">
                    <span>Total GST Included in Subtotal:</span>
                    <span className="font-mono">{formatINR(totalGst)}</span>
                  </div>
                </div>

                {/* Applied Discounts & Coupons */}
                {(firstOrderSavings > 0 || couponDiscountSavings > 0 || starLoyaltySavings > 0 || referralDiscountSavings > 0 || referralRewardSavings > 0 || totalBundleSavings > 0) && (
                  <div className="pt-2 pb-1 border-t border-dashed border-border/70 space-y-1.5">
                    {/* Subscription Bundle Savings */}
                    {totalBundleSavings > 0 && (
                      <div className="flex justify-between items-center text-emerald-500 dark:text-emerald-400 font-semibold">
                        <span>Subscription Plan Bundle Discount</span>
                        <span className="font-mono">- {formatINR(totalBundleSavings)}</span>
                      </div>
                    )}

                    {/* First Order Discount */}
                    {firstOrderSavings > 0 && (
                      <div className="flex justify-between items-center text-emerald-500 dark:text-emerald-400 font-semibold">
                        <span>🌱 Welcome First-Order Discount (10%)</span>
                        <span className="font-mono">- {formatINR(firstOrderSavings)}</span>
                      </div>
                    )}

                    {/* Referral Discount */}
                    {referralDiscountSavings > 0 && (
                      <div className="flex justify-between items-center text-emerald-500 dark:text-emerald-400 font-semibold">
                        <span>🎁 Referral Welcome Discount (10%)</span>
                        <span className="font-mono">- {formatINR(referralDiscountSavings)}</span>
                      </div>
                    )}

                    {/* Coupon Code Discount */}
                    {couponDiscountSavings > 0 && Boolean(coupon?.code || (quote && (quote as any).couponCode)) && (
                      <div className="flex justify-between items-center text-emerald-500 dark:text-emerald-400 font-semibold">
                        <span>🏷️ Coupon Savings ({coupon?.code || (quote as any)?.couponCode})</span>
                        <span className="font-mono">- {formatINR(couponDiscountSavings)}</span>
                      </div>
                    )}

                    {/* Star Member VIP Tier Discount */}
                    {starLoyaltySavings > 0 && (
                      <div className="flex justify-between items-center text-amber-500 dark:text-yellow-400 font-semibold">
                        <span>⭐ Star Loyalty VIP Discount ({quote?.starDiscountPercent || 5}%)</span>
                        <span className="font-mono">- {formatINR(starLoyaltySavings)}</span>
                      </div>
                    )}

                    {/* Referral Reward Wallet Redeemed */}
                    {referralRewardSavings > 0 && (
                      <div className="flex justify-between items-center text-emerald-500 dark:text-emerald-400 font-semibold">
                        <span>👛 Referral Wallet Reward Redeemed</span>
                        <span className="font-mono">- {formatINR(referralRewardSavings)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Delivery & Logistics */}
                <div className="flex justify-between items-center text-muted-foreground pt-1 border-t border-border/50">
                  <span>Delivery &amp; Handling</span>
                  <span className="font-mono font-bold text-foreground">
                    {effectiveDeliveryFee > 0 ? (
                      <span>
                        {formatINR(effectiveDeliveryFee)}{" "}
                        <span className="text-[10px] text-muted-foreground font-normal">(Free above {formatINR(freeDeliveryThreshold)})</span>
                      </span>
                    ) : (
                      <span className="text-emerald-500 dark:text-emerald-400 font-black">
                        FREE
                      </span>
                    )}
                  </span>
                </div>

                {/* Total Savings Highlight Pill */}
                {totalAllSavings > 0 && (
                  <div className="my-2 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black text-[11px] flex items-center justify-between shadow-xs">
                    <span>🎉 Total Savings on this Order</span>
                    <span className="font-mono font-black text-xs">{formatINR(totalAllSavings)}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="flex justify-between items-center border-t-2 border-emerald-500/40 pt-3 mt-2 font-black text-base text-foreground">
                  <span>Grand Total Payable</span>
                  <span className="font-mono text-emerald-400 text-2xl font-black">{formatINR(displayTotal)}</span>
                </div>
              </div>
            </div>

            {/* Verification / Account Helper Cards */}
            {!user ? (
              /* Case 1: Not Logged In */
              <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-card to-background p-5 space-y-3 shadow-xl text-center">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-md">
                  <LogIn size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif text-base font-bold text-foreground">Sign In to Complete Order</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your items are saved! Sign in to use saved addresses and unlock express delivery.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/login?redirect=/cart")}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn size={14} />
                  <span>Sign In / Register ➔</span>
                </Button>
              </div>
            ) : needsEmailVerification ? (
              /* Case 2: Email Not Verified */
              <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-card to-background p-4 space-y-2.5 shadow-md text-center">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
                  <Mail size={18} />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-serif text-sm font-bold text-foreground">Verify Email Address</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Verify <b>{user.email}</b> with a quick 6-digit code to receive order tracking.
                  </p>
                </div>
                <Button
                  onClick={() => setShowEmailVerifyModal(true)}
                  className="w-full py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Mail size={14} />
                  <span>Verify Email ➔</span>
                </Button>
              </div>
            ) : needsPhoneVerification ? (
              /* Case 3: Phone Not Verified */
              <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-card to-background p-4 space-y-2.5 shadow-md text-center">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
                  <Smartphone size={18} />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-serif text-sm font-bold text-foreground">Verify Phone Number</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Verify your phone number for live doorstep driver notifications.
                  </p>
                </div>
                <Button
                  onClick={() => setShowCartVerifyModal(true)}
                  className="w-full py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Smartphone size={14} />
                  <span>Verify Mobile ➔</span>
                </Button>
              </div>
            ) : (
              /* Case 4: Fully Verified! */
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-3.5 space-y-1 shadow-xs text-center">
                <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-extrabold text-xs">
                  <ShieldCheck size={16} />
                  <span>Verified Customer · Express Delivery Ready</span>
                </div>
                <p className="text-[10.5px] text-emerald-300/80">
                  {user.email} · +91 {user.phone}
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

      {/* 📱 Mobile-First Sticky Checkout Bottom Bar */}
      {items.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-emerald-500/30 p-3 px-4 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Total Amount</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-serif font-black text-emerald-400">{formatINR(displayTotal)}</span>
                {totalAllSavings > 0 && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                    Saved {formatINR(totalAllSavings)}
                  </span>
                )}
              </div>
            </div>

            <Button
              onClick={handleCheckout}
              disabled={!isFullyVerified || !isServiceable || ((isInternationalDelivery || isLocationUnserviceable) && hasSubscriptionInCart) || placeOrder.isPending || initiatePayment.isPending}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs shadow-lg active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>{placeOrder.isPending || initiatePayment.isPending ? "Placing..." : "Place Order ➔"}</span>
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
