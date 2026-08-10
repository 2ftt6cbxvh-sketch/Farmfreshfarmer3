import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2, ShoppingBag, Tag, Gift, Wallet, Smartphone, Globe, Navigation, AlertTriangle, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useCart, useAuth } from "@/lib/store";
import { formatINR } from "@/lib/types";
import { apiRequest, apiGet, imgUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
          setAddress(data.locationArea);
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
  });

  const { data: allPlans = [] } = useQuery<any[]>({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      return res.json();
    },
  });

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
  useEffect(() => {
    if (items.length === 0) return;
    quoteMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, items.map((i) => `${i.productId}:${i.qty}`).join(","), coupon?.code, referralInput, redeemReward, city, deliveryRes?.pincode]);

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
        items: items.map((i) => ({ productId: i.productId, name: i.name, unit: i.unit, price: i.price, qty: i.qty })),
        couponCode: coupon?.code ?? undefined,
        referralCode: referralInput.trim() || undefined,
        redeemReward,
        paymentMethod,
        city: city || undefined,
      };
      const res = await apiRequest("POST", "/api/orders", payload);
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: async (order) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/mine"] });
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
      toast({ title: "Order placed!", description: `Order #${order.id} — pay cash on delivery.` });
      navigate(user ? "/orders" : "/");
    },
    onError: () => toast({ title: "Could not place order", description: "Please try again.", variant: "destructive" }),
  });

  const isServiceable = isInternationalDelivery || !deliveryRes || deliveryRes.serviceable !== false;

  function handleCheckout() {
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

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-4">Your cart</h1>


        {user && !user.phone && (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 mb-4 flex items-center justify-between">
            <span className="text-amber-500 font-bold text-sm">📱 Add your phone number to receive order delivery updates</span>
            <button onClick={() => navigate('/account')} className="text-xs bg-amber-500 text-black font-black px-3 py-1.5 rounded-xl">Add Now</button>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((i) => (
              <div key={i.productId} className="flex gap-4 rounded-xl border border-card-border bg-card p-3" data-testid={`cart-item-${i.productId}`}>
                <div className="h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-secondary">
                  {i.image ? <img src={imgUrl(i.image)} alt={i.name} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{i.name}</h3>
                  <p className="text-xs text-muted-foreground">{i.unit}</p>
                  <p className="text-sm font-bold text-primary mt-1">{formatINR(i.price)}</p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => remove(i.productId)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remove" data-testid={`button-remove-${i.productId}`}>
                    <Trash2 size={16} />
                  </button>
                  <div className="flex items-center rounded-md border border-input">
                    <button onClick={() => setQty(i.productId, i.qty - 1)} className="px-2 py-1 hover-elevate" aria-label="Decrease"><Minus size={14} /></button>
                    <span className="w-8 text-center text-sm" data-testid={`qty-${i.productId}`}>{i.qty}</span>
                    <button onClick={() => setQty(i.productId, i.qty + 1)} className="px-2 py-1 hover-elevate" aria-label="Increase"><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary + checkout */}
          <div className="space-y-4">
            <div className="rounded-xl border border-card-border bg-card p-4">
              <h2 className="font-semibold mb-3">Order summary</h2>
              <div className="flex items-center gap-2 mb-3">
                <Input
                  placeholder="Coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  data-testid="input-coupon"
                />
                <Button variant="outline" onClick={() => applyCoupon.mutate()} disabled={!couponInput.trim() || applyCoupon.isPending} data-testid="button-apply-coupon">
                  <Tag size={14} className="mr-1" /> Apply
                </Button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Input
                  placeholder="Referral code (optional)"
                  value={referralInput}
                  onChange={(e) => { setReferralInput(e.target.value); setReferralValidated(null); }}
                  data-testid="input-referral-code"
                />
                <Button variant="outline" onClick={() => validateReferral.mutate()} disabled={!referralInput.trim() || validateReferral.isPending} data-testid="button-apply-referral">
                  <Gift size={14} className="mr-1" /> Check
                </Button>
              </div>
              {referralValidated && (
                <p className="text-xs text-primary mb-3" data-testid="text-referral-valid">Referral code {referralValidated} will be applied on your first order.</p>
              )}

              {!!user && availableBalance > 0 && (
                <div className="flex items-center gap-2 mb-3 rounded-lg bg-secondary p-2">
                  <Checkbox
                    id="redeem-reward"
                    checked={redeemReward}
                    onCheckedChange={(v) => setRedeemReward(v === true)}
                    data-testid="checkbox-redeem-reward"
                  />
                  <Label htmlFor="redeem-reward" className="text-xs cursor-pointer">
                    Use my referral reward — {formatINR(availableBalance)} available
                  </Label>
                </div>
              )}

              {/* Itemized Price & GST Breakdown Card */}
              {quote?.itemBreakdown && quote.itemBreakdown.length > 0 ? (
                <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/40 p-3 space-y-2.5 shadow-inner">
                  <div className="flex justify-between items-center text-xs font-black text-emerald-900 dark:text-emerald-300 border-b border-emerald-500/30 pb-2">
                    <span className="flex items-center gap-1.5">
                      🧾 Itemized Order & GST Breakdown
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-700 text-white dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded font-black border border-emerald-500/30">
                      Taxable Base + GST
                    </span>
                  </div>
                  <div className="space-y-2.5 divide-y divide-emerald-500/20">
                    {quote.itemBreakdown.map((item, idx) => (
                      <div key={idx} className="pt-2 first:pt-0 space-y-1">
                        <div className="flex justify-between items-center text-xs font-bold text-foreground">
                          <span>{item.name} ({item.unit}) × {item.qty}</span>
                          <span className="font-mono text-emerald-700 dark:text-emerald-400 font-black">{formatINR(item.itemSubtotal)}</span>
                        </div>
                        <div className="flex flex-wrap justify-between items-center text-[11px] font-mono gap-1 text-slate-700 dark:text-slate-300">
                          <span>
                            Base: {formatINR(item.unitPrice)} × {item.qty} = <strong className="text-slate-900 dark:text-white font-black">{formatINR(item.baseAmount)}</strong>
                          </span>
                          <span className="text-emerald-800 dark:text-emerald-400 font-black">
                            +{item.gstPercent}% GST ({formatINR(item.gstAmount)})
                          </span>
                        </div>
                        {(item.cgstAmount > 0 || item.sgstAmount > 0) && (
                          <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono flex items-center gap-3 pt-0.5">
                            {item.cgstAmount > 0 && <span>CGST ({item.cgstPercent}%): {formatINR(item.cgstAmount)}</span>}
                            {item.sgstAmount > 0 && <span>SGST ({item.sgstPercent}%): {formatINR(item.sgstAmount)}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : items.length > 0 && (
                <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/40 p-3 space-y-2.5 shadow-inner">
                  <div className="flex justify-between items-center text-xs font-black text-emerald-900 dark:text-emerald-300 border-b border-emerald-500/30 pb-2">
                    <span className="flex items-center gap-1.5">
                      🧾 Itemized Order & GST Breakdown
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-700 text-white dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded font-black border border-emerald-500/30">
                      Taxable Base + GST
                    </span>
                  </div>
                  <div className="space-y-2.5 divide-y divide-emerald-500/20">
                    {items.map((item, idx) => {
                      const baseTotal = (Number(item.price) || 0) * item.qty;
                      const cgstVal = baseTotal * 0.025;
                      const sgstVal = baseTotal * 0.025;
                      const itemTot = baseTotal + cgstVal + sgstVal;
                      return (
                        <div key={idx} className="pt-2 first:pt-0 space-y-1">
                          <div className="flex justify-between items-center text-xs font-bold text-foreground">
                            <span>{item.name} ({item.unit}) × {item.qty}</span>
                            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-black">{formatINR(itemTot)}</span>
                          </div>
                          <div className="flex flex-wrap justify-between items-center text-[11px] font-mono gap-1 text-slate-700 dark:text-slate-300">
                            <span>
                              Base: {formatINR(Number(item.price) || 0)} × {item.qty} = <strong className="text-slate-900 dark:text-white font-black">{formatINR(baseTotal)}</strong>
                            </span>
                            <span className="text-emerald-800 dark:text-emerald-400 font-black">
                              +5% GST ({formatINR(cgstVal + sgstVal)})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <dl className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between items-center gap-2">
                  <dt className="text-muted-foreground truncate">Taxable Subtotal (Excl. GST)</dt>
                  <dd data-testid="text-taxable-subtotal" className="font-mono shrink-0">{formatINR(quote?.taxableSubtotal ?? displaySubtotal)}</dd>
                </div>
                {quote?.cgstEnabled !== false && (
                  <div className="flex justify-between items-center gap-2 text-[11px] sm:text-xs text-muted-foreground">
                    <dt className="truncate">CGST Tax Component</dt>
                    <dd className="font-mono shrink-0">{formatINR(quote?.cgst ?? Math.round(displaySubtotal * 0.025 * 100) / 100)}</dd>
                  </div>
                )}
                {quote?.sgstEnabled !== false && (
                  <div className="flex justify-between items-center gap-2 text-[11px] sm:text-xs text-muted-foreground">
                    <dt className="truncate">SGST Tax Component</dt>
                    <dd className="font-mono shrink-0">{formatINR(quote?.sgst ?? Math.round(displaySubtotal * 0.025 * 100) / 100)}</dd>
                  </div>
                )}
                <div className="flex justify-between items-center gap-2 font-semibold pt-1 border-t border-card-border/40">
                  <dt className="text-foreground truncate">Cart Subtotal (Incl. GST)</dt>
                  <dd data-testid="text-subtotal" className="font-mono shrink-0">
                    {formatINR(quote?.subtotal ?? Math.round((displaySubtotal + (displaySubtotal * 0.05)) * 100) / 100)}
                  </dd>
                </div>

                {/* Bundle Savings & Discounts in Order Summary */}
                {totalBundleSavings > 0 && (
                  <div className="flex justify-between items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold py-0.5" data-testid="text-plan-bundle-savings">
                    <dt className="truncate flex items-center gap-1.5">
                      <Sparkles size={13} className="text-emerald-500 shrink-0" />
                      Plan Bundle Savings (vs Store MRP)
                    </dt>
                    <dd className="font-mono font-black shrink-0">−{formatINR(totalBundleSavings)}</dd>
                  </div>
                )}

                {quote ? (
                  quote.breakdown.map((line, idx) => (
                    <div key={idx} className="flex justify-between items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold py-0.5" data-testid={`breakdown-line-${idx}`}>
                      <dt className="truncate flex items-center gap-1.5">
                        <Tag size={13} className="text-emerald-500 shrink-0" />
                        {line.label}
                      </dt>
                      <dd className="font-mono font-black shrink-0">−{formatINR(Number(line.amount))}</dd>
                    </div>
                  ))
                ) : (
                  coupon && (
                    <div className="flex justify-between items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold py-0.5">
                      <dt className="truncate flex items-center gap-1.5">
                        <Tag size={13} className="text-emerald-500 shrink-0" />
                        Coupon ({coupon.code})
                      </dt>
                      <dd data-testid="text-discount" className="font-mono font-black shrink-0">−{formatINR(displayDiscount)}</dd>
                    </div>
                  )
                )}

                {/* Total Savings Highlight Banner */}
                {totalOrderSavings > 0 && (
                  <div className="bg-gradient-to-r from-emerald-500/15 via-emerald-500/20 to-teal-500/15 border border-emerald-500/30 rounded-xl p-2.5 my-1.5 text-center shadow-xs">
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                      <Sparkles size={14} className="text-emerald-500 animate-bounce" />
                      Total Discount &amp; Savings: {formatINR(totalOrderSavings)}
                    </p>
                  </div>
                )}

                {/* Out-of-station / International Subscription Warning in Order Summary */}
                {(isInternationalDelivery || isLocationUnserviceable) && hasSubscriptionInCart && (
                  <div className="p-3.5 rounded-2xl bg-red-500/10 dark:bg-red-950/40 border border-red-500/50 text-red-950 dark:text-red-200 text-xs space-y-2 my-2 shadow-md animate-fade-in" data-testid="warning-subscription-no-international">
                    <div className="flex items-center gap-1.5 font-black text-red-700 dark:text-red-400 text-xs">
                      <AlertTriangle size={16} className="shrink-0 animate-bounce" />
                      <span>Subscription Not Eligible for Out-of-Station Shipping</span>
                    </div>
                    <p className="text-[11px] leading-tight text-red-900 dark:text-red-300 font-medium">
                      Weekly fresh produce boxes are available for local Visakhapatnam delivery only. Please remove the subscription to proceed with international / out-of-station shipping.
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveSubscriptionItems}
                      className="w-full text-xs font-black bg-red-600 hover:bg-red-700 h-8 rounded-xl cursor-pointer shadow"
                      data-testid="button-remove-sub-order-summary"
                    >
                      <Trash2 size={13} className="mr-1.5 shrink-0" />
                      <span>Remove Subscription ({subscriptionCartItems.length}) &amp; Proceed</span>
                    </Button>
                  </div>
                )}

                {isInternationalDelivery ? (
                  <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-950 dark:text-amber-300 space-y-1.5 my-2 shadow-sm font-medium">
                    <div className="flex justify-between items-center font-bold text-xs gap-1">
                      <span className="flex items-center gap-1.5 text-amber-950 dark:text-amber-300 truncate">
                        <Globe size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="truncate">International Shipping</span>
                      </span>
                      <span className="text-amber-950 dark:text-amber-300 font-mono text-[9px] sm:text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40 font-black shrink-0">
                        At Dispatch
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 dark:text-amber-200/90 leading-tight font-medium">
                      Local delivery fee removed. Shipping charges will be calculated based on destination weight & address. Our support team will contact you for delivery payment before dispatch.
                    </p>
                  </div>
                ) : isLocationUnserviceable ? (
                  <div className="flex flex-col gap-1 py-1.5 text-xs border-t border-card-border/30 my-1">
                    <dt className="text-muted-foreground font-medium break-words">
                      Delivery ({deliveryRes?.locationArea || "Area"}{deliveryRes?.pincode ? ` - ${deliveryRes.pincode}` : ""})
                    </dt>
                    <dd data-testid="text-delivery-unserviceable" className="text-red-800 dark:text-red-300 font-extrabold text-[11px] leading-snug whitespace-normal break-words bg-red-500/10 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-500/40 text-center">
                      ⚠️ Unserviceable location — Cannot calculate fee
                    </dd>
                  </div>
                ) : (
                  <div className="flex justify-between items-center gap-2">
                    <dt className="text-muted-foreground truncate">Delivery{deliveryRes?.locationArea ? ` (${deliveryRes.locationArea})` : quote?.deliveryCity ? ` (${quote.deliveryCity})` : ""}</dt>
                    <dd data-testid="text-delivery" className={effectiveDeliveryFee > 0 ? "font-bold text-foreground shrink-0 font-mono" : "text-primary font-bold shrink-0 font-mono"}>
                      {effectiveDeliveryFee > 0 ? (
                        <span>
                          {formatINR(effectiveDeliveryFee)}{" "}
                          <span className="text-[10px] text-muted-foreground font-normal">(Free above {formatINR(freeDeliveryThreshold)})</span>
                        </span>
                      ) : (
                        <span>
                          FREE{" "}
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">(Above {formatINR(freeDeliveryThreshold)})</span>
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between items-center gap-2 border-t border-card-border pt-2 mt-2 font-bold text-base">
                  <dt>Grand total</dt><dd data-testid="text-total" className="font-mono">{formatINR(displayTotal)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-card-border bg-card p-4 space-y-3">
              <h2 className="font-semibold text-foreground">Delivery details</h2>

              {/* International / Out-of-Station Delivery Toggle Switch */}
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-secondary/40 border border-emerald-500/30 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3 pr-2">
                  <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                    <Globe size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-foreground flex items-center gap-1.5">
                      <span>✈️ International / Out-of-Station Shipping</span>
                    </p>
                    <p className="text-[10px] text-slate-600 dark:text-muted-foreground font-medium">
                      Turn on to ship to any city, state, or international country (bypasses {activeRadiusKm}km local warehouse radius limit).
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isInternationalDelivery}
                  onCheckedChange={handleToggleInternational}
                  data-testid="switch-international-delivery"
                />
              </div>

              {/* Specific Subscription conflict warning under toggle */}
              {hasSubscriptionInCart && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/40 text-amber-950 dark:text-amber-200 text-xs space-y-2 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-400">
                    <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                    <span>Subscriptions are Local Fresh Harvest Delivery Only (Visakhapatnam)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-300 font-medium">
                    Weekly subscription boxes contain fresh perishable vegetables/fruits harvested locally and cannot be delivered out of station or internationally.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveSubscriptionItems}
                    className="w-full text-xs font-bold border-amber-500/50 text-amber-900 dark:text-amber-300 hover:bg-amber-500/20 h-auto py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer whitespace-normal leading-tight"
                    data-testid="button-remove-sub-delivery-card"
                  >
                    <Trash2 size={13} className="shrink-0" />
                    <span>Remove Subscription Box ({subscriptionCartItems.length}) &amp; Enable Out-of-Station Shipping</span>
                  </Button>
                </div>
              )}

              {localOnlyConflictItems.length > 0 && !hasSubscriptionInCart && (
                <div className="p-4 rounded-2xl bg-red-500/10 dark:bg-red-950/40 border border-red-500/50 text-red-950 dark:text-red-200 text-xs space-y-2.5 shadow-lg animate-fade-in">
                  <div className="flex items-center gap-2 font-extrabold text-red-700 dark:text-red-400">
                    <AlertTriangle size={18} />
                    <span>Cannot Enable Out-of-Station Shipping</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-red-900 dark:text-red-200 font-medium">
                    Your cart contains <strong>{localOnlyConflictItems.length} item(s)</strong> restricted to <strong>Local Warehouse {activeRadiusKm}km Area Only</strong> (fresh produce/raw items not eligible for express courier):
                  </p>
                  <ul className="list-disc pl-5 space-y-1 font-extrabold text-red-950 dark:text-white">
                    {localOnlyConflictItems.map((it) => (
                      <li key={it.productId}>{it.name} ({it.unit})</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-red-800 dark:text-red-300 font-medium">
                    Please remove these local-only items from your cart to proceed with International / Out-of-Station Shipping.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleRemoveLocalOnlyItems}
                    className="w-full h-auto py-2.5 px-3 text-[11px] font-black leading-tight whitespace-normal text-center gap-1.5 cursor-pointer mt-1 rounded-xl flex items-center justify-center shadow-md"
                  >
                    <Trash2 size={14} className="shrink-0" />
                    <span>Remove Local-Only Items ({localOnlyConflictItems.length}) & Activate Out-of-Station Delivery</span>
                  </Button>
                </div>
              )}

              {isInternationalDelivery && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 dark:bg-emerald-950/60 border border-emerald-500/40 text-emerald-950 dark:text-emerald-300 text-xs font-extrabold flex items-center gap-2">
                  <span>✈️ International / Out-of-Station Shipping Mode Active — Orders dispatched via partnered express global or local courier.</span>
                </div>
              )}

              {/* Enhanced 3D Glass Delivery Breakdown Card */}
              {deliveryRes && deliveryRes.serviceable !== false && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/40 p-4 text-sm shadow-lg backdrop-blur-md relative overflow-hidden group">
                  <div className="flex items-center justify-between font-bold text-emerald-950 dark:text-emerald-400 mb-2 relative z-10">
                    <span className="flex items-center gap-1.5 font-extrabold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      🏢 {deliveryRes.warehouseName || "Assigned Warehouse"}
                    </span>
                    <span className="text-emerald-950 dark:text-emerald-300 font-black">⏱️ {deliveryRes.etaMinutes} mins</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 pt-2 text-emerald-900 dark:text-emerald-200/90 border-t border-emerald-500/30 relative z-10 text-xs font-medium">
                    <div>📍 Customer Area: <span className="font-extrabold text-emerald-950 dark:text-emerald-100">{deliveryRes.locationArea || "Current Location"}</span></div>
                    <div>⏱️ ETA Breakdown: <span className="font-extrabold text-emerald-950 dark:text-emerald-100">{deliveryRes.packingTimeMinutes || 30}m packing + {deliveryRes.travelTimeMinutes || 0}m travel</span></div>
                    <div>🚚 Delivery Fee: <span className="font-extrabold text-emerald-950 dark:text-emerald-100">{effectiveDeliveryFee > 0 ? formatINR(effectiveDeliveryFee) : "Free Delivery"}</span></div>
                  </div>
                </div>
              )}
              {/* Red Alert Card for Non-Serviceable Locations (Hidden when International Shipping is ON) */}
              {!isInternationalDelivery && deliveryRes && deliveryRes.serviceable === false && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 dark:bg-red-950/60 p-4 space-y-2 text-red-950 dark:text-red-200 backdrop-blur-xl animate-mobile-drawer shadow-lg">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-extrabold text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span>Delivery Unavailable for this Location</span>
                  </div>
                  <p className="text-xs text-red-900 dark:text-red-300 font-medium">
                    We cannot deliver to <strong>{deliveryRes.locationArea || deliveryRes.pincode || "this location"}</strong> right now. Please enter a serviceable PIN code or turn on International Shipping above.
                  </p>
                </div>
              )}

              {/* Dedicated PIN Code Input Field with Detect Location Button */}
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
                    className="h-6 px-2.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Navigation size={12} className={resolveGpsMutation.isPending ? "animate-spin" : "animate-pulse"} />
                    <span>{resolveGpsMutation.isPending ? "Detecting…" : "Detect My Location"}</span>
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
                      if (val.length === 6) {
                        handleCheckPincode(val);
                      }
                    }}
                    className="font-mono text-sm font-extrabold rounded-xl border-emerald-500/40 bg-background text-foreground tracking-widest"
                    data-testid="input-checkout-pincode"
                  />
                  <Button
                    type="button"
                    onClick={() => handleCheckPincode(inputPincode)}
                    disabled={resolvePincodeMutation.isPending || inputPincode.length < 6}
                    className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all shrink-0"
                  >
                    {resolvePincodeMutation.isPending ? "Checking…" : "Update PIN"}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="ck-name" className="text-xs font-bold text-foreground">Full name</Label>
                <Input id="ck-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" className="mt-1 font-medium" />
              </div>
              <div>
                <Label htmlFor="ck-phone" className="text-xs font-bold text-foreground">Phone number</Label>
                <Input id="ck-phone" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-phone" className="mt-1 font-medium" />
              </div>
              <div>
                <Label htmlFor="ck-city-area" className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>City / Area / District</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold">Auto-detected location</span>
                </Label>
                <Input
                  id="ck-city-area"
                  value={cityArea}
                  onChange={(e) => setCityArea(e.target.value)}
                  placeholder="e.g. Narsipatnam, Visakhapatnam"
                  className="mt-1 font-extrabold bg-secondary/40 text-foreground"
                  data-testid="input-city-area"
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
                  placeholder="Enter complete address"
                  className="mt-1 font-medium min-h-[75px]"
                  data-testid="input-street-address"
                />
              </div>

              {deliveryEnabled && (
                <div>
                  <Label htmlFor="ck-city" className="text-xs">Delivery city</Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger id="ck-city" className="mt-1" data-testid="select-city">
                      <SelectValue placeholder="Select your city" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryRules!.cities.map((c) => (
                        <SelectItem key={c.name} value={c.name} data-testid={`city-option-${c.name}`}>
                          {c.name}{c.freeAbove > 0 ? ` · Free above ${formatINR(c.freeAbove)}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Delivery charge is applied based on your city and cart value.</p>
                </div>
              )}

              <div>
                <Label className="text-xs mb-2 block">Payment method</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="space-y-2" data-testid="radio-payment-method">
                  {codEnabled && (
                    <div className="flex items-center gap-2 rounded-lg border border-input p-2 hover-elevate">
                      <RadioGroupItem value="COD" id="pay-cod" data-testid="radio-payment-cod" />
                      <Label htmlFor="pay-cod" className="flex items-center gap-2 cursor-pointer text-sm">
                        <Wallet size={15} /> Cash on Delivery
                      </Label>
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-lg border border-input p-2 hover-elevate">
                    <RadioGroupItem value="PHONEPE" id="pay-phonepe" data-testid="radio-payment-phonepe" />
                    <Label htmlFor="pay-phonepe" className="flex items-center gap-2 cursor-pointer text-sm">
                      <Smartphone size={15} /> Pay with PhonePe
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Button
                className="w-full h-auto py-3.5 px-4 text-xs font-extrabold rounded-2xl shadow-lg transition-all cursor-pointer whitespace-normal leading-snug text-center disabled:opacity-100 disabled:bg-amber-500/20 disabled:text-amber-950 dark:disabled:text-amber-200 disabled:border disabled:border-amber-500/50"
                onClick={handleCheckout}
                disabled={!isServiceable || ((isInternationalDelivery || isLocationUnserviceable) && hasSubscriptionInCart) || placeOrder.isPending || initiatePayment.isPending}
                data-testid="button-place-order"
              >
                {placeOrder.isPending || initiatePayment.isPending ? (
                  "Placing order…"
                ) : (isInternationalDelivery || isLocationUnserviceable) && hasSubscriptionInCart ? (
                  <div className="flex flex-col items-center justify-center gap-0.5 w-full">
                    <span className="font-black text-red-700 dark:text-red-300 flex items-center gap-1.5 text-xs">
                      ⚠️ Remove Subscription to Proceed with International Shipping
                    </span>
                    <span className="text-[10px] font-bold text-red-800/90 dark:text-red-300/90">
                      Subscriptions are local fresh harvest only (Visakhapatnam)
                    </span>
                  </div>
                ) : !isServiceable ? (
                  <div className="flex flex-col items-center justify-center gap-0.5 w-full">
                    <span className="font-black text-amber-950 dark:text-amber-300 flex items-center gap-1.5 text-xs">
                      🔒 Delivery Unavailable for this Location
                    </span>
                    <span className="text-[10px] font-bold text-amber-900/90 dark:text-amber-300/90">
                      Change PIN code above or enable International Shipping
                    </span>
                  </div>
                ) : (
                  `Place order · ${formatINR(displayTotal)}`
                )}
              </Button>
              {!user && (
                <p className="text-xs text-muted-foreground text-center">
                  <Link href="/login" className="text-primary underline">Log in</Link> to track your orders.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
