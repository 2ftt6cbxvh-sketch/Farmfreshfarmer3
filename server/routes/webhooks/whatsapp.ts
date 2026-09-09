/**
 * Official Meta WhatsApp Cloud API Webhook Handler
 * Endpoint: /api/webhooks/whatsapp
 *
 * Handles:
 * - GET: Webhook verification challenge handshake from Meta for Developers
 * - POST: Incoming customer WhatsApp messages for 100% Free Mobile Verification
 */
import type { Express, Request, Response } from "express";
import { db } from "../../db";
import { otpCodes, users } from "@shared/schema";
import { eq, and, gt, isNull, desc, or, sql, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getWhatsAppConfig, sendWhatsAppVerificationConfirmation } from "../../services/whatsapp-cloud";

export function registerWhatsAppWebhookRoutes(app: Express) {
  /**
   * GET /api/webhooks/whatsapp
   * Meta Webhook Verification Challenge Handshake
   */
  app.get("/api/webhooks/whatsapp", async (req: Request, res: Response) => {
    try {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      const config = await getWhatsAppConfig();

      if (mode === "subscribe" && token === config.verifyToken) {
        console.log("[WhatsApp Webhook] Verification challenge passed successfully.");
        return res.status(200).send(challenge);
      } else {
        console.warn("[WhatsApp Webhook] Verification challenge failed. Invalid token:", token);
        return res.status(403).send("Verification token mismatch");
      }
    } catch (err: any) {
      console.error("[WhatsApp Webhook Verify Error]:", err.message);
      return res.status(500).send("Webhook verification error");
    }
  });

  /**
   * POST /api/webhooks/whatsapp
   * Inbound WhatsApp Message Receiver
   */
  app.post("/api/webhooks/whatsapp", async (req: Request, res: Response) => {
    // Acknowledge Meta within 3 seconds to avoid webhook retries
    res.status(200).json({ status: "ok" });

    try {
      const body = req.body;
      if (body?.object !== "whatsapp_business_account") {
        return;
      }

      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (!message || message.type !== "text") {
        return;
      }

      const fromRaw = String(message.from || "");
      const cleanPhone = fromRaw.replace(/\D/g, "").slice(-10);
      const textBody = String(message.text?.body || "").trim();

      console.log(`[WhatsApp Webhook] Inbound message from +91 ${cleanPhone}: "${textBody}"`);

      // Extract 6-digit code (handles formats like "FF-123456", "123456", "Verify 123456", etc.)
      const codeMatch = textBody.match(/(?:FF[-_ ]?)?(\b\d{6}\b)/i);
      if (!codeMatch) {
        console.log(`[WhatsApp Webhook] No 6-digit verification code found in text: "${textBody}"`);
        return;
      }

      const extractedCode = codeMatch[1];

      // Lookup active pending whatsapp verification records in otpCodes
      const now = new Date();
      const pendingRows = await db
        .select()
        .from(otpCodes)
        .where(
          and(
            eq(otpCodes.purpose, "whatsapp_verification"),
            gt(otpCodes.expiresAt, now),
            isNull(otpCodes.verifiedAt)
          )
        )
        .orderBy(desc(otpCodes.id))
        .limit(20);

      let matchedRow: typeof otpCodes.$inferSelect | null = null;
      for (const row of pendingRows) {
        const isMatch = await bcrypt.compare(extractedCode, row.codeHash);
        if (isMatch) {
          matchedRow = row;
          break;
        }
      }

      if (!matchedRow) {
        console.log(`[WhatsApp Webhook] Code ${extractedCode} not found or expired.`);
        return;
      }

      // Mark the OTP code as verified
      await db
        .update(otpCodes)
        .set({
          verifiedAt: new Date(),
          phone: cleanPhone,
        })
        .where(eq(otpCodes.id, matchedRow.id));

      // Resolve Target User
      let targetUserId = matchedRow.userId;
      let targetUser: any = null;

      if (targetUserId) {
        const [u] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
        targetUser = u;
      }

      if (!targetUser) {
        // Fallback: match by clean phone
        const [u] = await db
          .select()
          .from(users)
          .where(
            or(
              eq(users.phone, cleanPhone),
              eq(users.phone, `+91${cleanPhone}`),
              eq(users.phone, `+91 ${cleanPhone}`),
              sql`RIGHT(REGEXP_REPLACE(${users.phone}, '[^0-9]', '', 'g'), 10) = ${cleanPhone}`
            )
          )
          .limit(1);
        if (u) {
          targetUser = u;
          targetUserId = u.id;
        }
      }

      if (targetUserId) {
        // Clear conflict on other accounts that had this phone
        await db
          .update(users)
          .set({ phone: null, updatedAt: new Date() })
          .where(
            and(
              or(
                eq(users.phone, cleanPhone),
                eq(users.phone, `+91${cleanPhone}`),
                eq(users.phone, `+91 ${cleanPhone}`),
                sql`RIGHT(REGEXP_REPLACE(${users.phone}, '[^0-9]', '', 'g'), 10) = ${cleanPhone}`
              ),
              ne(users.id, targetUserId)
            )
          );

        const isFullyVerified = Boolean(targetUser?.isEmailVerified || targetUser?.isPrimaryAdmin);
        const [updated] = await db
          .update(users)
          .set({
            isPhoneVerified: true,
            isVerified: isFullyVerified,
            phone: cleanPhone,
            updatedAt: new Date(),
          })
          .where(eq(users.id, targetUserId))
          .returning();

        // Unlock account if locked
        if (updated && (updated.isPermanentlyLocked || updated.status === "locked" || (updated.failedLoginAttempts || 0) > 0 || updated.lockoutUntil)) {
          const { unlockUserAccount } = await import("../../services/lockout");
          await unlockUserAccount(updated.id, "Meta WhatsApp Cloud API Verification");
        }

        console.log(`[WhatsApp Webhook] ✅ Customer #${targetUserId} (+91 ${cleanPhone}) successfully verified with Blue Badge!`);
      }

      // Automatically send confirmation on WhatsApp back to customer (Free within 24h user-initiated service window)
      await sendWhatsAppVerificationConfirmation(cleanPhone, targetUser?.name).catch((e) => {
        console.warn("[WhatsApp Webhook] Auto-reply confirmation dispatch failed:", e?.message || e);
      });
    } catch (err: any) {
      console.error("[WhatsApp Webhook Processing Error]:", err.message);
    }
  });
}
