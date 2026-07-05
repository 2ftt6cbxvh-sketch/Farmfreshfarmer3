/**
 * Subscription lifecycle + weekly delivery generation.
 * ====================================================
 * Business rules:
 *  - Deliveries happen every SATURDAY and SUNDAY (weekly recurring).
 *  - Admin controls the fulfilment day per subscription/plan: saturday | sunday | both.
 *  - Billing model (locked decision): "generate weekly orders, pay each time" —
 *    NO stored mandate/AutoPay. For each upcoming Sat/Sun we auto-create an order
 *    (paid per delivery via PhonePe or COD).
 *
 * Lifecycle actions: pause / resume / skip-next / cancel / reactivate / change-plan.
 *
 * The generation job (`generateUpcomingCycles`) is idempotent per delivery date:
 * it will not create a duplicate cycle for a subscription+date that already exists.
 */
import { storage } from "../storage";
import { placeOrder } from "./orders";
import type { CartLine } from "./pricing";

type DeliveryDay = "Saturday" | "Sunday";

/** Next N Saturdays/Sundays from a reference date (inclusive of today if match). */
export function upcomingDeliveryDates(from: Date, weeks = 2): { date: Date; day: DeliveryDay }[] {
  const out: { date: Date; day: DeliveryDay }[] = [];
  const cur = new Date(from);
  cur.setHours(9, 0, 0, 0); // deliveries scheduled for 9am local
  const end = new Date(cur);
  end.setDate(end.getDate() + weeks * 7);
  while (cur <= end) {
    const dow = cur.getDay(); // 0=Sun,6=Sat
    if (dow === 6) out.push({ date: new Date(cur), day: "Saturday" });
    else if (dow === 0) out.push({ date: new Date(cur), day: "Sunday" });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function daysMatch(subDeliveryDays: string, day: DeliveryDay): boolean {
  const d = subDeliveryDays.toLowerCase();
  if (d === "both") return true;
  if (d === "saturday") return day === "Saturday";
  if (d === "sunday") return day === "Sunday";
  return false;
}

/** Resolve the full item list for a subscription = plan box items + custom add-ons. */
async function resolveSubscriptionItems(subscriptionId: number, planId: number): Promise<CartLine[]> {
  const lines: CartLine[] = [];
  const planItems = await storage.plans.items(planId);
  const addOns = await storage.subscriptions.items(subscriptionId);
  const all = [...planItems, ...addOns];
  for (const it of all) {
    const p = await storage.products.get(it.productId);
    if (!p) continue;
    lines.push({ productId: p.id, name: p.name, unit: p.unit, price: Number(p.price), qty: it.qty });
  }
  return lines;
}

/* --------------------------- Lifecycle actions --------------------------- */

export async function pauseSubscription(id: number, actor: "customer" | "admin", pausedUntil?: Date) {
  await storage.subscriptions.update(id, { pausedUntil: pausedUntil ?? null });
  return storage.subscriptions.setStatus(id, "paused", actor, "Subscription paused");
}

export async function resumeSubscription(id: number, actor: "customer" | "admin") {
  await storage.subscriptions.update(id, { pausedUntil: null, skipNextCycle: false });
  return storage.subscriptions.setStatus(id, "active", actor, "Subscription resumed");
}

export async function skipNextCycle(id: number, actor: "customer" | "admin") {
  await storage.subscriptions.update(id, { skipNextCycle: true });
  await storage.subscriptions.setStatus(id, (await storage.subscriptions.get(id))!.status, actor, "Skip next delivery requested");
  return storage.subscriptions.get(id);
}

export async function cancelSubscription(id: number, actor: "customer" | "admin") {
  return storage.subscriptions.setStatus(id, "cancelled", actor, "Subscription cancelled");
}

export async function reactivateSubscription(id: number, actor: "customer" | "admin") {
  return storage.subscriptions.setStatus(id, "active", actor, "Subscription reactivated");
}

export async function changePlan(id: number, newPlanId: number, actor: "customer" | "admin") {
  const sub = await storage.subscriptions.get(id);
  if (!sub) return undefined;
  const newPlan = await storage.plans.get(newPlanId);
  if (!newPlan) return undefined;
  await storage.subscriptions.logChange(id, sub.planId, newPlanId, `Plan changed by ${actor}`);
  return storage.subscriptions.update(id, {
    planId: newPlanId,
    weeklyPrice: Number(newPlan.price),
    deliveryDays: newPlan.deliveryDays,
  });
}

/* ----------------------- Weekly delivery generation ---------------------- */

/**
 * For every active subscription, ensure billing cycles exist for the upcoming
 * Sat/Sun delivery dates (within `weeks`). Honours pause, skipNextCycle, and the
 * subscription's delivery-day preference. Idempotent.
 *
 * `createOrders=true` also creates a real order per generated cycle (pay-per-delivery).
 */
export async function generateUpcomingCycles(opts?: { weeks?: number; createOrders?: boolean; from?: Date }) {
  const weeks = opts?.weeks ?? 2;
  const from = opts?.from ?? new Date();
  const createOrders = opts?.createOrders ?? true;
  const active = await storage.subscriptions.listActive();
  const dates = upcomingDeliveryDates(from, weeks);
  const results: { subscriptionId: number; created: number; skipped: number }[] = [];

  for (const sub of active) {
    if (sub.status !== "active") continue;
    // Respect pausedUntil.
    if (sub.pausedUntil && new Date(sub.pausedUntil) > from) continue;

    let created = 0, skipped = 0;
    const existing = await storage.subscriptions.cyclesForSubscription(sub.id);
    const existingKeys = new Set(existing.map((c) => `${new Date(c.deliveryDate).toDateString()}`));
    let skipConsumed = false;

    for (const { date, day } of dates) {
      if (!daysMatch(sub.deliveryDays, day)) continue;
      const key = date.toDateString();
      if (existingKeys.has(key)) continue;

      // Skip-next-cycle consumes the first eligible upcoming delivery.
      if (sub.skipNextCycle && !skipConsumed) {
        await storage.subscriptions.createCycle({
          subscriptionId: sub.id, orderId: null, deliveryDate: date,
          deliveryDay: day, amount: Number(sub.weeklyPrice), status: "skipped",
        });
        skipConsumed = true;
        skipped++;
        continue;
      }

      const cycle = await storage.subscriptions.createCycle({
        subscriptionId: sub.id, orderId: null, deliveryDate: date,
        deliveryDay: day, amount: Number(sub.weeklyPrice), status: "scheduled",
      });

      if (createOrders) {
        const items = await resolveSubscriptionItems(sub.id, sub.planId);
        if (items.length) {
          const { order } = await placeOrder({
            userId: sub.userId,
            customerName: "",
            phone: sub.phone || "",
            address: sub.deliveryAddress || "",
            items,
            paymentMethod: "COD", // pay per delivery; can be switched to PhonePe by customer
            orderType: "subscription",
            subscriptionId: sub.id,
            deliveryDay: day,
          });
          await storage.subscriptions.updateCycle(cycle.id, { orderId: order.id, status: "generated" });
        }
      }
      created++;
    }

    // Consume the skip flag once we've generated.
    if (sub.skipNextCycle && skipConsumed) {
      await storage.subscriptions.update(sub.id, { skipNextCycle: false });
    }
    results.push({ subscriptionId: sub.id, created, skipped });
  }
  return results;
}
