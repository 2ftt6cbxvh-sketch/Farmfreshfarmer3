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
const CACHE_TTL_MS = 30_000; // 30s — enough for Neon cold starts, prevents hammering

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
    // ⚠️ On DB error: return LAST KNOWN state (not active:false) to prevent flicker
    // If we never had a state, default to inactive
    if (cachedStatus) return cachedStatus;
    return {
      active: false,
      headline: "Scheduled Maintenance Underway",
      message: "We are currently optimizing our platform. Back shortly!",
      allowAdminBypass: true,
    };
  }
}

/** Force-clear the server-side cache immediately (call after setMaintenance) */
export function invalidateMaintenanceCache(): void {
  cacheExpiry = 0;
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
/**
 * Express middleware — Hard lockdown of ALL customer/public API routes during maintenance.
 * Only verified staff/admin JWT holders pass through.
 * Everything else → 503 immediately, no DB queries, no processing.
 */
export async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const url = req.originalUrl || req.url || req.path;

  // ── ABSOLUTE EXEMPTIONS (always pass, even during maintenance) ──
  // These are required for the maintenance screen itself to function
  const alwaysAllow = (
    url === "/health" ||
    url === "/api/health" ||
    url.startsWith("/api/maintenance") ||           // maintenance status polling
    url.startsWith("/api/telegram") ||              // Telegram webhooks (order alerts etc.)
    url.startsWith("/telegram") ||                  // Telegram webhook alt path
    url.startsWith("/api/whatsapp") ||              // WhatsApp webhook
    url.startsWith("/api/admin/login") ||           // Admin login (staff need to get in)
    url.startsWith("/api/admin/auth") ||            // Admin auth endpoints
    url.startsWith("/api/admin/security/secret-unlock") ||
    url.startsWith("/api/admin/security/telegram-challenge") ||
    url.startsWith("/api/admin/security/check-telegram-approval") ||
    url.startsWith("/api/admin/security/lockdown") ||
    url.startsWith("/api/admin/mfa") ||             // Admin MFA
    url.startsWith("/api/admin/totp")               // Admin TOTP
  );

  if (alwaysAllow) return next();

  // ── CHECK IF MAINTENANCE IS ACTIVE ──
  let status: MaintenanceStatus;
  try {
    status = await getMaintenanceStatus();
  } catch {
    // On cache/DB error during check, fail open (let request through)
    return next();
  }

  if (!status.active) return next();

  // ── MAINTENANCE IS ACTIVE — verify admin/staff JWT ──
  let isVerifiedStaff = false;

  const authHeader = req.headers.authorization;
  const token =
    authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : req.cookies?.accessToken ||
        req.cookies?.admin_token ||
        req.cookies?.token;

  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const { getJwtSecret } = await import("./encryption");
      const decoded = jwt.verify(token, getJwtSecret()) as any;
      const uid = Number(decoded?.userId || decoded?.sub || decoded?.id || 0);

      if (uid > 0) {
        const { users } = await import("@shared/schema");
        const [user] = await db
          .select({ role: users.role, email: users.email, isPrimaryAdmin: users.isPrimaryAdmin })
          .from(users)
          .where(eq(users.id, uid))
          .limit(1);

        isVerifiedStaff = !!(
          user &&
          (user.isPrimaryAdmin ||
            user.email === "admin@farmfreshfarmer.com" ||
            user.role === "admin" ||
            user.role === "superadmin" ||
            user.role === "manager_admin" ||
            user.role === "subadmin" ||
            user.role === "staff")
        );
      }
    } catch {
      // Invalid / expired token → not staff
    }
  }

  // ── VERIFIED STAFF → PASS THROUGH ──
  if (isVerifiedStaff) return next();

  // ── EVERYONE ELSE → 503 HARD BLOCK ──
  // Applies to: customers, guests, unauthenticated requests, all public APIs
  // This includes: /api/products, /api/orders, /api/auth/*, /api/cart, /api/search, etc.
  res.status(503).json({
    maintenance: true,
    status: 503,
    error: "Service Unavailable",
    headline: status.headline,
    message: status.message,
    estimatedEnd: status.estimatedEnd ?? null,
    estimatedMinutes: status.estimatedMinutes ?? null,
    retryAfter: status.estimatedMinutes ? status.estimatedMinutes * 60 : 1800,
  });
}

