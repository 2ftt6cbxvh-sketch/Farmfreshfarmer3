/**
 * Forgot password & password reset routes.
 * Uses time-limited (1-hour), single-use tokens hashed with SHA-256 in DB.
 * Dispatches real emails via Resend / SMTP.
 */
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { authRateLimit } from "../middleware/rate-limit";
import { hashPassword } from "../services/argon2";
import { sendTelegramAlert } from "../services/telegram";
import { sendRealEmail, buildResetPasswordHtml } from "../services/email";

// Memory store for reset tokens: tokenHash -> { userId, expiresAt }
const resetTokens = new Map<string, { userId: number; expiresAt: number }>();

export function registerPasswordResetRoutes(app: Express) {
  /** POST /api/auth/forgot-password */
  app.post("/api/auth/forgot-password", authRateLimit, async (req: Request, res: Response) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Email is required" });

    const cleanEmail = email.toLowerCase().trim();
    const [user] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (!user) {
      return res.json({ message: "If an account exists with that email, a password reset link has been sent." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = Date.now() + 60 * 60 * 1000;

    resetTokens.set(tokenHash, { userId: user.id, expiresAt });

    const host = req.headers.host || "localhost:5001";
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const resetUrl = `${protocol}://${host}/#/reset-password?token=${rawToken}`;

    // Dispatch Real Email
    const html = buildResetPasswordHtml(resetUrl, user.name);
    await sendRealEmail({
      to: cleanEmail,
      subject: "🔑 Reset Your FarmFreshFarmer Password",
      html,
    });

    if (user.role === "admin") {
      await sendTelegramAlert(`⚠️ Admin password reset requested for email: ${user.email}`);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[PASSWORD RESET LINK] ${resetUrl}`);
    }

    return res.json({ message: "Password reset link sent to your email!" });
  });

  /** POST /api/auth/reset-password */
  app.post("/api/auth/reset-password", authRateLimit, async (req: Request, res: Response) => {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ message: "Token and new password required" });
    if (newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = resetTokens.get(tokenHash);

    if (!record || Date.now() > record.expiresAt) {
      resetTokens.delete(tokenHash);
      return res.status(400).json({ message: "Password reset link is invalid or has expired." });
    }

    const passwordHash = await hashPassword(newPassword);

    await db.update(users).set({ password: passwordHash }).where(eq(users.id, record.userId));
    resetTokens.delete(tokenHash);

    return res.json({ message: "Password updated successfully. You can now log in." });
  });
}
