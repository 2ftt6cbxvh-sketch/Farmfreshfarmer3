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
  role: varchar("role", { length: 32 }).notNull().default("customer"), // customer | admin | warehouse_admin | manager_admin | delivery_partner | subadmin | customer_rep | local_grievance_officer | zonal_grievance_officer | chief_grievance_officer
  customTitle: varchar("custom_title", { length: 128 }),
  telegramChatId: varchar("telegram_chat_id", { length: 64 }),
  permissions: text("permissions"), // JSON array of allowed menu routes e.g. ["/admin", "/admin/orders"]
  isPrimaryAdmin: boolean("is_primary_admin").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  isPhoneVerified: boolean("is_phone_verified").notNull().default(false),
  starRating: integer("star_rating").notNull().default(5),
  experienceRank: varchar("experience_rank", { length: 64 }).notNull().default("Specialist"),
  customerStars: integer("customer_stars").notNull().default(0),
  profilePhoto: text("profile_photo"),
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | blocked | inactive | locked
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockoutUntil: timestamp("lockout_until", { withTimezone: true }),
  lockoutTier: integer("lockout_tier").notNull().default(0),
  isPermanentlyLocked: boolean("is_permanently_locked").notNull().default(false),
  recoveryPending: boolean("recovery_pending").notNull().default(false),
  twoFaMethod: varchar("two_fa_method", { length: 32 }).notNull().default("both"), // totp | sms | both | none
  totpSecret: text("totp_secret"),
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
  behaviorProfile: text("behavior_profile"), // Encrypted/sanitized compact JSON rolling window of viewed items & health topics
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("customer_profiles_user_idx").on(t.userId),
}));
export type CustomerProfile = typeof customerProfiles.$inferSelect;

/* =================== GUEST BEHAVIOR SESSIONS ================== */
export const guestBehaviorSessions = pgTable("guest_behavior_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 128 }).notNull().unique(),
  behaviorProfile: text("behavior_profile"), // compact JSON rolling window of viewed items, searches & health topics
  ipHash: varchar("ip_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sessionIdx: uniqueIndex("guest_behavior_session_idx").on(t.sessionId),
  updatedIdx: index("guest_behavior_updated_idx").on(t.updatedAt),
}));
export type GuestBehaviorSession = typeof guestBehaviorSessions.$inferSelect;

/* =================== UNMET DEMAND EVENTS (LIVE SEARCHES) ================== */
export const unmetDemandEvents = pgTable("unmet_demand_events", {
  id: serial("id").primaryKey(),
  query: varchar("query", { length: 255 }).notNull(),
  sessionId: varchar("session_id", { length: 128 }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  city: varchar("city", { length: 128 }).default("Visakhapatnam"),
  pincode: varchar("pincode", { length: 32 }),
  resultCount: integer("result_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  queryIdx: index("unmet_demand_query_idx").on(t.query),
  createdIdx: index("unmet_demand_created_idx").on(t.createdAt),
}));
export type UnmetDemandEvent = typeof unmetDemandEvents.$inferSelect;

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
  // Approval workflow
  approvalStatus: varchar("approval_status", { length: 16 }).notNull().default("approved"), // approved | pending | rejected | under_review
  submittedBy: integer("submitted_by"), // FK to users.id (sub-admin who submitted)
  approvalNote: text("approval_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  slugIdx: uniqueIndex("categories_slug_idx").on(t.slug),
  parentIdx: index("categories_parent_idx").on(t.parentId),
}));
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true, approvalStatus: true, submittedBy: true, approvalNote: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

