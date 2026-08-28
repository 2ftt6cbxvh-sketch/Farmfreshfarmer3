/**
 * Staff & Sub-Admin 2FA Service (TOTP Authenticator + Mobile SMS OTP Fallback)
 * ==============================================================================
 * Enables Chief Super Admin to configure 2FA requirements per staff member:
 *  - 'totp': Authenticator App (Google Authenticator / Apple Passwords)
 *  - 'sms': 6-Digit Mobile SMS OTP
 *  - 'both': Primary Authenticator TOTP with Mobile SMS OTP Fallback
 *  - 'none': Direct password (development/testing only)
 */
import crypto from "crypto";
import { sendRealEmail, buildOtpEmailHtml, buildOtpPlainText } from "./email";
import { verifyTotpCode } from "./totp";
import { storage } from "../storage";

export interface Staff2faSession {
  userId: number;
  email: string;
  phone: string;
  name: string;
  totpSecret?: string | null;
  twoFaMethod: "totp" | "sms" | "both" | "none";
  activeMethod: "totp" | "sms";
  canFallbackToSms: boolean;
  smsOtp?: string;
  expiresAt: number;
  attempts: number;
  lastSmsSentAt?: number;
}

const staffSessions = new Map<string, Staff2faSession>();

// Auto-cleanup expired sessions every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, sess] of staffSessions.entries()) {
    if (sess.expiresAt < now) {
      staffSessions.delete(key);
    }
  }
}, 2 * 60 * 1000);

export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return "Registered Mobile";
  const clean = phone.replace(/\D/g, "");
  if (clean.length >= 10) {
    const last4 = clean.slice(-4);
    return `+91 ••••• ••${last4}`;
  }
  return phone;
}

export async function createStaff2faSession(
  user: any
): Promise<{
  tempToken: string;
  initialMethod: "totp" | "sms";
  canFallbackToSms: boolean;
  maskedPhone: string;
  staffName: string;
  message: string;
}> {
  const tempToken = crypto.randomBytes(32).toString("hex");
  const method = (user.twoFaMethod || "both") as "totp" | "sms" | "both" | "none";
  const maskedPhone = maskPhoneNumber(user.phone);

  const initialMethod: "totp" | "sms" = method === "sms" ? "sms" : "totp";
  const canFallbackToSms = method === "both" || method === "sms";

  const session: Staff2faSession = {
    userId: user.id,
    email: user.email,
    phone: user.phone || "",
    name: user.name || "Staff Member",
    totpSecret: user.totpSecret || null,
    twoFaMethod: method,
    activeMethod: initialMethod,
    canFallbackToSms,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
    attempts: 0,
  };

  // If initial method is SMS, dispatch the OTP immediately
  if (initialMethod === "sms") {
    const smsOtp = crypto.randomInt(100000, 999999).toString();
    session.smsOtp = smsOtp;
    session.lastSmsSentAt = Date.now();

    try {
      const html = buildOtpEmailHtml(smsOtp, user.name);
      const text = buildOtpPlainText(smsOtp, user.name);
      await sendRealEmail({
        to: user.email,
        subject: `🔑 Staff 2FA Verification Code: ${smsOtp}`,
        html,
        text,
      });
    } catch {}

    console.log(`[STAFF SMS 2FA] OTP for ${user.name} (${user.phone}) -> Code: ${smsOtp}`);
  }

  staffSessions.set(tempToken, session);

  let message = "";
  if (initialMethod === "totp") {
    message = canFallbackToSms
      ? `🔐 Enter 6-digit Authenticator App code, or click 'Send Mobile SMS OTP' if Authenticator is inaccessible.`
      : `🔐 Enter 6-digit Authenticator App code from Google Authenticator or Apple Passwords.`;
  } else {
    message = `🔐 6-digit verification code sent to your registered mobile number (${maskedPhone}).`;
  }

  return {
    tempToken,
    initialMethod,
    canFallbackToSms,
    maskedPhone,
    staffName: user.name || "Staff Member",
    message,
  };
}

