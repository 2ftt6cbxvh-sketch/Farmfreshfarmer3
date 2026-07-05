/**
 * FarmFreshFarmer — PostgreSQL schema (Drizzle ORM)
 * =================================================
 * Production data model for the full e-commerce platform:
 *  - Core: users, customer_profiles, addresses, categories, products,
 *          product_images, inventory, inventory_adjustments, carts,
 *          cart_items, orders, order_items, reviews, review_moderation_logs,
 *          settings
 *  - Subscriptions: subscription_plans, subscription_plan_items,
 *          user_subscriptions, subscription_items, subscription_status_logs,
 *          subscription_billing_cycles, subscription_change_logs
 *  - Discounts: discount_rules, discount_rule_targets, discount_usages,
 *          order_discounts
 *  - Referrals: referral_codes, referrals, referral_rewards,
 *          referral_reward_usages
 *  - Payments: payments, payment_events, refunds
 *
 * Conventions:
 *  - All monetary values are NUMERIC(10,2) INR.
 *  - All tables have created_at / (most) updated_at timestamptz defaults.
 *  - History tables are append-only so business-rule changes never rewrite
 *    past orders/subscriptions.
 */
import {
  pgTable, serial, integer, text, varchar, boolean, timestamp,
  numeric, jsonb, uniqueIndex, index, primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const now = () => new Date();

/* =============================== USERS =============================== */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  role: varchar("role", { length: 16 }).notNull().default("customer"), // customer | admin
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | blocked | inactive
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: index("users_email_idx").on(t.email),
  roleIdx: index("users_role_idx").on(t.role),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true, role: true, status: true, createdAt: true, updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

/* ========================= CUSTOMER PROFILES ======================== */
// Extended per-customer info kept separate from auth for reporting clarity.
export const customerProfiles = pgTable("customer_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  // Whether this customer has ever placed a *paid* qualifying order.
  // Drives first-order discount eligibility and "new customer" referral logic.
  hasCompletedFirstOrder: boolean("has_completed_first_order").notNull().default(false),
  firstOrderId: integer("first_order_id"),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: numeric("total_spent", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("customer_profiles_user_idx").on(t.userId),
}));
export type CustomerProfile = typeof customerProfiles.$inferSelect;

/* ============================== ADDRESSES =========================== */
export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 64 }).notNull().default("Home"),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: varchar("city", { length: 128 }).notNull().default("Visakhapatnam"),
  state: varchar("state", { length: 128 }).notNull().default("Andhra Pradesh"),
  pincode: varchar("pincode", { length: 12 }).notNull().default(""),
  phone: varchar("phone", { length: 32 }),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("addresses_user_idx").on(t.userId),
}));
export const insertAddressSchema = createInsertSchema(addresses).omit({ id: true, createdAt: true });
export type Address = typeof addresses.$inferSelect;

/* ============================= CATEGORIES =========================== */
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description").notNull().default(""),
  image: text("image").notNull().default(""),
  dietTag: varchar("diet_tag", { length: 16 }).notNull().default("none"), // none | veg | nonveg
  parentId: integer("parent_id"), // self-reference for child categories (nullable)
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  slugIdx: uniqueIndex("categories_slug_idx").on(t.slug),
  parentIdx: index("categories_parent_idx").on(t.parentId),
}));
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

/* ============================== PRODUCTS ============================ */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  categorySlug: varchar("category_slug", { length: 128 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  unit: varchar("unit", { length: 64 }).notNull().default("250 Grams"),
  image: text("image").notNull().default(""),
  stock: integer("stock").notNull().default(50),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(10),
  dietTag: varchar("diet_tag", { length: 16 }).notNull().default("none"),
  featured: boolean("featured").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  categoryIdx: index("products_category_idx").on(t.categorySlug),
  featuredIdx: index("products_featured_idx").on(t.featured),
}));
export const insertProductSchema = createInsertSchema(products, {
  price: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

/* =========================== PRODUCT IMAGES ======================== */
export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({
  productIdx: index("product_images_product_idx").on(t.productId),
}));
export type ProductImage = typeof productImages.$inferSelect;

/* ============================= INVENTORY =========================== */
// Mirrors current stock for reporting; products.stock stays the source of truth
// for the storefront, inventory_adjustments is the append-only audit trail.
export const inventoryAdjustments = pgTable("inventory_adjustments", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  changeQty: integer("change_qty").notNull(), // +restock / -sale/-correction
  reason: varchar("reason", { length: 64 }).notNull().default("manual"), // manual | order | correction | restock
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  note: text("note"),
  adminUserId: integer("admin_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  productIdx: index("inv_adj_product_idx").on(t.productId),
}));
export type InventoryAdjustment = typeof inventoryAdjustments.$inferSelect;