/* ============================== PRODUCTS ============================ */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameTe: varchar("name_te", { length: 255 }), // Authentic Telugu script produce subname (e.g. నాటు టమోటాలు, పాలకూర)
  description: text("description").notNull().default(""),
  categorySlug: varchar("category_slug", { length: 128 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  unit: varchar("unit", { length: 64 }).notNull().default("250 Grams"),
  quantityTiers: text("quantity_tiers"), // JSON string of QuantityTier[] e.g. [{"quantity":"250g","price":18,"savings":"Trial Pack"},{"quantity":"1 Kg","price":60,"savings":"10% OFF","isPopular":true}]
  image: text("image").notNull().default(""),
  stock: integer("stock").notNull().default(50),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(10),
  dietTag: varchar("diet_tag", { length: 16 }).notNull().default("none"),
  featured: boolean("featured").notNull().default(false),
  featuredInHero: boolean("featured_in_hero").notNull().default(false),
  gstPercent: numeric("gst_percent", { precision: 5, scale: 2 }),
  allowInternationalShipping: boolean("allow_international_shipping").notNull().default(true),
  active: boolean("active").notNull().default(true),
  // Approval workflow
  approvalStatus: varchar("approval_status", { length: 16 }).notNull().default("approved"), // approved | pending | rejected | under_review | draft
  submittedBy: integer("submitted_by"), // FK to users.id (sub-admin who submitted)
  approvalNote: text("approval_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  categoryIdx: index("products_category_idx").on(t.categorySlug),
  featuredIdx: index("products_featured_idx").on(t.featured),
  approvalIdx: index("products_approval_idx").on(t.approvalStatus),
}));
export const insertProductSchema = createInsertSchema(products, {
  nameTe: z.string().optional().nullable(),
  price: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  gstPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  allowInternationalShipping: z.boolean().optional(),
  quantityTiers: z.string().optional().nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true, approvalStatus: true, submittedBy: true, approvalNote: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export interface QuantityTier {
  quantity: string;
  price: number;
  perUnit?: string;
  savings?: string;
  isPopular?: boolean;
  active?: boolean;
}

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
  unit: varchar("unit", { length: 64 }),
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
  assignedPartnerId: integer("assigned_partner_id"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  invoiceData: jsonb("invoice_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("orders_user_idx").on(t.userId),
  statusIdx: index("orders_status_idx").on(t.status),
  typeIdx: index("orders_type_idx").on(t.orderType),
  createdIdx: index("orders_created_idx").on(t.createdAt),
}));
export type Order = typeof orders.$inferSelect;

/* ======================== DELIVERY PARTNERS ========================= */
export const deliveryPartners = pgTable("delivery_partners", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  partnerType: varchar("partner_type", { length: 32 }).notNull().default("local_delivery"), // local_delivery | inter_district | inter_state | international
  name: text("name").notNull(),
  idType: varchar("id_type", { length: 32 }).notNull().default("aadhar"), // aadhar | passport | pan | voter_id
  idNumber: varchar("id_number", { length: 64 }).notNull(),
  drivingLicenseNumber: varchar("driving_license_number", { length: 64 }),
  vehicleNumber: varchar("vehicle_number", { length: 64 }).notNull(),
  vehicleType: varchar("vehicle_type", { length: 32 }).notNull().default("bike"), // bike | auto | van | car | lorry
  vehicleModel: varchar("vehicle_model", { length: 64 }),
  phone: varchar("phone", { length: 32 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  availabilityStatus: varchar("availability_status", { length: 24 }).notNull().default("offline"), // available | offline | busy
  isBlockedByAdmin: boolean("is_blocked_by_admin").notNull().default(false),
  lastAvailableAt: timestamp("last_available_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("delivery_partners_user_idx").on(t.userId),
  typeIdx: index("delivery_partners_type_idx").on(t.partnerType),
  availabilityIdx: index("delivery_partners_availability_idx").on(t.availabilityStatus),
}));
export type DeliveryPartner = typeof deliveryPartners.$inferSelect;

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
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  restrictedUserId: integer("restricted_user_id").references(() => users.id, { onDelete: "cascade" }),
  restrictedEmail: varchar("restricted_email", { length: 255 }),
  isOneTime: boolean("is_one_time").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  campaignCategory: varchar("campaign_category", { length: 64 }).default("standard"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertCouponSchema = createInsertSchema(coupons, {
  discountPercent: z.coerce.number().min(0).max(100),
  minOrder: z.coerce.number().min(0).optional(),
  maxUses: z.coerce.number().min(0).optional(),
}).omit({ id: true, createdAt: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;

/* ========================= EMAIL CAMPAIGNS ========================= */
export const emailCampaigns = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  category: varchar("category", { length: 32 }).notNull().default("promotional"), // promotional | transactional | legal | emergency
  targetType: varchar("target_type", { length: 32 }).notNull().default("all"), // all | segment | individual | abandoned_cart
  targetSegment: text("target_segment"), // json
  targetUserId: integer("target_user_id").references(() => users.id, { onDelete: "set null" }),
  targetEmail: varchar("target_email", { length: 255 }),
  contentHtml: text("content_html").notNull(),
  couponCode: varchar("coupon_code", { length: 64 }),
  totalRecipients: integer("total_recipients").default(0),
  sentCount: integer("sent_count").default(0),
  failedCount: integer("failed_count").default(0),
  status: varchar("status", { length: 32 }).default("completed"), // draft | sending | completed | failed
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type EmailCampaign = typeof emailCampaigns.$inferSelect;

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
  provider: varchar("provider", { length: 24 }).notNull().default("phonepe"), // phonepe | razorpay | stripe | cod
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

/* ========================= REFRESH TOKENS (JWT) =================== */
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  deviceId: varchar("device_id", { length: 255 }),
  platform: varchar("platform", { length: 16 }).notNull().default("web"), // web | ios | android
  ipAtIssue: varchar("ip_at_issue", { length: 64 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("refresh_tokens_user_idx").on(t.userId),
  hashIdx: index("refresh_tokens_hash_idx").on(t.tokenHash),
}));
export type RefreshToken = typeof refreshTokens.$inferSelect;

/* ========================= OAUTH ACCOUNTS ========================= */
export const oauthAccounts = pgTable("oauth_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 32 }).notNull().default("google"), // google
  providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
  providerEmail: varchar("provider_email", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  providerIdx: uniqueIndex("oauth_accounts_provider_idx").on(t.provider, t.providerUserId),
  userIdx: index("oauth_accounts_user_idx").on(t.userId),
}));
export type OauthAccount = typeof oauthAccounts.$inferSelect;

/* ====================== DEVICE FINGERPRINTS ====================== */
export const deviceFingerprints = pgTable("device_fingerprints", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceHash: varchar("device_hash", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 16 }).notNull().default("web"), // web | ios | android
  trusted: boolean("trusted").notNull().default(false),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("device_fingerprints_user_idx").on(t.userId),
  hashIdx: index("device_fingerprints_hash_idx").on(t.deviceHash),
}));
export type DeviceFingerprint = typeof deviceFingerprints.$inferSelect;

