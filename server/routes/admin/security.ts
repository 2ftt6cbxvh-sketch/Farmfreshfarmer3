/**
 * Admin security management routes.
 */
import type { Express, Request, Response } from "express";
import { db } from "../../db";
import { refreshTokens, securityAuditLogs, users } from "@shared/schema";
import { eq, isNull, desc } from "drizzle-orm";
import { getLockdownStatus, setLockdown } from "../../services/lockdown";

async function requirePrimaryAdmin(req: Request, res: Response, next: Function) {
  let userId: number | undefined = (req as any).jwtUser?.userId || req.session?.userId;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token || req.cookies?.admin_token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
      if (decoded.userId || decoded.sub) {
        userId = Number(decoded.userId || decoded.sub);
      }
    } catch (e: any) {}
  }

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const { db } = await import("../../db");
  const { users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const [user] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);

  if (!user || user.status === "blocked" || user.status === "locked" || user.isPermanentlyLocked) {
    return res.status(403).json({ message: "Forbidden: Active account required" });
  }

  const isPrimary = Boolean(
    user.isPrimaryAdmin === true ||
    user.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    user.id === 1
  );

  if (!isPrimary) {
    return res.status(403).json({
      message: "⛔ ACCESS DENIED: Only the Chief Executive Super Admin is authorized to access Security Controls and Cryptographic Settings.",
    });
  }

  if (req.session) {
    req.session.userId = user.id;
    req.session.role = user.role;
  }
  (req as any).currentUser = user;
  return (next as any)();
}

