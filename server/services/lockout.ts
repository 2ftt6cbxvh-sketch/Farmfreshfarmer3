/**
 * Progressive Account Lockout & Cyber-Security Service
 * ======================================================
 * 
 * Rules:
 * 1. Up to 5 incorrect password attempts allowed before temporary lockout.
 * 2. Lockout Tiers upon exceeding 5 attempts:
 *    - 1st Lockout: 2 minutes
 *    - 2nd Lockout: 5 minutes
 *    - 3rd Lockout: 15 minutes
 *    - 4th Lockout: 60 minutes (1 hour)
 *    - 5th Lockout: 24 hours (Dispatches high-priority Telegram notification to Admin!)
 * 3. 10 or more failed tries:
 *    - Account is permanently locked (status = 'locked', isPermanentlyLocked = true)
 *    - Dispatches emergency Telegram alert with 1-click unlock command (/unlock <email>)
 *    - Requires Super Admin / Admin approval in Admin Panel or via Telegram command.
 */

import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sendTelegramAlert } from "./telegram";
import type { Request } from "express";

export interface LockoutCheckResult {
  allowed: boolean;
  statusCode?: number;
  message?: string;
  remainingAttempts?: number;
  lockoutUntil?: Date;
  isPermanentlyLocked?: boolean;
}

/**
 * Validates a user's password against progressive lockout rules.
 */