/* ===================== SECURITY AUDIT LOGS ======================= */
export const securityAuditLogs = pgTable("security_audit_logs", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 64 }).notNull(), // login_success | login_failed | logout | token_refresh | rate_limit_trigger | lockdown_on | lockdown_off | google_login | otp_sent | otp_verified | session_revoked
  userId: integer("user_id"),
  ip: varchar("ip", { length: 64 }),
  platform: varchar("platform", { length: 16 }).default("web"),
  deviceHash: varchar("device_hash", { length: 255 }),
  userAgent: text("user_agent"),
  locationInfo: jsonb("location_info"), // { city, region, country } if available
  actionTaken: text("action_taken"),
  // ── Phase-1 Security Hardening additions ───────────────────────────
  requestId: varchar("request_id", { length: 64 }),                         // unique request tracing ID
  severity: varchar("severity", { length: 16 }).notNull().default("info"),  // info | warning | critical
  previousHash: text("previous_hash"),                                        // HMAC chain
  eventHash: text("event_hash"),                                              // HMAC of this event
  targetId: integer("target_id"),                                             // resource being acted on
  targetType: varchar("target_type", { length: 64 }),                        // e.g. 'user', 'order', 'setting'
  sessionFamilyId: varchar("session_family_id", { length: 64 }),             // refresh token family ID
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  eventIdx: index("security_audit_logs_event_idx").on(t.eventType),
  userIdx: index("security_audit_logs_user_idx").on(t.userId),
  createdIdx: index("security_audit_logs_created_idx").on(t.createdAt),
}));
export type SecurityAuditLog = typeof securityAuditLogs.$inferSelect;

/* =================== WEBAUTHN CREDENTIALS =================== */
export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  deviceType: varchar("device_type", { length: 32 }).notNull().default("platform"), // platform | cross-platform
  backedUp: boolean("backed_up").notNull().default(false),
  transports: text("transports"), // JSON array e.g. ["internal","hybrid"]
  nickname: varchar("nickname", { length: 128 }).notNull().default("Passkey"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("webauthn_creds_user_idx").on(t.userId),
  credIdx: uniqueIndex("webauthn_creds_cred_idx").on(t.credentialId),
}));
export type WebAuthnCredential = typeof webauthnCredentials.$inferSelect;



/* ========================= STAR DISCOUNT RULES ======================== */
// Configurable star-based discount tiers.
// ruleType: 'customer' = applied at checkout for customer loyalty stars
// ruleType: 'staff' = defines max discount % a staff member can grant
export const starDiscountRules = pgTable("star_discount_rules", {
  id: serial("id").primaryKey(),
  ruleType: varchar("rule_type", { length: 16 }).notNull().default("customer"), // customer | staff
  starFrom: integer("star_from").notNull(), // inclusive lower bound
  starTo: integer("star_to").notNull(),     // inclusive upper bound
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStarDiscountRuleSchema = createInsertSchema(starDiscountRules).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertStarDiscountRule = z.infer<typeof insertStarDiscountRuleSchema>;
export type StarDiscountRule = typeof starDiscountRules.$inferSelect;

/* ============================ OTP CODES ========================== */
export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 255 }).notNull(),
  codeHash: text("code_hash").notNull(), // bcrypt hash of 6-digit code
  purpose: varchar("purpose", { length: 32 }).notNull().default("verify"), // verify | login | reset | signup
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("otp_codes_user_idx").on(t.userId),
}));
export type OtpCode = typeof otpCodes.$inferSelect;

