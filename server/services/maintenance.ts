/**
 * Maintenance service — customer-facing scheduled maintenance controller.
 * Can be activated from Admin Dashboard or via Telegram bot (/maintenance on/off).
 */
import { db } from "../db";
import { maintenanceState, securityAuditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export interface MaintenanceStatus {
  active: boolean;
  headline: string;
  message: string;
  estimatedEnd?: Date | null;
  estimatedMinutes?: number | null;
  allowAdminBypass: boolean;
  activatedAt?: Date | null;
  activatedBy?: number | null;
}

let cachedStatus: MaintenanceStatus | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 3_000;

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const now = Date.now();
  if (cachedStatus && now < cacheExpiry) return cachedStatus;
  try {
    const [row] = await db.select().from(maintenanceState).where(eq(maintenanceState.id, 1));
    cachedStatus = row
      ? {
          active: row.active,
          headline: row.headline,
          message: row.message,
          estimatedEnd: row.estimatedEnd,
          estimatedMinutes: row.estimatedMinutes,
          allowAdminBypass: row.allowAdminBypass,
          activatedAt: row.activatedAt,
          activatedBy: row.activatedBy,
        }
      : {
          active: false,
          headline: "Scheduled Maintenance Underway",
          message: "We are currently optimizing our farm-fresh catalog and ultrafast delivery infrastructure. We will be back shortly!",
          estimatedMinutes: 30,
          allowAdminBypass: true,
        };
    cacheExpiry = now + CACHE_TTL_MS;
    return cachedStatus;
  } catch (e) {
    console.error("[maintenance] Failed to read maintenance state:", e);
    return {
      active: false,
      headline: "Scheduled Maintenance Underway",
      message: "We are currently optimizing our platform. Back shortly!",
      allowAdminBypass: true,
    };
  }
}

export async function setMaintenance(
  active: boolean,
  options?: {
    headline?: string;
    message?: string;
    estimatedMinutes?: number;
    allowAdminBypass?: boolean;
    adminUserId?: number;
  }
): Promise<MaintenanceStatus> {
  const now = new Date();
  const headline = options?.headline?.trim() || "Scheduled Maintenance Underway";
  const message =
    options?.message?.trim() ||
    "We are currently optimizing our farm-fresh catalog and ultrafast delivery infrastructure. We will be back shortly!";
  const estimatedMinutes = options?.estimatedMinutes ? Number(options.estimatedMinutes) : 30;
  const estimatedEnd = active && estimatedMinutes > 0 ? new Date(now.getTime() + estimatedMinutes * 60 * 1000) : null;
  const allowAdminBypass = options?.allowAdminBypass !== false;
  const adminUserId = options?.adminUserId;

  const newStatus: MaintenanceStatus = {
    active,
    headline,
    message,
    estimatedMinutes,
    estimatedEnd,
    allowAdminBypass,
    activatedAt: active ? now : null,
    activatedBy: adminUserId || null,
  };

  // 1. Instantly update in-memory cache (ultra-low latency <1ms)
  cachedStatus = newStatus;
  cacheExpiry = Date.now() + 30_000;

  // 2. Persist to DB
  await db
    .insert(maintenanceState)
    .values({
      id: 1,
      active,
      headline,
      message,
      estimatedMinutes,
      estimatedEnd,
      allowAdminBypass,
      activatedBy: adminUserId,
      activatedAt: active ? now : undefined,
      deactivatedAt: !active ? now : undefined,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: maintenanceState.id,
      set: {
        active,
        headline,
        message,
        estimatedMinutes,
        estimatedEnd,
        allowAdminBypass,
        activatedBy: adminUserId,
        activatedAt: active ? now : undefined,
        deactivatedAt: !active ? now : undefined,
        updatedAt: now,
      },
    })
    .catch((err) => console.error("[maintenance] DB persist error:", err));

  // Non-blocking background audit log
  db.insert(securityAuditLogs)
    .values({
      eventType: active ? "maintenance_on" : "maintenance_off",
      userId: adminUserId || null,
      actionTaken: active
        ? `Under Maintenance Mode activated: ${headline} (ETA: ${estimatedMinutes}m)`
        : "Under Maintenance Mode deactivated",
    })
    .catch(() => {});

  console.log(
    `[maintenance] ${active ? "ACTIVATED" : "DEACTIVATED"} instantly by admin ${adminUserId || "system"}: ${headline} (${estimatedMinutes}m)`
  );

  return newStatus;
}

/**
 * Express middleware to intercept non-admin requests when maintenance mode is active
 */
export async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const url = req.originalUrl || req.url || req.path;

  // 1. Health check exemption
  if (req.path === "/health" || url === "/health") {
    return next();
  }

  // 2. Telegram Webhook exemption
  if (url.startsWith("/api/telegram") || url.startsWith("/telegram")) {
    return next();
  }

  // 3. Maintenance & Public Status endpoints
  if (
    url.startsWith("/api/maintenance") ||
    url.startsWith("/api/admin/security/secret-unlock") ||
    url.startsWith("/api/admin/security/telegram-challenge") ||
    url.startsWith("/api/admin/security/check-telegram-approval") ||
    url.startsWith("/api/admin/security/lockdown") ||
    url.startsWith("/api/admin/login") ||
    url.startsWith("/api/settings/public")
  ) {
    return next();
  }

  try {
    const status = await getMaintenanceStatus();
    if (status.active) {
      // Check if user is staff/admin
      let isStaffOrAdmin = false;
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : req.cookies?.accessToken || req.cookies?.token;

      if (token) {
        try {
          const jwt = (await import("jsonwebtoken")).default;
          const { getJwtSecret } = await import("./encryption");
          const decoded = jwt.verify(token, getJwtSecret()) as any;
          if (decoded && (decoded.userId || decoded.sub)) {
            const { users } = await import("@shared/schema");
            const [user] = await db
              .select()
              .from(users)
              .where(eq(users.id, Number(decoded.userId || decoded.sub)))
              .limit(1);
            if (
              user &&
              (user.email === "admin@farmfreshfarmer.com" ||
                user.isPrimaryAdmin ||
                user.role === "admin" ||
                user.role === "superadmin" ||
                user.role === "manager_admin" ||
                user.role === "subadmin")
            ) {
              isStaffOrAdmin = true;
            }
          }
        } catch {
          // invalid token
        }
      }

      // If accessing admin API or admin routes and is admin, allow
      if (isStaffOrAdmin || url.startsWith("/api/admin")) {
        return next();
      }

      // For public API routes, return 503 Service Unavailable with maintenance info
      if (url.startsWith("/api/")) {
        return res.status(503).json({
          maintenance: true,
          status: 503,
          message: status.message,
          headline: status.headline,
          estimatedEnd: status.estimatedEnd,
        });
      }
    }
  } catch (err) {
    console.error("[maintenanceMiddleware] Error checking status:", err);
  }

  next();
}
