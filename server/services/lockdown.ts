/**
 * Lockdown service — manual emergency lock for the entire platform.
 */
import { db } from "../db";
import { lockdownState, securityAuditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export interface LockdownStatus {
  active: boolean;
  reason: string;
  activatedAt?: Date | null;
}

let cachedStatus: LockdownStatus | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 10_000;

export async function getLockdownStatus(): Promise<LockdownStatus> {
  const now = Date.now();
  if (cachedStatus && now < cacheExpiry) return cachedStatus;
  try {
    const [row] = await db.select().from(lockdownState).where(eq(lockdownState.id, 1));
    cachedStatus = row ? { active: row.active, reason: row.reason, activatedAt: row.activatedAt } : { active: false, reason: "" };
    cacheExpiry = now + CACHE_TTL_MS;
    return cachedStatus;
  } catch (e) {
    console.error("[lockdown] Failed to read lockdown state:", e);
    return { active: false, reason: "" };
  }
}

export async function setLockdown(active: boolean, reason: string, adminUserId?: number): Promise<void> {
  const now = new Date();
  await db.insert(lockdownState).values({
    id: 1, active, reason, activatedBy: adminUserId,
    activatedAt: active ? now : undefined,
    deactivatedAt: !active ? now : undefined,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: lockdownState.id,
    set: { active, reason, activatedBy: adminUserId, activatedAt: active ? now : undefined, deactivatedAt: !active ? now : undefined, updatedAt: now },
  });
  cachedStatus = null;
  cacheExpiry = 0;
  try {
    await db.insert(securityAuditLogs).values({
      eventType: active ? "lockdown_on" : "lockdown_off",
      userId: adminUserId,
      actionTaken: active ? `Lockdown activated: ${reason}` : "Lockdown deactivated",
    });
  } catch { /* non-critical */ }
  console.log(`[lockdown] ${active ? "ACTIVATED" : "DEACTIVATED"} by admin ${adminUserId}: ${reason}`);
}

export async function lockdownMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.path === "/health" || req.path.startsWith("/api/admin") || req.path.startsWith("/api/auth")) {
    return next();
  }
  try {
    const status = await getLockdownStatus();
    if (status.active) {
      res.status(423).json({
        locked: true,
        reason: status.reason || "System temporarily unavailable.",
        message: "FarmFreshFarmer is temporarily locked. Unauthorized access attempts are logged under IT Act 2000 and BNS 2023 Section 318.",
      });
      return;
    }
  } catch { /* allow through on error */ }
  next();
}
