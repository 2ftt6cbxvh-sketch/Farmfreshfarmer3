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
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

// Automatically cap any existing customer stars to maximum of 5 in DB
db.execute(sql`UPDATE users SET customer_stars = 5 WHERE customer_stars > 5`).catch(() => {});
import { ensureSeeded } from "./seed-runner";
import {
  insertProductSchema, insertCouponSchema, insertReviewSchema, users,
  products, orders, orderItems, orderStatusLogs, orderDiscounts,
  subscriptionPlans, userSubscriptions, subscriptionPlanItems,
  productApprovalHistory,
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
import { processSecurityTelegramWebhook, processGrievanceTelegramWebhook, sendTelegramApprovalNotification } from "./services/telegram";
import { registerAdminSecurityRoutes } from "./routes/admin/security";
import { registerAdminWarehouseRoutes } from "./routes/admin/warehouses";
import { registerAdminDeliveryRoutes } from "./routes/admin/delivery-admin";
import { registerAdminContentRoutes } from "./routes/admin/content";
import { registerStaffRoutes } from "./routes/admin/staff";
import { registerApprovalRoutes } from "./routes/admin/approval";
import { registerChatbotRoutes } from "./routes/chatbot";
import { registerTicketRoutes } from "./routes/tickets";
import { registerAdminDeliveryPartnerRoutes } from "./routes/admin/delivery-partners";
import { registerDeliveryPartnerPortalRoutes } from "./routes/delivery-partner-portal";
import { registerPerkRoutes } from "./routes/admin/perks";
import { registerHeroShowcaseRoutes } from "./routes/admin/hero-showcase";
import gstRouter from "./routes/admin/gst";
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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const round2 = (n: number) => Math.round(n * 100) / 100;

function publicUser(u: any) {
  let perms: string[] = [];
  if (u.permissions) {
    if (Array.isArray(u.permissions)) {
      perms = u.permissions;
    } else if (typeof u.permissions === "string") {
      try { perms = JSON.parse(u.permissions); } catch { perms = []; }
    }
  }

  const isPrimary = Boolean(
    u.isPrimaryAdmin ||
    u.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    (u.role === "admin" && u.id === 1)
  );

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    customTitle: u.customTitle || null,
    permissions: perms,
    isPrimaryAdmin: isPrimary,
    isVerified: u.isVerified !== undefined ? Boolean(u.isVerified) : isPrimary,
    starRating: isPrimary ? 6 : Math.min(5, Math.max(1, Number(u.starRating) || 5)),
    experienceRank: u.experienceRank || (isPrimary ? "Super Admin" : "Specialist"),
    customerStars: u.customerStars ?? 0,
    phone: u.phone,
    address: u.address,
  };
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
      version: "1.7.1",
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

  async function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (req.session?.userId) {
      return next();
    }
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
    if (token) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
        if (decoded && (decoded.userId || decoded.sub)) {
          const uid = decoded.userId || decoded.sub;
          req.session.userId = typeof uid === "string" ? parseInt(uid, 10) : uid;
          req.session.role = decoded.role || "customer";
          return next();
        }
      } catch {}
    }
    return res.status(401).json({ message: "Not logged in" });
  }
  const STAFF_ROLES = ["admin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin", "delivery_partner"];

  async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    let adminValid = false;
    if (req.session?.userId && req.session?.role && STAFF_ROLES.includes(req.session.role)) {
      adminValid = true;
    } else {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
      if (token) {
        try {
          const jwt = (await import("jsonwebtoken")).default;
          let decoded: any;
          try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
          } catch {
            decoded = jwt.decode(token) as any;
          }
          if (decoded?.role && STAFF_ROLES.includes(decoded.role)) {
            adminValid = true;
            req.session.userId = decoded.userId || decoded.sub;
            req.session.role = decoded.role;
          } else if (decoded?.userId) {
            const { storage } = await import("./storage");
            const user = await storage.users.get(decoded.userId);
            if (user && STAFF_ROLES.includes(user.role)) {
              adminValid = true;
              req.session.userId = user.id;
              req.session.role = user.role;
            }
          }
        } catch (e) {}
      }
    }
    if (!adminValid) return res.status(403).json({ message: "Admin or Staff access required" });

    // Enforce Chief Admin 2FA TOTP verification if active
    const { storage } = await import("./storage");
    const totpEnabled = (await storage.settings.get("admin_totp_enabled")) === "true";
    if (totpEnabled && !req.path.startsWith("/api/admin/mfa")) {
      const mfaHeader = req.headers["x-admin-mfa-verified"] === "true";
      const mfaSession = (req.session as any)?.mfaVerified === true;
      if (!mfaHeader && !mfaSession && !adminValid) {
        return res.status(403).json({ message: "403 Forbidden: Chief Admin 2FA TOTP Verification Required", mfaRequired: true });
      }
    }

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

  app.get("/api/auth/methods", h(async (_req, res) => {
    const emailEnabled = (await storage.settings.get("auth_email_enabled")) !== "false";
    const googleEnabled = (await storage.settings.get("auth_google_enabled")) !== "false";
    res.json({ emailEnabled, googleEnabled });
  }));

  /* ============================= AUTH ============================== */
  app.post("/api/register", h(async (req, res) => {
    if ((await storage.settings.get("auth_email_enabled")) === "false") {
      return res.status(400).json({ message: "Email login is currently disabled by Admin. Please log in using Google." });
    }
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
    const { issueTokenPair } = await import('./services/token');
    const tokens = await issueTokenPair(user.id, user.role, {
      platform: 'web', ip: req.ip, userAgent: req.headers['user-agent'],
    });
    res.json({ user: publicUser(user), ...tokens });
  }));

  app.post("/api/login", h(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Missing credentials" });
    let user: any = null;
    const cleanEmail = String(email).toLowerCase().trim();
    try {
      user = await storage.users.getByEmail(cleanEmail);
    } catch (dbErr: any) {
      console.warn("[login] ORM user lookup error, running auto-migrations & fallback:", dbErr?.message);
      try {
        const { runAutoMigrations } = await import("./db");
        await runAutoMigrations();
        user = await storage.users.getByEmail(cleanEmail);
      } catch (retryErr: any) {
        console.error("[login] Retry user lookup error:", retryErr?.message);
        // Emergency Super Admin fallback query using raw SQL pool
        if (cleanEmail === "admin@farmfreshfarmer.com") {
          try {
            const { pool } = await import("./db");
            const rawRes = await pool.query(`SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1`, [cleanEmail]);
            if (rawRes.rows.length > 0) {
              const u = rawRes.rows[0];
              user = {
                id: u.id,
                name: u.name || "Super Admin",
                email: u.email,
                username: u.username || u.email,
                password: u.password,
                role: u.role || "admin",
                isPrimaryAdmin: true,
                isVerified: true,
                starRating: 6,
                experienceRank: "Super Admin",
                customerStars: 0,
                status: u.status || "active",
              };
            }
          } catch (fallbackErr) {
            console.error("[login] Raw SQL fallback error:", fallbackErr);
          }
        }
      }
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Wrong email or password" });
    }
    if (user.status && user.status === "blocked") {
      return res.status(403).json({ message: "Account is blocked" });
    }

    // Check if 2FA Telegram OTP is required globally for this Sub-Admin / Staff member
    const isGlobal2faEnabled = (await storage.settings.get("subadmin_2fa_otp_enabled")) === "true";
    const isSubAdminStaff = user.role !== "customer" && !user.isPrimaryAdmin && user.email.toLowerCase() !== "admin@farmfreshfarmer.com";

    if (isGlobal2faEnabled && isSubAdminStaff) {
      const { create2faOtpSession, sendTelegram2faOtp, isTelegramOtpConfigured } = await import("./services/telegram");

      if (!user.telegramChatId || !user.telegramChatId.trim()) {
        return res.status(403).json({
          message: "🔒 2FA Telegram Verification Required: Your staff profile has no Telegram Chat ID configured. Please contact the Super Admin to add your Telegram ID.",
        });
      }

      if (!(await isTelegramOtpConfigured())) {
        return res.status(503).json({
          message: "🔒 2FA Telegram Authentication Bot is not configured on the server. Please notify the Super Admin.",
        });
      }

      const { tempToken, otp, maskedTelegram } = await create2faOtpSession(
        user.id,
        user.email,
        user.telegramChatId,
        user.name
      );

      const sent = await sendTelegram2faOtp(user.telegramChatId, otp, user.name);
      if (!sent) {
        return res.status(500).json({
          message: "Failed to dispatch Telegram 2FA code. Please ensure you have started the 2FA Telegram bot.",
        });
      }

      return res.json({
        require2fa: true,
        tempToken,
        maskedTelegram,
        staffName: user.name,
        message: `🔐 6-digit 2FA verification code sent to your Telegram (${maskedTelegram}).`,
      });
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    const { issueTokenPair } = await import('./services/token');
    const tokens = await issueTokenPair(user.id, user.role, {
      platform: 'web', ip: req.ip, userAgent: req.headers['user-agent'],
    });
    res.json({ user: publicUser(user), ...tokens });
  }));

  /** POST /api/login/verify-otp — Verify 6-digit Sub-Admin 2FA Telegram OTP */
  app.post("/api/login/verify-otp", h(async (req, res) => {
    const { tempToken, otp } = req.body || {};
    if (!tempToken || !otp) {
      return res.status(400).json({ message: "Session token and 6-digit OTP code are required" });
    }

    const { verify2faOtpSession } = await import("./services/telegram");
    const result = verify2faOtpSession(String(tempToken), String(otp));

    if (!result.success || !result.userId) {
      return res.status(401).json({ message: result.message || "Invalid OTP code" });
    }

    const user = await storage.users.get(result.userId);
    if (!user || user.status === "blocked") {
      return res.status(403).json({ message: "Account not accessible or blocked" });
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    const { issueTokenPair } = await import('./services/token');
    const tokens = await issueTokenPair(user.id, user.role, {
      platform: 'web', ip: req.ip, userAgent: req.headers['user-agent'],
    });
    return res.json({ user: publicUser(user), ...tokens, message: "✨ 2FA Authentication Verified!" });
  }));

  /** POST /api/login/resend-otp — Resend 2FA Telegram OTP */
  app.post("/api/login/resend-otp", h(async (req, res) => {
    const { tempToken } = req.body || {};
    if (!tempToken) {
      return res.status(400).json({ message: "Session token is required" });
    }

    const { resend2faOtpSession } = await import("./services/telegram");
    const result = await resend2faOtpSession(String(tempToken));

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    return res.json({ message: result.message, maskedTelegram: result.maskedTelegram });
  }));

  app.post("/api/logout", (req, res) => {
    try {
      res.clearCookie("token");
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
    } catch {}
    if (req.session) {
      req.session.destroy(() => res.json({ ok: true }));
    } else {
      res.json({ ok: true });
    }
  });

  app.get("/api/me", h(async (req, res) => {
    let userId = req.session?.userId;
    if (!userId) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
      if (token) {
        try {
          const jwt = (await import('jsonwebtoken')).default;
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'farmfreshfarmer-jwt-secret') as any;
          if (decoded?.userId) userId = decoded.userId;
        } catch {}
      }
    }
    if (!userId) return res.json({ user: null });
    const user = await storage.users.get(userId);
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

async function isPrimaryAdminUser(req: Request): Promise<boolean> {
  let uid = req.session?.userId;
  let userRole = req.session?.role;

  // Also check Bearer JWT token if session is missing
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken ?? req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      let decoded: any;
      try { decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any; }
      catch { decoded = jwt.decode(token) as any; }
      if (decoded) {
        if (!uid) uid = typeof decoded.userId === "string" ? parseInt(decoded.userId, 10) : (decoded.userId ?? decoded.sub);
        if (!userRole) userRole = decoded.role;
        if (decoded.email?.toLowerCase() === "admin@farmfreshfarmer.com" || decoded.isPrimaryAdmin === true) {
          return true;
        }
      }
    } catch {}
  }

  if (!uid && !userRole) return false;

  if (uid) {
    const [u] = await db.select().from(users).where(eq(users.id, Number(uid)));
    if (u) {
      if (Boolean(u.isPrimaryAdmin) || u.email?.toLowerCase() === "admin@farmfreshfarmer.com" || (u.role === "admin" && (u.id === 1 || u.id === 0))) {
        return true;
      }
    }
  }

  return false;
}

  /* ============================ PRODUCTS =========================== */
  app.get("/api/products", h(async (req, res) => {
    const category = req.query.category ? String(req.query.category) : undefined;
    const q = req.query.q ? String(req.query.q) : undefined;
    const featured = req.query.featured === "1";
    const includeInactive = req.query.includeInactive === "1" || req.query.all === "1" || Boolean(req.session?.userId) || Boolean(req.headers.authorization);
    res.json(await storage.products.list({ category, q, featured, includeInactive }));
  }));

  app.get("/api/products/:id", h(async (req, res) => {
    const p = await storage.products.get(Number(req.params.id));
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  }));

  app.post("/api/products", requireAdmin, h(async (req, res) => {
    const parsed = insertProductSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn("Product creation validation error:", parsed.error.flatten());
      const issue = parsed.error.issues[0];
      const field = issue?.path.join(".") || "field";
      return res.status(400).json({ message: `Invalid product data: '${field}' ${issue?.message || "is invalid"}` });
    }
    const isPrimary = await isPrimaryAdminUser(req);
    const productData: any = {
      ...parsed.data,
      submittedBy: req.session?.userId ?? null,
      approvalStatus: isPrimary ? "approved" : "pending",
      active: isPrimary ? true : false,
    };
    const created = await storage.products.create(productData);

    if (!isPrimary) {
      let submitterUser: any = null;
      if (req.session?.userId) {
        try {
          const [u] = await db.select().from(users).where(eq(users.id, req.session.userId));
          submitterUser = u;
        } catch {}
      }

      try {
        await db.insert(productApprovalHistory).values({
          entityType: "product",
          entityId: created.id,
          entityName: created.name ?? "",
          action: "submitted",
          fromStatus: null,
          toStatus: "pending",
          adminUserId: null,
          submittedByUserId: req.session?.userId ?? null,
          note: "Product created by sub-admin, queued for Super Admin approval.",
        });
      } catch (err) {
        console.warn("[approval history log warning]", err);
      }

      // Formally notify Super Admin via Telegram Security Bot
      sendTelegramApprovalNotification({
        entityType: "product",
        action: "create",
        entityName: created.name ?? "",
        entityId: created.id,
        submitterName: submitterUser?.name,
        submitterEmail: submitterUser?.email,
        price: created.price,
        stock: created.stock,
        unit: created.unit,
        categorySlug: created.categorySlug,
      }).catch((e) => console.warn("[telegram security approval notify err]", e));

      return res.json({
        ...created,
        isPendingApproval: true,
        message: "Submitted for Super Admin Approval! 📤 It will go live once approved.",
      });
    }

    res.json(created);
  }));

  app.patch("/api/products/:id", requireAdmin, h(async (req, res) => {
    const parsed = insertProductSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      console.warn("Product update validation error:", parsed.error.flatten());
      const issue = parsed.error.issues[0];
      const field = issue?.path.join(".") || "field";
      return res.status(400).json({ message: `Invalid product data: '${field}' ${issue?.message || "is invalid"}` });
    }
    const isPrimary = await isPrimaryAdminUser(req);
    const updateData: any = { ...parsed.data };

    if (isPrimary) {
      // Super Admin edits go LIVE IMMEDIATELY on the public storefront!
      updateData.approvalStatus = "approved";
      updateData.active = parsed.data.active ?? true;
      updateData.approvalNote = "Updated directly by Super Admin";
    } else {
      // Sub-Admin edits require Super Admin approval before going live!
      updateData.approvalStatus = "pending";
      updateData.active = false; // Hide from public storefront until Super Admin approves!
      updateData.submittedBy = req.session?.userId ?? null;
      updateData.approvalNote = "Pending Super Admin re-approval for sub-admin edits.";
    }

    const updated = await storage.products.update(Number(req.params.id), updateData);
    if (!updated) return res.status(404).json({ message: "Not found" });

    if (!isPrimary) {
      let submitterUser: any = null;
      if (req.session?.userId) {
        try {
          const [u] = await db.select().from(users).where(eq(users.id, req.session.userId));
          submitterUser = u;
        } catch {}
      }

      try {
        await db.insert(productApprovalHistory).values({
          entityType: "product",
          entityId: updated.id,
          entityName: updated.name ?? "",
          action: "submitted_edit",
          fromStatus: "approved",
          toStatus: "pending",
          adminUserId: null,
          submittedByUserId: req.session?.userId ?? null,
          note: "Product edits submitted by sub-admin, queued for Super Admin approval.",
        });
      } catch (err) {
        console.warn("[approval history log warning]", err);
      }

      // Formally notify Super Admin via Telegram Security Bot
      sendTelegramApprovalNotification({
        entityType: "product",
        action: "edit",
        entityName: updated.name ?? "",
        entityId: updated.id,
        submitterName: submitterUser?.name,
        submitterEmail: submitterUser?.email,
        price: updated.price,
        stock: updated.stock,
        unit: updated.unit,
        categorySlug: updated.categorySlug,
      }).catch((e) => console.warn("[telegram security approval notify err]", e));

      return res.json({
        ...updated,
        isPendingApproval: true,
        message: "Product modifications submitted for Super Admin Approval! 📤",
      });
    }

    res.json(updated);
  }));

  app.delete("/api/products/:id", requireAdmin, h(async (req, res) => {
    const isPrimary = await isPrimaryAdminUser(req);
    const id = Number(req.params.id);
    const p = await storage.products.get(id);
    if (!p) return res.status(404).json({ message: "Not found" });

    if (isPrimary) {
      await storage.products.remove(id);
      return res.json({ ok: true, message: "Product permanently deleted 🗑️" });
    }

    const updated = await storage.products.update(id, {
      approvalStatus: "pending_deletion",
      active: false, // Immediately hide from live storefront while queued for approval!
      approvalNote: "Deletion requested by sub-admin, queued for Super Admin review.",
    });

    let submitterUser: any = null;
    if (req.session?.userId) {
      try {
        const [u] = await db.select().from(users).where(eq(users.id, req.session.userId));
        submitterUser = u;
      } catch {}
    }

    try {
      await db.insert(productApprovalHistory).values({
        entityType: "product",
        entityId: id,
        entityName: p.name ?? "",
        action: "deletion_requested",
        fromStatus: p.approvalStatus ?? "approved",
        toStatus: "pending_deletion",
        adminUserId: null,
        submittedByUserId: req.session?.userId ?? null,
        note: "Product deletion requested by sub-admin.",
      });
    } catch (err) {
      console.warn("[approval history log error]", err);
    }

    // Formally notify Super Admin via Telegram Security Bot
    sendTelegramApprovalNotification({
      entityType: "product",
      action: "delete",
      entityName: p.name ?? "",
      entityId: id,
      submitterName: submitterUser?.name,
      submitterEmail: submitterUser?.email,
      price: p.price,
      stock: p.stock,
      unit: p.unit,
      categorySlug: p.categorySlug,
    }).catch((e) => console.warn("[telegram security approval notify err]", e));

    res.json({
      ...updated,
      isPendingApproval: true,
      message: "Deletion request submitted for Super Admin Approval! 📤",
    });
  }));

  /* =========================== IMAGE UPLOAD ======================== */
  app.post("/api/upload", requireAdmin, (req, res) => {
    upload.single("image")(req, res, (err: any) => {
      if (err) {
        console.error("Multer upload error:", err);
        return res.status(400).json({ message: err.message || "File upload failed" });
      }
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const b64 = req.file.buffer.toString("base64");
      res.json({ url: `data:${req.file.mimetype};base64,${b64}` });
    });
  });

  // Customer photo upload endpoint (e.g. for refund damage proof photos)
  app.post("/api/upload/customer-photo", (req, res) => {
    upload.single("image")(req, res, (err: any) => {
      if (err) {
        console.error("Customer upload error:", err);
        return res.status(400).json({ message: err.message || "Photo upload failed" });
      }
      if (!req.file) return res.status(400).json({ message: "No photo uploaded" });
      const b64 = req.file.buffer.toString("base64");
      res.json({ url: `data:${req.file.mimetype};base64,${b64}` });
    });
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
    const code = String(req.query.code || "").trim().toUpperCase();
    const subtotal = Number(req.query.subtotal) || 0;
    const coupon = await storage.coupons.getByCode(code);
    if (!coupon || !coupon.active) return res.json({ valid: false, message: "Invalid or inactive code" });
    const minOrder = parseFloat(String(coupon.minOrder || "0")) || 0;
    if (subtotal > 0 && subtotal < minOrder) {
      return res.json({ valid: false, message: `Minimum order ₹${minOrder} required` });
    }
    const discountPercent = parseFloat(String(coupon.discountPercent || "0")) || 10;
    res.json({ valid: true, code: coupon.code, discountPercent });
  }));

  /* =================== STAR DISCOUNT RULES ========================= */
  // Get all star discount rules (public - used by client to show discount tiers)
  app.get("/api/star-discount-rules", h(async (_req, res) => {
    const rules = await storage.starDiscountRules.list();
    res.json(rules);
  }));

  // Create a new star discount rule (Super Admin only)
  app.post("/api/star-discount-rules", requireAdmin, h(async (req, res) => {
    const { ruleType, starFrom, starTo, discountPercent, description, active } = req.body;
    if (!ruleType || starFrom === undefined || starTo === undefined || discountPercent === undefined) {
      return res.status(400).json({ message: "ruleType, starFrom, starTo, discountPercent are required" });
    }
    const rule = await storage.starDiscountRules.create({ ruleType, starFrom, starTo, discountPercent, description, active: active !== false });
    res.status(201).json(rule);
  }));

  // Update a star discount rule (Super Admin only)
  app.patch("/api/star-discount-rules/:id", requireAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const rule = await storage.starDiscountRules.update(id, req.body);
    if (!rule) return res.status(404).json({ message: "Rule not found" });
    res.json(rule);
  }));

  // Delete a star discount rule (Super Admin only)
  app.delete("/api/star-discount-rules/:id", requireAdmin, h(async (req, res) => {
    await storage.starDiscountRules.remove(Number(req.params.id));
    res.json({ ok: true });
  }));

  /* =================== CUSTOMER STARS ============================== */
  // Set customer loyalty stars (Super Admin only)
  app.patch("/api/users/:id/customer-stars", requireAdmin, h(async (req, res) => {
    const userId = Number(req.params.id);
    const stars = Number(req.body.customerStars);
    if (isNaN(stars) || stars < 0 || stars > 5) {
      return res.status(400).json({ message: "customerStars must be 0–5" });
    }
    const [updated] = await db.update(users).set({ customerStars: stars, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ user: publicUser(updated) });
  }));

  function extractUserId(req: any): number | null {
    if (req.session?.userId) return Number(req.session.userId);
    if (req.jwtUser?.userId) return Number(req.jwtUser.userId);
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
    if (token) {
      try {
        const jwt = require("jsonwebtoken");
        let decoded: any;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret");
        } catch {
          decoded = jwt.decode(token);
        }
        if (decoded?.userId || decoded?.sub) {
          return Number(decoded.userId || decoded.sub);
        }
      } catch (e) {}
    }
    return null;
  }

  /* =========================== PRICE QUOTE ========================= */
  // Live price preview so the cart can show first-order/referral/reward
  // discounts before the customer commits.
  app.post("/api/price/quote", h(async (req, res) => {
    const items: CartLine[] = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ message: "No items" });
    const userId = extractUserId(req);
    const price = await computePrice({
      userId,
      items,
      couponCode: req.body.couponCode ?? null,
      referralCode: req.body.referralCode ?? null,
      redeemReward: Boolean(req.body.redeemReward),
      city: req.body.city ?? null,
      pincode: req.body.pincode ?? null,
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

  app.patch('/api/user/phone', requireAuth as any, h(async (req, res) => {
    const { phone } = req.body || {};
    if (!phone || !/^[6-9][0-9]{9}$/.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit Indian mobile number' });
    }
    const userId = extractUserId(req) || req.session.userId!;
    const updated = await db.update(users).set({ phone: phone.trim() }).where(eq(users.id, userId)).returning();
    res.json({ user: publicUser(updated[0]) });
  }));

  /* ============================= ORDERS ============================ */
  app.post("/api/orders", h(async (req, res) => {
    const items: CartLine[] = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) return res.status(400).json({ message: "Cart is empty" });
    const paymentMethod: PaymentMethod = req.body.paymentMethod === "PHONEPE" ? "PHONEPE" : "COD";
    // Enforce the admin COD toggle server-side so it can't be bypassed.
    if (paymentMethod === "COD" && (await storage.settings.get("cod_enabled")) === "false") {
      return res.status(400).json({ message: "Cash on Delivery is currently unavailable. Please pay online." });
    }
    const userId = extractUserId(req);

    // Require phone number for order and auto-save to user profile
    const incomingPhone = String(req.body.phone || "").trim();
    if (userId) {
      const u = await storage.users.get(userId);
      if (incomingPhone && (!u?.phone || u.phone.trim() !== incomingPhone)) {
        try {
          await db.update(users).set({ phone: incomingPhone }).where(eq(users.id, userId));
        } catch (e) {
          console.warn('[orders] Failed to auto-update phone on user:', e);
        }
      } else if (!u?.phone && !incomingPhone) {
        return res.status(400).json({ message: 'Please enter your phone number to receive delivery updates.' });
      }
    }

    const isInternational = Boolean(req.body.isInternational);
    if (isInternational) {
      const activePlans = await storage.plans.list();
      const hasSub = items.some(item =>
        activePlans.some(pl => pl.name.toLowerCase() === (item.name || '').toLowerCase() || (item.name || '').toLowerCase().includes(pl.name.toLowerCase()))
      );
      if (hasSub) {
        return res.status(400).json({ message: "Subscription boxes cannot be delivered internationally or out of station. Please remove subscription from cart." });
      }
    }

    const { order, price } = await placeOrder({
      userId,
      customerName: String(req.body.customerName || ""),
      phone: incomingPhone,
      address: String(req.body.address || ""),
      items,
      couponCode: req.body.couponCode ?? null,
      referralCode: req.body.referralCode ?? null,
      redeemReward: Boolean(req.body.redeemReward),
      paymentMethod,
      city: req.body.city ?? null,
      pincode: req.body.pincode ? String(req.body.pincode).trim() : null,
    });

    // If order contains a subscription plan item, activate user subscription
    if (userId) {
      try {
        const activePlans = await storage.plans.list();
        for (const item of items) {
          const matchingPlan = activePlans.find((pl: any) =>
            pl.name.toLowerCase() === (item.name || '').toLowerCase() ||
            (item.name || '').toLowerCase().includes(pl.name.toLowerCase())
          );
          if (matchingPlan) {
            const planItems = await storage.plans.items(matchingPlan.id);
            let deliveryDays = matchingPlan.deliveryDays || "both";
            const unitLower = (item.unit || '').toLowerCase();
            if (unitLower.includes('saturday') && !unitLower.includes('both')) deliveryDays = 'saturday';
            else if (unitLower.includes('sunday') && !unitLower.includes('both')) deliveryDays = 'sunday';

            const sub = await storage.subscriptions.create({
              userId,
              planId: matchingPlan.id,
              status: "active",
              deliveryDays,
              phone: String(req.body.phone || ""),
              deliveryAddress: String(req.body.address || ""),
              weeklyPrice: Number(matchingPlan.price),
            });
            if (planItems.length) {
              await storage.subscriptions.setItems(sub.id, planItems.map(pi => ({ productId: pi.productId, qty: pi.qty })));
            }
            await db.update(orders).set({ orderType: "subscription", subscriptionId: sub.id, deliveryDay: deliveryDays }).where(eq(orders.id, order.id));
            break;
          }
        }
      } catch (subErr) {
        console.error('[orders] Failed to activate subscription from order:', subErr);
      }
    }

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
    // COD: confirm immediately and dispatch Super Admin Security Bot alert.
    await storage.orders.setStatus(order.id, "confirmed", "Order placed (Cash on Delivery)");

    try {
      const { sendTelegramOrderSecurityNotification } = await import("./services/telegram");
      sendTelegramOrderSecurityNotification({
        orderId: order.id,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        items,
        subtotal: price.subtotal,
        discount: price.discount,
        deliveryFee: price.deliveryFee,
        total: order.total,
        paymentMethod: "Cash on Delivery (COD)",
        couponCode: order.couponCode,
        orderType: order.orderType,
      }).catch((e) => console.warn('[telegram] COD order notification error:', e));
    } catch (e) {}

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

    // If order was cancelled by Admin, dispatch Super Admin Security Bot alert
    if (status.toLowerCase() === "cancelled") {
      try {
        const { sendTelegramOrderCancellationSecurityNotification } = await import("./services/telegram");
        sendTelegramOrderCancellationSecurityNotification({
          orderId: updated.id,
          customerName: updated.customerName,
          phone: updated.phone,
          total: updated.total,
          paymentMethod: updated.paymentMethod,
          reason: req.body.note || "Cancelled by Admin",
          cancelledBy: "Admin",
        }).catch((e) => console.warn('[telegram] Admin cancel notification error:', e));
      } catch (e) {}
    }

    res.json(updated);
  }));

  // Customer order cancellation
  app.post("/api/orders/:id/cancel", requireAuth, h(async (req, res) => {
    const id = Number(req.params.id);
    const order = await storage.orders.get(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (req.session.role !== "admin" && order.userId !== req.session.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (order.status === "Delivered" || order.status === "Cancelled") {
      return res.status(400).json({ message: `Cannot cancel order with status "${order.status}"` });
    }

    const reason = String(req.body.reason || "Cancelled by Customer").trim();
    const updated = await storage.orders.setStatus(id, "Cancelled", reason);

    // Dispatch Telegram Alert ONLY to Super Admin Security Bot
    try {
      const { sendTelegramOrderCancellationSecurityNotification } = await import("./services/telegram");
      sendTelegramOrderCancellationSecurityNotification({
        orderId: order.id,
        customerName: order.customerName,
        phone: order.phone,
        total: order.total,
        paymentMethod: order.paymentMethod,
        reason,
        cancelledBy: req.session.role === "admin" ? "Admin" : "Customer",
      }).catch((e) => console.warn('[telegram] Customer cancel notification error:', e));
    } catch (e) {}

    res.json({ success: true, message: "Order cancelled successfully", order: updated });
  }));

  /* ====================== GST TAX INVOICE & BILLING ================== */
  function numberToIndianWords(num: number): string {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const n = Math.floor(Math.abs(num));
    if (n === 0) return 'INR Zero Rupees Only';

    function convertTwoDigits(n: number): string {
      if (n < 20) return a[n];
      const tens = b[Math.floor(n / 10)];
      const units = a[n % 10];
      return tens + (units ? ' ' + units : '');
    }

    function convertThreeDigits(n: number): string {
      const hundred = Math.floor(n / 100);
      const rest = n % 100;
      let res = '';
      if (hundred > 0) res += a[hundred] + ' Hundred';
      if (rest > 0) res += (res ? ' ' : '') + convertTwoDigits(rest);
      return res;
    }

    let words = '';
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const remainder = n % 1000;

    if (crore > 0) words += convertThreeDigits(crore) + ' Crore ';
    if (lakh > 0) words += convertThreeDigits(lakh) + ' Lakh ';
    if (thousand > 0) words += convertThreeDigits(thousand) + ' Thousand ';
    if (remainder > 0) words += convertThreeDigits(remainder);

    return 'INR ' + words.trim() + ' Only';
  }

  // GET /api/orders/:id/invoice — Generate / Fetch Legal GST Tax Invoice
  app.get("/api/orders/:id/invoice", requireAuth, h(async (req, res) => {
    const id = Number(req.params.id);
    const order = await storage.orders.get(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Allow primary admin, staff, or the customer who placed the order
    if (req.session.role !== "admin" && !["warehouse_admin", "manager_admin", "subadmin", "custom_subadmin"].includes(req.session.role || "") && order.userId !== req.session.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const items = await storage.orders.items(order.id);
    const discounts = await storage.orders.discounts(order.id);

    // Fetch dynamic store/company settings from DB
    const settingsMap = await storage.settings.all();

    const legalCompanyName = settingsMap["company_legal_name"] || settingsMap["store_name"] || "FARMFRESHFARMER AGRI VENTURES PRIVATE LIMITED";
    const brandName = settingsMap["store_name"] || "FarmFreshFarmer — Organic Farm to Home";
    const companyGstin = settingsMap["company_gstin"] || "37AABCF9876Q1Z2";
    const companyPan = settingsMap["company_pan"] || "AABCF9876Q";
    const companyFssai = settingsMap["fssai_license_number"] || "10021044000321";
    const companyCin = settingsMap["company_cin"] || "U01110AP2024PTC123456";
    const companyAddress = settingsMap["company_address"] || settingsMap["operating_cities"] || "Plot #42, Green Agro Valley, Rushikonda, Visakhapatnam, Andhra Pradesh - 530045, India";
    const supportEmail = settingsMap["support_email"] || "billing@farmfreshfarmer.com";
    const supportPhone = settingsMap["support_phone"] || "+91 891 234 5678";
    const placeOfSupply = settingsMap["jurisdiction_city"] ? `${settingsMap["jurisdiction_city"]}, Andhra Pradesh (State Code: 37)` : "Andhra Pradesh (State Code: 37)";

    const invoiceNumber = (order as any).invoiceData?.invoiceNumber || `FFF/TAX/${new Date(order.createdAt).getFullYear()}/${String(order.id).padStart(5, '0')}`;
    const invoiceDate = (order as any).invoiceData?.invoiceDate || new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // Itemized table with HSN codes & GST computation
    const lineItems = await Promise.all(items.map(async (it: any, index: number) => {
      let priceNum = parseFloat(it.price) || 0;
      const qtyNum = parseInt(String(it.qty || 1), 10) || 1;

      // If product has a catalog discount (e.g. 5% off on Boondi Laddu), use effective discounted selling price
      if (it.productId) {
        try {
          const prod = await storage.products.get(Number(it.productId));
          if (prod) {
            const rawPrice = Number(prod.price) || 0;
            const discPercent = Number(prod.discountPercent) || 0;
            if (discPercent > 0) {
              priceNum = round2(rawPrice * (1 - discPercent / 100));
            }
          }
        } catch (e) {}
      }
      
      // Assign appropriate HSN code based on item name
      let hsn = "0709"; // Fresh vegetables (0% GST)
      let gstRate = 0;
      const lowerName = (it.name || "").toLowerCase();
      if (lowerName.includes("milk") || lowerName.includes("curd") || lowerName.includes("paneer")) {
        hsn = "0401";
        gstRate = 0;
      } else if (lowerName.includes("sweet") || lowerName.includes("laddu") || lowerName.includes("halwa")) {
        hsn = "2106";
        gstRate = 5;
      } else if (lowerName.includes("pickle") || lowerName.includes("pachadi") || lowerName.includes("oil")) {
        hsn = "2001";
        gstRate = 5;
      } else if (lowerName.includes("spice") || lowerName.includes("powder") || lowerName.includes("masala")) {
        hsn = "0910";
        gstRate = 5;
      } else if (lowerName.includes("fruit") || lowerName.includes("mango") || lowerName.includes("apple")) {
        hsn = "0804";
        gstRate = 0;
      }

      // Unit Price and Taxable Value are identical for 1 unit (taxableValue = unitPrice * qty)
      const unitPrice = priceNum;
      const taxableValue = unitPrice * qtyNum;
      const cgstRate = gstRate / 2;
      const sgstRate = gstRate / 2;
      const cgstAmount = (taxableValue * (cgstRate / 100));
      const sgstAmount = (taxableValue * (sgstRate / 100));
      const lineTotal = taxableValue + cgstAmount + sgstAmount;

      return {
        serialNo: index + 1,
        id: it.id,
        name: it.name,
        unit: it.unit || "Unit",
        hsn,
        qty: qtyNum,
        unitPrice: unitPrice.toFixed(2),
        taxableValue: taxableValue.toFixed(2),
        gstRate,
        cgstRate,
        cgstAmount: cgstAmount.toFixed(2),
        sgstRate,
        sgstAmount: sgstAmount.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      };
    }));

    const taxableSubtotal = lineItems.reduce((acc: number, cur: any) => acc + parseFloat(cur.taxableValue), 0);
    const totalCgst = lineItems.reduce((acc: number, cur: any) => acc + parseFloat(cur.cgstAmount), 0);
    const totalSgst = lineItems.reduce((acc: number, cur: any) => acc + parseFloat(cur.sgstAmount), 0);
    const totalTax = totalCgst + totalSgst;
    const subtotalNum = taxableSubtotal + totalTax;
    const discountNum = parseFloat(order.discount) || 0;
    const orderTotalNum = parseFloat(order.total) || 0;
    
    // Explicit delivery fee calculation: Total = Subtotal - Discount + Delivery Fee
    const deliveryFeeNum = Math.max(0, round2(orderTotalNum - (subtotalNum - discountNum)));
    const totalNum = orderTotalNum > 0 ? orderTotalNum : round2(Math.max(0, subtotalNum - discountNum + deliveryFeeNum));

    const amountInWords = numberToIndianWords(totalNum);

    const baseInvoice = {
      orderId: order.id,
      invoiceNumber,
      invoiceDate,
      orderDate: new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      placeOfSupply,
      reverseCharge: "No",

      // Company / Vendor Details
      company: {
        legalName: legalCompanyName,
        brandName,
        logoUrl: "/images/logo-horizontal-brand.png",
        iconUrl: "/images/logo-icon.png",
        gstin: companyGstin,
        pan: companyPan,
        fssai: companyFssai,
        cin: companyCin,
        address: companyAddress,
        email: supportEmail,
        phone: supportPhone,
        website: "www.farmfreshfarmer.com",
      },

      // Customer Details
      customer: {
        name: order.customerName,
        phone: order.phone,
        address: order.address,
        email: (order as any).customerEmail || "",
        gstin: (order as any).customerGstin || "Unregistered / Consumer",
      },

      // Line Items (Unit Price and Taxable Value are identical for 1 unit)
      items: lineItems,

      // Totals & Taxes (Every rupee clearly accounted for)
      summary: {
        taxableSubtotal: taxableSubtotal.toFixed(2),
        totalCgst: totalCgst.toFixed(2),
        totalSgst: totalSgst.toFixed(2),
        totalTax: totalTax.toFixed(2),
        subtotal: subtotalNum.toFixed(2),
        discount: discountNum.toFixed(2),
        deliveryFee: deliveryFeeNum.toFixed(2),
        firstOrderDiscount: parseFloat(order.firstOrderDiscount || "0").toFixed(2),
        referralDiscount: parseFloat(order.referralDiscount || "0").toFixed(2),
        couponCode: order.couponCode || null,
        grandTotal: totalNum.toFixed(2),
        amountInWords,
      },

      // Authorized Signatory & Legal Terms
      signatory: {
        signatoryName: "Authorised Signatory",
        designation: "Finance & Accounts Lead",
        companyName: legalCompanyName,
        signatureUrl: "/images/logo-icon.png",
        declaration: "We declare that this invoice shows the actual price of the organic goods described and that all particulars are true and correct. All disputes subject to Visakhapatnam jurisdiction.",
      },
    };

    // If super admin has customized invoice metadata, preserve text edits but always enforce strict accurate math
    let mergedInvoice = baseInvoice;
    if ((order as any).invoiceData) {
      const saved = (order as any).invoiceData;
      mergedInvoice = {
        ...baseInvoice,
        ...saved,
        orderId: order.id,
        company: { ...baseInvoice.company, ...(saved.company || {}) },
        customer: { ...baseInvoice.customer, ...(saved.customer || {}) },
        placeOfSupply: saved.placeOfSupply || baseInvoice.placeOfSupply,
        signatory: { ...baseInvoice.signatory, ...(saved.signatory || {}) },
        items: lineItems, // Always use freshly normalized math where Unit Price === Taxable Value
        summary: {
          ...baseInvoice.summary,
          taxableSubtotal: taxableSubtotal.toFixed(2),
          totalCgst: totalCgst.toFixed(2),
          totalSgst: totalSgst.toFixed(2),
          totalTax: totalTax.toFixed(2),
          subtotal: subtotalNum.toFixed(2),
          discount: discountNum.toFixed(2),
          deliveryFee: deliveryFeeNum.toFixed(2),
          grandTotal: totalNum.toFixed(2),
          amountInWords,
        },
      };
    }

    res.json(mergedInvoice);
  }));

  // PATCH /api/admin/orders/:id/invoice — Super Admin Save Custom Invoice Edits
  app.patch("/api/admin/orders/:id/invoice", requireAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const order = await storage.orders.get(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const invoicePayload = req.body;

    // Persist company details globally so all invoices reflect changes
    if (invoicePayload?.company) {
      const comp = invoicePayload.company;
      if (comp.address) await storage.settings.set("company_address", String(comp.address).trim());
      if (comp.gstin) await storage.settings.set("company_gstin", String(comp.gstin).trim());
      if (comp.pan) await storage.settings.set("company_pan", String(comp.pan).trim());
      if (comp.fssai) await storage.settings.set("fssai_license_number", String(comp.fssai).trim());
      if (comp.cin) await storage.settings.set("company_cin", String(comp.cin).trim());
      if (comp.legalName) await storage.settings.set("company_legal_name", String(comp.legalName).trim());
      if (comp.phone) await storage.settings.set("support_phone", String(comp.phone).trim());
      if (comp.email) await storage.settings.set("support_email", String(comp.email).trim());
    }

    if (invoicePayload?.placeOfSupply) {
      await storage.settings.set("jurisdiction_city", String(invoicePayload.placeOfSupply).trim());
    }

    if (invoicePayload?.signatory?.declaration) {
      await storage.settings.set("invoice_declaration", String(invoicePayload.signatory.declaration).trim());
    }

    const [updated] = await db.update(orders)
      .set({
        invoiceData: invoicePayload,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();

    res.json({ success: true, message: "Customized GST Tax Invoice and Company Details saved successfully! 💾", invoice: invoicePayload });
  }));

  // DELETE /api/admin/orders/:id/hard-delete — Permanently Erase Order Out-of-Existence
  app.delete("/api/admin/orders/:id/hard-delete", requireAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const order = await storage.orders.get(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Delete dependent order child records in foreign key cascade order
    try {
      await db.delete(orderItems).where(eq(orderItems.orderId, id));
    } catch (e) {}
    try {
      await db.delete(orderStatusLogs).where(eq(orderStatusLogs.orderId, id));
    } catch (e) {}
    try {
      await db.delete(orderDiscounts).where(eq(orderDiscounts.orderId, id));
    } catch (e) {}

    // Delete the order itself
    await db.delete(orders).where(eq(orders.id, id));

    res.json({ success: true, message: `Order #${id} deleted out of existence permanently 🗑️` });
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
  async function ensurePlanProduct(plan: any): Promise<any> {
    const planName = plan.name;
    let [prod] = await db.select().from(products).where(eq(products.name, planName)).limit(1);
    if (!prod) {
      const [inserted] = await db.insert(products).values({
        name: planName,
        description: plan.description || `Curated weekly subscription box delivered every ${plan.deliveryDays}.`,
        categorySlug: 'vegetables',
        price: String(plan.price),
        unit: '1 Weekly Box',
        image: plan.image || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=500&auto=format&fit=crop&q=60',
        stock: 9999,
        active: plan.active ?? true,
        featured: false,
        gstPercent: "0",
      }).returning();
      prod = inserted;
    } else {
      if (Number(prod.price) !== Number(plan.price) || prod.active !== plan.active || prod.gstPercent !== "0") {
        const [updated] = await db.update(products).set({
          price: String(plan.price),
          active: plan.active ?? true,
          gstPercent: "0",
        }).where(eq(products.id, prod.id)).returning();
        prod = updated;
      }
    }
    return prod;
  }

  // Public: list active plans (with items) so customers can subscribe.
  app.get("/api/plans", h(async (_req, res) => {
    const plans = await storage.plans.list();
    const withItems = await Promise.all(
      plans.map(async (p) => {
        const planProduct = await ensurePlanProduct(p);
        const items = await storage.plans.items(p.id);
        const itemsWithProducts = await Promise.all(
          items.map(async (it) => {
            const product = await storage.products.get(it.productId);
            return {
              ...it,
              productName: product?.name ?? '',
              productPrice: Number(product?.price ?? 0),
              productImage: product?.image ?? '',
              productUnit: product?.unit ?? '',
              productDiscountPercent: Number(product?.discountPercent ?? 0),
            };
          })
        );
        return { 
          ...p, 
          productId: planProduct.id,
          product: planProduct,
          items: itemsWithProducts 
        };
      }),
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

  // Admin / Super Admin: update subscription status directly
  app.patch("/api/admin/subscriptions/:id", requireAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const sub = await storage.subscriptions.get(id);
    if (!sub) return res.status(404).json({ message: "Not found" });
    const { status, note } = req.body;
    if (status) {
      await storage.subscriptions.setStatus(id, status, "admin", note || "Updated by Super Admin");
    }
    const updated = await storage.subscriptions.update(id, req.body);
    res.json(updated);
  }));

  // Admin / Super Admin: permanently remove a subscription (removes subscription & badge from user UI)
  app.delete("/api/admin/subscriptions/:id", requireAdmin, h(async (req, res) => {
    const id = Number(req.params.id);
    const sub = await storage.subscriptions.get(id);
    if (!sub) return res.status(404).json({ message: "Not found" });
    await storage.subscriptions.remove(id);
    res.json({ ok: true, message: "Subscription removed successfully" });
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
    await ensurePlanProduct(plan);
    res.json(plan);
  }));

  app.patch("/api/admin/plans/:id", requireAdmin, h(async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : undefined;
    const updated = await storage.plans.update(Number(req.params.id), req.body, items);
    if (!updated) return res.status(404).json({ message: "Not found" });
    await ensurePlanProduct(updated);
    res.json(updated);
  }));

  app.delete("/api/admin/plans/:id", requireAdmin, h(async (req, res) => {
    const plan = await storage.plans.get(Number(req.params.id));
    await storage.plans.remove(Number(req.params.id));
    if (plan) {
      await db.update(products).set({ active: false }).where(eq(products.name, plan.name));
    }
    res.json({ ok: true });
  }));

  /* ===================== ADMIN: categories (CRUD) ================= */
  app.get("/api/admin/categories", requireAdmin, h(async (_req, res) => {
    res.json(await storage.categories.list({ includeInactive: true }));
  }));

  app.post("/api/admin/categories", requireAdmin, h(async (req, res) => {
    const isPrimary = await isPrimaryAdminUser(req);
    const categoryData: any = {
      ...req.body,
      submittedBy: req.session?.userId ?? null,
      approvalStatus: isPrimary ? "approved" : "pending",
      active: isPrimary ? (req.body.active ?? true) : false,
    };
    const created = await storage.categories.create(categoryData);

    if (!isPrimary) {
      let submitterUser: any = null;
      if (req.session?.userId) {
        try {
          const [u] = await db.select().from(users).where(eq(users.id, req.session.userId));
          submitterUser = u;
        } catch {}
      }

      try {
        await db.insert(productApprovalHistory).values({
          entityType: "category",
          entityId: created.id,
          entityName: created.name ?? "",
          action: "submitted",
          fromStatus: null,
          toStatus: "pending",
          adminUserId: null,
          submittedByUserId: req.session?.userId ?? null,
          note: "Category created by sub-admin, queued for Super Admin approval.",
        });
      } catch (err) {
        console.warn("[category approval history log warning]", err);
      }

      // Formally notify Super Admin via Telegram Security Bot
      sendTelegramApprovalNotification({
        entityType: "category",
        action: "create",
        entityName: created.name ?? "",
        entityId: created.id,
        submitterName: submitterUser?.name,
        submitterEmail: submitterUser?.email,
      }).catch((e) => console.warn("[telegram security approval notify err]", e));

      return res.json({
        ...created,
        isPendingApproval: true,
        message: "Submitted for Super Admin Approval! 📤 It will go live once approved.",
      });
    }

    res.json(created);
  }));

  app.patch("/api/admin/categories/:id", requireAdmin, h(async (req, res) => {
    const isPrimary = await isPrimaryAdminUser(req);
    const updateData: any = { ...req.body };

    if (isPrimary) {
      // Super Admin edits go LIVE IMMEDIATELY!
      updateData.approvalStatus = "approved";
      updateData.active = req.body.active ?? true;
      updateData.approvalNote = "Updated directly by Super Admin";
    } else {
      // Sub-Admin edits require Super Admin approval before going live!
      updateData.approvalStatus = "pending";
      updateData.active = false; // Hide from public storefront until Super Admin approves!
      updateData.submittedBy = req.session?.userId ?? null;
      updateData.approvalNote = "Pending Super Admin re-approval for sub-admin edits.";
    }

    const updated = await storage.categories.update(Number(req.params.id), updateData);
    if (!updated) return res.status(404).json({ message: "Not found" });

    if (!isPrimary) {
      let submitterUser: any = null;
      if (req.session?.userId) {
        try {
          const [u] = await db.select().from(users).where(eq(users.id, req.session.userId));
          submitterUser = u;
        } catch {}
      }

      try {
        await db.insert(productApprovalHistory).values({
          entityType: "category",
          entityId: updated.id,
          entityName: updated.name ?? "",
          action: "submitted_edit",
          fromStatus: "approved",
          toStatus: "pending",
          adminUserId: null,
          submittedByUserId: req.session?.userId ?? null,
          note: "Category edits submitted by sub-admin, queued for Super Admin approval.",
        });
      } catch (err) {
        console.warn("[category approval history log warning]", err);
      }

      // Formally notify Super Admin via Telegram Security Bot
      sendTelegramApprovalNotification({
        entityType: "category",
        action: "edit",
        entityName: updated.name ?? "",
        entityId: updated.id,
        submitterName: submitterUser?.name,
        submitterEmail: submitterUser?.email,
      }).catch((e) => console.warn("[telegram security approval notify err]", e));

      return res.json({
        ...updated,
        isPendingApproval: true,
        message: "Category modifications submitted for Super Admin Approval! 📤",
      });
    }

    res.json(updated);
  }));

  app.delete("/api/admin/categories/:id", requireAdmin, h(async (req, res) => {
    const isPrimary = await isPrimaryAdminUser(req);
    const id = Number(req.params.id);
    const c = await storage.categories.get(id);
    if (!c) return res.status(404).json({ message: "Not found" });

    if (isPrimary) {
      await storage.categories.remove(id);
      return res.json({ ok: true, message: "Category permanently deleted 🗑️" });
    }

    const updated = await storage.categories.update(id, {
      approvalStatus: "pending_deletion",
      active: false, // Immediately hide from live storefront while queued for approval!
      approvalNote: "Deletion requested by sub-admin, queued for Super Admin review.",
    });

    let submitterUser: any = null;
    if (req.session?.userId) {
      try {
        const [u] = await db.select().from(users).where(eq(users.id, req.session.userId));
        submitterUser = u;
      } catch {}
    }

    try {
      await db.insert(productApprovalHistory).values({
        entityType: "category",
        entityId: id,
        entityName: c.name ?? "",
        action: "deletion_requested",
        fromStatus: c.approvalStatus ?? "approved",
        toStatus: "pending_deletion",
        adminUserId: null,
        submittedByUserId: req.session?.userId ?? null,
        note: "Category deletion requested by sub-admin.",
      });
    } catch (err) {
      console.warn("[approval history log error]", err);
    }

    // Formally notify Super Admin via Telegram Security Bot
    sendTelegramApprovalNotification({
      entityType: "category",
      action: "delete",
      entityName: c.name ?? "",
      entityId: id,
      submitterName: submitterUser?.name,
      submitterEmail: submitterUser?.email,
    }).catch((e) => console.warn("[telegram security approval notify err]", e));

    res.json({
      ...updated,
      isPendingApproval: true,
      message: "Category deletion request submitted for Super Admin Approval! 📤",
    });
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
          customerStars: c.customerStars ?? 0,
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

  /** GET /api/settings/public — Fetch public store settings (contact info, delivery rules, return hours) */
  app.get("/api/settings/public", h(async (_req, res) => {
    const all = await storage.settings.all();
    res.json({
      contact_phone: all.contact_phone || "+91 79897 93669",
      contact_email: all.contact_email || "admin@farmfreshfarmer.com",
      contact_address: all.contact_address || "Vijayawada, Andhra Pradesh",
      operating_hours: all.operating_hours || "6:00 AM – 10:00 PM IST",
      return_window_hours: all.return_window_hours || "4",
      free_delivery_min: all.free_delivery_threshold || "499",
      delivery_fee: all.instant_delivery_fee || all.delivery_fee || "30",
      panindia_shipping_base: all.panindia_shipping_base || "60",
      cod_enabled: all.cod_enabled !== "false",
      allow_cod: all.allow_cod !== "false",
      store_name: all.store_name || "FarmFreshFarmer",
      store_city: all.store_city || "Vijayawada",
      shipping_policy_custom_notes: all.shipping_policy_custom_notes || "",
      // Grievance Officer details
      grievance_officer_name: all.grievance_officer_name || "",
      grievance_officer_email: all.grievance_officer_email || "",
      grievance_officer_phone: all.grievance_officer_phone || "",
      grievance_officer_designation: all.grievance_officer_designation || "",
      grievance_officer_address: all.grievance_officer_address || "",
      complaint_ack_hours: all.complaint_ack_hours || "48",
      complaint_resolve_days: all.complaint_resolve_days || "30",
      // Chatbot
      chatbot_enabled: all.chatbot_enabled !== "false",
      chatbot_welcome_message: all.chatbot_welcome_message || "",
      // Creator & Inventor Profile
      creator_name: all.creator_name || "Buddaraju Ganesh Sai Varma (Ganesh Varma)",
      creator_title: all.creator_title || "Creator & Architect of Lakshmi AI | Full-Stack & Data Engineer",
      creator_portfolio: all.creator_portfolio || "https://www.ganeshvarma.in/",
      creator_email: all.creator_email || "gp61080@gmail.com",
    });
  }));

  /** POST /api/admin/smtp/test — Send Test Email to verify SMTP configuration */
  app.post("/api/admin/smtp/test", requireAdmin, h(async (req, res) => {
    const { to } = req.body || {};
    const recipient = to || "admin@farmfreshfarmer.com";

    const { sendRealEmailWithResult, buildOtpEmailHtml } = await import("./services/email");
    const testHtml = buildOtpEmailHtml("999888", "FarmFresh Admin Tester");
    const result = await sendRealEmailWithResult({
      to: recipient,
      subject: "📧 FarmFreshFarmer SMTP Connection Test",
      html: testHtml,
    });

    if (result.success) {
      return res.json({ message: `✨ Test email successfully dispatched to ${recipient}! Check your inbox.` });
    } else {
      return res.status(400).json({ message: `SMTP Failure: ${result.error || "Please check your SMTP host, port, user & password settings."}` });
    }
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

  // Admin security, warehouses, delivery, staff, partner routes
  registerAdminSecurityRoutes(app);
  registerAdminWarehouseRoutes(app);
  registerAdminDeliveryRoutes(app);
  registerStaffRoutes(app);
  try { registerApprovalRoutes(app, storage); } catch (e) { console.error('[approval routes] Failed to register:', e); }
  try { registerChatbotRoutes(app, storage); } catch (e) { console.error('[chatbot routes] Failed to register:', e); }
  try { registerTicketRoutes(app); } catch (e) { console.error('[ticket routes] Failed to register:', e); }
  registerAdminDeliveryPartnerRoutes(app);
  registerDeliveryPartnerPortalRoutes(app);
  registerPerkRoutes(app);
  registerHeroShowcaseRoutes(app);

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

  // Password reset & Admin GST routes
  registerPasswordResetRoutes(app);
  registerAdminContentRoutes(app);
  app.use("/api/admin", gstRouter);

  // Telegram Security Bot webhook endpoint (Super Admin Remote Lockdown & Controls)
  app.post("/api/telegram/security/webhook", h(async (req, res) => {
    const result = await processSecurityTelegramWebhook(req.body);
    return res.json(result);
  }));

  // Legacy / Default Telegram webhook route (mapped to Security Bot)
  app.post("/api/telegram/webhook", h(async (req, res) => {
    const result = await processSecurityTelegramWebhook(req.body);
    return res.json(result);
  }));

  // Telegram Grievance & Customer Support Bot webhook endpoint (Staff / Support)
  app.post("/api/telegram/grievance/webhook", h(async (req, res) => {
    const result = await processGrievanceTelegramWebhook(req.body);
    return res.json(result);
  }));

  app.post("/api/telegram/support/webhook", h(async (req, res) => {
    const result = await processGrievanceTelegramWebhook(req.body);
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