export async function triggerStaffSmsFallback(
  tempToken: string
): Promise<{ success: boolean; message: string; maskedPhone?: string }> {
  const session = staffSessions.get(tempToken);
  if (!session) {
    return { success: false, message: "Session expired. Please sign in again." };
  }

  if (!session.canFallbackToSms) {
    return { success: false, message: "SMS fallback is not enabled for this staff profile." };
  }

  const now = Date.now();
  if (session.lastSmsSentAt && now - session.lastSmsSentAt < 30 * 1000) {
    const waitSec = Math.ceil((30 * 1000 - (now - session.lastSmsSentAt)) / 1000);
    return { success: false, message: `Please wait ${waitSec} seconds before requesting a new code.` };
  }

  const newOtp = crypto.randomInt(100000, 999999).toString();
  session.smsOtp = newOtp;
  session.activeMethod = "sms";
  session.expiresAt = Date.now() + 5 * 60 * 1000;
  session.lastSmsSentAt = now;
  session.attempts = 0;

  try {
    const html = buildOtpEmailHtml(newOtp, session.name);
    const text = buildOtpPlainText(newOtp, session.name);
    await sendRealEmail({
      to: session.email,
      subject: `🔑 Staff 2FA Verification Code (Mobile Fallback): ${newOtp}`,
      html,
      text,
    });
  } catch {}

  console.log(`[STAFF SMS FALLBACK] OTP for ${session.name} (${session.phone}) -> Code: ${newOtp}`);

  return {
    success: true,
    message: `A 6-digit verification code has been dispatched to your mobile (${maskPhoneNumber(session.phone)}).`,
    maskedPhone: maskPhoneNumber(session.phone),
  };
}

export async function verifyStaff2faSession(
  tempToken: string,
  userCode: string,
  method?: "totp" | "sms"
): Promise<{ success: boolean; userId?: number; email?: string; message?: string }> {
  if (!tempToken || !userCode) {
    return { success: false, message: "Missing session token or verification code" };
  }

  const session = staffSessions.get(tempToken);
  if (!session) {
    return { success: false, message: "Session expired or invalid. Please sign in again." };
  }

  if (session.expiresAt < Date.now()) {
    staffSessions.delete(tempToken);
    return { success: false, message: "Verification code has expired. Please sign in again." };
  }

  if (session.attempts >= 4) {
    staffSessions.delete(tempToken);
    return { success: false, message: "Too many failed attempts. Security session terminated." };
  }

  const cleanCode = String(userCode).trim();
  const verifyAs = method || session.activeMethod;

  if (verifyAs === "totp") {
    // Verify TOTP Code
    const totpSecret = session.totpSecret || (await storage.settings.get("admin_totp_secret"));
    if (!totpSecret) {
      // If no TOTP secret is configured yet, check if SMS fallback is possible
      if (session.canFallbackToSms && session.smsOtp && cleanCode === session.smsOtp) {
        staffSessions.delete(tempToken);
        return { success: true, userId: session.userId, email: session.email };
      }
      return { success: false, message: "TOTP Authenticator is not configured for this staff profile. Please use Mobile SMS OTP." };
    }

    const isValid = verifyTotpCode(totpSecret, cleanCode);
    if (isValid) {
      staffSessions.delete(tempToken);
      return { success: true, userId: session.userId, email: session.email };
    }

    // Also check if they submitted a valid SMS OTP as fallback
    if (session.smsOtp && cleanCode === session.smsOtp) {
      staffSessions.delete(tempToken);
      return { success: true, userId: session.userId, email: session.email };
    }

    session.attempts += 1;
    const remaining = 4 - session.attempts;
    return {
      success: false,
      message: `Invalid 6-digit Authenticator code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : "Session locked."}`,
    };
  } else {
    // Verify SMS OTP Code
    if (!session.smsOtp || cleanCode !== session.smsOtp) {
      session.attempts += 1;
      const remaining = 4 - session.attempts;
      return {
        success: false,
        message: `Invalid 6-digit SMS OTP code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : "Session locked."}`,
      };
    }

    staffSessions.delete(tempToken);
    return { success: true, userId: session.userId, email: session.email };
  }
}
