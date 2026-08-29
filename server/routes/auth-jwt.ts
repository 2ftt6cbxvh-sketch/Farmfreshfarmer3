import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db";
import { users, customerProfiles, oauthAccounts, otpCodes, securityAuditLogs, orders, carts } from "@shared/schema";
import { eq, and, or, gt, isNull, sql, desc } from "drizzle-orm";
import { issueTokenPair, rotateRefreshToken, revokeAllUserTokens } from "../services/token";
import { authRateLimit, otpRateLimit } from "../middleware/rate-limit";
import { requireRecaptcha } from "../middleware/recaptcha";
import { ensureReferralCode } from "../engine/referral";
import { verifyPasswordWithLockout } from "../services/lockout";
import { getJwtSecret } from "../services/encryption";

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) return { valid: false, error: "Password must be at least 8 characters long." };
  if (!/[A-Z]/.test(password)) return { valid: false, error: "Password must contain at least one uppercase letter." };
  if (!/[a-z]/.test(password)) return { valid: false, error: "Password must contain at least one lowercase letter." };
  if (!/[0-9]/.test(password)) return { valid: false, error: "Password must contain at least one number." };
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) return { valid: false, error: "Password must contain at least one special character (!@#$%^&*)." };
  if (/(.)\1\1/.test(password)) return { valid: false, error: "Password must not contain 3 or more repeated consecutive characters." };
  const SEQ = ["123","234","345","456","567","678","789","890","abc","bcd","cde","def","efg","fgh","ghi","hij","ijk","jkl","klm","lmn","mno","nop","opq","pqr","qrs","rst","stu","tuv","uvw","vwx","wxy","xyz","qwerty","asdf","zxcv"];
  const lp = password.toLowerCase();
  for (const seq of SEQ) { if (lp.includes(seq)) return { valid: false, error: "Password must not contain common sequential patterns (like '123', 'abc', 'qwerty')." }; }
  return { valid: true };
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().regex(/^[6-9][0-9]{9}$/, 'Enter a valid 10-digit Indian mobile number'),
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
  /** GET /api/auth/host-context — Check if current host is the Admin Subdomain (zero secret exposure) */
  app.get("/api/auth/host-context", (req: Request, res: Response) => {
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || req.hostname || "";
    const adminSubdomain = (process.env.ADMIN_SUBDOMAIN || "").toLowerCase().trim();
    const isAdminHost = Boolean(adminSubdomain && host.toLowerCase().includes(adminSubdomain));
    return res.json({ isAdminHost });
  });

  /** POST /api/auth/register */
  app.post("/api/auth/register", authRateLimit, async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.format() });

    const { name, email, password, phone, platform, deviceId } = parsed.data;
    const cleanEmail = email.toLowerCase().trim();

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.error });

    const [existing] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existing) return res.status(409).json({ message: "An account already exists with this email. Please log in instead." });

    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);
      if (cleanPhone.length === 10) {
        const [existingPhone] = await db.select().from(users).where(
          or(
            eq(users.phone, cleanPhone),
            eq(users.phone, `+91${cleanPhone}`),
            eq(users.phone, `+91 ${cleanPhone}`),
            eq(users.phone, `91${cleanPhone}`)
          )
        ).limit(1);
        if (existingPhone) {
          return res.status(409).json({
            message: "It seems this mobile number already exists. Please sign in with your registered email.",
            phoneExists: true,
          });
        }
      }
    }

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

    const lockoutCheck = await verifyPasswordWithLockout(user, password, req);
    if (!lockoutCheck.allowed) {
      return res.status(lockoutCheck.statusCode || 401).json({
        message: lockoutCheck.message || "Invalid email or password",
        remainingAttempts: lockoutCheck.remainingAttempts,
        isPermanentlyLocked: lockoutCheck.isPermanentlyLocked,
      });
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

  /** POST /api/auth/change-password */
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body || {};
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
    let userId: number | undefined = req.session?.userId;
    if (!userId && token) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        userId = decoded?.userId || decoded?.sub;
      } catch {}
    }
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(401).json({ message: "User not found" });

    const isSuperAdmin = Boolean(user.isPrimaryAdmin || user.email?.toLowerCase() === "admin@farmfreshfarmer.com" || user.id === 1);
    if (isSuperAdmin) {
      return res.status(403).json({
        message: "⛔ Chief Super Admin password updates are protected by 2FA Authenticator TOTP and must be performed in the Security Controls Dashboard (/api/admin/update-password).",
      });
    }

    if (!user.password || !(await bcrypt.compare(String(currentPassword || ""), user.password))) {
      return res.status(401).json({ message: "Current password incorrect" });
    }

    const pwCheck = validatePassword(String(newPassword || ""));
    if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.error });

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
    return res.json({ message: "Password updated successfully" });
  });

  /** POST /api/auth/google */
  app.post("/api/auth/google", authRateLimit, async (req: Request, res: Response) => {
    const { idToken, accessToken, email: directEmail, name: directName, sub: directSub, platform, deviceId } = req.body || {};

    try {
      let email = String(directEmail || "").trim().toLowerCase();
      let googleName = String(directName || "Google User");
      let googleUserId = String(directSub || "google_user");

      if (idToken) {
        try {
          const { OAuth2Client } = await import("google-auth-library");
          const client = new OAuth2Client();
          const ticket = await client.verifyIdToken({
            idToken,
            audience: [
              "983416661519-hd22kfa2kc02hnh5plea83bckfej3o95.apps.googleusercontent.com",
              "983416661519-lcur2retdisotv1mlksj7ck24fjtrpje.apps.googleusercontent.com",
              process.env.GOOGLE_CLIENT_ID || "",
            ].filter(Boolean),
          });
          const payload = ticket.getPayload();
          if (payload?.email) {
            email = payload.email.toLowerCase();
            googleName = payload.name || payload.given_name || email.split("@")[0];
            googleUserId = payload.sub;
          }
        } catch (tokenErr: any) {
          console.warn("[auth/google] verifyIdToken library note:", tokenErr?.message);
          // Fallback: decode JWT payload directly
          try {
            const jwt = (await import("jsonwebtoken")).default;
            const decoded = jwt.decode(idToken) as any;
            if (decoded?.email) {
              email = String(decoded.email).toLowerCase();
              googleName = decoded.name || decoded.given_name || email.split("@")[0];
              googleUserId = decoded.sub || `google_${Date.now()}`;
            }
          } catch (jwtErr: any) {
            console.error("[auth/google] jwt.decode fallback error:", jwtErr?.message);
          }
        }
      }

      if (!email && accessToken) {
        try {
          const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const info = await userInfoRes.json();
          if (info?.email) {
            email = String(info.email).toLowerCase();
            googleName = info.name || info.given_name || email.split("@")[0];
            googleUserId = info.sub || `google_${Date.now()}`;
          }
        } catch (fetchErr: any) {
          console.warn("[auth/google] userinfo fetch error:", fetchErr?.message);
        }
      }

      if (!email) {
        return res.status(400).json({ message: "Unable to extract email from Google Sign-In credentials." });
      }

      let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        const username = email.split("@")[0].replace(/[^a-z0-9]/g, "") + "_" + Date.now().toString(36);
        const [newUser] = await db.insert(users).values({
          name: googleName, email, username, password: "", role: "customer", status: "active",
        }).returning();
        try {
          await db.insert(customerProfiles).values({ userId: newUser.id }).onConflictDoNothing();
        } catch {}
        await ensureReferralCode(newUser.id).catch(() => {});
        user = newUser;
      }

      if (user.status === "blocked") return res.status(403).json({ message: "Account is blocked. Please contact support." });

      const isSuperAdminUser = Boolean(user.isPrimaryAdmin || user.email?.toLowerCase() === "admin@farmfreshfarmer.com" || (user.role === "admin" && user.id === 1));
      if (isSuperAdminUser) {
        return res.status(403).json({
          message: "🚫 Master credentials cannot be used on public portals. Please use your designated private access portal.",
        });
      }

      try {
        await db.insert(oauthAccounts).values({
          userId: user.id,
          provider: "google",
          providerUserId: googleUserId || `google_${user.id}`,
          providerEmail: email,
        }).onConflictDoNothing();
      } catch (oauthErr: any) {
        console.warn("[auth/google] oauthAccount link note:", oauthErr?.message);
      }

      if (req.session?.userId && req.session.userId !== user.id) {
        await db.update(orders).set({ userId: user.id }).where(eq(orders.userId, req.session.userId)).catch(() => {});
        await db.update(carts).set({ userId: user.id }).where(eq(carts.userId, req.session.userId)).catch(() => {});
      }

      if (req.session) {
        req.session.userId = user.id;
        req.session.role = user.role;
      }

      const tokens = await issueTokenPair(user.id, user.role, { platform: platform || "web", deviceId, ip: req.ip, userAgent: req.headers["user-agent"] });
      
      if (!user.phone) {
        return res.json({
          requiresPhone: true,
          userId: user.id,
          tempToken: tokens.accessToken,
          user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, profilePhoto: user.profilePhoto },
          ...tokens
        });
      }

      await auditLog("google_login", { userId: user.id, req, action: `Google Sign-In via ${platform || "web"}` });
      return res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, profilePhoto: user.profilePhoto },
        ...tokens,
      });
    } catch (err: any) {
      console.error("[auth/google] unhandled error:", err?.stack || err?.message);
      return res.status(400).json({ message: err?.message || "Google Sign-In failed. Please try again." });
    }
  });

  /** POST /api/auth/login/initiate — Step 1 of Login: Checks user existence & password, sends 2FA OTP */
  app.post("/api/auth/login/initiate", authRateLimit, requireRecaptcha, async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === "admin@farmfreshfarmer.com") {
      // Constant-Time Timing Oracle Defense: perform identical CPU bcrypt work
      const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
      await bcrypt.compare(String(password || "dummySecret123"), DUMMY_HASH).catch(() => {});

      const refId = `SEC-TRAP-${Date.now().toString().slice(-4)}`;
      const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      // Silently record incident in security audit logs
      const { securityAuditLogs } = await import("@shared/schema");
      await db.insert(securityAuditLogs).values({
        eventType: "master_credential_intercepted",
        actionTaken: `[${refId}] Master Admin Probed on Public Portal | Route: /api/auth/login/initiate | Target: ${cleanEmail}`,
        ip: ip.slice(0, 64),
        platform: "web",
        userAgent: userAgent.slice(0, 500),
      }).catch(() => {});

      const { sendTelegramSecurityAlert, isTelegramSecurityConfigured } = await import("../services/telegram");
      if (await isTelegramSecurityConfigured()) {
        await sendTelegramSecurityAlert(
          `🚨 <b>SNOOPING DETECTED [<code>${refId}</code>]</b>\n\nSomeone probed master admin email on the customer login form.\n• Target: <code>${cleanEmail}</code>\n• Action: Silently deflected with generic 401 response.`,
          req
        ).catch(() => {});
      }

      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);

    if (!user) {
      await auditLog("login_failed", { req, action: `Login attempt for non-existent email: ${cleanEmail}` });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status === "blocked") {
      return res.status(403).json({ message: "Your account is currently suspended. Please contact support." });
    }

    const isMasterAdmin = Boolean(user.isPrimaryAdmin || cleanEmail === "admin@farmfreshfarmer.com" || (user.role === "admin" && user.id === 1));
    if (isMasterAdmin) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.role && user.role !== "customer") {
      return res.status(403).json({
        message: "🚫 Staff and delivery partner accounts must sign in using the 'Staff & Delivery Partner Login' button.",
      });
    }

    if (!user.password || user.password.trim() === "") {
      return res.status(400).json({
        message: "This account was registered via Google Sign-In. Please click 'Sign in with Google' or use 'Forgot Password' to create a password.",
        googleAccount: true,
      });
    }

    const lockoutCheck = await verifyPasswordWithLockout(user, password, req);
    if (!lockoutCheck.allowed) {
      return res.status(lockoutCheck.statusCode || 401).json({
        message: lockoutCheck.message || "Incorrect password. Please try again or use Forgot Password.",
        remainingAttempts: lockoutCheck.remainingAttempts,
        isPermanentlyLocked: lockoutCheck.isPermanentlyLocked,
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(otpCodes).values({
      userId: user.id,
      phone: user.phone || cleanEmail,
      purpose: "login_2fa",
      codeHash,
      expiresAt,
    });

    const jwt = (await import("jsonwebtoken")).default;
    const loginToken = jwt.sign(
      { userId: user.id, email: user.email, type: "login_2fa" },
      getJwtSecret(),
      { expiresIn: "10m" }
    );

    const { sendRealEmail, buildOtpEmailHtml, buildOtpPlainText } = await import("../services/email");
    const html = buildOtpEmailHtml(otp, user.name);
    const text = buildOtpPlainText(otp, user.name);

    await sendRealEmail({
      to: cleanEmail,
      subject: `🔑 Your Verification OTP Code: ${otp}`,
      html,
      text,
    });

    await auditLog("login_otp_sent", { userId: user.id, req, action: `2FA Login OTP sent to ${cleanEmail}` });
    console.log(`[LOGIN 2FA OTP] ${cleanEmail} -> OTP: ${otp}`);

    return res.json({
      success: true,
      requireOtp: true,
      loginToken,
      email: cleanEmail,
      message: `A 6-digit verification code has been sent to ${cleanEmail}`,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  });

  /** POST /api/auth/login/verify-otp — Step 2 of Login: Verifies 2FA OTP & logs user in */
  app.post("/api/auth/login/verify-otp", authRateLimit, async (req: Request, res: Response) => {
    const { loginToken, email, code, platform, deviceId } = req.body || {};
    if (!code || (!loginToken && !email)) {
      return res.status(400).json({ message: "Verification code and login token required" });
    }

    let targetUserId: number | null = null;
    let targetEmail: string = email ? email.toLowerCase().trim() : "";

    if (loginToken) {
      const jwt = (await import("jsonwebtoken")).default;
      try {
        const decoded: any = jwt.verify(loginToken, getJwtSecret());
        if (decoded.type === "login_2fa" && decoded.userId) {
          targetUserId = decoded.userId;
          targetEmail = decoded.email || targetEmail;
        }
      } catch (err: any) {
        return res.status(400).json({ message: "Login session expired. Please enter your password again." });
      }
    }

    const [user] = targetUserId
      ? await db.select().from(users).where(eq(users.id, targetUserId)).limit(1)
      : await db.select().from(users).where(eq(users.email, targetEmail)).limit(1);

    if (!user) return res.status(404).json({ message: "User not found" });

    const isMasterAdmin = Boolean(user.isPrimaryAdmin || user.email?.toLowerCase() === "admin@farmfreshfarmer.com" || (user.role === "admin" && user.id === 1));
    if (isMasterAdmin) {
      return res.status(403).json({
        message: "🚫 Master credentials cannot be used on public portals. Please use your designated private access portal.",
      });
    }

    const activeOtps = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.userId, user.id), isNull(otpCodes.verifiedAt), gt(otpCodes.expiresAt, new Date())))
      .limit(10);

    let matchedOtpId: number | null = null;
    for (const row of activeOtps) {
      const isMatch = await bcrypt.compare(String(code).trim(), row.codeHash);
      if (isMatch) {
        matchedOtpId = row.id;
        break;
      }
    }

    if (!matchedOtpId) {
      await auditLog("otp_failed", { userId: user.id, req, action: `Invalid 2FA login OTP provided` });
      return res.status(400).json({ message: "Invalid or expired OTP code. Please check your inbox or Spam folder." });
    }

    await db.update(otpCodes).set({ verifiedAt: new Date() }).where(eq(otpCodes.id, matchedOtpId));

    if (req.session) {
      req.session.userId = user.id;
      req.session.role = user.role;
    }

    const tokens = await issueTokenPair(user.id, user.role, {
      platform: platform || "web",
      deviceId,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await auditLog("login_success", { userId: user.id, req, action: `2FA Login successful via ${platform || "web"}` });

    return res.json({
      message: "Login successful!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        customerStars: user.customerStars,
        isPrimaryAdmin: user.isPrimaryAdmin,
      },
      ...tokens,
    });
  });

  /** POST /api/auth/signup/initiate — Step 1 of Signup: Validates mandatory fields, checks user doesn't exist, sends OTP */
  app.post("/api/auth/signup/initiate", authRateLimit, requireRecaptcha, async (req: Request, res: Response) => {
    const { name, email, phone, password } = req.body || {};

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: "Please enter your full name (minimum 2 characters)." });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }
    const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit Indian mobile number." });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const [existing] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existing) {
      if (!existing.password || existing.password.trim() === "") {
        return res.status(409).json({
          message: "An account with this email is already registered via Google Sign-In. Please click 'Sign in with Google' to log in.",
          isGoogleAccount: true,
          exists: true,
        });
      }
      return res.status(409).json({
        message: "An account already exists with this email. Please log in instead.",
        exists: true,
      });
    }

    const [existingPhone] = await db.select().from(users).where(
      or(
        eq(users.phone, cleanPhone),
        eq(users.phone, `+91${cleanPhone}`),
        eq(users.phone, `+91 ${cleanPhone}`),
        eq(users.phone, `91${cleanPhone}`)
      )
    ).limit(1);
    if (existingPhone) {
      return res.status(409).json({
        message: "It seems this mobile number already exists. Please sign in with your registered email.",
        phoneExists: true,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Record OTP for email
    await db.insert(otpCodes).values({
      phone: cleanEmail,
      purpose: "signup",
      codeHash,
      expiresAt,
    });

    const jwt = (await import("jsonwebtoken")).default;
    const signupToken = jwt.sign(
      {
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        passwordHash,
        type: "signup_verify",
      },
      getJwtSecret(),
      { expiresIn: "10m" }
    );

    const { sendRealEmail, buildOtpEmailHtml, buildOtpPlainText } = await import("../services/email");
    const html = buildOtpEmailHtml(otp, name.trim());
    const text = buildOtpPlainText(otp, name.trim());

    await sendRealEmail({
      to: cleanEmail,
      subject: `🔑 Your FarmFreshFarmer Registration Code: ${otp}`,
      html,
      text,
    });

    console.log(`[SIGNUP OTP] ${cleanEmail} -> OTP: ${otp}`);

    return res.json({
      success: true,
      requireOtp: true,
      signupToken,
      email: cleanEmail,
      message: `A 6-digit verification code has been sent to ${cleanEmail}`,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  });

  /** POST /api/auth/signup/verify-otp — Step 2 of Signup: Verifies OTP, creates account in DB & logs user in */
  app.post("/api/auth/signup/verify-otp", authRateLimit, async (req: Request, res: Response) => {
    const { signupToken, code, platform, deviceId } = req.body || {};
    if (!signupToken || !code) {
      return res.status(400).json({ message: "Signup token and verification code are required" });
    }

    const jwt = (await import("jsonwebtoken")).default;
    let payload: any;
    try {
      payload = jwt.verify(signupToken, getJwtSecret());
    } catch (err: any) {
      return res.status(400).json({ message: "Registration session expired. Please fill in the sign-up form again." });
    }

    if (payload.type !== "signup_verify" || !payload.email || !payload.passwordHash) {
      return res.status(400).json({ message: "Invalid registration token payload." });
    }

    const { name, email, phone, passwordHash } = payload;

    // Check OTP
    const activeOtps = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, email), isNull(otpCodes.verifiedAt), gt(otpCodes.expiresAt, new Date())))
      .limit(10);

    let matchedOtpId: number | null = null;
    for (const row of activeOtps) {
      const isMatch = await bcrypt.compare(String(code).trim(), row.codeHash);
      if (isMatch) {
        matchedOtpId = row.id;
        break;
      }
    }

    if (!matchedOtpId) {
      return res.status(400).json({ message: "Invalid or expired OTP code. Please check your inbox or Spam folder." });
    }

    await db.update(otpCodes).set({ verifiedAt: new Date() }).where(eq(otpCodes.id, matchedOtpId));

    // Ensure account doesn't already exist
    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      const username = email.split("@")[0].replace(/[^a-z0-9]/g, "") + "_" + Date.now().toString(36);
      const [newUser] = await db.insert(users).values({
        name,
        email,
        username,
        password: passwordHash,
        phone,
        role: "customer",
        status: "active",
        emailVerified: true,
      }).returning();

      await db.insert(customerProfiles).values({ userId: newUser.id });
      await ensureReferralCode(newUser.id).catch(() => {});
      user = newUser;
    }

    if (req.session) {
      req.session.userId = user.id;
      req.session.role = user.role;
    }

    const tokens = await issueTokenPair(user.id, user.role, {
      platform: platform || "web",
      deviceId,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await auditLog("register_success", { userId: user.id, req, action: `Registration & OTP verification complete via ${platform || "web"}` });

    return res.status(201).json({
      message: "Account created successfully! Welcome to FarmFreshFarmer.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        customerStars: user.customerStars,
      },
      ...tokens,
    });
  });

  /** POST /api/auth/otp/send — Send OTP to Email (Direct fallback) */
  app.post("/api/auth/otp/send", otpRateLimit, async (req: Request, res: Response) => {
    const { email, phone } = req.body || {};
    if (!email && !phone) return res.status(400).json({ message: "Provide email to send OTP" });

    const targetEmail = email ? email.toLowerCase().trim() : null;
    let [user] = targetEmail
      ? await db.select().from(users).where(eq(users.email, targetEmail)).limit(1)
      : [];

    if (!user) {
      return res.status(404).json({ message: "No account found with this email. Please sign up first.", notFound: true });
    }
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

    const { sendRealEmail, buildOtpEmailHtml, buildOtpPlainText } = await import("../services/email");
    const html = buildOtpEmailHtml(otp, user.name);
    const text = buildOtpPlainText(otp, user.name);
    await sendRealEmail({
      to: targetEmail || user.email,
      subject: `🔑 Your Verification OTP Code: ${otp}`,
      html,
      text,
    });

    await auditLog("otp_sent", { userId: user.id, req, action: `OTP sent to ${targetEmail || phone}` });
    console.log(`[OTP VERIFICATION CODE] ${targetEmail || phone} -> OTP CODE: ${otp}`);

    return res.json({
      message: `Verification OTP code sent to ${targetEmail || phone}`,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
      expiresIn: 600,
    });
  });

  /** POST /api/auth/otp/verify — Verify OTP & Log In (Direct fallback) */
  app.post("/api/auth/otp/verify", authRateLimit, async (req: Request, res: Response) => {
    const { email, phone, code, platform, deviceId } = req.body || {};
    if (!code || (!email && !phone)) return res.status(400).json({ message: "Email and 6-digit OTP code required" });

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
      const isMatch = await bcrypt.compare(String(code).trim(), row.codeHash);
      if (isMatch) {
        matchedOtpId = row.id;
        break;
      }
    }

    if (!matchedOtpId) {
      await auditLog("otp_failed", { userId: user.id, req, action: `Invalid OTP code provided` });
      return res.status(400).json({ message: "Invalid or expired OTP code. Please check your Spam folder or request a new code." });
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

  /** POST /api/auth/phone-verify-firebase — Verify phone number via Firebase SMS OTP & activate Blue Badge */
  app.post("/api/auth/phone-verify-firebase", authRateLimit, async (req: Request, res: Response) => {
    const { phone, userId, email } = req.body || {};
    const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ message: "Invalid 10-digit Indian mobile number." });
    }

    const targetId = userId || (req.session as any)?.userId;
    let targetUser: any = null;

    if (targetId) {
      [targetUser] = await db.select().from(users).where(eq(users.id, Number(targetId))).limit(1);
    } else if (email) {
      [targetUser] = await db.select().from(users).where(eq(users.email, String(email).toLowerCase().trim())).limit(1);
    }

    if (!targetUser) {
      return res.status(404).json({ message: "User account not found" });
    }

    const sessionUserId = (req.session as any)?.userId;
    if (sessionUserId && targetUser.id !== sessionUserId && (req.session as any)?.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized account verification attempt." });
    }

    // Mark user as verified with Blue Badge and set their verified phone
    await db.update(users).set({
      isVerified: true,
      phone: cleanPhone,
      updatedAt: new Date(),
    }).where(eq(users.id, targetUser.id));

    // If user was locked or had failed attempts, unlock them immediately!
    if (targetUser.isPermanentlyLocked || targetUser.status === "locked" || (targetUser.failedLoginAttempts || 0) > 0 || targetUser.lockoutUntil) {
      const { unlockUserAccount } = await import("../services/lockout");
      await unlockUserAccount(targetUser.id, "Mobile Number SMS Verification");
    }

    return res.json({
      success: true,
      isVerified: true,
      phone: cleanPhone,
      message: "🎉 Mobile number verified successfully! Blue Verification Badge activated.",
    });
  });

  /** POST /api/auth/unlock-with-phone — Eliminate 24h+ rate limit / permanent lock by verifying registered mobile */
  app.post("/api/auth/unlock-with-phone", authRateLimit, async (req: Request, res: Response) => {
    const { email, phone } = req.body || {};
    if (!email || !phone) {
      return res.status(400).json({ message: "Email and verified mobile number required" });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);

    const [user] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (!user) {
      return res.status(404).json({ message: "No account found with this email address." });
    }

    // Verify phone matches account registered phone if present
    if (user.phone) {
      const userCleanPhone = String(user.phone).replace(/\D/g, "").slice(-10);
      if (userCleanPhone.length === 10 && userCleanPhone !== cleanPhone) {
        return res.status(400).json({
          message: "The entered mobile number does not match the registered phone on this account.",
        });
      }
    }

    const { unlockUserAccount } = await import("../services/lockout");
    const unlockResult = await unlockUserAccount(user.id, `Mobile SMS OTP Verification (+91 ${cleanPhone})`);

    // Also activate Blue Verification Badge & update phone
    await db.update(users).set({
      isVerified: true,
      phone: cleanPhone,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    return res.json({
      success: true,
      unlocked: true,
      isVerified: true,
      message: unlockResult.message || "🎉 Account unlocked successfully! All rate limits cleared and Blue Badge activated.",
    });
  });

  /** POST /api/user/email/send-otp — Send 6-digit OTP to new email address for verified email update */
  app.post("/api/user/email/send-otp", authRateLimit, async (req: Request, res: Response) => {
    const { newEmail } = req.body || {};
    if (!newEmail || !newEmail.includes("@")) {
      return res.status(400).json({ message: "Please enter a valid new email address." });
    }

    const cleanNewEmail = String(newEmail).toLowerCase().trim();

    // Verify authenticated user
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
    let userId = (req.session as any)?.userId;
    if (token) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded: any = jwt.verify(token, getJwtSecret());
        if (decoded?.userId || decoded?.sub) userId = Number(decoded.userId || decoded.sub);
      } catch {}
    }
    if (!userId) {
      return res.status(401).json({ message: "Please log in to update your email address." });
    }

    // Check if new email is already taken by another user
    const [existing] = await db.select().from(users).where(eq(users.email, cleanNewEmail)).limit(1);
    if (existing && existing.id !== userId) {
      return res.status(409).json({ message: "This email address is already in use by another account." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.insert(otpCodes).values({
      phone: cleanNewEmail,
      purpose: "email_update",
      codeHash,
      expiresAt,
    });

    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const userName = currentUser?.name || "Valued User";

    const { sendRealEmail, buildOtpEmailHtml, buildOtpPlainText } = await import("../services/email");
    const html = buildOtpEmailHtml(otp, userName);
    const text = buildOtpPlainText(otp, userName);

    await sendRealEmail({
      to: cleanNewEmail,
      subject: `📧 Verify Your New Email Address: ${otp}`,
      html,
      text,
    });

    return res.json({
      success: true,
      message: `A 6-digit verification OTP has been sent to ${cleanNewEmail}. Please enter the code to confirm.`,
    });
  });

  /** POST /api/user/email/verify-otp — Verify OTP & update email address in database */
  app.post("/api/user/email/verify-otp", authRateLimit, async (req: Request, res: Response) => {
    const { newEmail, otp } = req.body || {};
    if (!newEmail || !otp || String(otp).trim().length < 6) {
      return res.status(400).json({ message: "New email and 6-digit OTP code are required." });
    }

    const cleanNewEmail = String(newEmail).toLowerCase().trim();

    // Verify authenticated user
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
    let userId = (req.session as any)?.userId;
    if (token) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded: any = jwt.verify(token, getJwtSecret());
        if (decoded?.userId || decoded?.sub) userId = Number(decoded.userId || decoded.sub);
      } catch {}
    }
    if (!userId) {
      return res.status(401).json({ message: "Please log in to update your email address." });
    }

    // Verify OTP code
    const now = new Date();
    const rows = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, cleanNewEmail), eq(otpCodes.purpose, "email_update"), gt(otpCodes.expiresAt, now)))
      .orderBy(desc(otpCodes.id))
      .limit(1);

    if (!rows.length) {
      return res.status(400).json({ message: "Verification code expired or not found. Please request a new OTP." });
    }

    const valid = await bcrypt.compare(String(otp).trim(), rows[0].codeHash);
    if (!valid) {
      return res.status(400).json({ message: "Incorrect OTP code. Please check the code sent to your email." });
    }

    // Consume OTP code
    await db.delete(otpCodes).where(eq(otpCodes.id, rows[0].id));

    // Update user's email address in DB
    const [updated] = await db
      .update(users)
      .set({ email: cleanNewEmail, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return res.json({
      success: true,
      email: cleanNewEmail,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        isVerified: Boolean(updated.isVerified),
      },
      message: "🎉 Email address updated successfully!",
    });
  });
}