/* ============================ WAREHOUSES ========================= */
export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  maxRadiusKm: numeric("max_radius_km", { precision: 5, scale: 2 }).notNull().default("30"),
  averageSpeedKmph: numeric("average_speed_kmph", { precision: 5, scale: 2 }).notNull().default("30"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertWarehouseSchema = createInsertSchema(warehouses, {
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  maxRadiusKm: z.coerce.number().min(1).max(500).optional(),
  averageSpeedKmph: z.coerce.number().min(1).max(200).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type Warehouse = typeof warehouses.$inferSelect;

/* ======================== WAREHOUSE PINCODES ===================== */
export const warehousePincodes = pgTable("warehouse_pincodes", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
  pincode: varchar("pincode", { length: 12 }).notNull(),
  packingTimeMinutes: integer("packing_time_minutes").notNull().default(30),
  active: boolean("active").notNull().default(true),
}, (t) => ({
  warehouseIdx: index("warehouse_pincodes_warehouse_idx").on(t.warehouseId),
  pincodeIdx: index("warehouse_pincodes_pincode_idx").on(t.pincode),
}));
export const insertWarehousePincodeSchema = createInsertSchema(warehousePincodes, {
  packingTimeMinutes: z.coerce.number().int().min(0).optional(),
}).omit({ id: true });
export type InsertWarehousePincode = z.infer<typeof insertWarehousePincodeSchema>;
export type WarehousePincode = typeof warehousePincodes.$inferSelect;

/* ====================== DELIVERY FEE RULES ======================= */
export const deliveryFeeRules = pgTable("delivery_fee_rules", {
  id: serial("id").primaryKey(),
  minDistanceKm: numeric("min_distance_km", { precision: 8, scale: 2 }).notNull().default("0"),
  maxDistanceKm: numeric("max_distance_km", { precision: 8, scale: 2 }).notNull(),
  baseFee: numeric("base_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  perKmFee: numeric("per_km_fee", { precision: 8, scale: 2 }).notNull().default("0"),
  maxFeeCap: numeric("max_fee_cap", { precision: 10, scale: 2 }),
  freeDeliveryAboveOrderValue: numeric("free_delivery_above_order_value", { precision: 10, scale: 2 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertDeliveryFeeRuleSchema = createInsertSchema(deliveryFeeRules, {
  minDistanceKm: z.coerce.number().min(0).optional(),
  maxDistanceKm: z.coerce.number().min(0),
  baseFee: z.coerce.number().min(0).optional(),
  perKmFee: z.coerce.number().min(0).optional(),
  maxFeeCap: z.coerce.number().min(0).optional(),
  freeDeliveryAboveOrderValue: z.coerce.number().min(0).optional(),
}).omit({ id: true, createdAt: true });
export type InsertDeliveryFeeRule = z.infer<typeof insertDeliveryFeeRuleSchema>;
export type DeliveryFeeRule = typeof deliveryFeeRules.$inferSelect;

/* ====================== DELIVERY SETTINGS ======================== */
export const deliverySettings = pgTable("delivery_settings", {
  id: serial("id").primaryKey(),
  featureEnabled: boolean("feature_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type DeliverySetting = typeof deliverySettings.$inferSelect;

/* =================== CUSTOMER LOCATION LOGS ==================== */
export const customerLocationLogs = pgTable("customer_location_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  pincode: varchar("pincode", { length: 12 }),
  source: varchar("source", { length: 16 }).notNull().default("manual"), // gps | manual
  resolvedWarehouseId: integer("resolved_warehouse_id"),
  calculatedFee: numeric("calculated_fee", { precision: 10, scale: 2 }),
  calculatedTimeMinutes: integer("calculated_time_minutes"),
  serviceable: boolean("serviceable").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("customer_location_logs_user_idx").on(t.userId),
  pincodeIdx: index("customer_location_logs_pincode_idx").on(t.pincode),
  createdIdx: index("customer_location_logs_created_idx").on(t.createdAt),
}));
export type CustomerLocationLog = typeof customerLocationLogs.$inferSelect;

/* ===================== GEOFENCE COUNTRIES ======================== */
export const geofenceCountries = pgTable("geofence_countries", {
  id: serial("id").primaryKey(),
  countryCode: varchar("country_code", { length: 4 }).notNull().unique(), // ISO 2 or 3
  countryName: varchar("country_name", { length: 128 }).notNull().default(""),
  allowed: boolean("allowed").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("geofence_countries_code_idx").on(t.countryCode),
}));
export type GeofenceCountry = typeof geofenceCountries.$inferSelect;

/* ======================= LOCKDOWN STATE ========================= */
// Single-row table (id=1 always). Use upsert to toggle.
export const lockdownState = pgTable("lockdown_state", {
  id: serial("id").primaryKey(),
  active: boolean("active").notNull().default(false),
  reason: text("reason").notNull().default(""),
  activatedBy: integer("activated_by"), // admin user id
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type LockdownState = typeof lockdownState.$inferSelect;

/* ===================== MAINTENANCE STATE ======================== */
// Single-row table (id=1 always). Use upsert to toggle.
export const maintenanceState = pgTable("maintenance_state", {
  id: serial("id").primaryKey(),
  active: boolean("active").notNull().default(false),
  headline: varchar("headline", { length: 255 }).notNull().default("Scheduled Maintenance Underway"),
  message: text("message").notNull().default("We are currently optimizing our farm-fresh catalog and ultrafast delivery infrastructure. We will be back shortly!"),
  estimatedEnd: timestamp("estimated_end", { withTimezone: true }),
  estimatedMinutes: integer("estimated_minutes").default(30),
  allowAdminBypass: boolean("allow_admin_bypass").notNull().default(true),
  activatedBy: integer("activated_by"), // admin user id
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type MaintenanceState = typeof maintenanceState.$inferSelect;

/* ================= PRODUCT APPROVAL HISTORY =================== */
// Append-only audit trail for all product/category approval actions.
export const productApprovalHistory = pgTable("product_approval_history", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 16 }).notNull().default("product"), // product | category
  entityId: integer("entity_id").notNull(),
  entityName: text("entity_name").notNull().default(""),
  action: varchar("action", { length: 16 }).notNull(), // approved | rejected | under_review | submitted | reverted
  fromStatus: varchar("from_status", { length: 16 }),
  toStatus: varchar("to_status", { length: 16 }),
  adminUserId: integer("admin_user_id"), // who acted
  submittedByUserId: integer("submitted_by_user_id"), // original submitter
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("prod_approval_entity_idx").on(t.entityType, t.entityId),
  adminIdx: index("prod_approval_admin_idx").on(t.adminUserId),
}));
export type ProductApprovalHistory = typeof productApprovalHistory.$inferSelect;

/* ====================== CHATBOT & LIVE SUPPORT TABLES ======================== */
// Session tracking — one per conversation (guest or logged-in user).
export const chatbotSessions = pgTable("chatbot_sessions", {
  id: serial("id").primaryKey(),
  sessionToken: varchar("session_token", { length: 128 }).notNull().unique(),
  userId: integer("user_id"), // null for guests
  language: varchar("language", { length: 8 }).notNull().default("en"), // en | hi | te
  status: varchar("status", { length: 32 }).notNull().default("bot"), // bot | waiting_for_agent | agent_connected | closed
  assignedAgentId: integer("assigned_agent_id"),
  assignedAgentName: text("assigned_agent_name"),
  customerPermissionGranted: boolean("customer_permission_granted").notNull().default(false),
  permissionGrantedAt: timestamp("permission_granted_at", { withTimezone: true }),
  permissionRequestedAt: timestamp("permission_requested_at", { withTimezone: true }),
  permissionScope: varchar("permission_scope", { length: 64 }), // 'all' | 'profile' | 'cart' | 'orders'
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tokenIdx: uniqueIndex("chatbot_sessions_token_idx").on(t.sessionToken),
  statusIdx: index("chatbot_sessions_status_idx").on(t.status),
}));
export type ChatbotSession = typeof chatbotSessions.$inferSelect;

// Messages in live chat between customer and human support rep
export const liveChatMessages = pgTable("live_chat_messages", {
  id: serial("id").primaryKey(),
  sessionToken: varchar("session_token", { length: 128 }).notNull(),
  sender: varchar("sender", { length: 16 }).notNull(), // 'customer' | 'support' | 'bot' | 'system'
  senderName: text("sender_name"),
  senderId: integer("sender_id"),
  message: text("message").notNull(),
  messageType: varchar("message_type", { length: 32 }).notNull().default("text"), // 'text' | 'permission_request' | 'permission_response'
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sessionIdx: index("live_chat_messages_session_idx").on(t.sessionToken),
}));
export type LiveChatMessage = typeof liveChatMessages.$inferSelect;

// Queries the chatbot could not answer — stored for admin review.
export const chatbotMissedQueries = pgTable("chatbot_missed_queries", {
  id: serial("id").primaryKey(),
  sessionToken: varchar("session_token", { length: 128 }),
  userId: integer("user_id"),
  query: text("query").notNull(),
  language: varchar("language", { length: 8 }).notNull().default("en"),
  triggerType: varchar("trigger_type", { length: 24 }).notNull().default("unresolved"), // unresolved | human_request
  resolved: boolean("resolved").notNull().default(false),
  telegramAlertSent: boolean("telegram_alert_sent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  createdIdx: index("chatbot_missed_created_idx").on(t.createdAt),
}));
export type ChatbotMissedQuery = typeof chatbotMissedQueries.$inferSelect;

// Product suggestions from customers (unknown product names mentioned in chat).
export const chatbotProductSuggestions = pgTable("chatbot_product_suggestions", {
  id: serial("id").primaryKey(),
  productName: text("product_name").notNull(),
  mentionCount: integer("mention_count").notNull().default(1),
  lastMentionedAt: timestamp("last_mentioned_at", { withTimezone: true }).notNull().defaultNow(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  nameIdx: uniqueIndex("chatbot_suggestions_name_idx").on(t.productName),
}));
export type ChatbotProductSuggestion = typeof chatbotProductSuggestions.$inferSelect;

/* ====================== SUPPORT TICKETS TABLE ======================== */
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketId: varchar("ticket_id", { length: 32 }).notNull().unique(),
  userId: integer("user_id"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email").notNull(),
  concern: text("concern").notNull(),
  orderId: integer("order_id"),
  photoUrl: text("photo_url"),
  refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }),
  refundStatus: varchar("refund_status", { length: 32 }), // requested | approved | processing | refunded | rejected
  status: varchar("status", { length: 32 }).notNull().default("open"), // open | under_solving | solved | closed
  priority: varchar("priority", { length: 16 }).notNull().default("medium"), // low | medium | high | urgent
  assignedAgentId: integer("assigned_agent_id"),
  assignedAgentName: text("assigned_agent_name"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ticketIdIdx: uniqueIndex("support_tickets_ticket_id_idx").on(t.ticketId),
  userIdIdx: index("support_tickets_user_id_idx").on(t.userId),
  statusIdx: index("support_tickets_status_idx").on(t.status),
}));

export const insertSupportTicketSchema = createInsertSchema(supportTickets, {
  customerEmail: z.string().email(),
  customerPhone: z.string().min(10),
  concern: z.string().min(5),
}).omit({ id: true, createdAt: true, updatedAt: true, ticketId: true, status: true, assignedAgentId: true, assignedAgentName: true, adminNotes: true });

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

/* =========================== ANNOUNCEMENTS & ADS ================== */
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  category: varchar("category", { length: 32 }).notNull().default("advertisement"), // warning (yellow) | critical (red) | advertisement (green)
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  showPopup: boolean("show_popup").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  targetAudience: varchar("target_audience", { length: 32 }).notNull().default("all"), // all | customers | unverified
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (t) => ({
  categoryIdx: index("announcements_category_idx").on(t.category),
  isActiveIdx: index("announcements_is_active_idx").on(t.isActive),
}));

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

/* ===================== PASSWORD RESET TOKENS ===================== */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tokenHashIdx: uniqueIndex("password_reset_tokens_hash_idx").on(t.tokenHash),
  userIdIdx: index("password_reset_tokens_user_id_idx").on(t.userId),
}));
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

