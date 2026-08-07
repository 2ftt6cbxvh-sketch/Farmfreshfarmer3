/**
 * FarmFreshFarmer API routes (PostgreSQL / production).
 * ======================================================
 * Route groups:
 *   - Auth            /api/register /api/login /api/logout /api/me /api/change-password
 *   - Catalog         /api/categories /api/products /api/products/:id /api/reviews
 *   - Coupons         /api/coupons (admin) + /api/coupons/validate
 *   - Pricing         /api/price/quote  (live discount/referral preview)
 *   - Orders          /api/orders (place, mine, admin list, status, detail)
 *   - Subscriptions   /api/plans + /api/subscriptions (subscribe + lifecycle)
 *   - Referral        /api/referral (summary, validate)
 *   - Admin           /api/admin/* (categories, inventory, customers, reviews, sales)
 *   - Discounts       /api/admin/discounts (rules CRUD)
 *   - Payments        /api/payments/* (initiate, callback, webhook, status, refund)
 *   - Reporting       /api/admin/reporting/*
 *   - Health          /health
 *
 * Order placement is routed through the business engine (`placeOrder`) so
 * discount + referral + stock + subscription logic stays in one place.
 */
import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import session from "express-session";
import multer from "multer";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { ensureSeeded } from "./seed-runner";
import {
  insertProductSchema, insertCouponSchema, insertReviewSchema,
} from "@shared/schema";
import { z } from "zod";
import { computePrice, parseDeliveryRules, type CartLine } from "./engine/pricing";
import { placeOrder } from "./engine/orders";
import { ensureReferralCode, referralSummary } from "./engine/referral";
import {
  pauseSubscription, resumeSubscription, skipNextCycle, cancelSubscription,
  reactivateSubscription, changePlan, generateUpcomingCycles, upcomingDeliveryDates,
} from "./engine/subscription";
import {
  initiatePayment, checkAndReconcile, forceResolve, initiateRefund,
  handleWebhook, verifyWebhookAuth, isPhonePeConfigured,
} from "./services/phonepe";

import { registerAuthJwtRoutes } from "./routes/auth-jwt";
import { registerDeliveryRoutes } from "./routes/delivery";
import { registerPasswordResetRoutes } from "./routes/password-reset";
import { registerSearchRoutes } from "./routes/search";
import { registerCartRoutes } from "./routes/cart";
import { authRateLimit, apiRateLimit } from "./middleware/rate-limit";
import { lockdownMiddleware } from "./services/lockdown";
import { processTelegramWebhook } from "./services/telegram";
import { registerAdminSecurityRoutes } from "./routes/admin/security";
import { registerAdminWarehouseRoutes } from "./routes/admin/warehouses";
import { registerAdminDeliveryRoutes } from "./routes/admin/delivery-admin";
import { registerAdminContentRoutes } from "./routes/admin/content";
import {
  createRazorpayOrder, verifyRazorpaySignature, verifyRazorpayWebhookSignature,
  initiateRazorpayRefund, isRazorpayConfigured,
} from "./services/razorpay";
import {
  createPaymentIntent, retrievePaymentIntent, createStripeRefund,
  verifyStripeWebhook, isStripeConfigured,
} from "./services/stripe";

// Session typing
declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: string;
  }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function publicUser(u: any) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, address: u.address };
}

