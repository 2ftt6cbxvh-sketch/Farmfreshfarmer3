import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PackageCheck, CalendarDays, Pause, Play, SkipForward, Ban, RotateCcw, Repeat } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/store";
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
}

interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  deliveryDays: string;
  active: boolean;
  items: PlanItem[];
}

interface SubItem {
  id: number;
  productId: number;
  qty: number;
}

interface Cycle {
  id: number;
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

export default function MySubscriptions() {
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [subscribePlan, setSubscribePlan] = useState<Plan | null>(null);
  const [deliveryDays, setDeliveryDays] = useState<DeliveryDayOption>("both");
  const [address, setAddress] = useState(user?.address || "");
  const [phone, setPhone] = useState(user?.phone || "");

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
      toast({ title: "Subscribed!", description: "Your weekly box is set up." });
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
          <Link href="/login" className="inline-block mt-6 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover-elevate" data-testid="link-login">Log in</Link>
        </div>
      </Layout>
    );
  }

  const upcoming = mine?.upcomingDeliveries ?? [];

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">My subscriptions</h1>
        <p className="text-muted-foreground mb-6">Weekly farm-fresh boxes delivered every Saturday & Sunday.</p>

        {/* Upcoming deliveries */}
        {upcoming.length > 0 && (
          <div className="rounded-xl border border-card-border bg-card p-4 mb-8" data-testid="panel-upcoming-deliveries">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><CalendarDays size={18} className="text-primary" /> Upcoming delivery windows</h2>
            <div className="flex flex-wrap gap-2">
              {upcoming.map((d, idx) => (
                <Badge key={idx} variant="outline" data-testid={`upcoming-delivery-${idx}`}>
                  {d.day} · {new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* My subscriptions */}
        <section className="mb-10">
          <h2 className="font-semibold text-lg mb-3">Active & past subscriptions</h2>
          {mineLoading ? (
            <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
          ) : !mine || mine.subscriptions.length === 0 ? (
            <div className="rounded-xl border border-card-border bg-card p-8 text-center text-muted-foreground">
              You don't have any subscriptions yet. Pick a plan below to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {mine.subscriptions.map((s) => {
                const plan = plans.find((p) => p.id === s.planId);
                const futureCycles = s.cycles.filter((c) => new Date(c.deliveryDate) >= new Date(Date.now() - 86400000));
                return (
                  <div key={s.id} className="rounded-xl border border-card-border bg-card p-4" data-testid={`subscription-${s.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{plan?.name ?? `Plan #${s.planId}`}</h3>
                        <p className="text-xs text-muted-foreground capitalize">Delivers: {s.deliveryDays}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(s.status)} data-testid={`status-subscription-${s.id}`}>{s.status}</Badge>
                        <span className="font-bold text-primary" data-testid={`price-subscription-${s.id}`}>{formatINR(Number(s.weeklyPrice))}/wk</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Box items</p>
                      <ul className="text-sm flex flex-wrap gap-x-4 gap-y-1">
                        {s.items.map((it) => <li key={it.id}>{it.qty} × {productName(it.productId)}</li>)}
                        {s.items.length === 0 && <li className="text-muted-foreground">No items.</li>}
                      </ul>
                    </div>

                    {futureCycles.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Upcoming cycles</p>
                        <ul className="text-sm space-y-1" data-testid={`cycles-subscription-${s.id}`}>
                          {futureCycles.map((c) => (
                            <li key={c.id} className="flex justify-between border-b border-card-border pb-1 last:border-b-0">
                              <span>{c.deliveryDay} · {new Date(c.deliveryDate).toLocaleDateString("en-IN")}</span>
                              <span className="flex items-center gap-2">
                                <Badge variant="outline">{c.status}</Badge> {formatINR(Number(c.amount))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {s.skipNextCycle && <p className="text-xs text-accent-foreground mt-2">Next delivery will be skipped.</p>}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {s.status === "active" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => pauseMut.mutate(s.id)} disabled={pauseMut.isPending} data-testid={`button-pause-${s.id}`}>
                            <Pause size={14} className="mr-1" /> Pause
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => skipMut.mutate(s.id)} disabled={skipMut.isPending} data-testid={`button-skip-${s.id}`}>
                            <SkipForward size={14} className="mr-1" /> Skip next
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setChangePlanOpen(s.id); setChangePlanTarget(String(s.planId)); }} data-testid={`button-change-plan-${s.id}`}>
                            <Repeat size={14} className="mr-1" /> Change plan
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setCancelTarget(s.id)} data-testid={`button-cancel-${s.id}`}>
                            <Ban size={14} className="mr-1" /> Cancel
                          </Button>
                        </>
                      )}
                      {s.status === "paused" && (
                        <Button size="sm" variant="outline" onClick={() => resumeMut.mutate(s.id)} disabled={resumeMut.isPending} data-testid={`button-resume-${s.id}`}>
                          <Play size={14} className="mr-1" /> Resume
                        </Button>
                      )}
                      {s.status === "cancelled" && (
                        <Button size="sm" variant="outline" onClick={() => reactivateMut.mutate(s.id)} disabled={reactivateMut.isPending} data-testid={`button-reactivate-${s.id}`}>
                          <RotateCcw size={14} className="mr-1" /> Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Available plans */}
        <section>
          <h2 className="font-semibold text-lg mb-3">Available plans</h2>
          {plansLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {plans.filter((p) => p.active).map((p) => (
                <div key={p.id} className="rounded-xl border border-card-border bg-card p-4 flex flex-col" data-testid={`plan-${p.id}`}>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 flex-1">{p.description}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-2">Delivery: {p.deliveryDays}</p>
                  <ul className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {p.items.map((it, idx) => <li key={idx}>{it.qty} × {productName(it.productId)}</li>)}
                  </ul>
                  <div className="flex items-center justify-between mt-4">
                    <span className="font-bold text-primary" data-testid={`plan-price-${p.id}`}>{formatINR(Number(p.price))}/wk</span>
                    <Button size="sm" onClick={() => openSubscribe(p)} data-testid={`button-subscribe-${p.id}`}>Subscribe</Button>
                  </div>
                </div>
              ))}
              {plans.filter((p) => p.active).length === 0 && (
                <p className="text-muted-foreground col-span-2 text-center py-8">No plans available right now.</p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Subscribe dialog */}
      <Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Subscribe to {subscribePlan?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Delivery days</Label>
              <Select value={deliveryDays} onValueChange={(v) => setDeliveryDays(v as DeliveryDayOption)}>
                <SelectTrigger data-testid="select-subscribe-delivery-days"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saturday">Saturday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-subscribe-phone" />
            </div>
            <div>
              <Label className="text-xs">Delivery address</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} data-testid="input-subscribe-address" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubscribeOpen(false)}>Cancel</Button>
            <Button
              onClick={() => subscribe.mutate()}
              disabled={subscribe.isPending || !address.trim() || !phone.trim()}
              data-testid="button-confirm-subscribe"
            >
              {subscribe.isPending ? "Subscribing…" : "Confirm subscription"}
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
            <Button
              onClick={() => changePlanOpen != null && changePlanMut.mutate({ id: changePlanOpen, planId: Number(changePlanTarget) })}
              disabled={changePlanMut.isPending || !changePlanTarget}
              data-testid="button-confirm-change-plan"
            >
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
            <AlertDialogDescription>This will stop future deliveries. You can reactivate later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-dialog-dismiss">Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (cancelTarget != null) cancelMut.mutate(cancelTarget); setCancelTarget(null); }}
              data-testid="button-cancel-dialog-confirm"
            >
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
