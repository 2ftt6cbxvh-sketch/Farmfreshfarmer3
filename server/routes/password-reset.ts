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
import { requireRecaptcha } from "../middleware/recaptcha";
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

  /** POST /api/auth/forgot-password/otp/send — Send 6-digit OTP for Password Reset */
  app.post("/api/auth/forgot-password/otp/send", authRateLimit, requireRecaptcha, async (req: Request, res: Response) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Email address is required" });

    const cleanEmail = email.toLowerCase().trim();
    const [user] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (!user) {
      return res.status(404).json({ message: "No account found with this email. Please sign up first." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const { otpCodes } = await import("@shared/schema");
    const bcrypt = (await import("bcryptjs")).default;
    const codeHash = await bcrypt.hash(otp, 10);

    await db.insert(otpCodes).values({
      userId: user.id,
      phone: user.phone || user.email,
      purpose: "reset",
      codeHash,
      expiresAt,
    });

    const { buildOtpEmailHtml, sendRealEmail } = await import("../services/email");
    const html = buildOtpEmailHtml(otp, user.name);
    await sendRealEmail({
      to: cleanEmail,
      subject: `🔑 Password Reset OTP Code: ${otp}`,
      html,
    });

    if (user.role === "admin") {
      await sendTelegramAlert(`⚠️ Admin password reset OTP requested for email: ${user.email}`);
    }

    console.log(`[PASSWORD RESET OTP CODE] ${cleanEmail} -> OTP: ${otp}`);

    return res.json({
      message: "Password reset OTP code sent to your email!",
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  });

  /** POST /api/auth/forgot-password/otp/verify-reset — Verify OTP & Reset Password */
  app.post("/api/auth/forgot-password/otp/verify-reset", authRateLimit, async (req: Request, res: Response) => {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Email, OTP code, and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const [user] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (!user) {
      return res.status(404).json({ message: "No account found with this email address." });
    }

    const { otpCodes } = await import("@shared/schema");
    const { and, isNull, gt, desc } = await import("drizzle-orm");

    const validOtps = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.userId, user.id), isNull(otpCodes.verifiedAt), gt(otpCodes.expiresAt, new Date())))
      .orderBy(desc(otpCodes.id));

    if (validOtps.length === 0) {
      return res.status(400).json({ message: "OTP code has expired or is invalid. Please request a new OTP." });
    }

    const bcrypt = (await import("bcryptjs")).default;
    let matchedOtpId: number | null = null;
    for (const record of validOtps) {
      const match = await bcrypt.compare(String(code).trim(), record.codeHash);
      if (match) {
        matchedOtpId = record.id;
        break;
      }
    }

    if (!matchedOtpId) {
      return res.status(400).json({ message: "Invalid OTP code provided" });
    }

    // Mark OTP verified
    await db.update(otpCodes).set({ verifiedAt: new Date() }).where(eq(otpCodes.id, matchedOtpId));

    // Update user password
    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    await db.update(users).set({ password: passwordHash }).where(eq(users.id, user.id));

    return res.json({ message: "✨ Password updated successfully! You can now log in with your new password." });
  });
}