/* ==================== EMERGENCY RECOVERY CODES ==================== */
export const emergencyRecoveryCodes = pgTable("emergency_recovery_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  used: boolean("used").notNull().default(false),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedIp: varchar("used_ip", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index("emergency_recovery_codes_user_id_idx").on(t.userId),
}));
export type EmergencyRecoveryCode = typeof emergencyRecoveryCodes.$inferSelect;

/* ================= PRODUCE UNIT & DYNAMIC PRICING ENGINE ================= */
export type ProduceUnitType = "weight" | "dozen" | "bunch" | "piece" | "count";

export interface ProduceTypeInfo {
  unitType: ProduceUnitType;
  defaultUnit: string;
  unitLabel: string;
}

/**
 * Accurately detects whether a produce item is sold by Weight (kg/g), Dozens (bananas),
 * Bunches (spinach/leafy greens), Single Pieces (coconuts/watermelons), or Count (lemons).
 */
export function detectProduceUnitType(productName: string, categorySlug: string = "", unit: string = ""): ProduceTypeInfo {
  const norm = (productName + " " + unit + " " + categorySlug).toLowerCase();

  // 1. Dozen / Banana-specific
  if (norm.includes("banana") || norm.includes("arati") || norm.includes("kela") || norm.includes("dozen")) {
    return { unitType: "dozen", defaultUnit: "1 Dozen", unitLabel: "Dozen" };
  }

  // 2. Leafy greens / Bunch-specific
  if (
    norm.includes("spinach") ||
    norm.includes("palak") ||
    norm.includes("palakura") ||
    norm.includes("palakoora") ||
    norm.includes("coriander") ||
    norm.includes("kothimeera") ||
    norm.includes("cilantro") ||
    norm.includes("mint") ||
    norm.includes("pudina") ||
    norm.includes("methi") ||
    norm.includes("menthikura") ||
    norm.includes("gongura") ||
    norm.includes("curry leaves") ||
    norm.includes("karivepaku") ||
    norm.includes("bunch") ||
    norm.includes("bundle")
  ) {
    return { unitType: "bunch", defaultUnit: "1 Bunch", unitLabel: "Bunch" };
  }

  // 3. Single Large Fruit / Piece-specific
  if (
    norm.includes("coconut") ||
    norm.includes("kobbari") ||
    norm.includes("watermelon") ||
    norm.includes("tarbooja") ||
    norm.includes("papaya") ||
    norm.includes("boppayi") ||
    norm.includes("pineapple") ||
    norm.includes("anasa") ||
    norm.includes("jackfruit") ||
    norm.includes("panasa") ||
    norm.includes("cabbage") ||
    norm.includes("cauliflower") ||
    norm.includes("piece")
  ) {
    return { unitType: "piece", defaultUnit: "1 Piece", unitLabel: "Piece" };
  }

  // 4. Small count / pack items
  if (
    norm.includes("lemon") ||
    norm.includes("nimma") ||
    norm.includes("sweet corn") ||
    norm.includes("corn") ||
    norm.includes("mokkajonna") ||
    norm.includes("custard apple") ||
    norm.includes("seethaphal") ||
    norm.includes("sapota") ||
    norm.includes("egg")
  ) {
    return { unitType: "count", defaultUnit: "4 Pieces", unitLabel: "Pieces" };
  }

  // 5. Default: Weight-based (Tomatoes, Potatoes, Onions, Dal, Millets, Sweets, Namkeen, Pickles)
  return { unitType: "weight", defaultUnit: "1 Kg", unitLabel: "Kg" };
}