export async function verifyPasswordWithLockout(
  user: typeof users.$inferSelect,
  candidatePassword: string,
  _req?: Request
): Promise<LockoutCheckResult> {
  const now = Date.now();

  // 1. Check Permanent Lockout
  if (user.isPermanentlyLocked || user.status === "locked" || user.status === "blocked") {
    return {
      allowed: false,
      statusCode: 423,
      isPermanentlyLocked: true,
      message: "🔒 Your account has been permanently locked due to multiple failed login attempts. Please contact admin support or wait for Super Admin approval.",
    };
  }

  // 2. Check Temporary Lockout Active
  if (user.lockoutUntil && new Date(user.lockoutUntil).getTime() > now) {
    const remainingMs = new Date(user.lockoutUntil).getTime() - now;
    const minutes = Math.ceil(remainingMs / 60000);
    const seconds = Math.ceil(remainingMs / 1000);
    const timeStr = minutes > 1 ? `${minutes} minutes` : `${seconds} seconds`;

    return {
      allowed: false,
      statusCode: 429,
      lockoutUntil: user.lockoutUntil,
      message: `⏳ Account temporarily locked due to excessive incorrect password attempts. Please try again in ${timeStr}.`,
    };
  }

  // 3. Compare Password
  const isMatch = await bcrypt.compare(candidatePassword, user.password);

  if (isMatch) {
    // Correct Password -> Clear failed attempts & lockout timers
    if (user.failedLoginAttempts > 0 || user.lockoutTier > 0 || user.lockoutUntil) {
      await db.update(users).set({
        failedLoginAttempts: 0,
        lockoutTier: 0,
        lockoutUntil: null,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));
    }
    return { allowed: true };
  }

  // 4. Incorrect Password -> Increment Failed Attempts & Calculate Escalation
  const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
  const currentTier = user.lockoutTier || 0;

  // If 10 or more total failed attempts reached -> Permanent Lockout
  if (newFailedAttempts >= 10 || currentTier >= 9) {
    const newTier = currentTier + 1;
    await db.update(users).set({
      failedLoginAttempts: newFailedAttempts,
      lockoutTier: newTier,
      isPermanentlyLocked: true,
      status: "locked",
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    // Send Telegram Alert for Permanent Lockout
    await sendTelegramAlert(
      `🛑 <b>SECURITY ALERT: ACCOUNT PERMANENTLY LOCKED</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>User:</b> ${user.name} (<code>${user.email}</code>)\n` +
      `⚠️ <b>Reason:</b> 10+ failed password attempts detected. Potential cyber-attack / brute-force.\n` +
      `🔒 <b>Status:</b> PERMANENTLY LOCKED. Requires Super Admin approval.\n` +
      `⏰ <b>Timestamp:</b> ${new Date().toLocaleString("en-IN")}\n\n` +
      `👉 <b>Quick Unlock Telegram Command:</b>\n<code>/unlock ${user.email}</code>\n\n` +
      `👉 Or unlock directly from Admin Panel > Users.`
    ).catch((e: any) => console.warn("[lockout/telegram] permanent lock alert error:", e?.message));

    return {
      allowed: false,
      statusCode: 423,
      isPermanentlyLocked: true,
      message: "🔒 Your account has been permanently locked due to 10 failed login attempts. Please contact admin support or wait for Super Admin approval.",
    };
  }

  // If failed attempts are 1, 2, 3, 4 (before 5-attempt threshold)
  if (newFailedAttempts < 5) {
    await db.update(users).set({
      failedLoginAttempts: newFailedAttempts,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    const remaining = 5 - newFailedAttempts;

    return {
      allowed: false,
      statusCode: 401,
      remainingAttempts: remaining,
      message: `Incorrect password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before temporary account lock.`,
    };
  }

  // 5. Exceeded 5 failed attempts -> Trigger Progressive Lockout Tier
  const newTier = currentTier + 1;
  let durationMs = 2 * 60 * 1000; // Tier 1: 2 minutes
  let durationDesc = "2 minutes";

  if (newTier === 2) {
    durationMs = 5 * 60 * 1000; // Tier 2: 5 minutes
    durationDesc = "5 minutes";
  } else if (newTier === 3) {
    durationMs = 15 * 60 * 1000; // Tier 3: 15 minutes
    durationDesc = "15 minutes";
  } else if (newTier === 4) {
    durationMs = 60 * 60 * 1000; // Tier 4: 1 hour
    durationDesc = "1 hour";
  } else if (newTier >= 5) {
    durationMs = 24 * 60 * 60 * 1000; // Tier 5: 24 hours
    durationDesc = "24 hours";
  }

  const lockoutUntilDate = new Date(Date.now() + durationMs);

  await db.update(users).set({
    failedLoginAttempts: newFailedAttempts,
    lockoutTier: newTier,
    lockoutUntil: lockoutUntilDate,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));

  // If 24-hour lockout (Tier 5) is reached, send Telegram Notification to Admin!
  if (newTier === 5) {
    await sendTelegramAlert(
      `🚨 <b>SECURITY ALERT: ACCOUNT LOCKED FOR 24 HOURS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>User:</b> ${user.name} (<code>${user.email}</code>)\n` +
      `⚠️ <b>Reason:</b> 5 consecutive lockout escalations (Repeated incorrect password attempts).\n` +
      `⏳ <b>Lockout Duration:</b> 24 Hours (until ${lockoutUntilDate.toLocaleString("en-IN")})\n` +
      `⏰ <b>Timestamp:</b> ${new Date().toLocaleString("en-IN")}\n\n` +
      `👉 <b>Quick Unlock Telegram Command:</b>\n<code>/unlock ${user.email}</code>`
    ).catch((e: any) => console.warn("[lockout/telegram] 24hr alert error:", e?.message));
  }

  return {
    allowed: false,
    statusCode: 429,
    lockoutUntil: lockoutUntilDate,
    message: `⏳ Account locked for ${durationDesc} due to repeated incorrect password attempts. Please try again later or use Forgot Password.`,
  };
}

/**
 * Unlocks a user account and clears all lockout states.
 */
export async function unlockUserAccount(
  userIdOrEmail: number | string,
  adminIdentifier: string = "Admin"
): Promise<{ success: boolean; user?: typeof users.$inferSelect; message: string }> {
  let targetUser: typeof users.$inferSelect | undefined;

  if (typeof userIdOrEmail === "number" || (!isNaN(Number(userIdOrEmail)) && !String(userIdOrEmail).includes("@"))) {
    const [u] = await db.select().from(users).where(eq(users.id, Number(userIdOrEmail))).limit(1);
    targetUser = u;
  } else {
    const cleanEmail = String(userIdOrEmail).toLowerCase().trim();
    const [u] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    targetUser = u;
  }

  if (!targetUser) {
    return { success: false, message: `User not found: ${userIdOrEmail}` };
  }

  await db.update(users).set({
    failedLoginAttempts: 0,
    lockoutTier: 0,
    lockoutUntil: null,
    isPermanentlyLocked: false,
    status: targetUser.status === "locked" || targetUser.status === "blocked" ? "active" : targetUser.status,
    updatedAt: new Date(),
  }).where(eq(users.id, targetUser.id));

  await sendTelegramAlert(
    `🔓 <b>ACCOUNT UNLOCKED</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>User:</b> ${targetUser.name} (<code>${targetUser.email}</code>)\n` +
    `👮 <b>Unlocked By:</b> ${adminIdentifier}\n` +
    `✅ <b>Status:</b> Restored to Active with 0 failed attempts.`
  ).catch(() => {});

  return {
    success: true,
    user: targetUser,
    message: `Account for ${targetUser.name} (${targetUser.email}) unlocked successfully.`,
  };
}
