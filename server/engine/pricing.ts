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
  pincode?: string | null;       // delivery pincode chosen at checkout
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

export interface ItemGstBreakdown {
  productId: number | null;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  baseAmount: number;
  gstPercent: number;
  cgstPercent: number;
  sgstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  gstAmount: number;
  itemSubtotal: number;
}

export interface PriceResult {
  subtotal: number;
  discount: number;               // total discount
  deliveryFee: number;            // delivery charge added to the total
  deliveryCity: string | null;    // resolved delivery city
  total: number;
  taxableSubtotal: number;
  totalGst: number;
  cgst: number;
  sgst: number;
  cgstEnabled: boolean;
  sgstEnabled: boolean;
  itemBreakdown: ItemGstBreakdown[];
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
 * back to the supplied values. Returns the priced lines + the subtotal & GST breakdown.
 */
export async function resolveLines(
  items: CartLine[],
  defaultGstPercent = 5,
  cgstEnabled = true,
  sgstEnabled = true
): Promise<{ lines: CartLine[]; subtotal: number; itemBreakdown: ItemGstBreakdown[]; taxableSubtotal: number; totalGst: number; totalCgst: number; totalSgst: number }> {
  const lines: CartLine[] = [];
  const itemBreakdown: ItemGstBreakdown[] = [];
  let taxableSubtotal = 0;
  let totalGst = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  for (const i of items) {
    const qty = Math.max(0, Math.floor(Number(i.qty) || 0));
    if (qty <= 0) continue;
    let name = i.name ?? "Item";
    let unit = i.unit ?? "";
    let unitPrice = Number(i.price) || 0;
    let gstPercent = defaultGstPercent;
    let pId: number | null = null;

    if (i.productId) {
      const p = await storage.products.get(Number(i.productId));
      if (!p || !p.active) {
        throw Object.assign(new Error(`Product ${i.productId} is unavailable`), { status: 400 });
      }
      if (qty > p.stock) {
        throw Object.assign(
          new Error(`Insufficient stock for "${p.name}". Only ${p.stock} unit(s) remaining in stock (requested ${qty}).`),
          { status: 400 }
        );
      }
      pId = p.id;
      name = p.name;
      unit = p.unit ?? i.unit ?? "";
      const rawPrice = Number(p.price) || 0;
      const discPercent = Number(p.discountPercent) || 0;
      unitPrice = discPercent > 0 ? round2(rawPrice * (1 - discPercent / 100)) : rawPrice;
      gstPercent = p.gstPercent != null ? Number(p.gstPercent) : defaultGstPercent;
    }

    const baseAmount = round2(unitPrice * qty);
    const cgstPercent = cgstEnabled ? round2(gstPercent / 2) : 0;
    const sgstPercent = sgstEnabled ? round2(gstPercent / 2) : 0;
    const effectiveGstPercent = round2(cgstPercent + sgstPercent);

    const cgstAmount = round2(baseAmount * (cgstPercent / 100));
    const sgstAmount = round2(baseAmount * (sgstPercent / 100));
    const gstAmount = round2(cgstAmount + sgstAmount);
    const itemSubtotal = round2(baseAmount + gstAmount);

    taxableSubtotal = round2(taxableSubtotal + baseAmount);
    totalGst = round2(totalGst + gstAmount);
    totalCgst = round2(totalCgst + cgstAmount);
    totalSgst = round2(totalSgst + sgstAmount);

    lines.push({
      productId: pId,
      name,
      unit,
      price: unitPrice,
      qty,
    });

    itemBreakdown.push({
      productId: pId,
      name,
      unit,
      qty,
      unitPrice,
      baseAmount,
      gstPercent: effectiveGstPercent,
      cgstPercent,
      sgstPercent,
      cgstAmount,
      sgstAmount,
      gstAmount,
      itemSubtotal,
    });
  }

  const subtotal = round2(itemBreakdown.reduce((s, i) => s + i.itemSubtotal, 0));
  return { lines, subtotal, itemBreakdown, taxableSubtotal, totalGst, totalCgst, totalSgst };
}

/** Compute the full price breakdown for a prospective order. */
export async function computePrice(req: PriceRequest): Promise<PriceResult> {
  const settings = await storage.settings.all();
  const defaultGstPercent = parseFloat(settings.default_gst_percent || "5") || 5;
  const cgstEnabled = settings.cgst_enabled !== "false";
  const sgstEnabled = settings.sgst_enabled !== "false";

  // Re-price every line from the database (authoritative), never trust the client.
  const { subtotal, itemBreakdown, taxableSubtotal, totalGst, totalCgst, totalSgst } = await resolveLines(req.items, defaultGstPercent, cgstEnabled, sgstEnabled);
  const cgst = totalCgst;
  const sgst = totalSgst;

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

  // ---- Employee & Delivery Partner Perk Discount ----
  let perkDiscount = 0;
  if (req.userId) {
    try {
      const { db } = await import("../db");
      const { sql } = await import("drizzle-orm");
      const user = await storage.users.get(req.userId);
      if (user && user.role !== "customer") {
        const perkRes = await db.execute(sql`SELECT * FROM employee_perk_settings LIMIT 1`);
        if (perkRes.rows && perkRes.rows.length > 0) {
          const row: any = perkRes.rows[0];
          const isSubAdmin = ["warehouse_admin", "manager_admin", "subadmin", "custom_subadmin"].includes(user.role);
          const isPartner = user.role === "delivery_partner";

          if (isSubAdmin || isPartner) {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const countRes = await db.execute(sql`
              SELECT COUNT(*)::int as count FROM orders
              WHERE user_id = ${req.userId} AND created_at >= ${startOfMonth}
            `);
            const ordersThisMonth = (countRes.rows?.[0] as any)?.count || 0;

            const pct = isSubAdmin
              ? parseFloat(row.subadmin_discount_percent || 15)
              : parseFloat(row.delivery_partner_discount_percent || 20);

            const maxCap = isSubAdmin
              ? parseFloat(row.subadmin_max_cap || 500)
              : parseFloat(row.delivery_partner_max_cap || 300);

            const limit = isSubAdmin
              ? parseInt(row.subadmin_monthly_limit || 4, 10)
              : parseInt(row.delivery_partner_monthly_limit || 6, 10);

            if (ordersThisMonth < limit) {
              const rawPerk = round2(subtotal * (pct / 100));
              perkDiscount = round2(Math.min(rawPerk, maxCap));
              if (perkDiscount > 0) {
                breakdown.push({
                  ruleType: "perk_discount",
                  label: isSubAdmin
                    ? `Sub-Admin Perk (${pct}% off, cap ₹${maxCap})`
                    : `Delivery Partner Perk (${pct}% off, cap ₹${maxCap})`,
                  amount: perkDiscount,
                });
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.error("[pricing] Perk discount calculation error:", e);
    }
  }

  // ---- Referrer reward redemption (capped at N% of subtotal) ----
  if (req.redeemReward && req.userId && referralEnabled) {
    const capPct = Number(settings.referral_reward_max_percent_per_order || 30);
    const maxByCap = round2(subtotal * (capPct / 100));
    const balance = await storage.referrals.availableBalance(req.userId);
    // Never let combined discounts exceed subtotal.
    const alreadyDiscounted = referralDiscount + firstOrderDiscount + couponDiscount + perkDiscount;
    const roomLeft = Math.max(0, round2(subtotal - alreadyDiscounted));
    referralRewardApplied = round2(Math.min(balance, maxByCap, roomLeft));
    if (referralRewardApplied > 0) {
      breakdown.push({ ruleType: "referral_reward", label: `Referral reward credit applied (max ${capPct}% per order)`, amount: referralRewardApplied });
    }
  }

  // ---- Total, clamped so it never goes below zero ----
  let discount = round2(firstOrderDiscount + referralDiscount + couponDiscount + perkDiscount + referralRewardApplied);
  if (discount > subtotal) discount = subtotal;
  const afterDiscount = round2(subtotal - discount);

  // ---- Delivery fee calculation using distance rules & geofencing ----
  let deliveryFee = subtotal >= 500 ? 0 : 30;
  let deliveryCity: string | null = req.city || null;

  try {
    const { resolveByPincode } = await import("../services/delivery");
    const { deliveryFeeRules } = await import("@shared/schema");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const userPincode = req.pincode ?? null;
    const resByPin = await resolveByPincode(userPincode, req.userId, subtotal);
    const freeThreshold = resByPin?.freeDeliveryAbove || 500;

    if (freeThreshold > 0 && subtotal >= freeThreshold) {
      deliveryFee = 0;
      deliveryCity = resByPin?.locationArea || null;
    } else if (resByPin && resByPin.serviceable) {
      deliveryFee = resByPin.fee;
      deliveryCity = resByPin.locationArea || null;
    } else {
      const feeRules = await db.select().from(deliveryFeeRules).where(eq(deliveryFeeRules.active, true));
      if (feeRules.length > 0) {
        const rule = feeRules[0];
        const base = parseFloat(rule.baseFee || "30");
        const cap = rule.maxFeeCap ? parseFloat(rule.maxFeeCap) : 150;
        deliveryFee = Math.min(Math.round(base), cap);
      } else {
        deliveryFee = 30;
      }
    }
  } catch (err: any) {
    console.error("[pricing] Delivery fee calculation error:", err);
    deliveryFee = subtotal >= 500 ? 0 : 30;
  }

  const total = round2(afterDiscount + deliveryFee);

  return {
    subtotal, discount, deliveryFee, deliveryCity, total,
    taxableSubtotal, totalGst, cgst, sgst, cgstEnabled, sgstEnabled, itemBreakdown,
    couponCode,
    firstOrderDiscount, referralDiscount, referralRewardApplied,
    referralCodeUsed: referralValid ? referralCodeResolved : null,
    breakdown,
    meta: { isFirstOrder, referrerUserId, referralValid, referralReason },
  };
}