/**
 * ⚡ 100% Pure AI Market Sourced Price Engine
 * Dynamically computes authentic Andhra Pradesh farm-direct pricing
 * based on regional Mandi benchmarks, seasonality, and unit types.
 */
export function getAiPureProducePrice(
  productName: string,
  categorySlug: string = "",
  unitInput: string = ""
): number {
  const norm = (productName || "").toLowerCase().trim();
  const cat = (categorySlug || "").toLowerCase().trim();

  // 1. Specific Produce Benchmarks (AP Farm Direct Rates)
  if (norm.includes("garlic") || norm.includes("vellulli")) return 180;
  if (norm.includes("ginger") || norm.includes("allam")) return 120;
  if (norm.includes("banana") || norm.includes("arati")) return 60; // per Dozen
  if (norm.includes("spinach") || norm.includes("palak")) return 25; // per Bunch
  if (norm.includes("coriander") || norm.includes("kothimeera")) return 20; // per Bunch
  if (norm.includes("mint") || norm.includes("pudina")) return 15; // per Bunch
  if (norm.includes("methi") || norm.includes("menthi")) return 20; // per Bunch
  if (norm.includes("gongura")) return 20; // per Bunch
  if (norm.includes("curry leaf") || norm.includes("karivepaku")) return 15; // per Bunch
  if (norm.includes("tomato") || norm.includes("tamota")) return 40; // per 1 Kg
  if (norm.includes("onion") || norm.includes("ulli")) return 35; // per 1 Kg
  if (norm.includes("potato") || norm.includes("bangala")) return 35; // per 1 Kg
  if (norm.includes("mango") || norm.includes("mamidi") || norm.includes("banginapalli")) return 140; // per 1 Kg
  if (norm.includes("brinjal") || norm.includes("vankaya")) return 40; // per 1 Kg
  if (norm.includes("okra") || norm.includes("lady") || norm.includes("benda")) return 45; // per 1 Kg
  if (norm.includes("carrot")) return 50; // per 1 Kg
  if (norm.includes("beetroot")) return 45; // per 1 Kg
  if (norm.includes("capsicum") || norm.includes("shimla")) return 65; // per 1 Kg
  if (norm.includes("bitter gourd") || norm.includes("kakara")) return 50; // per 1 Kg
  if (norm.includes("ridge gourd") || norm.includes("beera")) return 45; // per 1 Kg
  if (norm.includes("bottle gourd") || norm.includes("sorakaya") || norm.includes("anapa")) return 35; // per 1 Kg / Piece
  if (norm.includes("tindora") || norm.includes("dondakaya")) return 40; // per 1 Kg
  if (norm.includes("drumstick") || norm.includes("mulakkada")) return 60; // per 1 Kg
  if (norm.includes("lemon") || norm.includes("nimma")) return 30; // per 4 Pcs
  if (norm.includes("coconut") || norm.includes("kobbari")) return 35; // per Piece
  if (norm.includes("watermelon") || norm.includes("tarbuja")) return 75; // per Piece
  if (norm.includes("papaya") || norm.includes("boppayi")) return 55; // per Piece
  if (norm.includes("pineapple") || norm.includes("anasa")) return 65; // per Piece
  if (norm.includes("pomegranate") || norm.includes("danimma")) return 160; // per 1 Kg
  if (norm.includes("apple") || norm.includes("sebu")) return 180; // per 1 Kg
  if (norm.includes("grapes") || norm.includes("draksha")) return 90; // per 1 Kg
  if (norm.includes("guava") || norm.includes("jama")) return 60; // per 1 Kg
  if (norm.includes("sweet corn") || norm.includes("mokkajonna")) return 40; // per 4 Pcs
  if (norm.includes("laddu") || norm.includes("katli") || norm.includes("mysore pak") || norm.includes("sweet")) return 340; // per 500g
  if (norm.includes("mixture") || norm.includes("murukku") || norm.includes("janthikalu") || norm.includes("namkeen")) return 180; // per 500g
  if (norm.includes("pickle") || norm.includes("avakaaya") || norm.includes("gongura pachadi") || norm.includes("pacchadi")) return 220; // per 500g
  if (norm.includes("dal") || norm.includes("pappu") || norm.includes("toor")) return 160; // per 1 Kg
  if (norm.includes("millet") || norm.includes("korralu") || norm.includes("ragi") || norm.includes("jowar")) return 95; // per 1 Kg
  if (norm.includes("oil") || norm.includes("nune") || norm.includes("ghee") || norm.includes("neyyi")) return 320;

  // 2. Category Fallbacks
  if (cat.includes("leafy") || cat.includes("greens")) return 25;
  if (cat.includes("vegetable")) return 45;
  if (cat.includes("fruit")) return 90;
  if (cat.includes("sweet") || cat.includes("dessert")) return 280;
  if (cat.includes("snack") || cat.includes("namkeen")) return 160;
  if (cat.includes("staple") || cat.includes("grain") || cat.includes("dal")) return 110;
  if (cat.includes("dairy")) return 80;

  return 60;
}

