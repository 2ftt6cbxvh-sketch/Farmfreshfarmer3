/**
 * Sub-Admin & Staff Management API routes.
 * Strictly restricted to Primary Admin (superuser).
 * Allows creating, updating, blocking, deleting, and assigning granular menu permissions to sub-admins.
 */
import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq, ne, and, sql } from "drizzle-orm";

/** Helper: Ensure user is authenticated AND is Primary Admin */
async function requirePrimaryAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    let userId: number | undefined = (req.session as any)?.userId;

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token || req.cookies?.admin_token);
    if (token) {
      const jwt = (await import("jsonwebtoken")).default;
      const { getJwtSecret } = await import("../../services/encryption");
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        if (decoded?.userId || decoded?.sub) userId = Number(decoded.userId || decoded.sub);
      } catch (e: any) {}
    }

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
    if (!user || user.status === "blocked" || user.status === "locked" || user.isPermanentlyLocked) {
      return res.status(403).json({ message: "Forbidden: Active account required" });
    }

    const isPrimary = Boolean(
      user.isPrimaryAdmin === true ||
      user.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
      user.id === 1
    );

    if (!isPrimary) {
      return res.status(403).json({
        message: "⛔ ACCESS DENIED: Only the Chief Super Admin is authorized to create, configure, or manage Sub-Admin credentials and permissions.",
      });
    }

    if (req.session) {
      req.session.userId = user.id;
      req.session.role = user.role;
    }

    (req as any).currentUser = user;
    return next();
  } catch (err: any) {
    return res.status(401).json({ message: "Invalid authentication token", error: err?.message });
  }
}

