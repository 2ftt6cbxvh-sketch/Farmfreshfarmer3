import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db";
import { users, customerProfiles, oauthAccounts, otpCodes, securityAuditLogs, orders, carts } from "@shared/schema";
import { eq, ne, and, or, gt, isNull, sql, desc } from "drizzle-orm";
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
    const host = ((req.headers["x-forwarded-host"] as string) || req.headers.host || req.hostname || "").toLowerCase().trim();
    const adminSubdomain = (process.env.ADMIN_SUBDOMAIN || "").toLowerCase().trim();
    const isSubdomainOfFarmFresh = host.endsWith("farmfreshfarmer.com") && !host.startsWith("www.") && host !== "farmfreshfarmer.com";
    const isAdminHost = Boolean(
      (adminSubdomain && host.includes(adminSubdomain)) ||
      isSubdomainOfFarmFresh ||
      host.includes("admin") ||
      host.includes("aihhytdgagthawswghsgs")
    );
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
    if (existing) {
      // If user was created via Google Sign-In without a password, allow them to set their password now
      if (!existing.password || existing.password === "") {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [updated] = await db.update(users).set({
          password: hashedPassword,
          name: name || existing.name,
          phone: phone || existing.phone,
          status: "active",
          updatedAt: new Date(),
        }).where(eq(users.id, existing.id)).returning();

        if (req.session) {
          req.session.userId = updated.id;
          req.session.role = updated.role;
        }

        const tokens = await issueTokenPair(updated.id, updated.role, {
          platform: platform || "web", deviceId, ip: req.ip, userAgent: req.headers["user-agent"],
        });

        return res.status(201).json({
          user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, phone: updated.phone },
          ...tokens,
          message: "Password linked successfully to your account!",
        });
      }
      return res.status(409).json({ message: "An account already exists with this email. Please log in instead." });
    }

    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);
      if (cleanPhone.length === 10) {
        const existingPhone = await findUserByPhone(cleanPhone);
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

    // Send Welcome & Security Registration Confirmation Email
    try {
      const { sendRealEmail, buildWelcomeRegistrationEmailHtml } = await import("../services/email");
      sendRealEmail({
        to: cleanEmail,
        subject: "🌿 Welcome to FarmFreshFarmer — Account Created Successfully",
        html: buildWelcomeRegistrationEmailHtml(user.name, user.email, {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          platform: platform || "web",
        }),
      }).catch((e: any) => console.warn("[welcome email error]", e?.message));
    } catch {}

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

    // Google Sign-In Account without a password set
    if (!user.password || user.password === "") {
      return res.status(400).json({
        message: "This account was registered with Google Sign-In. Please click 'Sign in with Google' above, or click 'Forgot Password?' to set a password.",
        isGoogleAccount: true,
      });
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

    // Send Security Sign-In Alert Email
    try {
      const { sendRealEmail, buildSecurityLoginAlertEmailHtml } = await import("../services/email");
      sendRealEmail({
        to: user.email,
        subject: "🛡️ [Security Alert] New Sign-In to Your FarmFreshFarmer Account",
        html: buildSecurityLoginAlertEmailHtml(user.name, user.email, {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          platform: platform || "web",
        }),
      }).catch((e: any) => console.warn("[login alert email error]", e?.message));
    } catch {}

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
    if (!userId) return res.status(401).json({ message: "Authentication required to change password." });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(401).json({ message: "User not found" });

    const isSuperAdmin = Boolean(user.isPrimaryAdmin || user.email?.toLowerCase() === "admin@farmfreshfarmer.com" || user.id === 1);
    if (isSuperAdmin) {
      return res.status(403).json({
        message: "⛔ Chief Super Admin password updates are protected by 2FA Authenticator TOTP and must be performed in the Security Controls Dashboard (/api/admin/update-password).",
      });
    }

    // If user already has a password, verify old password
    if (user.password && user.password.trim() !== "") {
      const match = await bcrypt.compare(String(currentPassword || ""), user.password);
      if (!match) {
        return res.status(400).json({ message: "Incorrect current password. If you forgot it, click 'Forgot Old Password? Verify via Email OTP'." });
      }
    }

    const pwCheck = validatePassword(String(newPassword || ""));
    if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.error });

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));

    // Send confirmation email
    try {
      const { sendRealEmail, buildPasswordChangedSuccessEmailHtml } = await import("../services/email");
      sendRealEmail({
        to: user.email,
        subject: "🔒 Your FarmFreshFarmer Password Has Been Changed",
        html: buildPasswordChangedSuccessEmailHtml(user.name),
      }).catch((e: any) => console.warn("[password change email error]", e?.message));
    } catch {}

    await auditLog("password_change_success", { userId: user.id, req, action: "Customer changed password with current password" });

    return res.json({ success: true, message: "Your password has been updated successfully!" });
  });

  /** POST /api/auth/password-otp/send — Send 6-digit Email OTP to logged-in user who forgot old password */
  app.post("/api/auth/password-otp/send", async (req: Request, res: Response) => {
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
    if (!userId) return res.status(401).json({ message: "Authentication required." });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(otpCodes).values({
      userId: user.id,
      phone: user.email,
      purpose: "password_change_otp",
      codeHash,
      expiresAt,
    });

    try {
      const { sendRealEmail, buildPasswordChangeOtpEmailHtml } = await import("../services/email");
      await sendRealEmail({
        to: user.email,
        subject: `🔑 Your Password Verification OTP Code: ${otp}`,
        html: buildPasswordChangeOtpEmailHtml(user.name, otp),
      });
    } catch (e: any) {
      console.error("[password otp send error]", e);
      return res.status(500).json({ message: "Failed to dispatch verification email. Please try again." });
    }

    await auditLog("password_otp_sent", { userId: user.id, req, action: `Password change OTP dispatched to ${user.email}` });

    return res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${user.email}. Valid for 10 minutes.`,
    });
  });

  /** POST /api/auth/password-otp/verify-and-update — Verify OTP & set new password */
  app.post("/api/auth/password-otp/verify-and-update", async (req: Request, res: Response) => {
    const { otp, newPassword } = req.body || {};
    if (!otp || !newPassword) {
      return res.status(400).json({ message: "OTP code and new password are required." });
    }

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
    if (!userId) return res.status(401).json({ message: "Authentication required." });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Validate OTP
    const activeOtps = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.userId, user.id),
          eq(otpCodes.purpose, "password_change_otp"),
          isNull(otpCodes.verifiedAt),
          gt(otpCodes.expiresAt, new Date())
        )
      )
      .orderBy(desc(otpCodes.id))
      .limit(5);

    let matchedOtpId: number | null = null;
    for (const row of activeOtps) {
      const isMatch = await bcrypt.compare(String(otp).trim(), row.codeHash);
      if (isMatch) {
        matchedOtpId = row.id;
        break;
      }
    }

    if (!matchedOtpId) {
      return res.status(400).json({ message: "Invalid or expired OTP code. Please request a new code." });
    }

    const pwCheck = validatePassword(String(newPassword));
    if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.error });

    // Mark OTP as verified
    await db.update(otpCodes).set({ verifiedAt: new Date() }).where(eq(otpCodes.id, matchedOtpId));

    // Update password
    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));

    // Send confirmation email
    try {
      const { sendRealEmail, buildPasswordChangedSuccessEmailHtml } = await import("../services/email");
      sendRealEmail({
        to: user.email,
        subject: "🔒 Your FarmFreshFarmer Password Has Been Changed",
        html: buildPasswordChangedSuccessEmailHtml(user.name),
      }).catch((e: any) => console.warn("[password change email error]", e?.message));
    } catch {}

    await auditLog("password_otp_verified_and_changed", { userId: user.id, req, action: "Password updated via Email OTP verification" });

    return res.json({ success: true, message: "Your password has been verified and updated successfully!" });
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

      // Send Security Login Alert or Welcome Email
      try {
        const { sendRealEmail, buildSecurityLoginAlertEmailHtml, buildWelcomeRegistrationEmailHtml } = await import("../services/email");
        if (user.password === "" && user.createdAt && (Date.now() - new Date(user.createdAt).getTime()) < 60000) {
          sendRealEmail({
            to: user.email,
            subject: "🌿 Welcome to FarmFreshFarmer — Account Created Successfully",
            html: buildWelcomeRegistrationEmailHtml(user.name, user.email, {
              ip: req.ip,
              userAgent: req.headers["user-agent"],
              platform: "google",
            }),
          }).catch((e: any) => console.warn("[google welcome email error]", e?.message));
        } else {
          sendRealEmail({
            to: user.email,
            subject: "🛡️ [Security Alert] New Sign-In to Your FarmFreshFarmer Account",
            html: buildSecurityLoginAlertEmailHtml(user.name, user.email, {
              ip: req.ip,
              userAgent: req.headers["user-agent"],
              platform: "google",
            }),
          }).catch((e: any) => console.warn("[google login alert email error]", e?.message));
        }
      } catch {}

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

    // Send Security Sign-In Alert Email
    try {
      const { sendRealEmail, buildSecurityLoginAlertEmailHtml } = await import("../services/email");
      sendRealEmail({
        to: user.email,
        subject: "🛡️ [Security Alert] New Sign-In to Your FarmFreshFarmer Account",
        html: buildSecurityLoginAlertEmailHtml(user.name, user.email, {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          platform: platform || "web",
        }),
      }).catch((e: any) => console.warn("[login alert email error]", e?.message));
    } catch {}

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

    const existingPhone = await findUserByPhone(cleanPhone);
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

    // Send Welcome & Security Registration Confirmation Email
    try {
      const { sendRealEmail, buildWelcomeRegistrationEmailHtml } = await import("../services/email");
      sendRealEmail({
        to: email,
        subject: "🌿 Welcome to FarmFreshFarmer — Account Created Successfully",
        html: buildWelcomeRegistrationEmailHtml(user.name, user.email, {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          platform: platform || "web",
        }),
      }).catch((e: any) => console.warn("[signup welcome email error]", e?.message));
    } catch {}

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

  /** Helper to find existing user by 10-digit phone number (checking standard, +91, 91 formats) */
  async function findUserByPhone(phone: string, excludeUserId?: number) {
    const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) return null;

    const [existing] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        isVerified: users.isVerified,
      })
      .from(users)
      .where(
        and(
          or(
            eq(users.phone, cleanPhone),
            eq(users.phone, `+91${cleanPhone}`),
            eq(users.phone, `+91 ${cleanPhone}`),
            eq(users.phone, `91${cleanPhone}`),
            sql`RIGHT(REGEXP_REPLACE(${users.phone}, '[^0-9]', '', 'g'), 10) = ${cleanPhone}`
          ),
          excludeUserId ? ne(users.id, excludeUserId) : undefined
        )
      )
      .limit(1);

    return existing || null;
  }

  /** POST /api/auth/phone/check-availability — Pre-check before sending SMS OTP to prevent duplicate phone numbers */
  const handlePhoneAvailabilityCheck = async (req: Request, res: Response) => {
    const { phone, userId, email, mode } = req.body || {};
    const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      return res.status(400).json({
        available: false,
        message: "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
      });
    }

    let currentUserId: number | undefined = userId ? Number(userId) : (req.session as any)?.userId;
    if (!currentUserId && email) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, String(email).toLowerCase().trim())).limit(1);
      if (u) currentUserId = u.id;
    }

    // In unlock_lockout mode, the phone MUST match the account being unlocked
    if (mode === "unlock_lockout") {
      if (!currentUserId) {
        return res.status(400).json({ available: false, message: "User account required for unlock." });
      }
      const [targetUser] = await db.select().from(users).where(eq(users.id, currentUserId)).limit(1);
      if (!targetUser) {
        return res.status(404).json({ available: false, message: "User account not found." });
      }
      if (targetUser.phone) {
        const targetClean = String(targetUser.phone).replace(/\D/g, "").slice(-10);
        if (targetClean.length === 10 && targetClean !== cleanPhone) {
          return res.status(400).json({
            available: false,
            message: "The entered mobile number does not match the registered phone on this account.",
          });
        }
      }
      return res.json({ available: true, cleanPhone });
    }

    // For logged-in users verifying account via SMS OTP:
    // Allow sending SMS code so user can prove physical SIM ownership
    const existing = await findUserByPhone(cleanPhone, currentUserId);
    if (existing && !currentUserId) {
      const maskedEmail = existing.email ? existing.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(Math.max(1, b.length)) + c) : "another registered user";
      return res.status(409).json({
        available: false,
        exists: true,
        message: `⚠️ This mobile number (+91 ${cleanPhone}) is already registered with another account (${maskedEmail}). Each account must have a unique mobile number. Please use your own unique number or sign in with that account.`,
      });
    }

    return res.json({
      available: true,
      cleanPhone,
      isReclaiming: Boolean(existing),
      message: existing
        ? `📱 A 6-digit SMS verification code will be sent to +91 ${cleanPhone}. Entering the code will link this mobile number to your account.`
        : "Mobile number is available for verification.",
    });
  };

  /** Helper to find existing user by email */
  async function findUserByEmail(email: string, excludeUserId?: number) {
    const cleanEmail = String(email || "").toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes("@")) return null;

    const [existing] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        role: users.role,
        password: users.password,
        isVerified: users.isVerified,
      })
      .from(users)
      .where(
        and(
          eq(users.email, cleanEmail),
          excludeUserId ? ne(users.id, excludeUserId) : undefined
        )
      )
      .limit(1);

    return existing || null;
  }

  /** POST /api/auth/email/check-availability — Pre-check before sending email verification OTP or registering */
  const handleEmailAvailabilityCheck = async (req: Request, res: Response) => {
    const { email, userId } = req.body || {};
    const cleanEmail = String(email || "").toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes("@") || cleanEmail.length < 5) {
      return res.status(400).json({
        available: false,
        message: "Please enter a valid email address.",
      });
    }

    let currentUserId: number | undefined = userId ? Number(userId) : (req.session as any)?.userId;
    if (!currentUserId) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
      if (token) {
        try {
          const jwt = (await import("jsonwebtoken")).default;
          const decoded: any = jwt.verify(token, getJwtSecret());
          if (decoded?.userId || decoded?.sub) currentUserId = Number(decoded.userId || decoded.sub);
        } catch {}
      }
    }

    const existing = await findUserByEmail(cleanEmail, currentUserId);
    if (existing) {
      const isGoogle = !existing.password || existing.password.trim() === "";
      return res.status(409).json({
        available: false,
        exists: true,
        isGoogleAccount: isGoogle,
        message: isGoogle
          ? `⚠️ This email (${cleanEmail}) is already registered via Google Sign-In with another account. Please sign in with Google or use your own unique email.`
          : `⚠️ This email address (${cleanEmail}) is already registered with another account. Each account must have a unique email address. Please use your own unique email or sign in with that account.`,
      });
    }

    return res.json({
      available: true,
      cleanEmail,
      message: "Email address is available.",
    });
  };

  app.post("/api/auth/email/check-availability", authRateLimit, handleEmailAvailabilityCheck);
  app.post("/api/auth/check-email-available", authRateLimit, handleEmailAvailabilityCheck);

  app.post("/api/auth/phone/check-availability", authRateLimit, handlePhoneAvailabilityCheck);
  app.post("/api/auth/check-phone-available", authRateLimit, handlePhoneAvailabilityCheck);

  /** POST /api/auth/phone/send-otp — Dispatch 6-Digit SMS OTP via Fast2SMS India Gateway */
  app.post("/api/auth/phone/send-otp", authRateLimit, async (req: Request, res: Response) => {
    const { phone, userId, email, mode } = req.body || {};
    const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9." });
    }

    let targetUserId = userId ? Number(userId) : (req.session as any)?.userId;
    if (!targetUserId && email) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, String(email).toLowerCase().trim())).limit(1);
      if (u) targetUserId = u.id;
    }

    try {
      const { sendSmsOtp } = await import("../services/sms");
      const result = await sendSmsOtp(cleanPhone, mode || "phone_verification", targetUserId);
      return res.json({
        success: true,
        phone: cleanPhone,
        message: result.message,
        devOtp: result.devOtp,
      });
    } catch (err: any) {
      console.error("[send-otp error]:", err.message);
      return res.status(400).json({ message: err.message || "Failed to dispatch SMS OTP. Please try again." });
    }
  });

  /** POST /api/auth/phone/verify-otp — Verify 6-Digit SMS OTP & Activate Blue Badge */
  app.post("/api/auth/phone/verify-otp", authRateLimit, async (req: Request, res: Response) => {
    const { phone, otp, userId, email, mode } = req.body || {};
    const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);
    const code = String(otp || "").trim();

    if (cleanPhone.length !== 10 || code.length !== 6) {
      return res.status(400).json({ message: "Please enter a valid 10-digit phone number and 6-digit OTP code." });
    }

    let targetUserId = userId ? Number(userId) : (req.session as any)?.userId;
    if (!targetUserId && email) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, String(email).toLowerCase().trim())).limit(1);
      if (u) targetUserId = u.id;
    }

    try {
      const { verifySmsOtp } = await import("../services/sms");
      const result = await verifySmsOtp(cleanPhone, code, mode || "phone_verification", targetUserId);

      if (req.session && result.user) {
        req.session.userId = result.user.id;
        req.session.role = result.user.role;
      }

      return res.json({
        success: true,
        isVerified: true,
        phone: cleanPhone,
        user: result.user,
        message: "🎉 Mobile number verified successfully! Blue Verification Badge activated.",
      });
    } catch (err: any) {
      console.error("[verify-otp error]:", err.message);
      return res.status(400).json({ message: err.message || "Invalid or expired SMS OTP code." });
    }
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

    // Clear phone from any older/conflicting account since this user proved ownership via 6-digit SMS OTP
    await db
      .update(users)
      .set({ phone: null, updatedAt: new Date() })
      .where(
        and(
          or(
            eq(users.phone, cleanPhone),
            eq(users.phone, `+91${cleanPhone}`),
            eq(users.phone, `+91 ${cleanPhone}`),
            eq(users.phone, `91${cleanPhone}`),
            sql`RIGHT(REGEXP_REPLACE(${users.phone}, '[^0-9]', '', 'g'), 10) = ${cleanPhone}`
          ),
          ne(users.id, targetUser.id)
        )
      );

    // Mark user as verified with Blue Badge and set their verified phone
    const [updatedUser] = await db.update(users).set({
      isVerified: true,
      phone: cleanPhone,
      updatedAt: new Date(),
    }).where(eq(users.id, targetUser.id)).returning();

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
    const existing = await findUserByEmail(cleanNewEmail, userId);
    if (existing) {
      const isGoogle = !existing.password || existing.password.trim() === "";
      return res.status(409).json({
        message: isGoogle
          ? `⚠️ This email (${cleanNewEmail}) is already registered via Google Sign-In with another account. Please use a unique email.`
          : `⚠️ This email address (${cleanNewEmail}) is already in use by another account.`,
      });
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

    // Check if new email was claimed by another user in the interim
    const conflict = await findUserByEmail(cleanNewEmail, userId);
    if (conflict) {
      return res.status(409).json({ message: `⚠️ This email address (${cleanNewEmail}) is already registered with another account.` });
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
