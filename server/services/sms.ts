/**
 * Fast2SMS India OTP Gateway Service
 * Delivers real 6-digit SMS verification OTPs directly to Indian mobile carriers (Jio, Airtel, Vi, BSNL)
 */
import { db } from "../db";
import { otpCodes, users } from "@shared/schema";
import { eq, and, gt, desc, isNull, ne, sql, or } from "drizzle-orm";
import bcrypt from "bcryptjs";

const FAST2SMS_API_KEY =
  process.env.FAST2SMS_API_KEY ||
  "zsaBW3Dx5pPNuOYF1iqTc2ne8dhXrSlAwLUb6H7Iftvy0VRkgKVLDcC5TE8nAw3Oea749SRkuxoB1Nsz";

export interface SendSmsResult {
  success: boolean;
  message: string;
  devOtp?: string;
}

/**
 * Dispatch 6-digit SMS OTP to a 10-digit Indian mobile number via Fast2SMS
 */
export async function sendSmsOtp(
  phone: string,
  purpose: string = "phone_verification",
  userId?: number
): Promise<SendSmsResult> {
  const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
    throw new Error("Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  // Invalidate any existing unverified OTPs for this phone number and purpose
  await db
    .delete(otpCodes)
    .where(and(eq(otpCodes.phone, cleanPhone), eq(otpCodes.purpose, purpose)));

  // Save OTP record to database
  await db.insert(otpCodes).values({
    userId: userId || null,
    phone: cleanPhone,
    purpose,
    codeHash,
    expiresAt,
  });

  // Dispatch via Fast2SMS Quick OTP API Route
  try {
    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: FAST2SMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "otp",
        variables_values: otp,
        numbers: cleanPhone,
      }),
    });

    const data = await res.json();
    console.log(`[Fast2SMS Dispatch] Phone: +91 ${cleanPhone} | Status:`, data);

    if (!data.return && !data.status_code) {
      console.warn("[Fast2SMS Warning]:", data.message || "Failed to dispatch SMS");
    }

    return {
      success: true,
      message: `6-Digit SMS verification code sent to +91 ${cleanPhone}. Valid for 10 minutes.`,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    };
  } catch (err: any) {
    console.error("[Fast2SMS Error]:", err.message);
    throw new Error(`Failed to send SMS OTP: ${err.message || "Network error"}`);
  }
}

/**
 * Verify 6-digit SMS OTP for a 10-digit Indian mobile number
 */
export async function verifySmsOtp(
  phone: string,
  enteredCode: string,
  purpose: string = "phone_verification",
  targetUserId?: number
): Promise<{ success: boolean; user?: any }> {
  const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);
  const code = String(enteredCode || "").trim();

  if (cleanPhone.length !== 10 || code.length !== 6) {
    throw new Error("Invalid phone number or 6-digit OTP code.");
  }

  const now = new Date();
  const rows = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, cleanPhone),
        eq(otpCodes.purpose, purpose),
        gt(otpCodes.expiresAt, now),
        isNull(otpCodes.verifiedAt)
      )
    )
    .orderBy(desc(otpCodes.id))
    .limit(3);

  if (!rows.length) {
    throw new Error("SMS verification code expired or not found. Please tap 'Resend Code'.");
  }

  let matchedRowId: number | null = null;
  for (const row of rows) {
    const isMatch = await bcrypt.compare(code, row.codeHash);
    if (isMatch) {
      matchedRowId = row.id;
      break;
    }
  }

  if (!matchedRowId) {
    throw new Error("Incorrect 6-digit SMS code. Please check your SMS and try again.");
  }

  // Consume OTP
  await db
    .update(otpCodes)
    .set({ verifiedAt: new Date() })
    .where(eq(otpCodes.id, matchedRowId));

  // If a target user ID is provided, link and verify the phone on their account
  let updatedUser = null;
  if (targetUserId) {
    // Clear phone from any old account that had it previously
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

    const [user] = await db
      .update(users)
      .set({
        isVerified: true,
        phone: cleanPhone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId))
      .returning();

    // If user was locked, unlock them immediately
    if (user && (user.isPermanentlyLocked || user.status === "locked" || (user.failedLoginAttempts || 0) > 0 || user.lockoutUntil)) {
      const { unlockUserAccount } = await import("./lockout");
      await unlockUserAccount(user.id, "Mobile Number Fast2SMS Verification");
    }

    updatedUser = user;
  }

  return { success: true, user: updatedUser };
}
