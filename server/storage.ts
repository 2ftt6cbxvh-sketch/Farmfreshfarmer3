/**
 * PostgreSQL storage layer (Drizzle ORM, async).
 * ==============================================
 * All queries are async and use node-postgres. This replaces the old
 * synchronous better-sqlite3 `.get()/.all()/.run()` pattern.
 *
 * Money is stored as NUMERIC and returned by pg as strings; helpers here
 * accept numbers and convert to string on write. Read-side number coercion
 * is done in the engine/route layer via Number().
 */
import { db } from "./db";
import {
  users, customerProfiles, addresses, categories, products, productImages,
  inventoryAdjustments, orders, orderItems, orderStatusLogs, reviews,
  reviewModerationLogs, coupons, subscriptionPlans, subscriptionPlanItems,
  userSubscriptions, subscriptionItems, subscriptionStatusLogs,
  subscriptionChangeLogs, subscriptionBillingCycles, discountRules,
  discountUsages, orderDiscounts, referralCodes, referrals, referralRewards,
  referralRewardUsages, payments, paymentEvents, refunds, settings,
} from "@shared/schema";
import type {
  User, InsertUser, Category, InsertCategory, Product, InsertProduct,
  Coupon, InsertCoupon, Review, Order, CustomerProfile, SubscriptionPlan,
  UserSubscription, DiscountRule, ReferralCode, Payment,
} from "@shared/schema";
import { eq, and, ilike, desc, sql, inArray } from "drizzle-orm";

/* ================================ USERS ============================== */
export const userStore = {
  async get(id: number) {
    const [r] = await db.select().from(users).where(eq(users.id, id));
    return r;
  },
  async getByEmail(email: string) {
    const [r] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return r;
  },
  async getByUsername(username: string) {
    const [r] = await db.select().from(users).where(eq(users.username, username));
    return r;
  },
  async create(u: InsertUser & { role?: string; username?: string }) {
    const [r] = await db.insert(users).values({
      name: u.name, email: u.email.toLowerCase(),
      username: (u.username || u.email).toLowerCase(),
      password: u.password, phone: u.phone ?? null, address: u.address ?? null,
      role: u.role || "customer",
    }).returning();
    return r;
  },
  async updatePassword(id: number, hash: string) {
    await db.update(users).set({ password: hash, updatedAt: new Date() }).where(eq(users.id, id));
  },
  async updateStatus(id: number, status: string) {
    const [r] = await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return r;
  },
  async list() {
    return db.select().from(users).orderBy(desc(users.createdAt));
  },
  async listCustomers() {
    return db.select().from(users).where(eq(users.role, "customer")).orderBy(desc(users.createdAt));
  },
};

/* ========================= CUSTOMER PROFILES ======================== */
export const profileStore = {
  async get(userId: number) {
    const [r] = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId));
    return r;
  },
  async ensure(userId: number): Promise<CustomerProfile> {
    const existing = await this.get(userId);
    if (existing) return existing;
    const [r] = await db.insert(customerProfiles).values({ userId }).returning();
    return r;
  },
  async markFirstOrder(userId: number, orderId: number) {
    await db.update(customerProfiles)
      .set({ hasCompletedFirstOrder: true, firstOrderId: orderId, updatedAt: new Date() })
      .where(eq(customerProfiles.userId, userId));
  },
  async bumpOrderStats(userId: number, orderTotal: number) {
    await db.update(customerProfiles).set({
      totalOrders: sql`${customerProfiles.totalOrders} + 1`,
      totalSpent: sql`${customerProfiles.totalSpent} + ${orderTotal}`,
      updatedAt: new Date(),
    }).where(eq(customerProfiles.userId, userId));
  },
};

/* ============================= CATEGORIES =========================== */
export const categoryStore = {
  async list(opts?: { includeInactive?: boolean }) {
    if (opts?.includeInactive) {
      return db.select().from(categories).orderBy(categories.sortOrder);
    }
    return db.select().from(categories).where(eq(categories.active, true)).orderBy(categories.sortOrder);
  },
  async get(id: number) {
    const [r] = await db.select().from(categories).where(eq(categories.id, id));
    return r;
  },
  async create(c: InsertCategory) {
    const [r] = await db.insert(categories).values(c).returning();
    return r;
  },
  async update(id: number, c: Partial<InsertCategory>) {
    const [r] = await db.update(categories).set(c).where(eq(categories.id, id)).returning();
    return r;
  },
  async remove(id: number) {
    await db.delete(categories).where(eq(categories.id, id));
  },
};