/* =============================== CARTS ============================= */
export const carts = pgTable("carts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: integer("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull(),
  qty: integer("qty").notNull().default(1),
});

/* =============================== ORDERS =========================== */
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  customerName: text("customer_name").notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  address: text("address").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  couponCode: varchar("coupon_code", { length: 64 }),
  // Order origin & subscription linkage
  orderType: varchar("order_type", { length: 24 }).notNull().default("normal"), // normal | subscription
  subscriptionId: integer("subscription_id"),
  deliveryDay: varchar("delivery_day", { length: 12 }), // Saturday | Sunday (for subscription orders)
  // Discount / referral breakdown for reporting
  firstOrderDiscount: numeric("first_order_discount", { precision: 10, scale: 2 }).notNull().default("0"),
  referralDiscount: numeric("referral_discount", { precision: 10, scale: 2 }).notNull().default("0"),
  referralRewardApplied: numeric("referral_reward_applied", { precision: 10, scale: 2 }).notNull().default("0"),
  referralCodeUsed: varchar("referral_code_used", { length: 32 }),
  paymentMethod: varchar("payment_method", { length: 24 }).notNull().default("COD"), // COD | PHONEPE
  paymentStatus: varchar("payment_status", { length: 16 }).notNull().default("pending"), // pending | paid | failed | refunded
  status: varchar("status", { length: 24 }).notNull().default("Placed"), // Placed | Packed | Out for delivery | Delivered | Cancelled
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("orders_user_idx").on(t.userId),
  statusIdx: index("orders_status_idx").on(t.status),
  typeIdx: index("orders_type_idx").on(t.orderType),
  createdIdx: index("orders_created_idx").on(t.createdAt),
}));
export type Order = typeof orders.$inferSelect;

// Order items normalised (replaces old items_json) for clean Power BI reporting.
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id"),
  name: text("name").notNull(),
  unit: varchar("unit", { length: 64 }).notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  qty: integer("qty").notNull(),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
}, (t) => ({
  orderIdx: index("order_items_order_idx").on(t.orderId),
  productIdx: index("order_items_product_idx").on(t.productId),
}));
export type OrderItem = typeof orderItems.$inferSelect;

// Append-only order status timeline.
export const orderStatusLogs = pgTable("order_status_logs", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 24 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ orderIdx: index("order_status_logs_order_idx").on(t.orderId) }));

/* =============================== REVIEWS ========================== */
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull().default(""),
  moderationStatus: varchar("moderation_status", { length: 16 }).notNull().default("approved"), // pending | approved | rejected | hidden
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  productIdx: index("reviews_product_idx").on(t.productId),
  modIdx: index("reviews_mod_idx").on(t.moderationStatus),
}));
export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true, moderationStatus: true, createdAt: true,
});
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

