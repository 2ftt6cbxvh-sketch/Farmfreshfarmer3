import { useState } from "react";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PackageCheck, CalendarDays, Pause, Play, SkipForward, Ban, RotateCcw, Repeat, CreditCard, ChevronDown, ChevronUp, ShoppingCart, Tag, Leaf } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth, useCart } from "@/lib/store";
import { apiGet, apiRequest, queryClient } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import type { Product } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

type DeliveryDayOption = "saturday" | "sunday" | "both";

interface PlanItem {
  productId: number;
  qty: number;
  productName?: string;
  productPrice?: number;
  productImage?: string;
  productUnit?: string;
  productDiscountPercent?: number;
}

interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  deliveryDays: string;
  image?: string;
  active: boolean;
  productId?: number;
  product?: any;
  items: PlanItem[];
}

interface SubItem {
  id: number;
  productId: number;
  qty: number;
}

interface Cycle {
  id: number;
  orderId?: number | null;
  deliveryDate: string;
  deliveryDay: string;
  status: string;
  amount: string;
}

interface Subscription {
  id: number;
  userId: number;
  planId: number;
  status: string;
  deliveryDays: string;
  weeklyPrice: string;
  startDate: string;
  nextDeliveryDate: string | null;
  pausedUntil: string | null;
  skipNextCycle: boolean;
  items: SubItem[];
  cycles: Cycle[];
}

interface UpcomingDelivery {
  date: string;
  day: "Saturday" | "Sunday";
}

interface MySubscriptionsResponse {
  subscriptions: Subscription[];
  upcomingDeliveries: UpcomingDelivery[];
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "cancelled" || status === "expired") return "outline";
  return "secondary";
}

function statusColor(status: string): string {
  if (status === "active") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "paused") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (status === "cancelled" || status === "expired") return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
}