export function registerStaffRoutes(app: Express) {
  /** GET /api/admin/staff — List all staff & sub-admins (Primary Admin only) */
  app.get("/api/admin/staff", requirePrimaryAdmin, async (req: Request, res: Response) => {
    try {
      // Return all users with role !== 'customer' AND role !== 'delivery_partner'
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
        isVerified: users.isVerified,
        starRating: users.starRating,
        experienceRank: users.experienceRank,
        status: users.status,
        twoFaMethod: users.twoFaMethod,
        totpSecret: users.totpSecret,
        createdAt: users.createdAt,
      }).from(users).where(and(ne(users.role, "customer"), ne(users.role, "delivery_partner")));

      // Parse JSON string permissions array for each staff member
      const formatted = staffList.map((s) => ({
        ...s,
        permissions: s.permissions ? JSON.parse(s.permissions) : [],
        isVerified: Boolean(s.isVerified),
        starRating: (s.isPrimaryAdmin || s.email?.toLowerCase() === "admin@farmfreshfarmer.com") ? 6 : (s.starRating !== null && s.starRating !== undefined ? Math.min(6, Math.max(0, Number(s.starRating))) : 5),
        experienceRank: s.experienceRank || (s.isPrimaryAdmin ? "Super Admin" : "Specialist"),
        twoFaMethod: s.twoFaMethod || "both",
        hasTotpSecret: !!s.totpSecret,
      }));

      return res.json({ staff: formatted });
    } catch (err: any) {
      console.error("[staff] GET error:", err);
      return res.status(500).json({ message: "Failed to fetch staff list" });
    }
  });

  /** GET /api/admin/staff/2fa-config — Fetch Staff 2FA Global Config (Primary Admin only) */
  app.get("/api/admin/staff/2fa-config", requirePrimaryAdmin, async (_req: Request, res: Response) => {
    try {
      const { storage } = await import("../../storage");
      const isProduction = process.env.NODE_ENV === "production";
      const enabled = isProduction || ((await storage.settings.get("staff_sms_2fa_enabled")) === "true") || ((await storage.settings.get("subadmin_2fa_otp_enabled")) === "true");
      return res.json({
        enabled,
        isProduction,
        configured: true,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch 2FA config" });
    }
  });

  /** POST /api/admin/staff/2fa-config — Save Staff 2FA Global Config (Primary Admin only) */
  app.post("/api/admin/staff/2fa-config", requirePrimaryAdmin, async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body || {};
      const { storage } = await import("../../storage");

      if (enabled !== undefined) {
        const val = enabled ? "true" : "false";
        await storage.settings.set("staff_sms_2fa_enabled", val);
        await storage.settings.set("subadmin_2fa_otp_enabled", val);
      }

      return res.json({
        message: enabled
          ? "🛡️ Full Production 2FA Mode Activated! All Staff & Sub-Admins must verify 2FA on login."
          : "⚠️ Testing Mode Activated. Staff & Sub-Admins can sign in directly with password (local testing only).",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to save 2FA config" });
    }
  });

  /** POST /api/admin/staff/2fa-test — Test dispatch a 2FA OTP to a specific Telegram Chat ID */
  app.post("/api/admin/staff/2fa-test", requirePrimaryAdmin, async (req: Request, res: Response) => {
    try {
      const { chatId } = req.body || {};
      const { sendTelegram2faOtp, isTelegramOtpConfigured } = await import("../../services/telegram");

      if (!chatId || !String(chatId).trim()) {
        return res.status(400).json({ message: "Please provide a valid Telegram Chat ID to test dispatch." });
      }

      if (!(await isTelegramOtpConfigured())) {
        return res.status(400).json({ message: "2FA Bot Token is not configured yet. Please enter and save your @BotFather token first." });
      }

      const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const sent = await sendTelegram2faOtp(String(chatId).trim(), testOtp, "Administrator Test");

      if (sent) {
        return res.json({ message: `✨ Test 2FA OTP (${testOtp}) successfully sent to Telegram Chat ID ${chatId}!` });
      } else {
        return res.status(500).json({ message: "Failed to dispatch Telegram message. Verify the bot token and ensure the user has started the bot." });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Error testing 2FA OTP dispatch" });
    }
  });

  /** POST /api/admin/staff — Create a new sub-admin/staff member (Primary Admin only) */
  app.post("/api/admin/staff", requirePrimaryAdmin, async (req: Request, res: Response) => {
    try {
      const { name, email, phone, password, role, customTitle, permissions, isVerified, starRating, experienceRank, twoFaMethod } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }

      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail === "admin@farmfreshfarmer.com") {
        return res.status(403).json({ message: "⛔ The Chief Super Admin credentials (admin@farmfreshfarmer.com) are unique and cannot be duplicated." });
      }

      const existing = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const permString = Array.isArray(permissions) ? JSON.stringify(permissions) : JSON.stringify(permissions || []);

      // Never allow creating a root "admin" or "superadmin" — all created staff are sub-admins
      const ALLOWED_STAFF_ROLES = ["warehouse_admin", "manager_admin", "subadmin", "custom_subadmin", "customer_rep", "local_grievance_officer", "zonal_grievance_officer", "chief_grievance_officer"];
      const assignedRole = ALLOWED_STAFF_ROLES.includes(role) ? role : "custom_subadmin";

      const method = (twoFaMethod || "both") as "totp" | "sms" | "both" | "none";
      const { generateTotpSecret } = await import("../../services/totp");
      const totpSecret = (method === "totp" || method === "both") ? generateTotpSecret(cleanEmail).secret : null;

      const [created] = await db.insert(users).values({
        name: name.trim(),
        email: cleanEmail,
        username: cleanEmail,
        password: hashedPassword,
        phone: phone ? phone.trim() : null,
        role: assignedRole,
        customTitle: customTitle ? customTitle.trim() : null,
        permissions: permString,
        isPrimaryAdmin: false,
        isVerified: isVerified !== undefined ? Boolean(isVerified) : false,
        starRating: Math.min(6, Math.max(0, Number(starRating) ?? 5)),
        experienceRank: (experienceRank && String(experienceRank).trim()) ? String(experienceRank).trim() : "Specialist",
        twoFaMethod: method,
        totpSecret,
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
        isVerified: users.isVerified,
        starRating: users.starRating,
        experienceRank: users.experienceRank,
        twoFaMethod: users.twoFaMethod,
        status: users.status,
        createdAt: users.createdAt,
      });

      return res.status(201).json({
        staff: {
          ...created,
          permissions: created.permissions ? JSON.parse(created.permissions) : [],
          isVerified: Boolean(created.isVerified),
          starRating: Number(created.starRating) || 5,
          experienceRank: created.experienceRank || "Specialist",
          twoFaMethod: created.twoFaMethod || "both",
        },
      });
    } catch (err: any) {
      console.error("[staff] POST error:", err);
      return res.status(500).json({ message: err?.message || "Failed to create staff account" });
    }
  });

  /** Staff update handler */
  const handleStaffUpdate = async (req: Request, res: Response) => {
    try {
      const staffId = parseInt(String(req.params.id), 10);
      if (isNaN(staffId)) return res.status(400).json({ message: "Invalid staff ID" });

      const [target] = await db.select().from(users).where(eq(users.id, staffId)).limit(1);
      if (!target) return res.status(404).json({ message: "Staff account not found" });

      // Prevent editing primary admin via this endpoint
      if (target.email.toLowerCase() === "admin@farmfreshfarmer.com" || target.isPrimaryAdmin || target.id === 1) {
        return res.status(403).json({ message: "Chief Super Admin credentials cannot be modified via sub-admin management" });
      }

      const { name, phone, password, role, customTitle, status, permissions, isVerified, starRating, experienceRank, twoFaMethod } = req.body || {};
      const updates: any = { updatedAt: new Date() };

      if (name) updates.name = name.trim();
      if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
      
      // Never allow promoting to root admin
      if (role) {
        const ALLOWED_STAFF_ROLES = ["warehouse_admin", "manager_admin", "subadmin", "custom_subadmin", "customer_rep", "local_grievance_officer", "zonal_grievance_officer", "chief_grievance_officer"];
        updates.role = ALLOWED_STAFF_ROLES.includes(role) ? role : "custom_subadmin";
      }

      // Hardcode single-root immutability
      delete updates.isPrimaryAdmin;
      delete updates.email; // Email of staff accounts cannot be renamed to hijack identities

      if (customTitle !== undefined) updates.customTitle = customTitle ? customTitle.trim() : null;
      if (status) updates.status = status; // 'active' | 'blocked' | 'inactive'
      if (permissions !== undefined) {
        updates.permissions = Array.isArray(permissions) ? JSON.stringify(permissions) : JSON.stringify(permissions || []);
      }
      if (isVerified !== undefined) updates.isVerified = Boolean(isVerified);
      if (starRating !== undefined) updates.starRating = Math.min(6, Math.max(0, Number(starRating)));
      if (experienceRank !== undefined) updates.experienceRank = String(experienceRank).trim() || "Specialist";

      if (twoFaMethod !== undefined) {
        updates.twoFaMethod = twoFaMethod;
        if ((twoFaMethod === "totp" || twoFaMethod === "both") && !target.totpSecret) {
          const { generateTotpSecret } = await import("../../services/totp");
          updates.totpSecret = generateTotpSecret(target.email).secret;
        }
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
        isVerified: users.isVerified,
        starRating: users.starRating,
        experienceRank: users.experienceRank,
        twoFaMethod: users.twoFaMethod,
        status: users.status,
        createdAt: users.createdAt,
      });

      return res.json({
        staff: {
          ...updated,
          permissions: updated.permissions ? JSON.parse(updated.permissions) : [],
          isVerified: Boolean(updated.isVerified),
          starRating: Number(updated.starRating) || 5,
          experienceRank: updated.experienceRank || "Specialist",
        },
      });
    } catch (err: any) {
      console.error("[staff] Update error:", err);
      return res.status(500).json({ message: "Failed to update staff account" });
    }
  };

  /** PATCH/PUT/POST /api/admin/staff/:id — Edit sub-admin role, status, 2FA, or permissions (Primary Admin only) */
  app.patch("/api/admin/staff/:id", requirePrimaryAdmin, handleStaffUpdate);
  app.put("/api/admin/staff/:id", requirePrimaryAdmin, handleStaffUpdate);
  app.post("/api/admin/staff/:id", requirePrimaryAdmin, handleStaffUpdate);
  app.post("/api/admin/staff/:id/update", requirePrimaryAdmin, handleStaffUpdate);

  /** DELETE /api/admin/staff/:id — Delete sub-admin account (Primary Admin only) */
  app.delete("/api/admin/staff/:id", requirePrimaryAdmin, async (req: Request, res: Response) => {
    try {
      const staffId = parseInt(String(req.params.id), 10);
      if (isNaN(staffId)) return res.status(400).json({ message: "Invalid staff ID" });

      const currentUserId = (req as any).currentUser?.id || (req.session as any)?.userId;

      const { purgeUserCompletelyFromDatabase } = await import("../../services/user-purge");
      const result = await purgeUserCompletelyFromDatabase(staffId, currentUserId ? Number(currentUserId) : undefined);

      return res.json({ success: true, message: `Staff account ${result.name} (${result.email}) and all associated permissions permanently purged from the database.` });
    } catch (err: any) {
      console.error("[staff] DELETE error:", err);
      return res.status(500).json({ message: err.message || "Failed to delete staff account" });
    }
  });

  /** POST /api/admin/update-password — Update Super Admin password securely (Requires Current Password + 6-digit TOTP 2FA) */
  app.post("/api/admin/update-password", requirePrimaryAdmin, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword, totpCode } = req.body || {};

      if (!currentPassword) {
        return res.status(400).json({ message: "Current (old) Super Admin password is required." });
      }

      if (!newPassword || newPassword.trim().length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long." });
      }

      if (!totpCode || String(totpCode).trim().length < 6) {
        return res.status(400).json({ message: "6-Digit Authenticator TOTP 2FA verification code is required." });
      }

      // 1. Verify 6-Digit TOTP Code
      const { verifyTotpCode, generateTotpSecret } = await import("../../services/totp");
      const { storage } = await import("../../storage");
      let secret = await storage.settings.get("admin_totp_secret");
      if (!secret) {
        secret = generateTotpSecret().secret;
        await storage.settings.set("admin_totp_secret", secret);
        await storage.settings.set("admin_totp_enabled", "true");
      }

      const isTotpValid = verifyTotpCode(secret, String(totpCode).trim());
      if (!isTotpValid) {
        return res.status(400).json({ message: "Invalid 6-digit TOTP code. Check Apple Passwords or Authenticator App." });
      }

      // 2. Fetch Super Admin User
      const [adminUser] = await db.select().from(users).where(eq(users.email, "admin@farmfreshfarmer.com")).limit(1);
      if (!adminUser) {
        return res.status(404).json({ message: "Super Admin account not found." });
      }

      // 3. Verify Current Password against bcrypt hash
      const isPasswordValid = await bcrypt.compare(currentPassword, adminUser.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Current Super Admin password is incorrect." });
      }

      // 4. Update Password to new bcrypt hash
      const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
      await db.update(users).set({ password: hashedPassword, updatedAt: new Date() }).where(eq(users.id, adminUser.id));

      return res.json({ success: true, message: "🔑 Super Admin password updated successfully following Current Password & TOTP 2FA verification!" });
    } catch (err: any) {
      console.error("[update-password] Error:", err);
      return res.status(500).json({ message: err?.message || "Failed to update Super Admin password." });
    }
  });
}