export const reviewModerationLogs = pgTable("review_moderation_logs", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 16 }).notNull(), // approve | reject | hide
  adminUserId: integer("admin_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ============================== COUPONS =========================== */
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  minOrder: numeric("min_order", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertCouponSchema = createInsertSchema(coupons, {
  discountPercent: z.coerce.number().min(0).max(100),
  minOrder: z.coerce.number().min(0).optional(),
}).omit({ id: true, createdAt: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;

/* ========================= SUBSCRIPTION PLANS ===================== */
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(), // weekly price
  frequency: varchar("frequency", { length: 16 }).notNull().default("weekly"),
  // Which day(s) this plan delivers: saturday | sunday | both
  deliveryDays: varchar("delivery_days", { length: 16 }).notNull().default("both"),
  image: text("image").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans, {
  price: z.coerce.number().min(0),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// Products included in a plan (the fixed "box" contents).
export const subscriptionPlanItems = pgTable("subscription_plan_items", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull(),
  qty: integer("qty").notNull().default(1),
}, (t) => ({ planIdx: index("sub_plan_items_plan_idx").on(t.planId) }));
export type SubscriptionPlanItem = typeof subscriptionPlanItems.$inferSelect;

/* ========================= USER SUBSCRIPTIONS ===================== */
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | active | paused | cancelled | expired
  deliveryDays: varchar("delivery_days", { length: 16 }).notNull().default("both"), // saturday | sunday | both
  // Snapshot of price at subscribe time so plan price changes don't rewrite history.
  weeklyPrice: numeric("weekly_price", { precision: 10, scale: 2 }).notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
  nextDeliveryDate: timestamp("next_delivery_date", { withTimezone: true }),
  pausedUntil: timestamp("paused_until", { withTimezone: true }),
  skipNextCycle: boolean("skip_next_cycle").notNull().default(false),
  deliveryAddress: text("delivery_address"),
  phone: varchar("phone", { length: 32 }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("user_subs_user_idx").on(t.userId),
  statusIdx: index("user_subs_status_idx").on(t.status),
}));
export type UserSubscription = typeof userSubscriptions.$inferSelect;

// Customer custom add-on items on top of the plan box.
export const subscriptionItems = pgTable("subscription_items", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => userSubscriptions.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull(),
  qty: integer("qty").notNull().default(1),
}, (t) => ({ subIdx: index("sub_items_sub_idx").on(t.subscriptionId) }));
export type SubscriptionItem = typeof subscriptionItems.$inferSelect;

// Append-only subscription status history.
export const subscriptionStatusLogs = pgTable("subscription_status_logs", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => userSubscriptions.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 16 }).notNull(),
  note: text("note"),
  actorType: varchar("actor_type", { length: 12 }).notNull().default("customer"), // customer | admin | system
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ subIdx: index("sub_status_logs_sub_idx").on(t.subscriptionId) }));

// Append-only plan-change history (never rewrites old orders).
export const subscriptionChangeLogs = pgTable("subscription_change_logs", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => userSubscriptions.id, { onDelete: "cascade" }),
  fromPlanId: integer("from_plan_id"),
  toPlanId: integer("to_plan_id"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per generated weekly delivery/billing cycle -> links to the order.
export const subscriptionBillingCycles = pgTable("subscription_billing_cycles", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => userSubscriptions.id, { onDelete: "cascade" }),
  orderId: integer("order_id"),
  deliveryDate: timestamp("delivery_date", { withTimezone: true }).notNull(),
  deliveryDay: varchar("delivery_day", { length: 12 }).notNull(), // Saturday | Sunday
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("scheduled"), // scheduled | generated | skipped | paid | delivered | failed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  subIdx: index("sub_cycles_sub_idx").on(t.subscriptionId),
  dateIdx: index("sub_cycles_date_idx").on(t.deliveryDate),
}));
export type SubscriptionBillingCycle = typeof subscriptionBillingCycles.$inferSelect;

/* ======================= DISCOUNT / PROMOTIONS ==================== */
export const discountRules = pgTable("discount_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // type drives engine behaviour: first_order | referral_new | referral_reward | manual
  type: varchar("type", { length: 24 }).notNull(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  // Where it applies: all | normal | subscription
  appliesTo: varchar("applies_to", { length: 16 }).notNull().default("all"),
  maxUsesPerCustomer: integer("max_uses_per_customer").notNull().default(1),
  stackable: boolean("stackable").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ typeIdx: index("discount_rules_type_idx").on(t.type) }));
export const insertDiscountRuleSchema = createInsertSchema(discountRules, {
  discountPercent: z.coerce.number().min(0).max(100),
  maxUsesPerCustomer: z.coerce.number().int().min(0).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDiscountRule = z.infer<typeof insertDiscountRuleSchema>;
export type DiscountRule = typeof discountRules.$inferSelect;

// Optional targeting of a rule to products/categories/plans.
export const discountRuleTargets = pgTable("discount_rule_targets", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull().references(() => discountRules.id, { onDelete: "cascade" }),
  targetType: varchar("target_type", { length: 16 }).notNull(), // product | category | plan
  targetId: integer("target_id"),
  targetSlug: varchar("target_slug", { length: 128 }),
});

// Append-only ledger of every time a discount rule was consumed.
export const discountUsages = pgTable("discount_usages", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull().references(() => discountRules.id),
  userId: integer("user_id"),
  orderId: integer("order_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ruleUserIdx: index("discount_usages_rule_user_idx").on(t.ruleId, t.userId),
}));
export type DiscountUsage = typeof discountUsages.$inferSelect;