/** Wrap async handlers so rejected promises become clean 500s instead of crashes. */
function h(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error("[route error]", err?.message || err);
      if (!res.headersSent) res.status(500).json({ message: err?.message || "Server error" });
    });
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Ensure fresh database is seeded with categories, products & admin user on cold start
  // Seed runs in background — does NOT block route registration or first request
  ensureSeeded({ log: true }).catch((e) => console.error("[seed] error:", e?.message || e));

  // Behind the Elastic Beanstalk load balancer / nginx we trust the first proxy
  // hop so secure cookies are honoured when TLS terminates upstream.
  app.set("trust proxy", 1);

  // CORS — allow all local dev + production origins dynamically
  const cors = (await import("cors")).default;
  app.use(cors({ origin: true, credentials: true }));

  // Apply general API rate limit
  app.use("/api", apiRateLimit);

  // Apply lockdown middleware (allows /health, /api/admin, /api/auth)
  app.use("/api", lockdownMiddleware);

  // Register JWT auth routes (parallel to session auth)
  registerAuthJwtRoutes(app);

  // Register delivery routes
  registerDeliveryRoutes(app);
  registerSearchRoutes(app);
  registerCartRoutes(app);

  /** GET /api/version — Version control telemetry */
  app.get("/api/version", (_req: Request, res: Response) => {
    return res.json({
      version: "1.4.0",
      environment: process.env.NODE_ENV || "production",
      platform: "vercel",
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || "bbcccbe",
      buildTimestamp: new Date().toISOString(),
    });
  });

  /** GET /api/debug/db — diagnostic: shows DB counts and forces re-seed */
  app.get("/api/debug/db", async (_req: Request, res: Response) => {
    try {
      const { db: _db } = await import("./db");
      const { categories, products, users } = await import("@shared/schema");
      const cats = await _db.select().from(categories);
      const prods = await _db.select().from(products);
      const admins = await _db.select().from(users);
      // Force re-seed regardless of in-memory flag
      const { ensureSeeded } = await import("./seed-runner");
      // Reset the module-level flag by importing fresh
      await ensureSeeded({ log: true });
      const cats2 = await _db.select().from(categories);
      const prods2 = await _db.select().from(products);
      const admins2 = await _db.select().from(users);
      return res.json({
        before: { categories: cats.length, products: prods.length, users: admins.length },
        after: { categories: cats2.length, products: prods2.length, users: admins2.length },
        dbUrl: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 40) + '...' : 'NOT SET',
        nodeEnv: process.env.NODE_ENV,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || String(e) });
    }
  });

  /** POST /api/debug/force-seed — force re-seed regardless of state */
  app.post("/api/debug/force-seed", async (_req: Request, res: Response) => {
    try {
      const { resetSeedFlag, ensureSeeded } = await import("./seed-runner");
      resetSeedFlag();
      await ensureSeeded({ log: true });
      return res.json({ success: true, message: 'Database seeded successfully' });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || String(e), success: false });
    }
  });

  // Secure cookies require HTTPS. In real production (EB + HTTPS listener) leave
  // COOKIE_SECURE unset/true. For local HTTP testing set COOKIE_SECURE=false.
  const cookieSecure =
    process.env.COOKIE_SECURE != null
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production";

  app.use(
    session({
      // Production MUST set SESSION_SECRET; dev falls back to a fixed string.
      secret: process.env.SESSION_SECRET || "farmfreshfarmer-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: cookieSecure,
        maxAge: 1000 * 60 * 60 * 24 * 30,
      },
    }),
  );

  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    next();
  }
  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId || req.session.role !== "admin") return res.status(403).json({ message: "Admin only" });
    next();
  }

  /* ============================ HEALTH ============================= */
  // Lightweight liveness + DB readiness probe for AWS EB / load balancers.
  app.get("/health", h(async (_req, res) => {
    const { pingDb } = await import("./db");
    const dbOk = await pingDb().catch(() => false);
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? "ok" : "degraded",
      db: dbOk,
      phonepe: isPhonePeConfigured() ? "configured" : "simulation",
      time: new Date().toISOString(),
    });
  }));

  /* ============================= AUTH ============================== */
  app.post("/api/register", h(async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(4),
      phone: z.string().optional(),
      referralCode: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid details" });
    const { name, email, password, phone, referralCode } = parsed.data;
    const lower = email.toLowerCase();
    const existing = await storage.users.getByEmail(lower);
    if (existing) return res.status(409).json({ message: "Email already registered" });
    const hash = bcrypt.hashSync(password, 10);
    const user = await storage.users.create({
      name, email: lower, username: lower, password: hash, phone: phone || null, address: null,
    } as any);
    // Give every new customer a referral code + profile immediately.
    await ensureReferralCode(user.id);
    await storage.profiles.ensure(user.id);
    // Record a pending referral link if they signed up via someone's code.
    if (referralCode) {
      const code = referralCode.trim().toUpperCase();
      const owner = await storage.referrals.findByCode(code);
      if (owner && owner.userId !== user.id) {
        const already = await storage.referrals.wasReferred(user.id);
        if (!already) {
          await storage.referrals.createReferral({
            referrerUserId: owner.userId, referredUserId: user.id, code, status: "pending",
          });
        }
      }
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ user: publicUser(user) });
  }));

  app.post("/api/login", h(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Missing credentials" });
    const user = await storage.users.getByEmail(String(email).toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Wrong email or password" });
    }
    if (user.status && user.status === "blocked") {
      return res.status(403).json({ message: "Account is blocked" });
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ user: publicUser(user) });
  }));

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/me", h(async (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    const user = await storage.users.get(req.session.userId);
    res.json({ user: user ? publicUser(user) : null });
  }));

  app.post("/api/change-password", requireAuth, h(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 4) return res.status(400).json({ message: "Password too short" });
    const me = await storage.users.get(req.session.userId!);
    if (!me || !bcrypt.compareSync(String(currentPassword || ""), me.password)) {
      return res.status(401).json({ message: "Current password incorrect" });
    }
    await storage.users.updatePassword(me.id, bcrypt.hashSync(String(newPassword), 10));
    res.json({ ok: true });
  }));
  // Back-compat alias used by the existing admin UI.
  app.post("/api/admin/change-password", requireAdmin, h(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 4) return res.status(400).json({ message: "Password too short" });
    const admin = await storage.users.get(req.session.userId!);
    if (!admin || !bcrypt.compareSync(String(currentPassword || ""), admin.password)) {
      return res.status(401).json({ message: "Current password incorrect" });
    }
    await storage.users.updatePassword(admin.id, bcrypt.hashSync(String(newPassword), 10));
    res.json({ ok: true });
  }));

  /* =========================== CATEGORIES ========================== */
  app.get("/api/categories", h(async (_req, res) => {
    res.json(await storage.categories.list());
  }));

  /* ============================ PRODUCTS =========================== */
  app.get("/api/products", h(async (req, res) => {
    const category = req.query.category ? String(req.query.category) : undefined;
    const q = req.query.q ? String(req.query.q) : undefined;
    const featured = req.query.featured === "1";
    res.json(await storage.products.list({ category, q, featured }));
  }));

  app.get("/api/products/:id", h(async (req, res) => {
    const p = await storage.products.get(Number(req.params.id));
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  }));

  app.post("/api/products", requireAdmin, h(async (req, res) => {
    const parsed = insertProductSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid product", errors: parsed.error.flatten() });
    res.json(await storage.products.create(parsed.data));
  }));

  app.patch("/api/products/:id", requireAdmin, h(async (req, res) => {
    const parsed = insertProductSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid product" });
    const updated = await storage.products.update(Number(req.params.id), parsed.data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  }));

  app.delete("/api/products/:id", requireAdmin, h(async (req, res) => {
    await storage.products.remove(Number(req.params.id));
    res.json({ ok: true });
  }));

  /* =========================== IMAGE UPLOAD ======================== */
  app.post("/api/upload", requireAdmin, upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file" });
    const b64 = req.file.buffer.toString("base64");
    res.json({ url: `data:${req.file.mimetype};base64,${b64}` });
  });

  /* ============================= REVIEWS =========================== */
  app.get("/api/reviews", h(async (req, res) => {
    const productId = Number(req.query.productId);
    if (!productId) return res.json([]);
    res.json(await storage.reviews.listForProduct(productId, { onlyApproved: true }));
  }));

  app.post("/api/reviews", requireAuth, h(async (req, res) => {
    const user = await storage.users.get(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    const body = {
      productId: Number(req.body.productId),
      userId: user.id,
      userName: user.name,
      rating: Math.max(1, Math.min(5, Number(req.body.rating) || 5)),
      comment: String(req.body.comment || ""),
    };
    const parsed = insertReviewSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid review" });
    res.json(await storage.reviews.create(body));
  }));

  /* ============================= COUPONS =========================== */
  app.get("/api/coupons", requireAdmin, h(async (_req, res) => {
    res.json(await storage.coupons.list());
  }));

  app.post("/api/coupons", requireAdmin, h(async (req, res) => {
    const parsed = insertCouponSchema.safeParse({ ...req.body, code: String(req.body.code || "").toUpperCase() });
    if (!parsed.success) return res.status(400).json({ message: "Invalid coupon" });
    const existing = await storage.coupons.getByCode(parsed.data.code);
    if (existing) return res.status(409).json({ message: "Code exists" });
    res.json(await storage.coupons.create(parsed.data));
  }));

  app.patch("/api/coupons/:id", requireAdmin, h(async (req, res) => {
    const parsed = insertCouponSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid coupon" });
    const updated = await storage.coupons.update(Number(req.params.id), parsed.data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  }));

  app.delete("/api/coupons/:id", requireAdmin, h(async (req, res) => {
    await storage.coupons.remove(Number(req.params.id));
    res.json({ ok: true });
  }));

  app.get("/api/coupons/validate", h(async (req, res) => {
    const code = String(req.query.code || "").toUpperCase();
    const subtotal = Number(req.query.subtotal) || 0;
    const coupon = await storage.coupons.getByCode(code);
    if (!coupon || !coupon.active) return res.json({ valid: false, message: "Invalid or inactive code" });
    const minOrder = Number(coupon.minOrder);
    if (subtotal < minOrder) {
      return res.json({ valid: false, message: `Minimum order ₹${minOrder} required` });
    }
    res.json({ valid: true, code: coupon.code, discountPercent: coupon.discountPercent });
  }));

  /* =========================== PRICE QUOTE ========================= */
  // Live price preview so the cart can show first-order/referral/reward
  // discounts before the customer commits.
  app.post("/api/price/quote", h(async (req, res) => {
    const items: CartLine[] = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ message: "No items" });
    const price = await computePrice({
      userId: req.session.userId ?? null,
      items,
      couponCode: req.body.couponCode ?? null,
      referralCode: req.body.referralCode ?? null,
      redeemReward: Boolean(req.body.redeemReward),
      city: req.body.city ?? null,
    });
    res.json(price);
  }));

  /* ===================== DELIVERY RULES (public) =================== */
  // Lets the checkout page list serviceable cities + their charges. Only the
  // city NAME and charge/threshold are exposed — the fee is still recomputed
  // server-side at order time so it can't be spoofed.
  app.get("/api/delivery-rules", h(async (_req, res) => {
    const rules = parseDeliveryRules(await storage.settings.get("delivery_rules"));
    res.json(rules);
  }));

  /* =================== CHECKOUT CONFIG (public) =================== */
  // Public flags the checkout page needs. COD is ON unless the admin has
  // explicitly disabled it (cod_enabled === "false").
  app.get("/api/checkout-config", h(async (_req, res) => {
    const codEnabled = (await storage.settings.get("cod_enabled")) !== "false";
    res.json({ codEnabled });
  }));

  /* ============================== ORDERS =========================== */
  app.post("/api/orders", h(async (req, res) => {
    const items: CartLine[] = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) return res.status(400).json({ message: "Cart is empty" });
    const paymentMethod = String(req.body.paymentMethod || "COD").toUpperCase();
    // Enforce the admin COD toggle server-side so it can't be bypassed.
    if (paymentMethod === "COD" && (await storage.settings.get("cod_enabled")) === "false") {
      return res.status(400).json({ message: "Cash on Delivery is currently unavailable. Please pay online." });
    }
    const { order, price } = await placeOrder({
      userId: req.session.userId ?? null,
      customerName: String(req.body.customerName || ""),
      phone: String(req.body.phone || ""),
      address: String(req.body.address || ""),
      items,
      couponCode: req.body.couponCode ?? null,
      referralCode: req.body.referralCode ?? null,
      redeemReward: Boolean(req.body.redeemReward),
      paymentMethod,
      city: req.body.city ?? null,
    });

    // For PhonePe, initiate payment and return the redirect URL.
    if (paymentMethod === "PHONEPE") {
      const pay = await initiatePayment({
        amountRupees: Number(order.total),
        target: { orderId: order.id, userId: order.userId },
        customerName: order.customerName,
      });
      return res.json({
        id: order.id, total: order.total, price,
        payment: { merchantOrderId: pay.merchantOrderId, redirectUrl: pay.redirectUrl, simulated: pay.simulated },
      });
    }
    // COD: confirm immediately.
    await storage.orders.setStatus(order.id, "confirmed", "Order placed (Cash on Delivery)");
    res.json({ id: order.id, total: order.total, price });
  }));

  app.get("/api/orders/mine", requireAuth, h(async (req, res) => {
    res.json(await storage.orders.listByUser(req.session.userId!));
  }));

  app.get("/api/orders/:id", requireAuth, h(async (req, res) => {
    const order = await storage.orders.get(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Not found" });
    // Customers may only view their own; admins any.
    if (req.session.role !== "admin" && order.userId !== req.session.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json({
      order,
      items: await storage.orders.items(order.id),
      discounts: await storage.orders.discounts(order.id),
      statusLogs: await storage.orders.statusLogs(order.id),
    });
  }));

  app.get("/api/orders", requireAdmin, h(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const type = req.query.type ? String(req.query.type) : undefined;
    res.json(await storage.orders.list({ status, type }));
  }));

  app.patch("/api/orders/:id", requireAdmin, h(async (req, res) => {
    const status = String(req.body.status || "");
    if (!status) return res.status(400).json({ message: "Missing status" });
    const updated = await storage.orders.setStatus(Number(req.params.id), status, req.body.note);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  }));

  /* ============================== USERS ============================ */
  app.get("/api/users", requireAdmin, h(async (_req, res) => {
    const users = await storage.users.list();
    res.json(users.map((u) => ({ ...u, password: undefined })));
  }));

  /* ============================= REFERRAL ========================== */
  app.get("/api/referral/summary", requireAuth, h(async (req, res) => {
    res.json(await referralSummary(req.session.userId!));
  }));

  app.get("/api/referral/validate", h(async (req, res) => {
    const code = String(req.query.code || "").trim().toUpperCase();
    if (!code) return res.json({ valid: false, message: "Enter a code" });
    const owner = await storage.referrals.findByCode(code);
    if (!owner) return res.json({ valid: false, message: "Unknown referral code" });
    if (req.session.userId && owner.userId === req.session.userId) {
      return res.json({ valid: false, message: "You cannot use your own referral code" });
    }
    res.json({ valid: true, code });
  }));

  /* =========================== SUBSCRIPTIONS ======================= */
  // Public: list active plans (with items) so customers can subscribe.
  app.get("/api/plans", h(async (_req, res) => {
    const plans = await storage.plans.list();
    const withItems = await Promise.all(
      plans.map(async (p) => ({ ...p, items: await storage.plans.items(p.id) })),
    );
    res.json(withItems);
  }));

  app.get("/api/subscriptions/mine", requireAuth, h(async (req, res) => {
    const subs = await storage.subscriptions.listByUser(req.session.userId!);
    const detailed = await Promise.all(
      subs.map(async (s) => ({
        ...s,
        items: await storage.subscriptions.items(s.id),
        cycles: await storage.subscriptions.cyclesForSubscription(s.id),
      })),
    );
    res.json({ subscriptions: detailed, upcomingDeliveries: upcomingDeliveryDates(new Date(), 2) });
  }));

  // Subscribe to a plan (optionally with custom add-on items).
  app.post("/api/subscriptions", requireAuth, h(async (req, res) => {
    const planId = Number(req.body.planId);
    const plan = await storage.plans.get(planId);
    if (!plan || !plan.active) return res.status(400).json({ message: "Invalid plan" });
    const deliveryDays = String(req.body.deliveryDays || req.body.deliveryDay || "both"); // saturday | sunday | both
    const extraItems: { productId: number; qty: number }[] = Array.isArray(req.body.items) ? req.body.items : [];

    // Compute weekly price = plan base + add-ons.
    const planItems = await storage.plans.items(planId);
    let weeklyPrice = Number(plan.price);
    for (const ex of extraItems) {
      const prod = await storage.products.get(ex.productId);
      if (prod) weeklyPrice += Number(prod.price) * Math.max(1, Number(ex.qty) || 1);
    }
    const sub = await storage.subscriptions.create({
      userId: req.session.userId!, planId, status: "active",
      deliveryDays, phone: req.body.phone ?? null, deliveryAddress: req.body.address ?? null,
      weeklyPrice: Math.round(weeklyPrice * 100) / 100,
    });
    // Persist the full item set (plan items + add-ons).
    const merged = [
      ...planItems.map((pi) => ({ productId: pi.productId, qty: pi.qty })),
      ...extraItems,
    ];
    await storage.subscriptions.setItems(sub.id, merged);
    res.json(sub);
  }));

  // Lifecycle actions (customer on own sub; admin on any).
  async function guardSub(req: Request, res: Response): Promise<any | null> {
    const sub = await storage.subscriptions.get(Number(req.params.id));
    if (!sub) { res.status(404).json({ message: "Not found" }); return null; }
    if (req.session.role !== "admin" && sub.userId !== req.session.userId) {
      res.status(403).json({ message: "Forbidden" }); return null;
    }
    return sub;
  }
  const actorOf = (req: Request): "customer" | "admin" => (req.session.role === "admin" ? "admin" : "customer");

  app.post("/api/subscriptions/:id/pause", requireAuth, h(async (req, res) => {
    if (!(await guardSub(req, res))) return;
    res.json(await pauseSubscription(Number(req.params.id), actorOf(req)));
  }));
  app.post("/api/subscriptions/:id/resume", requireAuth, h(async (req, res) => {
    if (!(await guardSub(req, res))) return;
    res.json(await resumeSubscription(Number(req.params.id), actorOf(req)));
  }));
  app.post("/api/subscriptions/:id/skip", requireAuth, h(async (req, res) => {
    if (!(await guardSub(req, res))) return;
    res.json(await skipNextCycle(Number(req.params.id), actorOf(req)));
  }));
  app.post("/api/subscriptions/:id/cancel", requireAuth, h(async (req, res) => {
    if (!(await guardSub(req, res))) return;
    res.json(await cancelSubscription(Number(req.params.id), actorOf(req)));
  }));
  app.post("/api/subscriptions/:id/reactivate", requireAuth, h(async (req, res) => {
    if (!(await guardSub(req, res))) return;
    res.json(await reactivateSubscription(Number(req.params.id), actorOf(req)));
  }));
  app.post("/api/subscriptions/:id/change-plan", requireAuth, h(async (req, res) => {
    if (!(await guardSub(req, res))) return;
    const newPlanId = Number(req.body.planId);
    const plan = await storage.plans.get(newPlanId);
    if (!plan) return res.status(400).json({ message: "Invalid plan" });
    res.json(await changePlan(Number(req.params.id), newPlanId, actorOf(req)));
  }));

  /* ===================== ADMIN: subscriptions ====================== */
  app.get("/api/admin/subscriptions", requireAdmin, h(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const subs = await storage.subscriptions.listAll({ status });
    const detailed = await Promise.all(
      subs.map(async (s) => {
        const u = await storage.users.get(s.userId);
        return { ...s, customer: u ? { id: u.id, name: u.name, email: u.email } : null };
      }),
    );
    res.json(detailed);
  }));

  app.get("/api/admin/subscriptions/:id", requireAdmin, h(async (req, res) => {
    const sub = await storage.subscriptions.get(Number(req.params.id));
    if (!sub) return res.status(404).json({ message: "Not found" });
    res.json({
      subscription: sub,
      items: await storage.subscriptions.items(sub.id),
      cycles: await storage.subscriptions.cyclesForSubscription(sub.id),
      statusLogs: await storage.subscriptions.statusLogs(sub.id),
    });
  }));

  // Admin: generate upcoming Sat/Sun billing cycles (idempotent).
  app.post("/api/admin/subscriptions/generate-cycles", requireAdmin, h(async (req, res) => {
    const weeks = Number(req.body.weeks) || 2;
    const createOrders = Boolean(req.body.createOrders);
    const result = await generateUpcomingCycles({ weeks, createOrders });
    res.json(result);
  }));

  /* ===================== ADMIN: plans (CRUD) ====================== */
  app.get("/api/admin/plans", requireAdmin, h(async (_req, res) => {
    const plans = await storage.plans.list({ includeInactive: true });
    const withItems = await Promise.all(plans.map(async (p) => ({ ...p, items: await storage.plans.items(p.id) })));
    res.json(withItems);
  }));

  app.post("/api/admin/plans", requireAdmin, h(async (req, res) => {
    const { name, description, price, deliveryDays, active } = req.body || {};
    if (!name || price == null) return res.status(400).json({ message: "Name and price required" });
    const items: { productId: number; qty: number }[] = Array.isArray(req.body.items) ? req.body.items : [];
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    const plan = await storage.plans.create(
      { name, slug, description: description ?? "", price, deliveryDays: deliveryDays ?? "both", active: active ?? true },
      items,
    );
    res.json(plan);
  }));

  app.patch("/api/admin/plans/:id", requireAdmin, h(async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : undefined;
    const updated = await storage.plans.update(Number(req.params.id), req.body, items);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  }));

  app.delete("/api/admin/plans/:id", requireAdmin, h(async (req, res) => {
    await storage.plans.remove(Number(req.params.id));
    res.json({ ok: true });
  }));

  /* ===================== ADMIN: categories (CRUD) ================= */
  app.get("/api/admin/categories", requireAdmin, h(async (_req, res) => {
    res.json(await storage.categories.list({ includeInactive: true }));
  }));
  app.post("/api/admin/categories", requireAdmin, h(async (req, res) => {
    res.json(await storage.categories.create(req.body));
  }));
  app.patch("/api/admin/categories/:id", requireAdmin, h(async (req, res) => {
    const updated = await storage.categories.update(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  }));
  app.delete("/api/admin/categories/:id", requireAdmin, h(async (req, res) => {
    await storage.categories.remove(Number(req.params.id));
    res.json({ ok: true });
  }));

  /* ===================== ADMIN: inventory ========================= */
  app.get("/api/admin/inventory/low-stock", requireAdmin, h(async (_req, res) => {
    res.json(await storage.products.lowStock());
  }));
  app.get("/api/admin/inventory/:id/adjustments", requireAdmin, h(async (req, res) => {
    res.json(await storage.products.adjustments(Number(req.params.id)));
  }));
  app.post("/api/admin/inventory/:id/adjust", requireAdmin, h(async (req, res) => {
    const changeQty = Number(req.body.changeQty);
    if (!Number.isFinite(changeQty) || changeQty === 0) return res.status(400).json({ message: "changeQty required" });
    const product = await storage.products.adjustStock(
      Number(req.params.id), changeQty, String(req.body.reason || "manual"),
      req.body.note, req.session.userId,
    );
    res.json(product);
  }));

  /* ===================== ADMIN: customers ========================= */
  app.get("/api/admin/customers", requireAdmin, h(async (_req, res) => {
    const customers = await storage.users.listCustomers();
    const detailed = await Promise.all(
      customers.map(async (c) => {
        const profile = await storage.profiles.get(c.id);
        const summary = await referralSummary(c.id).catch(() => null);
        return {
          id: c.id, name: c.name, email: c.email, phone: c.phone, status: c.status,
          hasCompletedFirstOrder: profile?.hasCompletedFirstOrder ?? false,
          totalOrders: profile?.totalOrders ?? 0,
          totalSpent: profile?.totalSpent ?? "0",
          referralCode: summary?.code ?? null,
          successfulReferrals: summary?.successfulReferrals ?? 0,
          referralBalance: summary?.availableBalance ?? 0,
        };
      }),
    );
    res.json(detailed);
  }));

  app.post("/api/admin/customers/:id/status", requireAdmin, h(async (req, res) => {
    const status = String(req.body.status || "");
    if (!["active", "blocked"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    res.json(await storage.users.updateStatus(Number(req.params.id), status));
  }));

  /* ===================== ADMIN: review moderation ================= */
  app.get("/api/admin/reviews", requireAdmin, h(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    res.json(await storage.reviews.listAll(status));
  }));
  app.post("/api/admin/reviews/:id/moderate", requireAdmin, h(async (req, res) => {
    const action = String(req.body.action || "");
    if (!["approve", "reject", "hide"].includes(action)) return res.status(400).json({ message: "Invalid action" });
    res.json(await storage.reviews.setModeration(Number(req.params.id), action as any, req.session.userId));
  }));

  /* ===================== ADMIN: discount rules =================== */
  app.get("/api/admin/discounts", requireAdmin, h(async (_req, res) => {
    res.json(await storage.discounts.list());
  }));
  app.post("/api/admin/discounts", requireAdmin, h(async (req, res) => {
    res.json(await storage.discounts.create(req.body));
  }));
  app.patch("/api/admin/discounts/:id", requireAdmin, h(async (req, res) => {
    const updated = await storage.discounts.update(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  }));

  /* ===================== ADMIN: settings ========================= */
  app.get("/api/admin/settings", requireAdmin, h(async (_req, res) => {
    res.json(await storage.settings.all());
  }));
  app.post("/api/admin/settings", requireAdmin, h(async (req, res) => {
    const pairs = req.body && typeof req.body === "object" ? req.body : {};
    await storage.settings.setMany(
      Object.fromEntries(Object.entries(pairs).map(([k, v]) => [k, String(v)])),
    );
    res.json(await storage.settings.all());
  }));

  /* ===================== ADMIN: sales summary ==================== */
  app.get("/api/admin/sales-summary", requireAdmin, h(async (_req, res) => {
    const orders = await storage.orders.list();
    const paidOrders = orders.filter((o) => o.paymentStatus === "paid" || o.paymentMethod === "COD");
    const revenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
    const byStatus: Record<string, number> = {};
    for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    const activeSubs = (await storage.subscriptions.listActive()).length;
    // Upcoming Sat/Sun deliveries for the dashboard.
    const upcoming = upcomingDeliveryDates(new Date(), 2);
    res.json({
      totalOrders: orders.length,
      totalRevenue: Math.round(revenue * 100) / 100,
      averageOrderValue: paidOrders.length ? Math.round((revenue / paidOrders.length) * 100) / 100 : 0,
      ordersByStatus: byStatus,
      activeSubscriptions: activeSubs,
      upcomingDeliveries: upcoming,
      lowStockCount: (await storage.products.lowStock()).length,
    });
  }));

  /* ===================== ADMIN: reporting (Power BI helpers) ===== */
  // JSON convenience endpoints mirroring the SQL reporting views, in case
  // Power BI is pointed at the API instead of directly at PostgreSQL.
  app.get("/api/admin/reporting/orders", requireAdmin, h(async (_req, res) => {
    res.json(await storage.orders.list());
  }));
  app.get("/api/admin/reporting/payments", requireAdmin, h(async (_req, res) => {
    res.json(await storage.payments.list());
  }));

  /* ============================= PAYMENTS ========================= */
  // Initiate a payment for an existing order (e.g. retry after COD->PhonePe,
  // or paying a generated subscription cycle order).
  app.post("/api/payments/initiate", requireAuth, h(async (req, res) => {
    const orderId = Number(req.body.orderId);
    const order = await storage.orders.get(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (req.session.role !== "admin" && order.userId !== req.session.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const pay = await initiatePayment({
      amountRupees: Number(order.total),
      target: { orderId: order.id, userId: order.userId },
      customerName: order.customerName,
    });
    res.json(pay);
  }));

  // Redirect target after PhonePe checkout: verify + reconcile, then report.
  app.get("/api/payments/status/:merchantOrderId", h(async (req, res) => {
    const result = await checkAndReconcile(String(req.params.merchantOrderId));
    res.json(result);
  }));

  // Simulator resolve (dev/preview only — no live credentials).
  app.post("/api/payments/simulate", h(async (req, res) => {
    if (isPhonePeConfigured()) return res.status(400).json({ message: "Simulation disabled when PhonePe is configured" });
    const outcome = String(req.body.outcome || "success") === "failed" ? "failed" : "success";
    const result = await forceResolve(String(req.body.merchantOrderId), outcome);
    res.json(result);
  }));

  // Webhook (server-to-server from PhonePe). Verified via Authorization header.
  app.post("/api/payments/webhook", h(async (req, res) => {
    if (!verifyWebhookAuth(req.headers["authorization"] as string | undefined)) {
      return res.status(401).json({ message: "Invalid webhook signature" });
    }
    await handleWebhook(req.body);
    res.json({ ok: true });
  }));

  // Admin: refund a payment.
  app.post("/api/admin/payments/:merchantOrderId/refund", requireAdmin, h(async (req, res) => {
    const result = await initiateRefund({
      merchantOrderId: String(req.params.merchantOrderId),
      amountRupees: req.body.amount != null ? Number(req.body.amount) : undefined,
      reason: req.body.reason,
    });
    res.json(result);
  }));

  // Admin: list payments.
  app.get("/api/admin/payments", requireAdmin, h(async (_req, res) => {
    res.json(await storage.payments.list());
  }));

  // Admin security, warehouses, delivery routes
  registerAdminSecurityRoutes(app);
  registerAdminWarehouseRoutes(app);
  registerAdminDeliveryRoutes(app);

  // ============================================================
  // RAZORPAY ROUTES
  // ============================================================

  /** POST /api/payments/razorpay/create-order */
  app.post("/api/payments/razorpay/create-order", h(async (req, res) => {
    if (!isRazorpayConfigured()) return res.status(503).json({ message: "Razorpay not configured" });
    const { orderId, amount } = req.body;
    if (!orderId || !amount) return res.status(400).json({ message: "orderId and amount required" });
    const order = await createRazorpayOrder(parseFloat(amount), `fff_${orderId}`);
    return res.json({ razorpayOrderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  }));

  /** POST /api/payments/razorpay/verify */
  app.post("/api/payments/razorpay/verify", h(async (req, res) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: "razorpayOrderId, razorpayPaymentId, and razorpaySignature required" });
    }
    const valid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!valid) return res.status(400).json({ message: "Payment signature verification failed" });
    // Update payment record in DB
    const { db: _db } = await import("./db");
    const { payments } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    if (orderId) {
      await _db.update(payments).set({ status: "success", providerTransactionId: razorpayPaymentId, updatedAt: new Date() }).where(eq(payments.orderId, parseInt(orderId)));
    }
    return res.json({ success: true, paymentId: razorpayPaymentId });
  }));

  /** POST /api/payments/razorpay/webhook */
  app.post("/api/payments/razorpay/webhook", h(async (req, res) => {
    const signature = req.headers["x-razorpay-signature"] as string;
    const rawBody = typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(req.body);
    if (signature && process.env.RAZORPAY_WEBHOOK_SECRET) {
      const valid = verifyRazorpayWebhookSignature(rawBody, signature);
      if (!valid) return res.status(400).json({ message: "Invalid webhook signature" });
    }
    const event = req.body;
    console.log(`[razorpay webhook] event: ${event.event}`);
    // Handle payment.captured
    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (payment?.id) {
        const { db: _db } = await import("./db");
        const { payments } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        await _db.update(payments).set({ status: "success", updatedAt: new Date() }).where(eq(payments.providerTransactionId, payment.id));
      }
    }
    return res.json({ status: "ok" });
  }));

  // ============================================================
  // STRIPE ROUTES
  // ============================================================

  /** POST /api/payments/stripe/create-intent */
  app.post("/api/payments/stripe/create-intent", h(async (req, res) => {
    if (!isStripeConfigured()) return res.status(503).json({ message: "Stripe not configured" });
    const { orderId, amount } = req.body;
    if (!orderId || !amount) return res.status(400).json({ message: "orderId and amount required" });
    const pi = await createPaymentIntent(parseFloat(amount), { orderId: String(orderId) });
    return res.json({ clientSecret: pi.client_secret, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
  }));

  /** POST /api/payments/stripe/webhook */
  app.post("/api/payments/stripe/webhook", h(async (req, res) => {
    const signature = req.headers["stripe-signature"] as string;
    if (!signature) return res.status(400).json({ message: "stripe-signature header missing" });
    try {
      const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body));
      const event = verifyStripeWebhook(rawBody as Buffer, signature);
      if (event.type === "payment_intent.succeeded") {
        const pi = event.data.object as any;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          const { db: _db } = await import("./db");
          const { payments } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          await _db.update(payments).set({ status: "success", providerTransactionId: pi.id, updatedAt: new Date() }).where(eq(payments.orderId, parseInt(orderId)));
        }
      }
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
    return res.json({ received: true });
  }));

  // Password reset routes
  registerPasswordResetRoutes(app);
  registerAdminContentRoutes(app);

  // Telegram bot webhook endpoint for remote /lockdown commands
  app.post("/api/telegram/webhook", h(async (req, res) => {
    const result = await processTelegramWebhook(req.body);
    return res.json(result);
  }));

  // Version information endpoint
  app.get("/api/version", (_req, res) => {
    return res.json({
      version: process.env.VITE_APP_VERSION || process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    });
  });

  return httpServer;
}
