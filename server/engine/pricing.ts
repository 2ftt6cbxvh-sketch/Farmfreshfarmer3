/**
 * Pricing / discount / referral engine.
 * ======================================
 * Single place that computes an order's final price from a set of line items
 * plus optional coupon + referral code + referrer reward redemption.
 *
 * Business rules enforced here (all admin-configurable via `settings`):
 *  1. FIRST-ORDER DISCOUNT: e.g. 10% off, applies ONLY to a customer's first
 *     qualifying order. Tracked via customer_profiles.hasCompletedFirstOrder +
 *     discount_usages (max_uses_per_customer). Never applied twice.
 *  2. REFERRAL (NEW CUSTOMER): when a NEW customer places their first order with
 *     a valid referral code, they get e.g. 10% off. Only new customers qualify.
 *  3. REFERRER REWARD: the referrer earns e.g. 5% of the referred customer's
 *     qualifying order as reward credit. A referrer may redeem accumulated
 *     reward credit on their own orders, but redemption is CAPPED at 30% of
 *     that order's subtotal (referral_reward_max_percent_per_order).
 *  4. COUPON: existing coupon system preserved.
 *
 * Stacking policy: first-order OR referral-new is the "primary" percentage
 * discount (they don't stack with each other — a first order via referral gets
 * the better of the two, defaulting to referral-new which also credits the
 * referrer). Coupon and referrer-reward redemption apply on top, but the total
 * discount can never exceed the subtotal.
 *
 * Abuse protection:
 *  - A customer can be referred only once (DB unique index on referred_user_id).
 *  - Self-referral is rejected (referrer !== referred).
 *  - Referral-new only for customers with no completed first order.
 *  - Referrer reward only credited when the referred order is genuinely a NEW
 *    customer's first qualifying order.
 */
import { storage } from "../storage";

export interface CartLine {
  productId?: number | null;
  name: string;
  unit: string;
  price: number;
  qty: number;
}

export interface PriceRequest {
  userId: number | null;         // logged-in customer (null = guest)
  items: CartLine[];
  couponCode?: string | null;
  referralCode?: string | null;  // code entered at checkout
  redeemReward?: boolean;        // referrer wants to spend their reward credit
  city?: string | null;          // delivery city chosen at checkout
}

/** One admin-configured delivery rule per city. */
export interface DeliveryCity {
  name: string;
  charge: number;      // delivery fee in INR
  freeAbove: number;   // subtotal at/above which delivery is free (0 = never free)
}
export interface DeliveryRules {
  enabled: boolean;
  cities: DeliveryCity[];
}

/** Parse the delivery_rules JSON setting, tolerating a missing/invalid value. */
export function parseDeliveryRules(raw: string | undefined): DeliveryRules {
  if (!raw) return { enabled: false, cities: [] };
  try {
    const p = JSON.parse(raw);
    const cities: DeliveryCity[] = Array.isArray(p?.cities)
      ? p.cities.map((c: any) => ({
          name: String(c?.name ?? "").trim(),
          charge: Math.max(0, Number(c?.charge) || 0),
          freeAbove: Math.max(0, Number(c?.freeAbove) || 0),
        })).filter((c: DeliveryCity) => c.name)
      : [];
    return { enabled: p?.enabled !== false, cities };
  } catch {
    return { enabled: false, cities: [] };
  }
}

export interface DiscountLine {
  ruleType: string;   // first_order | referral_new | coupon | referral_reward
  label: string;
  amount: number;
}

