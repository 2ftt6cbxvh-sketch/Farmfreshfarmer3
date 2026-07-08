import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2, ShoppingBag, Tag, Gift, Wallet, Smartphone } from "lucide-react";
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

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [city, setCity] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");

  // Serviceable cities + delivery charges (admin-configured).
  const { data: deliveryRules } = useQuery<DeliveryRules>({
    queryKey: ["/api/delivery-rules"],
    queryFn: () => apiGet<DeliveryRules>("/api/delivery-rules"),
  });
  const deliveryEnabled = !!deliveryRules?.enabled && (deliveryRules?.cities.length ?? 0) > 0;

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

  const quoteMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/price/quote", {
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        couponCode: coupon?.code || undefined,
        referralCode: referralInput.trim() || undefined,
        redeemReward,
        city: city || undefined,
      }).then((r) => r.json() as Promise<PriceQuote>),
    onSuccess: (data) => setQuote(data),
    onError: () => setQuote(null),
  });

  // Re-fetch the live quote whenever items/coupon/referral/redeem toggle change.
  useEffect(() => {
    if (items.length === 0) return;
    quoteMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, items.map((i) => `${i.productId}:${i.qty}`).join(","), coupon?.code, referralInput, redeemReward, city]);

  const displaySubtotal = quote ? Number(quote.subtotal) : subtotal;
  const displayDiscount = quote ? Number(quote.discount) : coupon ? Math.round(subtotal * (coupon.discountPercent / 100) * 100) / 100 : 0;
  const displayTotal = quote ? Number(quote.total) : Math.round((subtotal - displayDiscount) * 100) / 100;

  const applyCoupon = useMutation({
    mutationFn: () => apiGet<CouponResult>(`/api/coupons/validate?code=${encodeURIComponent(couponInput.trim())}&subtotal=${subtotal}`),
    onSuccess: (res) => {
      if (res.valid && res.code && typeof res.discountPercent === "number") {
        setCoupon({ code: res.code, discountPercent: res.discountPercent });
        toast({ title: "Coupon applied", description: `${res.discountPercent}% off` });
      } else {
        setCoupon(null);
        toast({ title: "Invalid coupon", description: res.message || "This code can't be used.", variant: "destructive" });
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
      const res = await apiRequest("POST", "/api/payments/initiate", { orderId });
      return res.json() as Promise<InitiatePaymentResult>;
    },
  });

  const placeOrder = useMutation({
    mutationFn: async () => {
      const payload = {
        userId: user?.id ?? null,
        customerName: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
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

  function handleCheckout() {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast({ title: "Please fill all delivery details", variant: "destructive" });
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
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <ShoppingBag className="mx-auto text-muted-foreground" size={48} />
          <h1 className="font-serif text-2xl font-bold mt-4">Your cart is empty</h1>
          <p className="text-muted-foreground mt-2">Add some fresh items to get started.</p>
          <Link href="/" className="inline-block mt-6 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover-elevate" data-testid="link-continue-shopping">
            Continue shopping
          </Link>
        </div>
      </Layout>
    );
  }

  const availableBalance = referralSummary ? Number(referralSummary.availableBalance) : 0;

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-6">Your cart</h1>
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

              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd data-testid="text-subtotal">{formatINR(displaySubtotal)}</dd></div>

                {quote ? (
                  quote.breakdown.map((line, idx) => (
                    <div key={idx} className="flex justify-between text-primary" data-testid={`breakdown-line-${idx}`}>
                      <dt>{line.label}</dt><dd>−{formatINR(Number(line.amount))}</dd>
                    </div>
                  ))
                ) : (
                  coupon && (
                    <div className="flex justify-between text-primary">
                      <dt>Coupon ({coupon.code})</dt><dd data-testid="text-discount">−{formatINR(displayDiscount)}</dd>
                    </div>
                  )
                )}

                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery{quote?.deliveryCity ? ` (${quote.deliveryCity})` : ""}</dt>
                  <dd data-testid="text-delivery" className={quote && Number(quote.deliveryFee) > 0 ? "" : "text-primary"}>
                    {quote && Number(quote.deliveryFee) > 0 ? formatINR(Number(quote.deliveryFee)) : "Free"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-card-border pt-2 mt-2 font-bold text-base">
                  <dt>Total</dt><dd data-testid="text-total">{formatINR(displayTotal)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-card-border bg-card p-4 space-y-3">
              <h2 className="font-semibold">Delivery details</h2>
              <div>
                <Label htmlFor="ck-name" className="text-xs">Full name</Label>
                <Input id="ck-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
              </div>
              <div>
                <Label htmlFor="ck-phone" className="text-xs">Phone</Label>
                <Input id="ck-phone" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-phone" />
              </div>
              <div>
                <Label htmlFor="ck-address" className="text-xs">Delivery address</Label>
                <Textarea id="ck-address" value={address} onChange={(e) => setAddress(e.target.value)} data-testid="input-address" />
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

              <Button className="w-full" onClick={handleCheckout} disabled={placeOrder.isPending || initiatePayment.isPending} data-testid="button-place-order">
                {placeOrder.isPending || initiatePayment.isPending ? "Placing order…" : `Place order · ${formatINR(displayTotal)}`}
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