// Per-order breakdown of which discounts applied (reporting).
export const orderDiscounts = pgTable("order_discounts", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  ruleType: varchar("rule_type", { length: 24 }).notNull(),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ orderIdx: index("order_discounts_order_idx").on(t.orderId) }));

/* ============================= REFERRALS ========================== */
// One code per customer (also stored denormalised for quick lookups).
export const referralCodes = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ codeIdx: uniqueIndex("referral_codes_code_idx").on(t.code) }));
export type ReferralCode = typeof referralCodes.$inferSelect;

// A successful referral relationship (referrer -> referred new customer).
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerUserId: integer("referrer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredUserId: integer("referred_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 32 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | converted | rejected
  qualifyingOrderId: integer("qualifying_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
}, (t) => ({
  referrerIdx: index("referrals_referrer_idx").on(t.referrerUserId),
  referredIdx: uniqueIndex("referrals_referred_idx").on(t.referredUserId), // a customer can be referred only once
}));
export type Referral = typeof referrals.$inferSelect;

// Rewards earned by referrers (5% of referred customer's qualifying order).
export const referralRewards = pgTable("referral_rewards", {
  id: serial("id").primaryKey(),
  referrerUserId: integer("referrer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referralId: integer("referral_id").notNull().references(() => referrals.id, { onDelete: "cascade" }),
  rewardPercent: numeric("reward_percent", { precision: 5, scale: 2 }).notNull().default("5"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"), // reward credit value in INR
  status: varchar("status", { length: 16 }).notNull().default("approved"), // pending | approved | used | expired
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ referrerIdx: index("referral_rewards_referrer_idx").on(t.referrerUserId) }));
export type ReferralReward = typeof referralRewards.$inferSelect;

// Append-only ledger of reward credit spent on orders (enforces 30% cap per order).
export const referralRewardUsages = pgTable("referral_reward_usages", {
  id: serial("id").primaryKey(),
  referrerUserId: integer("referrer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orderId: integer("order_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ userIdx: index("referral_reward_usages_user_idx").on(t.referrerUserId) }));
export type ReferralRewardUsage = typeof referralRewardUsages.$inferSelect;

/* ============================== PAYMENTS ========================== */
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
  subscriptionCycleId: integer("subscription_cycle_id"),
  userId: integer("user_id"),
  provider: varchar("provider", { length: 24 }).notNull().default("phonepe"), // phonepe | cod
  merchantOrderId: varchar("merchant_order_id", { length: 128 }).notNull().unique(), // our unique id sent to PhonePe
  providerTransactionId: varchar("provider_transaction_id", { length: 128 }), // PhonePe transactionId
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | success | failed | refunded
  method: varchar("method", { length: 32 }), // UPI | CARD | etc from provider
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orderIdx: index("payments_order_idx").on(t.orderId),
  statusIdx: index("payments_status_idx").on(t.status),
  merchantIdx: uniqueIndex("payments_merchant_idx").on(t.merchantOrderId),
}));
export type Payment = typeof payments.$inferSelect;

// Append-only raw webhook / status-check log for reconciliation.
export const paymentEvents = pgTable("payment_events", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").references(() => payments.id, { onDelete: "cascade" }),
  merchantOrderId: varchar("merchant_order_id", { length: 128 }),
  eventType: varchar("event_type", { length: 32 }).notNull(), // initiate | callback | webhook | status_check
  status: varchar("status", { length: 16 }),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refunds = pgTable("refunds", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  merchantRefundId: varchar("merchant_refund_id", { length: 128 }).notNull().unique(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | success | failed
  reason: text("reason"),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Refund = typeof refunds.$inferSelect;

/* ============================== SETTINGS ========================== */
export const settings = pgTable("settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value").notNull(),
});
export type Setting = typeof settings.$inferSelect;