/* ============================== PRODUCTS ============================ */
export const productStore = {
  async list(opts?: { category?: string; q?: string; featured?: boolean; includeInactive?: boolean }) {
    const conds = [];
    if (!opts?.includeInactive) conds.push(eq(products.active, true));
    if (opts?.category) conds.push(eq(products.categorySlug, opts.category));
    if (opts?.featured) conds.push(eq(products.featured, true));
    if (opts?.q) conds.push(ilike(products.name, `%${opts.q}%`));
    const where = conds.length ? and(...conds) : undefined;
    return db.select().from(products).where(where).orderBy(desc(products.createdAt));
  },
  async get(id: number) {
    const [r] = await db.select().from(products).where(eq(products.id, id));
    return r;
  },
  async create(p: InsertProduct) {
    const [r] = await db.insert(products).values({
      ...p, price: String(p.price),
      discountPercent: p.discountPercent != null ? String(p.discountPercent) : "0",
    } as any).returning();
    return r;
  },
  async update(id: number, p: Partial<InsertProduct>) {
    const patch: any = { ...p, updatedAt: new Date() };
    if (p.price != null) patch.price = String(p.price);
    if (p.discountPercent != null) patch.discountPercent = String(p.discountPercent);
    const [r] = await db.update(products).set(patch).where(eq(products.id, id)).returning();
    return r;
  },
  async remove(id: number) {
    await db.delete(products).where(eq(products.id, id));
  },
  async lowStock() {
    return db.select().from(products)
      .where(and(eq(products.active, true), sql`${products.stock} <= ${products.lowStockThreshold}`))
      .orderBy(products.stock);
  },
  /** Adjust stock and write an append-only audit row. */
  async adjustStock(productId: number, changeQty: number, reason: string, note?: string, adminUserId?: number) {
    const p = await this.get(productId);
    if (!p) return undefined;
    const previous = p.stock;
    const next = Math.max(0, previous + changeQty);
    await db.update(products).set({ stock: next, updatedAt: new Date() }).where(eq(products.id, productId));
    await db.insert(inventoryAdjustments).values({
      productId, changeQty, reason, previousStock: previous, newStock: next,
      note: note ?? null, adminUserId: adminUserId ?? null,
    });
    return { ...p, stock: next };
  },
  async adjustments(productId: number) {
    return db.select().from(inventoryAdjustments)
      .where(eq(inventoryAdjustments.productId, productId))
      .orderBy(desc(inventoryAdjustments.createdAt));
  },
};

/* ============================== COUPONS ============================= */
export const couponStore = {
  async list() { return db.select().from(coupons).orderBy(desc(coupons.createdAt)); },
  async getByCode(code: string) {
    const [r] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return r;
  },
  async create(c: InsertCoupon) {
    const [r] = await db.insert(coupons).values({
      code: c.code.toUpperCase(), discountPercent: String(c.discountPercent),
      minOrder: c.minOrder != null ? String(c.minOrder) : "0",
      active: c.active ?? true,
    } as any).returning();
    return r;
  },
  async update(id: number, c: Partial<InsertCoupon>) {
    const patch: any = { ...c };
    if (c.code) patch.code = c.code.toUpperCase();
    if (c.discountPercent != null) patch.discountPercent = String(c.discountPercent);
    if (c.minOrder != null) patch.minOrder = String(c.minOrder);
    const [r] = await db.update(coupons).set(patch).where(eq(coupons.id, id)).returning();
    return r;
  },
  async remove(id: number) { await db.delete(coupons).where(eq(coupons.id, id)); },
};