export function registerAdminSecurityRoutes(app: Express) {
  /** GET /api/admin/mfa/totp/setup — Generate TOTP secret & QR URI for Apple Passwords / Authenticator (Chief Super Admin Only) */
  app.get("/api/admin/mfa/totp/setup", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    const { generateTotpSecret } = await import("../../services/totp");
    const { storage } = await import("../../storage");

    let secret = await storage.settings.get("admin_totp_secret");
    if (!secret) {
      const generated = generateTotpSecret();
      secret = generated.secret;
      await storage.settings.set("admin_totp_secret", secret);
      await storage.settings.set("admin_totp_enabled", "true");
    }

    const enabled = (await storage.settings.get("admin_totp_enabled")) !== "false";
    const uri = `otpauth://totp/FarmFreshFarmer:ChiefAdmin?secret=${secret}&issuer=FarmFreshFarmer`;

    return res.json({
      secret,
      uri,
      enabled,
      accountName: "admin@farmfreshfarmer.com",
    });
  });

  /** POST /api/admin/mfa/totp/verify — Confirm 6-Digit TOTP Code & Activate MFA (Chief Super Admin Only) */
  app.post("/api/admin/mfa/totp/verify", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    const { code } = req.body || {};
    const { verifyTotpCode } = await import("../../services/totp");
    const { storage } = await import("../../storage");

    const secret = await storage.settings.get("admin_totp_secret");
    if (!secret) return res.status(400).json({ message: "TOTP secret not initialized. Refresh page." });

    const valid = verifyTotpCode(secret, String(code || ""));
    if (!valid) {
      return res.status(400).json({ message: "Invalid 6-digit TOTP code. Check Apple Passwords or Authenticator App." });
    }

    await storage.settings.set("admin_totp_enabled", "true");
    return res.json({ message: "✨ Chief Admin 2FA TOTP successfully verified and activated!" });
  });

  /** POST /api/admin/mfa/challenge — Verify 6-digit TOTP code during Admin login */
  app.post("/api/admin/mfa/challenge", async (req: Request, res: Response) => {
    const { code } = req.body || {};
    const { verifyTotpCode, generateTotpSecret } = await import("../../services/totp");
    const { storage } = await import("../../storage");

    let secret = await storage.settings.get("admin_totp_secret");
    if (!secret) {
      secret = generateTotpSecret().secret;
      await storage.settings.set("admin_totp_secret", secret);
      await storage.settings.set("admin_totp_enabled", "true");
    }

    const valid = verifyTotpCode(secret, String(code || ""));
    if (valid) {
      if (req.session) {
        (req.session as any).mfaVerified = true;
      }
      return res.json({ verified: true, mfaVerified: true });
    }

    return res.status(400).json({ message: "Invalid 6-digit TOTP verification code. Check Apple Passwords or Authenticator App." });
  });

  /** POST /api/admin/security/unauthorized-attempt — Trigger Telegram Alert when someone hits /admin directly */
  app.post("/api/admin/security/unauthorized-attempt", async (req: Request, res: Response) => {
    const { path } = req.body || {};
    const ip = req.headers["x-forwarded-for"] || req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    const { sendTelegramAlert } = await import("../../services/telegram");
    const alertMessage =
      `⚠️ <b>UNAUTHORISED ADMIN ACCESS ATTEMPT DETECTED!</b>\n` +
      `Path: <code>${path || "/admin"}</code>\n` +
      `IP Address: <code>${ip}</code>\n` +
      `User Agent: ${userAgent.slice(0, 60)}\n` +
      `Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}\n\n` +
      `🔒 Access Blocked (403 Forbidden). Incident logged under IT Act 2000 & BNS 2023.`;

    await sendTelegramAlert(alertMessage);
    return res.json({ logged: true, alertSent: true });
  });

  app.get("/api/admin/security/lockdown", requirePrimaryAdmin as any, async (_req: Request, res: Response) => {
    return res.json(await getLockdownStatus());
  });

  app.post("/api/admin/security/lockdown", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    const { active, reason } = req.body || {};
    if (typeof active !== "boolean") return res.status(400).json({ message: "active (boolean) required" });
    if (active && !reason) return res.status(400).json({ message: "reason required when activating lockdown" });
    const adminId = (req as any).jwtUser?.userId || req.session?.userId;
    await setLockdown(active, reason || "", adminId);
    return res.json({ message: `Lockdown ${active ? "activated" : "deactivated"}`, active });
  });

  app.get("/api/admin/security/audit-log", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit || "50")), 200);
    const logs = await db.select({
      id: securityAuditLogs.id, eventType: securityAuditLogs.eventType,
      userId: securityAuditLogs.userId, email: users.email,
      ip: securityAuditLogs.ip, platform: securityAuditLogs.platform,
      userAgent: securityAuditLogs.userAgent, actionTaken: securityAuditLogs.actionTaken,
      createdAt: securityAuditLogs.createdAt,
    }).from(securityAuditLogs).leftJoin(users, eq(securityAuditLogs.userId, users.id))
      .orderBy(desc(securityAuditLogs.createdAt)).limit(limit);
    return res.json({ logs });
  });

  app.get("/api/admin/security/sessions", requirePrimaryAdmin as any, async (_req: Request, res: Response) => {
    const sessions = await db.select({
      id: refreshTokens.id, userId: refreshTokens.userId, email: users.email,
      platform: refreshTokens.platform, deviceId: refreshTokens.deviceId,
      ipAtIssue: refreshTokens.ipAtIssue, expiresAt: refreshTokens.expiresAt, createdAt: refreshTokens.createdAt,
    }).from(refreshTokens).leftJoin(users, eq(refreshTokens.userId, users.id))
      .where(isNull(refreshTokens.revokedAt)).orderBy(desc(refreshTokens.createdAt)).limit(100);
    return res.json({ sessions });
  });

  app.delete("/api/admin/security/sessions/:id", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "Invalid session ID" });
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, id));
    return res.json({ message: "Session revoked" });
  });

  /** GET /api/admin/security/telegram — Fetch both Telegram bots configuration */
  app.get("/api/admin/security/telegram", requirePrimaryAdmin as any, async (_req: Request, res: Response) => {
    try {
      const { getTelegramSecurityCredentials, getTelegramGrievanceCredentials } = await import("../../services/telegram");
      const { storage } = await import("../../storage");

      // 1. Security Bot
      const sec = await getTelegramSecurityCredentials();
      const secDbToken = await storage.settings.get("telegram_security_bot_token") || await storage.settings.get("telegram_bot_token");
      const secDbChatIds = await storage.settings.get("telegram_security_chat_ids") || await storage.settings.get("telegram_security_chat_id") || await storage.settings.get("telegram_chat_id");
      const secIsValid = !!(sec.botToken && sec.botToken.includes(":") && !sec.botToken.includes("..."));
      const secMasked = secIsValid ? `${sec.botToken.substring(0, 5)}...${sec.botToken.slice(-4)}` : "";

      // 2. Grievance & Support Bot
      const griev = await getTelegramGrievanceCredentials();
      const grievDbToken = await storage.settings.get("telegram_grievance_bot_token") || await storage.settings.get("telegram_support_bot_token");
      const grievDbChatIds = await storage.settings.get("telegram_grievance_chat_ids") || await storage.settings.get("telegram_support_chat_ids");
      const grievIsValid = !!(griev.botToken && griev.botToken.includes(":") && !griev.botToken.includes("..."));
      const grievMasked = grievIsValid ? `${griev.botToken.substring(0, 5)}...${griev.botToken.slice(-4)}` : "";

      return res.json({
        security: {
          configured: !!(secIsValid && sec.chatIds.length > 0),
          botToken: secIsValid ? secMasked : "",
          chatId: secDbChatIds || sec.chatIds.join(", ") || "",
          chatIds: secDbChatIds || sec.chatIds.join(", ") || "",
          envConfigured: !!(process.env.TELEGRAM_SECURITY_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN),
        },
        grievance: {
          configured: !!(grievIsValid && griev.chatIds.length > 0),
          botToken: grievIsValid ? grievMasked : "",
          chatIds: grievDbChatIds || griev.chatIds.join(", ") || "",
          envConfigured: !!(process.env.TELEGRAM_GRIEVANCE_BOT_TOKEN || process.env.TELEGRAM_SUPPORT_BOT_TOKEN),
        },
        // Legacy top-level aliases mapped to Security Bot
        configured: !!(secIsValid && sec.chatIds.length > 0),
        botToken: secIsValid ? secMasked : "",
        chatId: secDbChatIds || sec.chatIds.join(", ") || "",
        chatIds: secDbChatIds || sec.chatIds.join(", ") || "",
        envConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch Telegram configuration" });
    }
  });

  /** POST /api/admin/security/telegram/security — Save Security Bot credentials (Super Admin only) */
  app.post("/api/admin/security/telegram/security", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    try {
      const { botToken, chatId, chatIds } = req.body || {};
      const { storage } = await import("../../storage");

      const rawChatIds = chatIds !== undefined ? chatIds : chatId;
      if (rawChatIds !== undefined && String(rawChatIds).trim()) {
        const cleanChatIds = String(rawChatIds).trim();
        await storage.settings.set("telegram_security_chat_ids", cleanChatIds);
        await storage.settings.set("telegram_security_chat_id", cleanChatIds);
        await storage.settings.set("telegram_chat_id", cleanChatIds);
      }

      if (botToken !== undefined && String(botToken).trim()) {
        const cleanToken = String(botToken).trim();
        if (cleanToken.includes("...")) {
          // Ignore masked preview
        } else if (!cleanToken.includes(":")) {
          return res.status(400).json({
            message: `Invalid Bot Token format ("${cleanToken}"). A Telegram Bot Token from @BotFather must contain a colon ':' (e.g. 7123456789:AAFx...). Note: Your Chat ID is NOT your Bot Token.`,
          });
        } else {
          await storage.settings.set("telegram_security_bot_token", cleanToken);
          await storage.settings.set("telegram_bot_token", cleanToken);
        }
      }

      return res.json({ message: "🛡️ Super Admin Security Bot credentials saved successfully" });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to save Security Bot credentials" });
    }
  });

  /** POST /api/admin/security/telegram/broadcast-update — Broadcast update push alert to all Super Admins */
  app.post("/api/admin/security/telegram/broadcast-update", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    try {
      const { sendTelegramDeployNotification } = await import("../../services/telegram");
      const { version, details } = req.body || {};
      const ver = version || "v8.1.1";
      const sent = await sendTelegramDeployNotification(ver, details);
      if (sent) {
        return res.json({ message: `🚀 Update notification for ${ver} broadcasted to all configured Super Admins!` });
      }
      return res.status(400).json({ message: "Could not send Telegram broadcast. Check Security Bot credentials." });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to broadcast update notification" });
    }
  });

  // Legacy route alias for Security credentials
  app.post("/api/admin/security/telegram", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    try {
      const { botToken, chatId } = req.body || {};
      const { storage } = await import("../../storage");

      if (chatId !== undefined && String(chatId).trim()) {
        const cleanChatId = String(chatId).trim();
        await storage.settings.set("telegram_security_chat_id", cleanChatId);
        await storage.settings.set("telegram_chat_id", cleanChatId);
      }

      if (botToken !== undefined && String(botToken).trim()) {
        const cleanToken = String(botToken).trim();
        if (!cleanToken.includes("...")) {
          if (!cleanToken.includes(":")) {
            return res.status(400).json({
              message: `Invalid Bot Token format. A Telegram Bot Token from @BotFather must contain a colon ':'.`,
            });
          }
          await storage.settings.set("telegram_security_bot_token", cleanToken);
          await storage.settings.set("telegram_bot_token", cleanToken);
        }
      }

      return res.json({ message: "Telegram security credentials saved successfully" });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to save Telegram credentials" });
    }
  });

  /** POST /api/admin/security/telegram/security/setup-webhook — Auto-Register Security Webhook */
  app.post("/api/admin/security/telegram/security/setup-webhook", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    try {
      const { getTelegramSecurityCredentials } = await import("../../services/telegram");
      const { botToken } = await getTelegramSecurityCredentials();

      if (!botToken || botToken.includes("...") || !botToken.includes(":")) {
        return res.status(400).json({
          message: `The saved Security Bot Token is invalid. A real Telegram Bot Token from @BotFather contains a colon ':' (e.g. 7123456789:AAFx...). Save your real Bot Token first.`,
        });
      }

      const host = req.headers.host || "farmfreshfarmer.com";
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const webhookUrl = `${protocol}://${host}/api/telegram/security/webhook`;

      const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
      const resTelegram = await fetch(telegramUrl);
      const data = await resTelegram.json();

      if (data.ok) {
        return res.json({ message: `✨ Security Bot Webhook Registered! (${webhookUrl})`, details: data });
      } else {
        return res.status(400).json({
          message: `Telegram API Error: ${data.description || "Failed to register webhook. Verify Security Bot Token from @BotFather."}`,
          details: data,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Webhook auto-setup error" });
    }
  });

  // Legacy setup-webhook alias
  app.post("/api/admin/security/telegram/setup-webhook", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    try {
      const { getTelegramSecurityCredentials } = await import("../../services/telegram");
      const { botToken } = await getTelegramSecurityCredentials();

      if (!botToken || botToken.includes("...") || !botToken.includes(":")) {
        return res.status(400).json({
          message: `The saved Bot Token is invalid. Enter a real Bot Token from @BotFather first.`,
        });
      }

      const host = req.headers.host || "farmfreshfarmer.com";
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

      const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
      const resTelegram = await fetch(telegramUrl);
      const data = await resTelegram.json();

      if (data.ok) {
        return res.json({ message: `✨ Telegram Webhook Registered! (${webhookUrl})`, details: data });
      } else {
        return res.status(400).json({ message: `Telegram API Error: ${data.description}`, details: data });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Webhook auto-setup error" });
    }
  });

  /** POST /api/admin/security/telegram/security/test-alert — Dispatch test alert to Super Admin Security Bot */
  app.post(["/api/admin/security/telegram/security/test-alert", "/api/admin/security/telegram/test-alert"], requirePrimaryAdmin as any, async (_req: Request, res: Response) => {
    try {
      const { sendTelegramSecurityAlert, isTelegramSecurityConfigured } = await import("../../services/telegram");
      if (!(await isTelegramSecurityConfigured())) {
        return res.status(400).json({ message: "Security Bot token or Chat ID is not configured." });
      }

      const success = await sendTelegramSecurityAlert(
        `🔔 <b>SUPER ADMIN SECURITY BOT TEST</b>\n\n` +
        `This is a verified test notification from FarmFreshFarmer Security.\n` +
        `Timestamp: ${new Date().toLocaleString()}\n` +
        `Status: All platform protection services are fully operational.`
      );

      if (success) {
        return res.json({ message: "Test alert dispatched to Super Admin Security Bot in Telegram!" });
      } else {
        return res.status(500).json({ message: "Failed to dispatch Telegram message. Check your bot token and chat ID." });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Error sending test alert" });
    }
  });

  /** POST /api/admin/security/telegram/grievance — Save Grievance & Support Bot credentials */
  app.post("/api/admin/security/telegram/grievance", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    try {
      const { botToken, chatIds } = req.body || {};
      const { storage } = await import("../../storage");

      if (chatIds !== undefined) {
        const cleanChatIds = String(chatIds).trim();
        await storage.settings.set("telegram_grievance_chat_ids", cleanChatIds);
        await storage.settings.set("telegram_support_chat_ids", cleanChatIds);
      }

      if (botToken !== undefined && String(botToken).trim()) {
        const cleanToken = String(botToken).trim();
        if (cleanToken.includes("...")) {
          // Ignore masked preview
        } else if (!cleanToken.includes(":")) {
          return res.status(400).json({
            message: `Invalid Grievance Bot Token format ("${cleanToken}"). A Telegram Bot Token from @BotFather must contain a colon ':' (e.g. 7123456789:AAFx...).`,
          });
        } else {
          await storage.settings.set("telegram_grievance_bot_token", cleanToken);
          await storage.settings.set("telegram_support_bot_token", cleanToken);
        }
      }

      return res.json({ message: "🎫 Grievance & Support Bot credentials saved successfully" });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to save Grievance Bot credentials" });
    }
  });

  /** POST /api/admin/security/telegram/grievance/setup-webhook — Auto-Register Grievance Webhook */
  app.post("/api/admin/security/telegram/grievance/setup-webhook", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    try {
      const { getTelegramGrievanceCredentials } = await import("../../services/telegram");
      const { botToken } = await getTelegramGrievanceCredentials();

      if (!botToken || botToken.includes("...") || !botToken.includes(":")) {
        return res.status(400).json({
          message: `The saved Grievance Bot Token is invalid. Enter a real Bot Token from @BotFather first.`,
        });
      }

      const host = req.headers.host || "farmfreshfarmer.com";
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const webhookUrl = `${protocol}://${host}/api/telegram/grievance/webhook`;

      const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
      const resTelegram = await fetch(telegramUrl);
      const data = await resTelegram.json();

      if (data.ok) {
        return res.json({ message: `✨ Grievance Bot Webhook Registered! (${webhookUrl})`, details: data });
      } else {
        return res.status(400).json({
          message: `Telegram API Error: ${data.description || "Failed to register Grievance webhook. Verify Bot Token from @BotFather."}`,
          details: data,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Webhook auto-setup error" });
    }
  });

  /** POST /api/admin/security/telegram/grievance/test-alert — Dispatch test alert to Grievance & Support Bot */
  app.post("/api/admin/security/telegram/grievance/test-alert", requirePrimaryAdmin as any, async (_req: Request, res: Response) => {
    try {
      const { sendTelegramGrievanceAlert, isTelegramGrievanceConfigured } = await import("../../services/telegram");
      if (!(await isTelegramGrievanceConfigured())) {
        return res.status(400).json({ message: "Grievance Bot token or Chat IDs are not configured." });
      }

      const success = await sendTelegramGrievanceAlert(
        `🎫 <b>GRIEVANCE & CUSTOMER SUPPORT BOT TEST</b>\n\n` +
        `This is a verified test notification sent to all registered Grievance Officers & Support Representatives.\n` +
        `Timestamp: ${new Date().toLocaleString()}\n` +
        `Status: Customer ticket notifications & live chat escalations are active!`
      );

      if (success) {
        return res.json({ message: "Test alert dispatched to Grievance & Support Bot in Telegram!" });
      } else {
        return res.status(500).json({ message: "Failed to dispatch Grievance message. Check your bot token and chat IDs." });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Error sending test alert" });
    }
  });

  /** POST /api/admin/security/secret-unlock — Mode A: Direct Vault (Password + 6-Digit TOTP 2FA) */
  app.post("/api/admin/security/secret-unlock", async (req: Request, res: Response) => {
    try {
      const { currentPassword, totpCode } = req.body || {};

      if (!currentPassword) {
        return res.status(400).json({ message: "Current Super Admin password is required." });
      }
      if (!totpCode || String(totpCode).trim().length < 6) {
        return res.status(400).json({ message: "6-Digit Authenticator TOTP 2FA code is required." });
      }

      // 1. Verify 6-digit TOTP or Telegram Override Token
      const cleanCode = String(totpCode).trim();
      const { verifyTotpCode, generateTotpSecret } = await import("../../services/totp");
      const { isTelegramUnlockTokenValid, checkTelegramUnlockToken, sendTelegramSecurityAlertThrottled } = await import("../../services/telegram");
      const { storage } = await import("../../storage");
      let secret = await storage.settings.get("admin_totp_secret");
      if (!secret) {
        secret = generateTotpSecret().secret;
        await storage.settings.set("admin_totp_secret", secret);
      }

      let isTotpValid = verifyTotpCode(secret, cleanCode);
      if (!isTotpValid) {
        // Also check if code matches an active or approved Telegram session token
        if (isTelegramUnlockTokenValid(cleanCode) || checkTelegramUnlockToken(cleanCode)) {
          isTotpValid = true;
        }
      }

      if (!isTotpValid) {
        await sendTelegramSecurityAlertThrottled(
          `totp_fail_${req.ip}`,
          `⚠️ <b>FAILED SECRET PASSAGE ATTEMPT</b>\nMethod: Direct Vault (Invalid TOTP / Code)\nIP: ${req.ip}\nDevice: ${req.headers["user-agent"]}`
        );
        return res.status(400).json({ message: "Invalid 6-digit code. Enter your Authenticator TOTP or Telegram Override Token." });
      }

      // 2. Fetch Super Admin User
      const [adminUser] = await db.select().from(users).where(eq(users.email, "admin@farmfreshfarmer.com")).limit(1);
      if (!adminUser) {
        return res.status(404).json({ message: "Super Admin account not found." });
      }

      // 3. Verify Password
      const bcrypt = (await import("bcryptjs")).default;
      const isPasswordValid = await bcrypt.compare(currentPassword, adminUser.password);
      if (!isPasswordValid) {
        const { sendTelegramAlert } = await import("../../services/telegram");
        await sendTelegramAlert(`⚠️ <b>FAILED SECRET PASSAGE ATTEMPT</b>\nMethod: Direct Vault (Invalid Password)\nIP: ${req.ip}\nDevice: ${req.headers["user-agent"]}`);
        return res.status(400).json({ message: "Current Super Admin password is incorrect." });
      }

      // 4. Grant Master Access to Super Admin ONLY (Keep Global Lockdown Active for all other users!)
      const jwt = (await import("jsonwebtoken")).default;
      const token = jwt.sign(
        { userId: adminUser.id, role: adminUser.role, email: adminUser.email },
        process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret",
        { expiresIn: "7d" }
      );

      const { sendTelegramAlert } = await import("../../services/telegram");
      await sendTelegramAlert(`🚨 <b>SUPER ADMIN MASTER SESSION UNLOCKED</b>\nMethod: Direct Vault (Password + TOTP)\nGlobal Platform Lockdown remains ACTIVE for all other users!\nIP: ${req.ip}\nDevice: ${req.headers["user-agent"]}`);

      return res.json({
        success: true,
        token,
        user: { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role },
        message: "🔑 Super Admin Master Access Authorized! Global Lockdown remains ACTIVE for all other users.",
      });
    } catch (err: any) {
      console.error("[secret-unlock error]", err);
      return res.status(500).json({ message: err?.message || "Secret unlock failed" });
    }
  });

  /** POST /api/admin/security/telegram-challenge — Mode B: Dispatch 1-Click Telegram Approval */
  app.post("/api/admin/security/telegram-challenge", async (req: Request, res: Response) => {
    try {
      const { createTelegramUnlockToken, sendTelegramUnlockRequest } = await import("../../services/telegram");
      const deviceInfo = `${req.headers["user-agent"] || "Unknown Device"} (IP: ${req.ip})`;
      const token = createTelegramUnlockToken(deviceInfo);

      const dispatched = await sendTelegramUnlockRequest(token, deviceInfo);
      if (!dispatched) {
        return res.status(400).json({ message: "Telegram Bot is not configured. Use Direct Vault (Password + TOTP) mode instead." });
      }

      return res.json({
        success: true,
        token,
        message: "📲 1-Click Approval push notification sent to Super Admin Telegram Bot! Tap 'Authorize' in Telegram to unlock.",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to dispatch Telegram challenge" });
    }
  });

  /** GET /api/admin/security/check-telegram-approval/:token — Mode B: Poll for Telegram approval */
  app.get("/api/admin/security/check-telegram-approval/:token", async (req: Request, res: Response) => {
    try {
      const { token: sessionToken } = req.params;
      const { checkTelegramUnlockToken } = await import("../../services/telegram");

      const isApproved = checkTelegramUnlockToken(String(sessionToken));
      if (!isApproved) {
        return res.json({ approved: false });
      }

      // Approved by Super Admin via Telegram 1-click button!
      // Keep Global Lockdown Active for all other users!
      const [adminUser] = await db.select().from(users).where(eq(users.email, "admin@farmfreshfarmer.com")).limit(1);
      const jwt = (await import("jsonwebtoken")).default;
      const jwtToken = jwt.sign(
        { userId: adminUser?.id || 1, role: "superadmin", email: "admin@farmfreshfarmer.com" },
        process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret",
        { expiresIn: "7d" }
      );

      return res.json({
        approved: true,
        token: jwtToken,
        user: { id: adminUser?.id || 1, email: "admin@farmfreshfarmer.com", name: adminUser?.name || "Super Admin", role: "superadmin" },
        message: "✅ Telegram 1-Click Approval Confirmed! Platform Lockdown Deactivated.",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to check Telegram approval" });
    }
  });
}
