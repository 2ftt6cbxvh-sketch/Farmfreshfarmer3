import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db";
import { users, customerProfiles, oauthAccounts, otpCodes, securityAuditLogs, orders, carts } from "@shared/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { issueTokenPair, rotateRefreshToken, revokeAllUserTokens } from "../services/token";
import { authRateLimit, otpRateLimit } from "../middleware/rate-limit";
import { ensureReferralCode } from "../engine/referral";

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
  /** POST /api/auth/register */
  app.post("/api/auth/register", authRateLimit, async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.format() });

    const { name, email, password, phone, platform, deviceId } = parsed.data;
    const cleanEmail = email.toLowerCase().trim();

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.error });

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

  /** POST /api/auth/change-password */
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body || {};
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
    let userId: number | undefined = req.session?.userId;
    if (!userId && token) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
        userId = decoded?.userId || decoded?.sub;
      } catch {}
    }
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.password || !(await bcrypt.compare(String(currentPassword || ""), user.password))) {
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
  app.post("/api/auth/login/initiate", authRateLimit, async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const [user] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);

    if (!user) {
      await auditLog("login_failed", { req, action: `Login attempt for non-existent email: ${cleanEmail}` });
      return res.status(404).json({
        message: "No account found with this email. Please sign up first.",
        notFound: true,
      });
    }

    if (user.status === "blocked") {
      return res.status(403).json({ message: "Your account is currently suspended. Please contact support." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await auditLog("login_failed", { userId: user.id, req, action: `Wrong password for email: ${cleanEmail}` });
      return res.status(401).json({ message: "Incorrect password. Please try again or use Forgot Password." });
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
      process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret",
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
        const decoded: any = jwt.verify(loginToken, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret");
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
  app.post("/api/auth/signup/initiate", authRateLimit, async (req: Request, res: Response) => {
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
      return res.status(409).json({
        message: "An account already exists with this email. Please log in instead.",
        exists: true,
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
      process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret",
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
      payload = jwt.verify(signupToken, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret");
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
}