/* ============================== REVIEWS ============================= */
export const reviewStore = {
  async listForProduct(productId: number, opts?: { onlyApproved?: boolean }) {
    const conds = [eq(reviews.productId, productId)];
    if (opts?.onlyApproved) conds.push(eq(reviews.moderationStatus, "approved"));
    return db.select().from(reviews).where(and(...conds)).orderBy(desc(reviews.createdAt));
  },
  async listAll(status?: string) {
    if (status) return db.select().from(reviews).where(eq(reviews.moderationStatus, status)).orderBy(desc(reviews.createdAt));
    return db.select().from(reviews).orderBy(desc(reviews.createdAt));
  },
  async create(r: { productId: number; userId: number; userName: string; rating: number; comment: string }) {
    const [row] = await db.insert(reviews).values(r).returning();
    return row;
  },
  async setModeration(id: number, action: "approve" | "reject" | "hide", adminUserId?: number) {
    const map = { approve: "approved", reject: "rejected", hide: "hidden" } as const;
    const [row] = await db.update(reviews).set({ moderationStatus: map[action] }).where(eq(reviews.id, id)).returning();
    await db.insert(reviewModerationLogs).values({ reviewId: id, action, adminUserId: adminUserId ?? null });
    return row;
  },
};

/* =============================== ORDERS ============================= */
export const orderStore = {
  async list(opts?: { status?: string; type?: string }) {
    const conds = [];
    if (opts?.status) conds.push(eq(orders.status, opts.status));
    if (opts?.type) conds.push(eq(orders.orderType, opts.type));
    const where = conds.length ? and(...conds) : undefined;
    return db.select().from(orders).where(where).orderBy(desc(orders.createdAt));
  },
  async listByUser(userId: number) {
    return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  },
  async get(id: number) {
    const [r] = await db.select().from(orders).where(eq(orders.id, id));
    return r;
  },
  async items(orderId: number) {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  },
  async discounts(orderId: number) {
    return db.select().from(orderDiscounts).where(eq(orderDiscounts.orderId, orderId));
  },
  async statusLogs(orderId: number) {
    return db.select().from(orderStatusLogs).where(eq(orderStatusLogs.orderId, orderId)).orderBy(orderStatusLogs.createdAt);
  },
  /** Create an order + its items + initial status log in one go. */
  async create(o: {
    userId: number | null; customerName: string; phone: string; address: string;
    subtotal: number; discount: number; total: number; couponCode?: string | null;
    orderType?: string; subscriptionId?: number | null; deliveryDay?: string | null;
    firstOrderDiscount?: number; referralDiscount?: number; referralRewardApplied?: number;
    referralCodeUsed?: string | null; paymentMethod?: string; paymentStatus?: string;
    items: { productId?: number | null; name: string; unit: string; price: number; qty: number }[];
    discountBreakdown?: { ruleType: string; label: string; amount: number }[];
  }) {
    const [order] = await db.insert(orders).values({
      userId: o.userId, customerName: o.customerName, phone: o.phone, address: o.address,
      subtotal: String(o.subtotal), discount: String(o.discount), total: String(o.total),
      couponCode: o.couponCode ?? null, orderType: o.orderType ?? "normal",
      subscriptionId: o.subscriptionId ?? null, deliveryDay: o.deliveryDay ?? null,
      firstOrderDiscount: String(o.firstOrderDiscount ?? 0),
      referralDiscount: String(o.referralDiscount ?? 0),
      referralRewardApplied: String(o.referralRewardApplied ?? 0),
      referralCodeUsed: o.referralCodeUsed ?? null,
      paymentMethod: o.paymentMethod ?? "COD",
      paymentStatus: o.paymentStatus ?? "pending",
    }).returning();

    if (o.items.length) {
      await db.insert(orderItems).values(o.items.map((it) => ({
        orderId: order.id, productId: it.productId ?? null, name: it.name,
        unit: it.unit, price: String(it.price), qty: it.qty,
        lineTotal: String(Math.round(it.price * it.qty * 100) / 100),
      })));
    }
    if (o.discountBreakdown?.length) {
      await db.insert(orderDiscounts).values(o.discountBreakdown.map((d) => ({
        orderId: order.id, ruleType: d.ruleType, label: d.label, amount: String(d.amount),
      })));
    }
    await db.insert(orderStatusLogs).values({ orderId: order.id, status: order.status, note: "Order placed" });
    return order;
  },
  async setStatus(id: number, status: string, note?: string) {
    const [r] = await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
    if (r) await db.insert(orderStatusLogs).values({ orderId: id, status, note: note ?? null });
    return r;
  },
  async setPaymentStatus(id: number, paymentStatus: string, paymentMethod?: string) {
    const patch: any = { paymentStatus, updatedAt: new Date() };
    if (paymentMethod) patch.paymentMethod = paymentMethod;
    const [r] = await db.update(orders).set(patch).where(eq(orders.id, id)).returning();
    return r;
  },
};

