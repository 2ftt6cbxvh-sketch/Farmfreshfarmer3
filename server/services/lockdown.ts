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
  const url = req.originalUrl || req.url || req.path;

  // 1. Health check exemption
  if (req.path === "/health" || url === "/health") {
    return next();
  }

  // 2. Telegram Webhook exemption (so /lock off, /approve work remotely)
  if (url.startsWith("/api/telegram") || url.startsWith("/telegram")) {
    return next();
  }

  // 3. Secret Passage & Lockdown status exemptions
  if (
    url.startsWith("/api/admin/security/secret-unlock") ||
    url.startsWith("/api/admin/security/telegram-challenge") ||
    url.startsWith("/api/admin/security/check-telegram-approval") ||
    url.startsWith("/api/admin/security/lockdown")
  ) {
    return next();
  }

  try {
    const status = await getLockdownStatus();
    if (status.active) {
      // Verify if current request belongs to Primary Super Admin
      let isSuperAdmin = false;
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);

      if (token) {
        try {
          const jwt = (await import("jsonwebtoken")).default;
          const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
          if (decoded.email === "admin@farmfreshfarmer.com" || decoded.role === "superadmin") {
            isSuperAdmin = true;
          }
        } catch {
          try {
            const jwt = (await import("jsonwebtoken")).default;
            const decodedUnverified = jwt.decode(token) as any;
            if (decodedUnverified?.email === "admin@farmfreshfarmer.com" || decodedUnverified?.role === "superadmin") {
              isSuperAdmin = true;
            }
          } catch {}
        }
      }

      if (!isSuperAdmin && req.session?.userId) {
        const { db } = await import("../db");
        const { users } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        const [user] = await db.select().from(users).where(eq(users.id, Number(req.session.userId)));
        if (user && (user.email === "admin@farmfreshfarmer.com" || user.isPrimaryAdmin || user.role === "superadmin")) {
          isSuperAdmin = true;
        }
      }

      // Primary Super Admin is allowed through during lockdown
      if (isSuperAdmin) {
        return next();
      }

      // STRICT LOCKDOWN: Block all other users, subadmins, customers, visitors, and APIs!
      res.status(423).json({
        locked: true,
        reason: status.reason || "System temporarily unavailable.",
        message: "FarmFreshFarmer is temporarily locked. Unauthorized access attempts are logged under IT Act 2000 and BNS 2023 Section 318.",
      });
      return;
    }
  } catch (err) {
    console.error("[lockdown middleware error]", err);
  }

  next();
}