export interface PriceResult {
  subtotal: number;
  discount: number;               // total discount
  deliveryFee: number;            // delivery charge added to the total
  deliveryCity: string | null;    // resolved delivery city
  total: number;
  couponCode: string | null;
  firstOrderDiscount: number;
  referralDiscount: number;
  referralRewardApplied: number;  // reward credit the referrer spent
  referralCodeUsed: string | null;
  breakdown: DiscountLine[];
  // context needed by the order-placement step to write referral records
  meta: {
    isFirstOrder: boolean;
    referrerUserId: number | null;   // resolved from referralCode
    referralValid: boolean;
    referralReason?: string;         // why a referral code was rejected
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve authoritative line details from the database.
 * Any line that carries a productId is re-priced from the DB so a client can
 * never spoof the price. Lines without a productId (rare, custom lines) fall
 * back to the supplied values. Returns the priced lines + the subtotal.
 */
export async function resolveLines(
  items: CartLine[],
): Promise<{ lines: CartLine[]; subtotal: number }> {
  const lines: CartLine[] = [];
  for (const i of items) {
    const qty = Math.max(0, Math.floor(Number(i.qty) || 0));
    if (qty <= 0) continue;
    if (i.productId) {
      const p = await storage.products.get(Number(i.productId));
      if (!p || !p.active) {
        throw Object.assign(new Error(`Product ${i.productId} is unavailable`), { status: 400 });
      }
      lines.push({
        productId: p.id,
        name: p.name,
        unit: p.unit ?? i.unit ?? "",
        price: Number(p.price),
        qty,
      });
    } else {
      // No productId: trust supplied values (custom/ad-hoc line).
      lines.push({
        productId: null,
        name: i.name ?? "Item",
        unit: i.unit ?? "",
        price: Number(i.price) || 0,
        qty,
      });
    }
  }
  const subtotal = round2(lines.reduce((s, i) => s + i.price * i.qty, 0));
  return { lines, subtotal };
}

/** Compute the full price breakdown for a prospective order. */
export async function computePrice(req: PriceRequest): Promise<PriceResult> {
  const settings = await storage.settings.all();
  // Re-price every line from the database (authoritative), never trust the client.
  const { subtotal } = await resolveLines(req.items);

  const breakdown: DiscountLine[] = [];
  let firstOrderDiscount = 0;
  let referralDiscount = 0;
  let referralRewardApplied = 0;
  let couponCode: string | null = null;
  let couponDiscount = 0;

  // ---- Determine "new customer" / first-order eligibility ----
  let isFirstOrder = false;
  if (req.userId) {
    const profile = await storage.profiles.ensure(req.userId);
    isFirstOrder = !profile.hasCompletedFirstOrder;
  }

  // ---- Resolve referral code (if any) ----
  // A customer may be referred in one of two ways:
  //   (a) they entered a code at signup -> a PENDING referral row already exists,
  //   (b) they enter a code at checkout for the first time.
  // Either way the discount is only ever granted on their FIRST order, only once
  // (unique index on referred_user_id), and never for self-referral.
  let referrerUserId: number | null = null;
  let referralValid = false;
  let referralReason: string | undefined;
  let referralCodeResolved: string | null = null;
  const enteredCode = req.referralCode?.trim().toUpperCase() || null;
  const referralEnabled = settings.referral_enabled !== "false";

  if (referralEnabled && req.userId) {
    const existing = await storage.referrals.wasReferred(req.userId);

    if (existing) {
      // A referral link already exists for this user (usually from signup).
      if (existing.status === "converted") {
        referralReason = "Your referral discount has already been used";
      } else if (!isFirstOrder) {
        referralReason = "Referral discount is only for your first order";
      } else if (existing.referrerUserId === req.userId) {
        referralReason = "You cannot use your own referral code";
      } else if (enteredCode && enteredCode !== existing.code) {
        // They typed a different code than the one they signed up with.
        referralReason = "A different referral is already linked to your account";
        referrerUserId = existing.referrerUserId;
        referralCodeResolved = existing.code;
        referralValid = true; // still honour the pending referral
        referralReason = undefined;
      } else {
        // Honour the pending referral from signup (code optional at checkout).
        referrerUserId = existing.referrerUserId;
        referralCodeResolved = existing.code;
        referralValid = true;
      }
    } else if (enteredCode) {
      // No prior link; validate the freshly entered code.
      const codeRow = await storage.referrals.findByCode(enteredCode);
      if (!codeRow || !codeRow.active) {
        referralReason = "Invalid referral code";
      } else if (codeRow.userId === req.userId) {
        referralReason = "You cannot use your own referral code";
      } else if (!isFirstOrder) {
        referralReason = "Referral discount is only for your first order";
      } else {
        referrerUserId = codeRow.userId;
        referralCodeResolved = codeRow.code;
        referralValid = true;
      }
    }
  } else if (referralEnabled && enteredCode && !req.userId) {
    referralReason = "Log in to use a referral code";
  }

  // ---- Primary percentage discount: referral-new takes precedence over first-order ----
  const firstOrderEnabled = settings.first_order_discount_enabled !== "false";
  const firstOrderPct = Number(settings.first_order_discount_percent || 10);
  const referralNewPct = Number(settings.referral_new_customer_percent || 10);

  if (referralValid) {
    referralDiscount = round2(subtotal * (referralNewPct / 100));
    breakdown.push({ ruleType: "referral_new", label: `Referral discount (${referralNewPct}% off first order)`, amount: referralDiscount });
  } else if (isFirstOrder && firstOrderEnabled && req.userId) {
    // Only if the customer hasn't already consumed a first-order discount rule.
    const rule = await storage.discounts.getByType("first_order");
    let allowed = true;
    if (rule) {
      const uses = await storage.discounts.usagesForUserRule(req.userId, rule.id);
      allowed = uses.length < (rule.maxUsesPerCustomer || 1);
    }
    if (allowed) {
      firstOrderDiscount = round2(subtotal * (firstOrderPct / 100));
      breakdown.push({ ruleType: "first_order", label: `First order discount (${firstOrderPct}% off)`, amount: firstOrderDiscount });
    }
  }

  // ---- Coupon (existing system), applies on subtotal ----
  if (req.couponCode) {
    const coupon = await storage.coupons.getByCode(req.couponCode);
    if (coupon && coupon.active && subtotal >= Number(coupon.minOrder)) {
      couponDiscount = round2(subtotal * (Number(coupon.discountPercent) / 100));
      couponCode = coupon.code;
      breakdown.push({ ruleType: "coupon", label: `Coupon ${coupon.code} (${Number(coupon.discountPercent)}% off)`, amount: couponDiscount });
    }
  }

  // ---- Referrer reward redemption (capped at N% of subtotal) ----
  if (req.redeemReward && req.userId && referralEnabled) {
    const capPct = Number(settings.referral_reward_max_percent_per_order || 30);
    const maxByCap = round2(subtotal * (capPct / 100));
    const balance = await storage.referrals.availableBalance(req.userId);
    // Never let combined discounts exceed subtotal.
    const alreadyDiscounted = referralDiscount + firstOrderDiscount + couponDiscount;
    const roomLeft = Math.max(0, round2(subtotal - alreadyDiscounted));
    referralRewardApplied = round2(Math.min(balance, maxByCap, roomLeft));
    if (referralRewardApplied > 0) {
      breakdown.push({ ruleType: "referral_reward", label: `Referral reward credit applied (max ${capPct}% per order)`, amount: referralRewardApplied });
    }
  }

  // ---- Total, clamped so it never goes below zero ----
  let discount = round2(firstOrderDiscount + referralDiscount + couponDiscount + referralRewardApplied);
  if (discount > subtotal) discount = subtotal;
  const afterDiscount = round2(subtotal - discount);

  // ---- Delivery fee (per-city, admin configurable) ----
  // The charge is resolved server-side from the chosen city so the client can
  // never spoof it. If the city has a free-delivery threshold and the subtotal
  // reaches it, delivery is free.
  const deliveryRules = parseDeliveryRules(settings.delivery_rules);
  let deliveryFee = 0;
  let deliveryCity: string | null = null;
  const chosenCity = req.city?.trim() || null;
  if (deliveryRules.enabled && chosenCity) {
    const rule = deliveryRules.cities.find(
      (c) => c.name.toLowerCase() === chosenCity.toLowerCase(),
    );
    if (rule) {
      deliveryCity = rule.name;
      const qualifiesFree = rule.freeAbove > 0 && subtotal >= rule.freeAbove;
      deliveryFee = qualifiesFree ? 0 : round2(rule.charge);
      if (deliveryFee > 0) {
        breakdown.push({ ruleType: "delivery", label: `Delivery charge (${rule.name})`, amount: deliveryFee });
      }
    }
  }

  const total = round2(afterDiscount + deliveryFee);

  return {
    subtotal, discount, deliveryFee, deliveryCity, total, couponCode,
    firstOrderDiscount, referralDiscount, referralRewardApplied,
    referralCodeUsed: referralValid ? referralCodeResolved : null,
    breakdown,
    meta: { isFirstOrder, referrerUserId, referralValid, referralReason },
  };
}
