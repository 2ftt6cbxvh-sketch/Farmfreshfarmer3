/**
 * Order placement orchestrator.
 * =============================
 * Ties together pricing, stock decrement, discount-usage recording, first-order
 * marking, and referral settlement into one place so both the normal checkout
 * route and the subscription weekly-generation job produce consistent orders.
 */
import { storage } from "../storage";
import { computePrice, resolveLines, type CartLine, type PriceResult } from "./pricing";
import { settleReferralForOrder, recordRewardSpend } from "./referral";

export interface PlaceOrderInput {
  userId: number | null;
  customerName: string;
  phone: string;
  address: string;
  items: CartLine[];
  couponCode?: string | null;
  referralCode?: string | null;
  redeemReward?: boolean;
  paymentMethod?: string;         // COD | PHONEPE
  orderType?: string;             // normal | subscription
  subscriptionId?: number | null;
  deliveryDay?: string | null;
}

export interface PlacedOrder {
  order: Awaited<ReturnType<typeof storage.orders.create>>;
  price: PriceResult;
}

/**
 * Places an order. For COD the order is immediately "confirmed" (payment
 * pending -> COD). For PHONEPE the caller initiates payment afterwards and the
 * payment callback marks it paid. Referral settlement + first-order marking are
 * applied here regardless of method because the qualifying event is "order
 * placed" (a COD first order still converts a referral).
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  // Authoritative, server-side line items (never trust client prices).
  const { lines } = await resolveLines(input.items);
  if (lines.length === 0) {
    throw Object.assign(new Error("Cart is empty"), { status: 400 });
  }

  const price = await computePrice({
    userId: input.userId,
    items: lines,
    couponCode: input.couponCode,
    referralCode: input.referralCode,
    redeemReward: input.redeemReward,
  });

  const paymentMethod = input.paymentMethod || "COD";
  const paymentStatus = paymentMethod === "COD" ? "pending" : "pending";

  const order = await storage.orders.create({
    userId: input.userId,
    customerName: input.customerName,
    phone: input.phone,
    address: input.address,
    subtotal: price.subtotal,
    discount: price.discount,
    total: price.total,
    couponCode: price.couponCode,
    orderType: input.orderType || "normal",
    subscriptionId: input.subscriptionId ?? null,
    deliveryDay: input.deliveryDay ?? null,
    firstOrderDiscount: price.firstOrderDiscount,
    referralDiscount: price.referralDiscount,
    referralRewardApplied: price.referralRewardApplied,
    referralCodeUsed: price.referralCodeUsed,
    paymentMethod,
    paymentStatus,
    items: lines,
    discountBreakdown: price.breakdown,
  });

  // Decrement stock for known products (best-effort; never negative).
  for (const it of lines) {
    if (it.productId) {
      await storage.products.adjustStock(it.productId, -Math.abs(it.qty), "order", `Order #${order.id}`);
    }
  }

  // Record discount-rule usages so first-order can't be reused.
  if (input.userId) {
    if (price.firstOrderDiscount > 0) {
      const rule = await storage.discounts.getByType("first_order");
      if (rule) await storage.discounts.recordUsage(rule.id, input.userId, order.id, price.firstOrderDiscount);
    }
    if (price.referralDiscount > 0) {
      const rule = await storage.discounts.getByType("referral_new");
      if (rule) await storage.discounts.recordUsage(rule.id, input.userId, order.id, price.referralDiscount);
    }
    // Referrer reward spend ledger.
    if (price.referralRewardApplied > 0) {
      await recordRewardSpend(input.userId, order.id, price.referralRewardApplied);
    }
  }

  // Settle referral (credit referrer) if this was a valid new-customer first order.
  if (price.meta.referralValid && price.meta.referrerUserId && input.userId) {
    await settleReferralForOrder({
      referredUserId: input.userId,
      referrerUserId: price.meta.referrerUserId,
      referralCode: price.referralCodeUsed || input.referralCode || "",
      orderId: order.id,
      orderSubtotal: price.subtotal,
    });
  }

  // Mark first order + bump stats for logged-in customers.
  if (input.userId) {
    const profile = await storage.profiles.ensure(input.userId);
    if (!profile.hasCompletedFirstOrder) {
      await storage.profiles.markFirstOrder(input.userId, order.id);
    }
    await storage.profiles.bumpOrderStats(input.userId, price.total);
  }

  return { order, price };
}
