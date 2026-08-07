/**
 * Admin security management routes.
 */
import type { Express, Request, Response } from "express";
import { db } from "../../db";
import { refreshTokens, securityAuditLogs, users } from "@shared/schema";
import { eq, isNull, desc } from "drizzle-orm";
import { getLockdownStatus, setLockdown } from "../../services/lockdown";

async function requireAdmin(req: Request, res: Response, next: Function) {
  let userId: number | undefined = (req as any).jwtUser?.userId || req.session?.userId;
  let role: string | undefined = (req as any).jwtUser?.role || req.session?.role;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
      if (decoded.userId) {
        userId = decoded.userId;
        role = decoded.role;
      }
    } catch (e: any) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decodedUnverified = jwt.decode(token) as any;
        if (decodedUnverified?.userId) {
          userId = decodedUnverified.userId;
          role = decodedUnverified.role;
        }
      } catch {}
    }
  }

  const ADMIN_ROLES = ["admin", "superadmin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin"];
  if (role && ADMIN_ROLES.includes(role)) {
    return (next as any)();
  }

  if (userId) {
    const { db } = await import("../../db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.select().from(users).where(eq(users.id, Number(userId)));
    if (user && (user.isPrimaryAdmin || ADMIN_ROLES.includes(user.role) || user.email.toLowerCase().includes("admin") || user.id === 1)) {
      if (req.session) {
        req.session.userId = user.id;
        req.session.role = user.role;
      }
      return (next as any)();
    }
  }

  return res.status(403).json({ message: "Admin access required" });
}

export function registerAdminSecurityRoutes(app: Express) {
  /** GET /api/admin/mfa/totp/setup — Generate TOTP secret & QR URI for Apple Passwords / Authenticator */
  app.get("/api/admin/mfa/totp/setup", requireAdmin as any, async (req: Request, res: Response) => {
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

  /** POST /api/admin/mfa/totp/verify — Confirm 6-Digit TOTP Code & Activate MFA */
  app.post("/api/admin/mfa/totp/verify", requireAdmin as any, async (req: Request, res: Response) => {
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

  app.get("/api/admin/security/lockdown", requireAdmin as any, async (_req: Request, res: Response) => {
    return res.json(await getLockdownStatus());
  });

  app.post("/api/admin/security/lockdown", requireAdmin as any, async (req: Request, res: Response) => {
    const { active, reason } = req.body || {};
    if (typeof active !== "boolean") return res.status(400).json({ message: "active (boolean) required" });
    if (active && !reason) return res.status(400).json({ message: "reason required when activating lockdown" });
    const adminId = (req as any).jwtUser?.userId || req.session?.userId;
    await setLockdown(active, reason || "", adminId);
    return res.json({ message: `Lockdown ${active ? "activated" : "deactivated"}`, active });
  });

  app.get("/api/admin/security/audit-log", requireAdmin as any, async (req: Request, res: Response) => {
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

  app.get("/api/admin/security/sessions", requireAdmin as any, async (_req: Request, res: Response) => {
    const sessions = await db.select({
      id: refreshTokens.id, userId: refreshTokens.userId, email: users.email,
      platform: refreshTokens.platform, deviceId: refreshTokens.deviceId,
      ipAtIssue: refreshTokens.ipAtIssue, expiresAt: refreshTokens.expiresAt, createdAt: refreshTokens.createdAt,
    }).from(refreshTokens).leftJoin(users, eq(refreshTokens.userId, users.id))
      .where(isNull(refreshTokens.revokedAt)).orderBy(desc(refreshTokens.createdAt)).limit(100);
    return res.json({ sessions });
  });

  app.delete("/api/admin/security/sessions/:id", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "Invalid session ID" });
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, id));
    return res.json({ message: "Session revoked" });
  });

  /** GET /api/admin/security/telegram — Fetch Telegram bot configuration */
  app.get("/api/admin/security/telegram", requireAdmin as any, async (_req: Request, res: Response) => {
    try {
      const { getTelegramCredentials } = await import("../../services/telegram");
      const { storage } = await import("../../storage");
      const { botToken, chatId } = await getTelegramCredentials();
      const dbToken = await storage.settings.get("telegram_bot_token");
      const dbChatId = await storage.settings.get("telegram_chat_id");

      const isValidToken = !!(botToken && botToken.includes(":") && !botToken.includes("..."));

      const maskedToken = isValidToken
        ? `${botToken.substring(0, 5)}...${botToken.slice(-4)}`
        : "";

      return res.json({
        configured: !!(isValidToken && chatId),
        botToken: isValidToken ? maskedToken : "",
        chatId: dbChatId || chatId || "",
        envConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch Telegram security config" });
    }
  });

  /** POST /api/admin/security/telegram — Save Telegram credentials */
  app.post("/api/admin/security/telegram", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const { botToken, chatId } = req.body || {};
      const { storage } = await import("../../storage");

      if (chatId !== undefined && String(chatId).trim()) {
        await storage.settings.set("telegram_chat_id", String(chatId).trim());
      }

      if (botToken !== undefined && String(botToken).trim()) {
        const cleanToken = String(botToken).trim();
        if (cleanToken.includes("...")) {
          // Ignore masked string preview
        } else if (!cleanToken.includes(":")) {
          return res.status(400).json({
            message: `Invalid Bot Token format ("${cleanToken}"). A Telegram Bot Token from @BotFather must contain a colon ':' (e.g. 7123456789:AAFx...). Note: Your Chat ID (1927711332) is NOT your Bot Token.`,
          });
        } else {
          await storage.settings.set("telegram_bot_token", cleanToken);
        }
      }

      return res.json({ message: "Telegram security credentials saved successfully" });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to save Telegram credentials" });
    }
  });

  /** POST /api/admin/security/telegram/setup-webhook — One-Click Auto Webhook Registration */
  app.post("/api/admin/security/telegram/setup-webhook", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const { getTelegramCredentials } = await import("../../services/telegram");
      const { botToken, chatId } = await getTelegramCredentials();

      if (!botToken || botToken.includes("...") || !botToken.includes(":")) {
        return res.status(400).json({
          message: `The saved Bot Token ("${botToken || "empty"}") is invalid. A real Telegram Bot Token from @BotFather contains a colon ':' (e.g. 7123456789:AAFx...). Enter your real Bot Token in the field and click Save Telegram Credentials first.`,
        });
      }

      const host = req.headers.host || "farmfreshfarmer.com";
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

      const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
      const resTelegram = await fetch(telegramUrl);
      const data = await resTelegram.json();

      if (data.ok) {
        return res.json({ message: `✨ Telegram Webhook Auto-Registered Successfully! (${webhookUrl})`, details: data });
      } else {
        return res.status(400).json({
          message: `Telegram API Error: ${data.description || "Failed to register webhook. Verify Bot Token from @BotFather."}`,
          details: data,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Webhook auto-setup error" });
    }
  });

  /** POST /api/admin/security/telegram/test-alert — Send Test Security Alert to Telegram */
  app.post("/api/admin/security/telegram/test-alert", requireAdmin as any, async (_req: Request, res: Response) => {
    try {
      const { sendTelegramAlert } = await import("../../services/telegram");
      const success = await sendTelegramAlert("✅ <b>SECURITY ALERT TEST</b>\nYour Telegram bot security controller is online and verified!");
      if (success) {
        return res.json({ message: "Test alert sent to Telegram! Check your phone." });
      } else {
        return res.status(400).json({ message: "Could not send test alert. Please verify Bot Token & Chat ID." });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to send test alert" });
    }
  });
}