/**
 * Dynamically computes a realistic 5-tier multi-quantity pricing matrix for any given produce
 * based on its base unit and base price with farm-direct volume discounts.
 */
export function generateProduceQuantityTiersMatrix(
  productName: string,
  basePriceInput: number | string,
  unitInput: string = "",
  categorySlug: string = ""
): QuantityTier[] {
  let price = typeof basePriceInput === "string" ? parseFloat(basePriceInput) : basePriceInput;
  if (isNaN(price) || price <= 0) price = 60;

  const { unitType } = detectProduceUnitType(productName, categorySlug, unitInput);

  // ── 1. DOZEN (e.g. Bananas) ──────────────────────────────────────────────
  if (unitType === "dozen") {
    // Treat price as 1 Dozen price
    const dPrice = unitInput.toLowerCase().includes("half") || unitInput.toLowerCase().includes("6")
      ? price * 2
      : price;

    return [
      {
        quantity: "6 Pcs (Half Dozen)",
        price: Math.round(dPrice * 0.55),
        perUnit: `₹${Math.round(dPrice * 1.1)}/dz`,
        savings: "Trial Pack",
        active: true,
      },
      {
        quantity: "1 Dozen (12 pcs)",
        price: Math.round(dPrice),
        perUnit: `₹${Math.round(dPrice)}/dz`,
        savings: "Standard Pack",
        isPopular: true,
        active: true,
      },
      {
        quantity: "2 Dozen (24 pcs)",
        price: Math.round(dPrice * 1.85),
        perUnit: `₹${Math.round(dPrice * 0.925)}/dz`,
        savings: "8% Savings (Family Pack)",
        active: true,
      },
      {
        quantity: "5 Dozen (Wholesale Crate)",
        price: Math.round(dPrice * 4.2),
        perUnit: `₹${Math.round(dPrice * 0.84)}/dz`,
        savings: "16% Wholesale Crate",
        active: true,
      },
      {
        quantity: "10 Dozen (Bulk Party Pack)",
        price: Math.round(dPrice * 8.0),
        perUnit: `₹${Math.round(dPrice * 0.8)}/dz`,
        savings: "20% Bulk Savings",
        active: true,
      },
    ];
  }

  // ── 2. BUNCH (e.g. Spinach, Coriander, Mint, Methi) ─────────────────────
  if (unitType === "bunch") {
    const bPrice = price; // Treat price as 1 Bunch price

    return [
      {
        quantity: "1 Bunch",
        price: Math.round(bPrice),
        perUnit: `₹${Math.round(bPrice)}/bunch`,
        savings: "Fresh Daily Pick",
        active: true,
      },
      {
        quantity: "2 Bunches",
        price: Math.round(bPrice * 1.9),
        perUnit: `₹${Math.round(bPrice * 0.95)}/bunch`,
        savings: "5% Savings",
        active: true,
      },
      {
        quantity: "3 Bunches",
        price: Math.round(bPrice * 2.7),
        perUnit: `₹${Math.round(bPrice * 0.9)}/bunch`,
        savings: "10% OFF (Best Value)",
        isPopular: true,
        active: true,
      },
      {
        quantity: "5 Bunches (Family Pack)",
        price: Math.round(bPrice * 4.2),
        perUnit: `₹${Math.round(bPrice * 0.84)}/bunch`,
        savings: "16% Savings",
        active: true,
      },
      {
        quantity: "10 Bunches (Fresh Crate)",
        price: Math.round(bPrice * 8.0),
        perUnit: `₹${Math.round(bPrice * 0.8)}/bunch`,
        savings: "20% Wholesale",
        active: true,
      },
    ];
  }

  // ── 3. SINGLE PIECE (e.g. Coconut, Watermelon, Papaya, Cabbage) ─────────
  if (unitType === "piece") {
    const pPrice = price; // Treat price as 1 Piece price

    return [
      {
        quantity: "1 Piece",
        price: Math.round(pPrice),
        perUnit: `₹${Math.round(pPrice)}/pc`,
        savings: "Single Fresh",
        active: true,
      },
      {
        quantity: "2 Pieces (Twin Pack)",
        price: Math.round(pPrice * 1.9),
        perUnit: `₹${Math.round(pPrice * 0.95)}/pc`,
        savings: "5% OFF",
        active: true,
      },
      {
        quantity: "4 Pieces (Family Box)",
        price: Math.round(pPrice * 3.6),
        perUnit: `₹${Math.round(pPrice * 0.9)}/pc`,
        savings: "10% OFF (Best Value)",
        isPopular: true,
        active: true,
      },
      {
        quantity: "8 Pieces (Farm Crate)",
        price: Math.round(pPrice * 6.8),
        perUnit: `₹${Math.round(pPrice * 0.85)}/pc`,
        savings: "15% Wholesale",
        active: true,
      },
    ];
  }

  // ── 4. COUNT (e.g. Lemons, Sweet Corn, Custard Apples) ───────────────────
  if (unitType === "count") {
    const base4Price = price;

    return [
      {
        quantity: "4 Pieces",
        price: Math.round(base4Price),
        perUnit: `₹${Math.round(base4Price / 4)}/pc`,
        savings: "Daily Pack",
        active: true,
      },
      {
        quantity: "8 Pieces",
        price: Math.round(base4Price * 1.9),
        perUnit: `₹${Math.round((base4Price * 1.9) / 8)}/pc`,
        savings: "5% OFF",
        active: true,
      },
      {
        quantity: "15 Pieces (Family Pack)",
        price: Math.round(base4Price * 3.3),
        perUnit: `₹${Math.round((base4Price * 3.3) / 15)}/pc`,
        savings: "12% OFF (Best Value)",
        isPopular: true,
        active: true,
      },
      {
        quantity: "30 Pieces (Bulk Crate)",
        price: Math.round(base4Price * 6.0),
        perUnit: `₹${Math.round((base4Price * 6.0) / 30)}/pc`,
        savings: "20% OFF Bulk",
        active: true,
      },
    ];
  }

  // ── 5. WEIGHT-BASED (e.g. Tomatoes, Potatoes, Onions, Mangoes, Dal, Sweets) ─
  // Normalize base price to 1 Kg
  const uLower = (unitInput || "1 Kg").toLowerCase();
  let baseKgPrice = price;
  if (uLower.includes("250g") || uLower.includes("250 g") || uLower.includes("250 gram")) {
    baseKgPrice = price * 4;
  } else if (uLower.includes("500g") || uLower.includes("500 g") || uLower.includes("500 gram")) {
    baseKgPrice = price * 2;
  } else if (uLower.includes("2 kg") || uLower.includes("2kg")) {
    baseKgPrice = price / 2;
  } else if (uLower.includes("5 kg") || uLower.includes("5kg")) {
    baseKgPrice = price / 5;
  }

  return [
    {
      quantity: "250g",
      price: Math.round(baseKgPrice * 0.28),
      perUnit: `₹${Math.round(baseKgPrice * 1.12)}/kg`,
      savings: "Trial Pack",
      active: true,
    },
    {
      quantity: "500g",
      price: Math.round(baseKgPrice * 0.52),
      perUnit: `₹${Math.round(baseKgPrice * 1.04)}/kg`,
      savings: "5% Savings (Popular)",
      active: true,
    },
    {
      quantity: "1 Kg",
      price: Math.round(baseKgPrice),
      perUnit: `₹${Math.round(baseKgPrice)}/kg`,
      savings: "10% OFF (Best Value)",
      isPopular: true,
      active: true,
    },
    {
      quantity: "3 Kg",
      price: Math.round(baseKgPrice * 2.7),
      perUnit: `₹${Math.round(baseKgPrice * 0.9)}/kg`,
      savings: "15% Family Pack",
      active: true,
    },
    {
      quantity: "5 Kg",
      price: Math.round(baseKgPrice * 4.2),
      perUnit: `₹${Math.round(baseKgPrice * 0.84)}/kg`,
      savings: "20% Wholesale Crate",
      active: true,
    },
  ];
}