/* ========================= SUBSCRIPTION PLANS ====================== */
export const planStore = {
  async list(opts?: { includeInactive?: boolean }) {
    if (opts?.includeInactive) return db.select().from(subscriptionPlans).orderBy(subscriptionPlans.id);
    return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.active, true)).orderBy(subscriptionPlans.id);
  },
  async get(id: number) {
    const [r] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return r;
  },
  async items(planId: number) {
    return db.select().from(subscriptionPlanItems).where(eq(subscriptionPlanItems.planId, planId));
  },
  async create(p: any, items: { productId: number; qty: number }[]) {
    const [plan] = await db.insert(subscriptionPlans).values({ ...p, price: String(p.price) }).returning();
    if (items?.length) {
      await db.insert(subscriptionPlanItems).values(items.map((it) => ({ planId: plan.id, ...it })));
    }
    return plan;
  },
  async update(id: number, p: any, items?: { productId: number; qty: number }[]) {
    const patch: any = { ...p, updatedAt: new Date() };
    if (p.price != null) patch.price = String(p.price);
    const [plan] = await db.update(subscriptionPlans).set(patch).where(eq(subscriptionPlans.id, id)).returning();
    if (items) {
      await db.delete(subscriptionPlanItems).where(eq(subscriptionPlanItems.planId, id));
      if (items.length) await db.insert(subscriptionPlanItems).values(items.map((it) => ({ planId: id, ...it })));
    }
    return plan;
  },
  async remove(id: number) {
    await db.update(subscriptionPlans).set({ active: false }).where(eq(subscriptionPlans.id, id));
  },
};

/* ========================= USER SUBSCRIPTIONS ====================== */
export const subscriptionStore = {
  async listByUser(userId: number) {
    return db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).orderBy(desc(userSubscriptions.createdAt));
  },
  async listAll(opts?: { status?: string }) {
    if (opts?.status) return db.select().from(userSubscriptions).where(eq(userSubscriptions.status, opts.status)).orderBy(desc(userSubscriptions.createdAt));
    return db.select().from(userSubscriptions).orderBy(desc(userSubscriptions.createdAt));
  },
  async listActive() {
    return db.select().from(userSubscriptions).where(eq(userSubscriptions.status, "active"));
  },
  async get(id: number) {
    const [r] = await db.select().from(userSubscriptions).where(eq(userSubscriptions.id, id));
    return r;
  },
  async create(s: any) {
    const [r] = await db.insert(userSubscriptions).values({ ...s, weeklyPrice: String(s.weeklyPrice) }).returning();
    await db.insert(subscriptionStatusLogs).values({ subscriptionId: r.id, status: r.status, actorType: "customer", note: "Subscription created" });
    return r;
  },
  async update(id: number, patch: any) {
    const p: any = { ...patch, updatedAt: new Date() };
    if (patch.weeklyPrice != null) p.weeklyPrice = String(patch.weeklyPrice);
    const [r] = await db.update(userSubscriptions).set(p).where(eq(userSubscriptions.id, id)).returning();
    return r;
  },
  async setStatus(id: number, status: string, actorType: "customer" | "admin" | "system", note?: string) {
    const patch: any = { status, updatedAt: new Date() };
    if (status === "cancelled") patch.cancelledAt = new Date();
    const [r] = await db.update(userSubscriptions).set(patch).where(eq(userSubscriptions.id, id)).returning();
    await db.insert(subscriptionStatusLogs).values({ subscriptionId: id, status, actorType, note: note ?? null });
    return r;
  },
  async logChange(id: number, fromPlanId: number | null, toPlanId: number | null, note?: string) {
    await db.insert(subscriptionChangeLogs).values({ subscriptionId: id, fromPlanId, toPlanId, note: note ?? null });
  },
  async items(subscriptionId: number) {
    return db.select().from(subscriptionItems).where(eq(subscriptionItems.subscriptionId, subscriptionId));
  },
  async setItems(subscriptionId: number, items: { productId: number; qty: number }[]) {
    await db.delete(subscriptionItems).where(eq(subscriptionItems.subscriptionId, subscriptionId));
    if (items.length) await db.insert(subscriptionItems).values(items.map((it) => ({ subscriptionId, ...it })));
  },
  async statusLogs(subscriptionId: number) {
    return db.select().from(subscriptionStatusLogs).where(eq(subscriptionStatusLogs.subscriptionId, subscriptionId)).orderBy(subscriptionStatusLogs.createdAt);
  },
  // billing cycles
  async createCycle(c: any) {
    const [r] = await db.insert(subscriptionBillingCycles).values({ ...c, amount: String(c.amount) }).returning();
    return r;
  },
  async cyclesForSubscription(subscriptionId: number) {
    return db.select().from(subscriptionBillingCycles).where(eq(subscriptionBillingCycles.subscriptionId, subscriptionId)).orderBy(desc(subscriptionBillingCycles.deliveryDate));
  },
  async updateCycle(id: number, patch: any) {
    const [r] = await db.update(subscriptionBillingCycles).set(patch).where(eq(subscriptionBillingCycles.id, id)).returning();
    return r;
  },
  async cyclesBetween(fromISO: Date, toISO: Date) {
    return db.select().from(subscriptionBillingCycles)
      .where(and(sql`${subscriptionBillingCycles.deliveryDate} >= ${fromISO}`, sql`${subscriptionBillingCycles.deliveryDate} <= ${toISO}`))
      .orderBy(subscriptionBillingCycles.deliveryDate);
  },
};

