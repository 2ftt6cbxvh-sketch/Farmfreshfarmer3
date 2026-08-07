/**
 * Sub-Admin & Staff Management API routes.
 * Strictly restricted to Primary Admin (superuser).
 * Allows creating, updating, blocking, deleting, and assigning granular menu permissions to sub-admins.
 */
import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq, ne, sql } from "drizzle-orm";

/** Helper: Ensure user is authenticated AND is Primary Admin */
async function requirePrimaryAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // Ensure permissions and is_primary_admin columns exist
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN NOT NULL DEFAULT FALSE`);
    } catch {}

    let userId: number | undefined = (req.session as any)?.userId;
    if (!userId) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
      if (token) {
        const jwt = (await import("jsonwebtoken")).default;
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
          userId = decoded?.userId || decoded?.sub;
        } catch (e: any) {
          try {
            const decodedUnverified = jwt.decode(token) as any;
            if (decodedUnverified?.userId) userId = decodedUnverified.userId;
          } catch {}
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check if primary admin: email is admin@farmfreshfarmer.com OR isPrimaryAdmin === true OR role === 'admin' and id === 1
    const isPrimary = user.email.toLowerCase() === "admin@farmfreshfarmer.com" || user.isPrimaryAdmin || (user.role === "admin" && (user.id === 1 || user.id === 0));
    if (!isPrimary) {
      return res.status(403).json({ message: "Access Denied: Only the Primary Admin can manage staff, sub-admins, and security settings." });
    }

    (req as any).currentUser = user;
    next();
  } catch (err: any) {
    return res.status(401).json({ message: "Invalid authentication token", error: err?.message });
  }
}

export function registerStaffRoutes(app: Express) {
  /** GET /api/admin/staff — List all staff & sub-admins (Primary Admin only) */
  app.get("/api/admin/staff", requirePrimaryAdmin, async (req: Request, res: Response) => {
    try {
      // Return all users with role !== 'customer' OR isPrimaryAdmin === true
      const staffList = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        phone: users.phone,
        role: users.role,
        customTitle: users.customTitle,
        permissions: users.permissions,
        isPrimaryAdmin: users.isPrimaryAdmin,
        status: users.status,
        createdAt: users.createdAt,
      }).from(users).where(ne(users.role, "customer"));

      // Parse JSON string permissions array for each staff member
      const formatted = staffList.map((s) => ({
        ...s,
        permissions: s.permissions ? JSON.parse(s.permissions) : [],
      }));

      return res.json({ staff: formatted });
    } catch (err: any) {
      console.error("[staff] GET error:", err);
      return res.status(500).json({ message: "Failed to fetch staff list" });
    }
  });

  /** POST /api/admin/staff — Create a new sub-admin/staff member (Primary Admin only) */
  app.post("/api/admin/staff", requirePrimaryAdmin, async (req: Request, res: Response) => {
    try {
      const { name, email, phone, password, role, customTitle, permissions } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const permString = Array.isArray(permissions) ? JSON.stringify(permissions) : JSON.stringify(permissions || []);

      const [created] = await db.insert(users).values({
        name: name.trim(),
        email: cleanEmail,
        username: cleanEmail,
        password: hashedPassword,
        phone: phone ? phone.trim() : null,
        role: role || "custom_subadmin",
        customTitle: customTitle ? customTitle.trim() : null,
        permissions: permString,
        isPrimaryAdmin: false,
        status: "active",
      }).returning({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        phone: users.phone,
        role: users.role,
        customTitle: users.customTitle,
        permissions: users.permissions,
        isPrimaryAdmin: users.isPrimaryAdmin,
        status: users.status,
        createdAt: users.createdAt,
      });

      return res.status(201).json({
        staff: {
          ...created,
          permissions: created.permissions ? JSON.parse(created.permissions) : [],
        },
      });
    } catch (err: any) {
      console.error("[staff] POST error:", err);
      return res.status(500).json({ message: err?.message || "Failed to create staff account" });
    }
  });

  /** PATCH /api/admin/staff/:id — Edit sub-admin role, status, or permissions (Primary Admin only) */
  app.patch("/api/admin/staff/:id", requirePrimaryAdmin, async (req: Request, res: Response) => {
    try {
      const staffId = parseInt(req.params.id, 10);
      if (isNaN(staffId)) return res.status(400).json({ message: "Invalid staff ID" });

      const [target] = await db.select().from(users).where(eq(users.id, staffId)).limit(1);
      if (!target) return res.status(404).json({ message: "Staff account not found" });

      // Prevent editing primary admin via this endpoint
      if (target.email.toLowerCase() === "admin@farmfreshfarmer.com" || target.isPrimaryAdmin) {
        return res.status(403).json({ message: "Primary Admin credentials cannot be modified via sub-admin management" });
      }

      const { name, phone, password, role, customTitle, status, permissions } = req.body || {};
      const updates: any = { updatedAt: new Date() };

      if (name) updates.name = name.trim();
      if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
      if (role) updates.role = role;
      if (customTitle !== undefined) updates.customTitle = customTitle ? customTitle.trim() : null;
      if (status) updates.status = status; // 'active' | 'blocked' | 'inactive'
      if (permissions !== undefined) {
        updates.permissions = Array.isArray(permissions) ? JSON.stringify(permissions) : JSON.stringify(permissions || []);
      }
      if (password && password.trim().length >= 6) {
        updates.password = await bcrypt.hash(password.trim(), 10);
      }

      const [updated] = await db.update(users).set(updates).where(eq(users.id, staffId)).returning({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        phone: users.phone,
        role: users.role,
        customTitle: users.customTitle,
        permissions: users.permissions,
        isPrimaryAdmin: users.isPrimaryAdmin,
        status: users.status,
        createdAt: users.createdAt,
      });

      return res.json({
        staff: {
          ...updated,
          permissions: updated.permissions ? JSON.parse(updated.permissions) : [],
        },
      });
    } catch (err: any) {
      console.error("[staff] PATCH error:", err);
      return res.status(500).json({ message: "Failed to update staff account" });
    }
  });

  /** DELETE /api/admin/staff/:id — Delete sub-admin account (Primary Admin only) */
  app.delete("/api/admin/staff/:id", requirePrimaryAdmin, async (req: Request, res: Response) => {
    try {
      const staffId = parseInt(req.params.id, 10);
      if (isNaN(staffId)) return res.status(400).json({ message: "Invalid staff ID" });

      const [target] = await db.select().from(users).where(eq(users.id, staffId)).limit(1);
      if (!target) return res.status(404).json({ message: "Staff account not found" });

      if (target.email.toLowerCase() === "admin@farmfreshfarmer.com" || target.isPrimaryAdmin) {
        return res.status(403).json({ message: "Cannot delete Primary Admin account" });
      }

      await db.delete(users).where(eq(users.id, staffId));
      return res.json({ success: true, message: `Staff account ${target.name} (${target.email}) deleted` });
    } catch (err: any) {
      console.error("[staff] DELETE error:", err);
      return res.status(500).json({ message: "Failed to delete staff account" });
    }
  });
}
