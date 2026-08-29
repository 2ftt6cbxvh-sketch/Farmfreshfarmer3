/**
 * Centralised policy enforcement middleware.
 * Every protected route calls through here.
 *
 * Flow: authenticate → validate session → check permission → check resource scope → allow/deny
 *
 * NIST SP 800-207: Policy Enforcement Point
 */
import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getLockdownStatus } from "../services/lockdown";

// ── Permission constants ────────────────────────────────────────────
export const PERMISSIONS = {
  // Orders
  ORDERS_READ: "orders.read",
  ORDERS_UPDATE: "orders.update",
  ORDERS_REFUND: "orders.refund",
  // Products
  PRODUCTS_READ: "products.read",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_UPDATE: "products.update",
  PRODUCTS_DELETE: "products.delete",
  // Inventory
  INVENTORY_READ: "inventory.read",
  INVENTORY_UPDATE: "inventory.update",
  // Customers
  CUSTOMERS_READ: "customers.read",
  CUSTOMERS_MANAGE: "customers.manage",
  // Staff
  STAFF_READ: "staff.read",
  STAFF_MANAGE: "staff.manage",
  // Security (root only)
  SECURITY_READ: "security.read",
  SECURITY_MANAGE: "security.manage",
  // Audit (root only)
  AUDIT_READ: "audit.read",
  // Exports
  EXPORTS_CREATE: "exports.create",
  // Payments
  PAYMENTS_READ: "payments.read",
  PAYMENTS_MANAGE: "payments.manage",
  // Reviews
  REVIEWS_MODERATE: "reviews.moderate",
  // Settings
  SETTINGS_READ: "settings.read",
  SETTINGS_MANAGE: "settings.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ── Role → default permissions map ─────────────────────────────────
const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.values(PERMISSIONS), // root admin gets everything
  manager_admin: [
    PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.PRODUCTS_READ, PERMISSIONS.PRODUCTS_UPDATE, PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.STAFF_READ,
    PERMISSIONS.REVIEWS_MODERATE, PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.PAYMENTS_READ,
  ],
  warehouse_admin: [
    PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.PRODUCTS_READ, PERMISSIONS.ORDERS_READ,
  ],
  subadmin: [
    PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.PRODUCTS_READ,
  ],
  customer_rep: [
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.REVIEWS_MODERATE,
  ],
  local_grievance_officer: [PERMISSIONS.ORDERS_READ, PERMISSIONS.CUSTOMERS_READ],
  zonal_grievance_officer: [PERMISSIONS.ORDERS_READ, PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.STAFF_READ],
  chief_grievance_officer: [PERMISSIONS.ORDERS_READ, PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.STAFF_READ],
  delivery_partner: [],
  customer: [],
};

// ── Utility: check if a user has a permission ───────────────────────
export function userHasPermission(user: {
  role: string;
  permissions?: string | null;
  isPrimaryAdmin: boolean;
}, permission: Permission): boolean {
  // Root admin has all permissions
  if (user.isPrimaryAdmin || user.role === "admin") return true;

  // Check explicit permission list from DB
  if (user.permissions) {
    let perms: string[] = [];
    try {
      perms = typeof user.permissions === "string" ? JSON.parse(user.permissions) : user.permissions;
    } catch { perms = []; }
    if (perms.includes(permission)) return true;
  }

  // Fall back to role defaults
  const defaults = ROLE_DEFAULT_PERMISSIONS[user.role] || [];
  return defaults.includes(permission);
}

// ── requirePermission middleware factory ────────────────────────────
/**
 * Usage: app.get("/api/admin/orders", requirePermission(PERMISSIONS.ORDERS_READ), handler)
 */
export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Resolve userId
      let userId: number | undefined =
        (req as any).jwtUser?.userId || req.session?.userId;

      if (!userId) {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.accessToken;
        if (token) {
          try {
            const jwt = (await import("jsonwebtoken")).default;
            const { getJwtSecret } = await import("../services/encryption");
            const decoded = jwt.verify(token, getJwtSecret()) as any;
            userId = Number(decoded.userId || decoded.sub);
          } catch { /* ignore */ }
        }
      }

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // 2. Load user from DB (always fresh — no trusting token claims alone)
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // 3. Check account status
      if (user.status === "blocked" || user.isPermanentlyLocked) {
        return res.status(403).json({ message: "Account is locked or blocked" });
      }
      if (user.lockoutUntil && user.lockoutUntil > new Date()) {
        return res.status(429).json({ message: "Account temporarily locked. Try again later." });
      }

      // 4. Check global lockdown (customers blocked; admin/staff still allowed)
      const lockdownStatus = await getLockdownStatus();
      if (lockdownStatus.active && user.role === "customer") {
        return res.status(503).json({ message: "Platform is temporarily unavailable" });
      }

      // 5. Check recovery pending (block everything except re-enrollment)
      if (user.recoveryPending) {
        const allowedInRecovery = ["/api/admin/mfa", "/api/admin/webauthn", "/api/admin/emergency-codes", "/api/admin/change-password", "/api/admin/update-password"];
        const isAllowed = allowedInRecovery.some((path) => req.path.startsWith(path));
        if (!isAllowed) {
          return res.status(403).json({
            message: "⚠️ Account in Recovery Mode. Complete credential re-enrollment before accessing this resource.",
            recoveryPending: true,
          });
        }
      }

      // 6. Check permission
      const hasPerm = userHasPermission(
        { role: user.role, permissions: user.permissions, isPrimaryAdmin: user.isPrimaryAdmin },
        permission
      );
      if (!hasPerm) {
        return res.status(403).json({
          message: `⛔ Access denied. Required permission: ${permission}`,
        });
      }

      // 7. Attach resolved user to request for downstream handlers
      (req as any).resolvedUser = user;
      return next();
    } catch (err: any) {
      console.error("[authorization] Error:", err.message);
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };
}

// ── requireRootAdmin convenience ────────────────────────────────────
export function requireRootAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let userId: number | undefined =
        (req as any).jwtUser?.userId || req.session?.userId;

      if (!userId) {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.accessToken;
        if (token) {
          try {
            const jwt = (await import("jsonwebtoken")).default;
            const { getJwtSecret } = await import("../services/encryption");
            const decoded = jwt.verify(token, getJwtSecret()) as any;
            userId = Number(decoded.userId || decoded.sub);
          } catch { /* ignore */ }
        }
      }

      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return res.status(401).json({ message: "User not found" });
      if (user.status === "blocked" || user.isPermanentlyLocked) {
        return res.status(403).json({ message: "Account is locked" });
      }

      const isPrimary = Boolean(
        user.isPrimaryAdmin ||
        user.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
        user.id === 1
      );
      if (!isPrimary) {
        return res.status(403).json({ message: "⛔ Chief Executive Admin access required" });
      }

      (req as any).resolvedUser = user;
      return next();
    } catch (err: any) {
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };
}