/* ======================= DISCOUNT RULES ============================ */
export const discountStore = {
  async list() { return db.select().from(discountRules).orderBy(discountRules.id); },
  async get(id: number) {
    const [r] = await db.select().from(discountRules).where(eq(discountRules.id, id));
    return r;
  },
  async getByType(type: string) {
    const [r] = await db.select().from(discountRules).where(and(eq(discountRules.type, type), eq(discountRules.active, true)));
    return r;
  },
  async create(d: any) {
    const [r] = await db.insert(discountRules).values({ ...d, discountPercent: String(d.discountPercent) }).returning();
    return r;
  },
  async update(id: number, d: any) {
    const patch: any = { ...d, updatedAt: new Date() };
    if (d.discountPercent != null) patch.discountPercent = String(d.discountPercent);
    const [r] = await db.update(discountRules).set(patch).where(eq(discountRules.id, id)).returning();
    return r;
  },
  async usagesForUserRule(userId: number, ruleId: number) {
    return db.select().from(discountUsages).where(and(eq(discountUsages.userId, userId), eq(discountUsages.ruleId, ruleId)));
  },
  async recordUsage(ruleId: number, userId: number | null, orderId: number | null, amount: number) {
    await db.insert(discountUsages).values({ ruleId, userId, orderId, amount: String(amount) });
  },
};