export default function MySubscriptions() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const { add: addToCart } = useCart();
  const [, navigate] = useLocation();

  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [subscribePlan, setSubscribePlan] = useState<Plan | null>(null);
  const [deliveryDays, setDeliveryDays] = useState<DeliveryDayOption>("both");
  const [address, setAddress] = useState(user?.address || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [expandedBox, setExpandedBox] = useState<number | null>(null);
  const [expandedSubBox, setExpandedSubBox] = useState<number | null>(null);

  const [changePlanOpen, setChangePlanOpen] = useState<number | null>(null);
  const [changePlanTarget, setChangePlanTarget] = useState<string>("");
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: () => apiGet<Plan[]>("/api/plans"),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: () => apiGet<Product[]>("/api/products"),
  });

  const { data: mine, isLoading: mineLoading } = useQuery<MySubscriptionsResponse>({
    queryKey: ["/api/subscriptions/mine"],
    queryFn: () => apiGet<MySubscriptionsResponse>("/api/subscriptions/mine"),
    enabled: !!user,
  });

  function productName(id: number): string {
    return products.find((p) => p.id === id)?.name ?? `Product #${id}`;
  }

  function invalidateMine() {
    queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/mine"] });
  }

  // Calculate store value (sum of items at store price) and savings
  function calcPlanSavings(plan: Plan) {
    const storeValue = plan.items.reduce((sum, it) => {
      const price = it.productPrice ?? 0;
      return sum + price * it.qty;
    }, 0);
    const planPrice = Number(plan.price);
    const savings = storeValue - planPrice;
    const savingsPct = storeValue > 0 ? Math.round((savings / storeValue) * 100) : 0;
    return { storeValue, savings, savingsPct };
  }

  const subscribe = useMutation({
    mutationFn: async () => {
      if (!subscribePlan) throw new Error("No plan selected");
      const payload = {
        planId: subscribePlan.id,
        deliveryDays,
        address: address.trim(),
        phone: phone.trim(),
      };
      const res = await apiRequest("POST", "/api/subscriptions", payload);
      return res.json();
    },
    onSuccess: () => {
      invalidateMine();
      setSubscribeOpen(false);

      // Add subscription bundle as 1 single item to cart with the plan price
      if (subscribePlan) {
        const planProduct = subscribePlan.product || {
          id: subscribePlan.productId || subscribePlan.id,
          name: subscribePlan.name,
          unit: "1 Weekly Box",
          price: String(subscribePlan.price),
          image: subscribePlan.image || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=500&auto=format&fit=crop&q=60",
          discountPercent: "0",
          stock: 9999,
          allowInternationalShipping: false,
          categorySlug: "vegetables",
        };
        addToCart(planProduct as any, 1);
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      }

      toast({
        title: "Subscribed! 🎉",
        description: "Your weekly subscription box has been added to cart. Complete checkout to confirm your delivery schedule!",
      });

      navigate("/cart");
    },
    onError: () => toast({ title: "Could not subscribe", description: "Please try again.", variant: "destructive" }),
  });

  function useLifecycleAction(action: "pause" | "resume" | "skip" | "cancel" | "reactivate", label: string) {
    return useMutation({
      mutationFn: async (id: number) => {
        await apiRequest("POST", `/api/subscriptions/${id}/${action}`);
      },
      onSuccess: () => {
        invalidateMine();
        toast({ title: label });
      },
      onError: () => toast({ title: "Action failed", description: "Please try again.", variant: "destructive" }),
    });
  }

  const pauseMut = useLifecycleAction("pause", "Subscription paused");
  const resumeMut = useLifecycleAction("resume", "Subscription resumed");
  const skipMut = useLifecycleAction("skip", "Next delivery will be skipped");
  const cancelMut = useLifecycleAction("cancel", "Subscription cancelled");
  const reactivateMut = useLifecycleAction("reactivate", "Subscription reactivated");

  const payCycleMut = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("POST", "/api/payments/initiate", { orderId });
      return res.json() as Promise<{ paymentId: number; merchantOrderId: string; redirectUrl: string; simulated: boolean }>;
    },
    onSuccess: (pay) => {
      if (pay.redirectUrl.startsWith("http")) {
        window.location.href = pay.redirectUrl;
      } else {
        const hashIdx = pay.redirectUrl.indexOf("#");
        const target = hashIdx >= 0 ? pay.redirectUrl.slice(hashIdx + 1) : pay.redirectUrl;
        window.location.hash = target.startsWith("/") ? target : `/${target}`;
      }
    },
    onError: () => toast({ title: "Could not start payment", description: "Please try again.", variant: "destructive" }),
  });

  const changePlanMut = useMutation({
    mutationFn: async ({ id, planId }: { id: number; planId: number }) => {
      await apiRequest("POST", `/api/subscriptions/${id}/change-plan`, { planId });
    },
    onSuccess: () => {
      invalidateMine();
      setChangePlanOpen(null);
      toast({ title: "Plan changed" });
    },
    onError: () => toast({ title: "Could not change plan", description: "Please try again.", variant: "destructive" }),
  });

  function openSubscribe(plan: Plan) {
    setSubscribePlan(plan);
    setDeliveryDays((plan.deliveryDays as DeliveryDayOption) || "both");
    setAddress(user?.address || "");
    setPhone(user?.phone || "");
    setSubscribeOpen(true);
  }

  if (!loading && !user) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <PackageCheck className="mx-auto text-muted-foreground" size={44} />
          <h1 className="font-serif text-2xl font-bold mt-4">Please log in</h1>
          <p className="text-muted-foreground mt-2">Log in to manage your weekly box subscriptions.</p>
          <Link href="/login" className="inline-block mt-6 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold" data-testid="link-login">Log in</Link>
        </div>
      </Layout>
    );
  }

  const upcoming = mine?.upcomingDeliveries ?? [];

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-1">My Subscriptions</h1>
          <p className="text-muted-foreground">Weekly farm-fresh boxes — every Saturday &amp; Sunday. Subscribe once, receive every week.</p>
        </div>

        {/* Upcoming delivery windows */}
        {upcoming.length > 0 && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-8" data-testid="panel-upcoming-deliveries">
            <h2 className="font-semibold mb-3 flex items-center gap-2 text-emerald-400">
              <CalendarDays size={18} /> Upcoming delivery windows
            </h2>
            <div className="flex flex-wrap gap-2">
              {upcoming.map((d, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" data-testid={`upcoming-delivery-${idx}`}>
                  <CalendarDays size={11} />{d.day} · {new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Active & past subscriptions */}
        <section className="mb-12">
          <h2 className="font-semibold text-lg mb-4">Active &amp; past subscriptions</h2>
          {mineLoading ? (
            <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
          ) : !mine || mine.subscriptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-card-border bg-card/50 p-10 text-center">
              <PackageCheck size={40} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">You don&apos;t have any subscriptions yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Pick a plan below to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mine.subscriptions.map((s) => {
                const plan = plans.find((p) => p.id === s.planId);
                const futureCycles = s.cycles.filter((c) => new Date(c.deliveryDate) >= new Date(Date.now() - 86400000));
                return (
                  <div key={s.id} className="rounded-2xl border border-card-border bg-card overflow-hidden" data-testid={`subscription-${s.id}`}>
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{plan?.name ?? `Plan #${s.planId}`}</h3>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColor(s.status)}`}>{s.status}</span>
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">Delivers: {s.deliveryDays}</p>
                        </div>
                        <span className="text-2xl font-black text-primary" data-testid={`price-subscription-${s.id}`}>{formatINR(Number(s.weeklyPrice))}<span className="text-sm font-normal text-muted-foreground">/wk</span></span>
                      </div>

                      {/* Box items toggle */}
                      <button
                        onClick={() => setExpandedSubBox(expandedSubBox === s.id ? null : s.id)}
                        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      >
                        {expandedSubBox === s.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {expandedSubBox === s.id ? "Hide box contents" : "View box contents"}
                      </button>

                      {expandedSubBox === s.id && (
                        <div className="mt-3 rounded-xl bg-secondary/40 p-3 space-y-1.5">
                          {s.items.map((it) => {
                            const prod = products.find(p => p.id === it.productId);
                            return (
                              <div key={it.id} className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1.5">
                                  {prod?.image ? (
                                    <img
                                      src={prod.image}
                                      alt={prod.name || ''}
                                      className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-card-border"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                                      <Leaf size={16} className="text-emerald-400" />
                                    </div>
                                  )}
                                  <span>{it.qty} × {productName(it.productId)}</span>
                                </span>
                                {prod && <span className="text-muted-foreground">{formatINR(Number(prod.price) * it.qty)}</span>}
                              </div>
                            );
                          })}
                          {s.items.length === 0 && <p className="text-xs text-muted-foreground">No items listed.</p>}
                        </div>
                      )}

                      {/* Upcoming cycles */}
                      {futureCycles.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Upcoming cycles</p>
                          <ul className="space-y-1.5" data-testid={`cycles-subscription-${s.id}`}>
                            {futureCycles.map((c) => {
                              const payable = c.orderId != null && !["paid", "delivered", "skipped"].includes(c.status);
                              return (
                                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b border-card-border last:border-0">
                                  <span className="text-sm">{c.deliveryDay} · {new Date(c.deliveryDate).toLocaleDateString("en-IN")}</span>
                                  <span className="flex items-center gap-2">
                                    <Badge variant="outline">{c.status}</Badge>
                                    <span className="text-sm font-medium">{formatINR(Number(c.amount))}</span>
                                    {payable && (
                                      <Button size="sm" className="h-7 px-3" onClick={() => payCycleMut.mutate(c.orderId!)} disabled={payCycleMut.isPending} data-testid={`button-pay-cycle-${c.id}`}>
                                        <CreditCard size={13} className="mr-1" /> Pay now
                                      </Button>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {s.skipNextCycle && <p className="text-xs text-amber-400 mt-2 font-medium">⚠ Next delivery will be skipped.</p>}

                      {/* Actions */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {s.status === "active" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => pauseMut.mutate(s.id)} disabled={pauseMut.isPending} data-testid={`button-pause-${s.id}`}><Pause size={14} className="mr-1" /> Pause</Button>
                            <Button size="sm" variant="outline" onClick={() => skipMut.mutate(s.id)} disabled={skipMut.isPending} data-testid={`button-skip-${s.id}`}><SkipForward size={14} className="mr-1" /> Skip next</Button>
                            <Button size="sm" variant="outline" onClick={() => { setChangePlanOpen(s.id); setChangePlanTarget(String(s.planId)); }} data-testid={`button-change-plan-${s.id}`}><Repeat size={14} className="mr-1" /> Change plan</Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setCancelTarget(s.id)} data-testid={`button-cancel-${s.id}`}><Ban size={14} className="mr-1" /> Cancel</Button>
                          </>
                        )}
                        {s.status === "paused" && <Button size="sm" variant="outline" onClick={() => resumeMut.mutate(s.id)} disabled={resumeMut.isPending} data-testid={`button-resume-${s.id}`}><Play size={14} className="mr-1" /> Resume</Button>}
                        {s.status === "cancelled" && <Button size="sm" variant="outline" onClick={() => reactivateMut.mutate(s.id)} disabled={reactivateMut.isPending} data-testid={`button-reactivate-${s.id}`}><RotateCcw size={14} className="mr-1" /> Reactivate</Button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Available plans */}
        <section>
          <div className="mb-6">
            <h2 className="font-semibold text-xl mb-1">Available plans</h2>
            <p className="text-sm text-muted-foreground">All boxes are packed fresh on delivery day. Subscribe and save vs. buying individually!</p>
          </div>
          {plansLoading ? (
            <div className="grid sm:grid-cols-2 gap-6">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              {plans.filter((p) => p.active).map((p) => {
                const { storeValue, savings, savingsPct } = calcPlanSavings(p);
                const isExpanded = expandedBox === p.id;
                return (
                  <div key={p.id} className="rounded-2xl border border-card-border bg-card flex flex-col overflow-hidden hover:border-primary/40 transition-colors" data-testid={`plan-${p.id}`}>
                    {/* Plan header */}
                    <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 p-5 border-b border-card-border">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Leaf size={16} className="text-emerald-400" />
                            <h3 className="font-bold text-lg">{p.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">{p.description}</p>
                          <p className="text-xs text-muted-foreground mt-1.5 capitalize">📅 Delivery: {p.deliveryDays}</p>
                        </div>
                        {savingsPct > 0 && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-white shadow">
                            <Tag size={10} /> SAVE {savingsPct}%
                          </span>
                        )}
                      </div>

                      {/* Price row */}
                      <div className="flex items-end gap-3 mt-4">
                        <span className="text-3xl font-black text-primary" data-testid={`plan-price-${p.id}`}>{formatINR(Number(p.price))}<span className="text-sm font-normal text-muted-foreground">/wk</span></span>
                        {storeValue > 0 && savings > 0 && (
                          <div className="text-sm">
                            <span className="line-through text-muted-foreground">{formatINR(storeValue)}</span>
                            <span className="ml-1.5 text-emerald-400 font-semibold">Save {formatINR(savings)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Box contents */}
                    <div className="p-4 flex-1">
                      <button
                        onClick={() => setExpandedBox(isExpanded ? null : p.id)}
                        className="w-full flex items-center justify-between text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
                      >
                        <span className="flex items-center gap-1.5"><PackageCheck size={15} className="text-emerald-400" /> What's in your box ({p.items.length} items)</span>
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>

                      {/* Always show compact list with images */}
                      {!isExpanded && (
                        <div className="flex flex-wrap gap-2">
                          {p.items.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-secondary/40 rounded-lg px-2 py-1">
                              {it.productImage ? (
                                <img
                                  src={it.productImage}
                                  alt={it.productName || ''}
                                  className="w-6 h-6 rounded object-cover flex-shrink-0"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                  <Leaf size={10} className="text-emerald-400" />
                                </div>
                              )}
                              <span className="text-xs font-medium">{it.qty} × {it.productName || `Product #${it.productId}`}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Expanded: show individual prices and savings */}
                      {isExpanded && (
                        <div className="space-y-2">
                          {p.items.map((it, idx) => {
                            const lineTotal = (it.productPrice ?? 0) * it.qty;
                            return (
                              <div key={idx} className="flex items-center justify-between text-sm bg-secondary/30 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {it.productImage ? (
                                    <img
                                      src={it.productImage}
                                      alt={it.productName || ''}
                                      className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-card-border"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                                      <Leaf size={16} className="text-emerald-400" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-medium text-xs">{it.productName || `Product #${it.productId}`}</p>
                                    <p className="text-xs text-muted-foreground">{it.qty} × {formatINR(it.productPrice ?? 0)} / {it.productUnit || 'unit'}</p>
                                  </div>
                                </div>
                                <span className="font-bold text-xs">{formatINR(lineTotal)}</span>
                              </div>
                            );
                          })}
                          {/* Store value total */}
                          {storeValue > 0 && (
                            <div className="flex items-center justify-between text-sm border-t border-card-border pt-2 mt-2">
                              <span className="text-muted-foreground">Store value</span>
                              <span className="line-through text-muted-foreground">{formatINR(storeValue)}</span>
                            </div>
                          )}
                          {savings > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-emerald-400 font-semibold">You save</span>
                              <span className="text-emerald-400 font-bold">{formatINR(savings)} ({savingsPct}% off)</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Subscribe button */}
                    <div className="p-4 border-t border-card-border">
                      <Button
                        className="w-full h-11 font-bold text-base rounded-xl"
                        style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
                        onClick={() => openSubscribe(p)}
                        data-testid={`button-subscribe-${p.id}`}
                      >
                        <ShoppingCart size={16} className="mr-2" />
                        Subscribe &amp; Add to Cart
                      </Button>
                      <p className="text-center text-xs text-muted-foreground mt-2">Cancel anytime · No hidden charges</p>
                    </div>
                  </div>
                );
              })}
              {plans.filter((p) => p.active).length === 0 && (
                <p className="text-muted-foreground col-span-2 text-center py-12">No plans available right now. Check back soon!</p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Subscribe dialog */}
      <Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-emerald-400" />
              Subscribe to {subscribePlan?.name}
            </DialogTitle>
          </DialogHeader>
          
          {/* Plan summary in dialog */}
          {subscribePlan && (() => { const { storeValue, savings, savingsPct } = calcPlanSavings(subscribePlan); return storeValue > 0 && savings > 0 ? (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm">
              <p className="font-semibold text-emerald-400">🎉 You're saving {formatINR(savings)} ({savingsPct}% off store price)</p>
              <p className="text-muted-foreground text-xs mt-0.5">Plan: {formatINR(Number(subscribePlan.price))}/wk vs store value {formatINR(storeValue)}</p>
            </div>
          ) : null; })()}

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold">Delivery days</Label>
              <Select value={deliveryDays} onValueChange={(v) => setDeliveryDays(v as DeliveryDayOption)}>
                <SelectTrigger className="mt-1" data-testid="select-subscribe-delivery-days"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saturday">Saturday only</SelectItem>
                  <SelectItem value="sunday">Sunday only</SelectItem>
                  <SelectItem value="both">Both Saturday &amp; Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Phone number</Label>
              <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" data-testid="input-subscribe-phone" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Delivery address</Label>
              <Textarea className="mt-1" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Your full delivery address..." data-testid="input-subscribe-address" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSubscribeOpen(false)}>Cancel</Button>
            <Button
              onClick={() => subscribe.mutate()}
              disabled={subscribe.isPending || !address.trim() || !phone.trim()}
              className="flex-1"
              style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
              data-testid="button-confirm-subscribe"
            >
              {subscribe.isPending ? "Setting up…" : "✓ Confirm & Add to Cart"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change plan dialog */}
      <Dialog open={changePlanOpen != null} onOpenChange={(v) => !v && setChangePlanOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change plan</DialogTitle></DialogHeader>
          <Select value={changePlanTarget} onValueChange={setChangePlanTarget}>
            <SelectTrigger data-testid="select-change-plan-target"><SelectValue /></SelectTrigger>
            <SelectContent>
              {plans.filter((p) => p.active).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name} — {formatINR(Number(p.price))}/wk</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOpen(null)}>Cancel</Button>
            <Button onClick={() => changePlanOpen != null && changePlanMut.mutate({ id: changePlanOpen, planId: Number(changePlanTarget) })} disabled={changePlanMut.isPending || !changePlanTarget} data-testid="button-confirm-change-plan">
              {changePlanMut.isPending ? "Saving…" : "Change plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelTarget != null} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>This will stop future deliveries. You can reactivate later from this page.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-dialog-dismiss">Keep subscription</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (cancelTarget != null) cancelMut.mutate(cancelTarget); setCancelTarget(null); }} data-testid="button-cancel-dialog-confirm">Cancel subscription</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
