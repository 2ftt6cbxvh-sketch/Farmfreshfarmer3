import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db";
import { users, customerProfiles, oauthAccounts, otpCodes, securityAuditLogs, orders, carts } from "@shared/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { issueTokenPair, rotateRefreshToken, revokeAllUserTokens } from "../services/token";
import { authRateLimit, otpRateLimit } from "../middleware/rate-limit";
import { ensureReferralCode } from "../engine/referral";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  platform: z.enum(["web", "ios", "android"]).optional(),
  deviceId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  platform: z.enum(["web", "ios", "android"]).optional(),
  deviceId: z.string().optional(),
});

const googleSchema = z.object({
  idToken: z.string(),
  platform: z.enum(["web", "ios", "android"]).optional(),
  deviceId: z.string().optional(),
});

async function auditLog(eventType: string, opts: { userId?: number; req: Request; action?: string }) {
  try {
    await db.insert(securityAuditLogs).values({
      eventType,
      userId: opts.userId,
      ip: opts.req.ip,
      platform: (opts.req as any).jwtUser?.platform || "web",
      userAgent: opts.req.headers["user-agent"],
      actionTaken: opts.action,
    });
  } catch {}
}

export function registerAuthJwtRoutes(app: Express) {
  /** POST /api/auth/register */
  app.post("/api/auth/register", authRateLimit, async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.format() });

    const { name, email, password, phone, platform, deviceId } = parsed.data;
    const cleanEmail = email.toLowerCase().trim();

    const [existing] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existing) return res.status(409).json({ message: "Email is already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const username = cleanEmail.split("@")[0].replace(/[^a-z0-9]/g, "") + "_" + Date.now().toString(36);

    const [user] = await db.insert(users).values({
      name, email: cleanEmail, username, password: hashedPassword, phone: phone || null, role: "customer", status: "active",
    }).returning();

    await db.insert(customerProfiles).values({ userId: user.id });
    await ensureReferralCode(user.id).catch(() => {});

    // Set Express Session
    if (req.session) {
      req.session.userId = user.id;
      req.session.role = user.role;
    }

    const tokens = await issueTokenPair(user.id, user.role, {
      platform: platform || "web", deviceId, ip: req.ip, userAgent: req.headers["user-agent"],
    });

    await auditLog("register_success", { userId: user.id, req, action: `Registration via ${platform || "web"}` });
    return res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone }, ...tokens });
  });

  /** POST /api/auth/login */
  app.post("/api/auth/login", authRateLimit, async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid credentials format" });

    const { email, password, platform, deviceId } = parsed.data;
    const cleanEmail = email.toLowerCase().trim();

    const [user] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (!user) {
      await auditLog("login_failed", { req, action: `Failed login attempt for email: ${cleanEmail}` });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status === "blocked") return res.status(403).json({ message: "Account is suspended." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await auditLog("login_failed", { userId: user.id, req, action: `Wrong password for email: ${cleanEmail}` });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (req.session) {
      req.session.userId = user.id;
      req.session.role = user.role;
    }

    const tokens = await issueTokenPair(user.id, user.role, {
      platform: platform || "web", deviceId, ip: req.ip, userAgent: req.headers["user-agent"],
    });

    await auditLog("login_success", { userId: user.id, req, action: `Login via ${platform || "web"}` });
    return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone }, ...tokens });
  });

  /** POST /api/auth/refresh */
  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ message: "refreshToken required" });
    const newPair = await rotateRefreshToken(refreshToken, { ip: req.ip, userAgent: req.headers["user-agent"] });
    if (!newPair) return res.status(401).json({ message: "Invalid or expired refresh token." });
    return res.json(newPair);
  });

  /** POST /api/auth/logout */
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const { refreshToken } = req.body || {};
    if (refreshToken) await rotateRefreshToken(refreshToken).catch(() => {});
    if (req.session?.userId) req.session.destroy(() => {});
    return res.json({ message: "Logged out" });
  });

  /** POST /api/auth/google */
  app.post("/api/auth/google", authRateLimit, async (req: Request, res: Response) => {
    const parsed = googleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const { idToken, platform, deviceId } = parsed.data;

    try {
      let email = "demo.google@farmfreshfarmer.com";
      let googleName = "Google User";
      let googleUserId = "google_demo_id";

      if (process.env.GOOGLE_CLIENT_ID || true) {
        const { OAuth2Client } = await import("google-auth-library");
        const clientId = process.env.GOOGLE_CLIENT_ID || "983416661519-hd22kfa2kc02hnh5plea83bckfej3o95.apps.googleusercontent.com";
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({ idToken, audience: clientId });
        const payload = ticket.getPayload();
        if (!payload?.email) return res.status(400).json({ message: "Invalid Google ID token" });
        email = payload.email.toLowerCase();
        googleName = payload.name || email.split("@")[0];
        googleUserId = payload.sub;
      }

      let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        const username = email.split("@")[0].replace(/[^a-z0-9]/g, "") + "_" + Date.now().toString(36);
        const [newUser] = await db.insert(users).values({
          name: googleName, email, username, password: "", role: "customer", status: "active",
        }).returning();
        await db.insert(customerProfiles).values({ userId: newUser.id });
        await ensureReferralCode(newUser.id).catch(() => {});
        user = newUser;
      }

      if (user.status === "blocked") return res.status(403).json({ message: "Account is blocked." });

      await db.insert(oauthAccounts).values({ userId: user.id, provider: "google", providerUserId: googleUserId, providerEmail: email }).onConflictDoNothing();

      if (req.session?.userId && req.session.userId !== user.id) {
        await db.update(orders).set({ userId: user.id }).where(eq(orders.userId, req.session.userId)).catch(() => {});
        await db.update(carts).set({ userId: user.id }).where(eq(carts.userId, req.session.userId)).catch(() => {});
      }

      if (req.session) {
        req.session.userId = user.id;
        req.session.role = user.role;
      }

      const tokens = await issueTokenPair(user.id, user.role, { platform: platform || "web", deviceId, ip: req.ip, userAgent: req.headers["user-agent"] });
      await auditLog("google_login", { userId: user.id, req, action: `Google Sign-In via ${platform || "web"}` });
      return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone }, ...tokens });
    } catch (err: any) {
      console.error("[auth/google]", err?.message);
      return res.status(400).json({ message: "Google Sign-In failed. Please try again." });
    }
  });

  /** POST /api/auth/otp/send — Send OTP to Email or Phone */
  app.post("/api/auth/otp/send", otpRateLimit, async (req: Request, res: Response) => {
    const { email, phone } = req.body || {};
    if (!email && !phone) return res.status(400).json({ message: "Provide email or phone to send OTP" });

    const targetEmail = email ? email.toLowerCase().trim() : null;
    let user: typeof users.$inferSelect | undefined;

    if (targetEmail) {
      [user] = await db.select().from(users).where(eq(users.email, targetEmail)).limit(1);
      if (!user) {
        // Auto-create user for new email
        const username = targetEmail.split("@")[0].replace(/[^a-z0-9]/g, "") + "_" + Date.now().toString(36);
        const [newUser] = await db.insert(users).values({
          name: targetEmail.split("@")[0], email: targetEmail, username, password: "", role: "customer", status: "active",
        }).returning();
        await db.insert(customerProfiles).values({ userId: newUser.id });
        await ensureReferralCode(newUser.id).catch(() => {});
        user = newUser;
      }
    }

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.status === "blocked") return res.status(403).json({ message: "Account is suspended." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.insert(otpCodes).values({
      userId: user.id,
      phone: phone || targetEmail || "email",
      codeHash,
      expiresAt,
    });

    if (targetEmail) {
      const { sendRealEmail, buildOtpEmailHtml } = await import("../services/email");
      const html = buildOtpEmailHtml(otp, user.name);
      await sendRealEmail({
        to: targetEmail,
        subject: `🔑 Your Verification OTP Code: ${otp}`,
        html,
      });
    }

    await auditLog("otp_sent", { userId: user.id, req, action: `OTP sent to ${targetEmail || phone}` });
    console.log(`[OTP VERIFICATION CODE] ${targetEmail || phone} -> OTP CODE: ${otp}`);

    return res.json({
      message: `Verification OTP code sent to ${targetEmail || phone}`,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
      expiresIn: 600,
    });
  });

  /** POST /api/auth/otp/verify — Verify OTP & Log In */
  app.post("/api/auth/otp/verify", authRateLimit, async (req: Request, res: Response) => {
    const { email, phone, code, platform, deviceId } = req.body || {};
    if (!code || (!email && !phone)) return res.status(400).json({ message: "Email/Phone and 6-digit OTP code required" });

    const targetEmail = email ? email.toLowerCase().trim() : null;
    const [user] = targetEmail
      ? await db.select().from(users).where(eq(users.email, targetEmail)).limit(1)
      : [];

    if (!user) return res.status(404).json({ message: "User not found" });

    const activeOtps = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.userId, user.id), isNull(otpCodes.verifiedAt), gt(otpCodes.expiresAt, new Date())))
      .limit(10);

    let matchedOtpId: number | null = null;
    for (const row of activeOtps) {
      const isMatch = await bcrypt.compare(code.trim(), row.codeHash);
      if (isMatch) {
        matchedOtpId = row.id;
        break;
      }
    }

    if (!matchedOtpId) {
      await auditLog("otp_failed", { userId: user.id, req, action: `Invalid OTP code provided` });
      return res.status(400).json({ message: "Invalid or expired OTP code. Please try again." });
    }

    await db.update(otpCodes).set({ verifiedAt: new Date() }).where(eq(otpCodes.id, matchedOtpId));

    if (req.session) {
      req.session.userId = user.id;
      req.session.role = user.role;
    }

    const tokens = await issueTokenPair(user.id, user.role, {
      platform: platform || "web", deviceId, ip: req.ip, userAgent: req.headers["user-agent"],
    });

    await auditLog("otp_verified", { userId: user.id, req, action: `Login via Email OTP` });
    return res.json({
      message: "OTP verified successfully!",
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
      ...tokens,
    });
  });
}