/* ============================ REFERRALS ============================= */
export const referralStore = {
  async codeForUser(userId: number) {
    const [r] = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId));
    return r;
  },
  async createCode(userId: number, code: string) {
    const [r] = await db.insert(referralCodes).values({ userId, code }).returning();
    return r;
  },
  async findByCode(code: string) {
    const [r] = await db.select().from(referralCodes).where(eq(referralCodes.code, code.toUpperCase()));
    return r;
  },
  async wasReferred(referredUserId: number) {
    const [r] = await db.select().from(referrals).where(eq(referrals.referredUserId, referredUserId));
    return r;
  },
  async createReferral(r: { referrerUserId: number; referredUserId: number; code: string; status?: string }) {
    const [row] = await db.insert(referrals).values({ ...r, status: r.status ?? "pending" }).returning();
    return row;
  },
  async convertReferral(id: number, qualifyingOrderId: number) {
    const [r] = await db.update(referrals).set({ status: "converted", qualifyingOrderId, convertedAt: new Date() }).where(eq(referrals.id, id)).returning();
    return r;
  },
  async referralsByReferrer(referrerUserId: number) {
    return db.select().from(referrals).where(eq(referrals.referrerUserId, referrerUserId)).orderBy(desc(referrals.createdAt));
  },
  async createReward(rw: { referrerUserId: number; referralId: number; rewardPercent: number; amount: number; status?: string }) {
    const [r] = await db.insert(referralRewards).values({
      referrerUserId: rw.referrerUserId, referralId: rw.referralId,
      rewardPercent: String(rw.rewardPercent), amount: String(rw.amount), status: rw.status ?? "approved",
    }).returning();
    return r;
  },
  async rewardsForUser(userId: number) {
    return db.select().from(referralRewards).where(eq(referralRewards.referrerUserId, userId)).orderBy(desc(referralRewards.createdAt));
  },
  async rewardUsagesForUser(userId: number) {
    return db.select().from(referralRewardUsages).where(eq(referralRewardUsages.referrerUserId, userId));
  },
  async recordRewardUsage(userId: number, orderId: number | null, amount: number) {
    await db.insert(referralRewardUsages).values({ referrerUserId: userId, orderId, amount: String(amount) });
  },
  /** Available reward balance = sum(approved rewards) - sum(used). */
  async availableBalance(userId: number): Promise<number> {
    const rewards = await this.rewardsForUser(userId);
    const usages = await this.rewardUsagesForUser(userId);
    const earned = rewards.filter((r) => r.status === "approved" || r.status === "used")
      .reduce((s, r) => s + Number(r.amount), 0);
    const used = usages.reduce((s, u) => s + Number(u.amount), 0);
    return Math.max(0, Math.round((earned - used) * 100) / 100);
  },
};

/* ============================= PAYMENTS ============================ */
export const paymentStore = {
  async create(p: any) {
    const [r] = await db.insert(payments).values({ ...p, amount: String(p.amount) }).returning();
    return r;
  },
  async get(id: number) {
    const [r] = await db.select().from(payments).where(eq(payments.id, id));
    return r;
  },
  async getByMerchantOrderId(merchantOrderId: string) {
    const [r] = await db.select().from(payments).where(eq(payments.merchantOrderId, merchantOrderId));
    return r;
  },
  async listForOrder(orderId: number) {
    return db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt));
  },
  async list() { return db.select().from(payments).orderBy(desc(payments.createdAt)); },
  async updateStatus(id: number, status: string, extra?: { providerTransactionId?: string; method?: string; rawResponse?: any }) {
    const patch: any = { status, updatedAt: new Date() };
    if (extra?.providerTransactionId) patch.providerTransactionId = extra.providerTransactionId;
    if (extra?.method) patch.method = extra.method;
    if (extra?.rawResponse) patch.rawResponse = extra.rawResponse;
    const [r] = await db.update(payments).set(patch).where(eq(payments.id, id)).returning();
    return r;
  },
  async logEvent(e: { paymentId?: number | null; merchantOrderId?: string | null; eventType: string; status?: string | null; payload?: any }) {
    await db.insert(paymentEvents).values({
      paymentId: e.paymentId ?? null, merchantOrderId: e.merchantOrderId ?? null,
      eventType: e.eventType, status: e.status ?? null, payload: e.payload ?? null,
    });
  },
  async createRefund(r: any) {
    const [row] = await db.insert(refunds).values({ ...r, amount: String(r.amount) }).returning();
    return row;
  },
  async listRefundsForPayment(paymentId: number) {
    return db.select().from(refunds).where(eq(refunds.paymentId, paymentId)).orderBy(desc(refunds.createdAt));
  },
};

/* ============================= SETTINGS ============================ */
export const settingStore = {
  async all(): Promise<Record<string, string>> {
    const rows = await db.select().from(settings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
  async get(key: string): Promise<string | undefined> {
    const [r] = await db.select().from(settings).where(eq(settings.key, key));
    return r?.value;
  },
  async set(key: string, value: string) {
    await db.insert(settings).values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  },
  async setMany(pairs: Record<string, string>) {
    for (const [key, value] of Object.entries(pairs)) await this.set(key, value);
  },
};

/* -------- Aggregate export mirroring the old `storage` object -------- */
export const storage = {
  users: userStore, profiles: profileStore, categories: categoryStore,
  products: productStore, coupons: couponStore, reviews: reviewStore,
  orders: orderStore, plans: planStore, subscriptions: subscriptionStore,
  discounts: discountStore, referrals: referralStore, payments: paymentStore,
  settings: settingStore,
};

export type Storage = typeof storage;
