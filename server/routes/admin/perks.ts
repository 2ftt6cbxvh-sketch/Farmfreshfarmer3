/**
 * Employee & Delivery Partner Perk Discounts API routes.
 * Strictly managed by Primary Admin.
 * Configures separate discount percentages, max discount caps, and monthly order limits.
 */
import type { Express, Request, Response } from "express";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function requirePrimaryAdmin(req: Request, res: Response, next: Function) {
  try {
    let userId: number | undefined = (req.session as any)?.userId;
    let role: string | undefined = (req.session as any)?.role;

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
    if (token) {
      const jwt = (await import("jsonwebtoken")).default;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
        userId = Number(decoded?.userId || decoded?.sub);
      } catch (e: any) {}
    }

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    let user: any = null;
    if (userId) {
      const [found] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
      user = found;
    }

    if (!user || (!STAFF_ROLES.includes(user.role) && user.role !== "admin") || user.status === "blocked" || user.status === "locked" || user.isPermanentlyLocked) {
      return res.status(403).json({ message: "Forbidden: Admin privileges required" });
    }

    const isPrimary =
      role === "admin" ||
      user?.role === "admin" ||
      user?.isPrimaryAdmin === true ||
      user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
      Number(userId) === 1 ||
      Number(userId) === 0;

    if (!isPrimary) {
      return res.status(403).json({ message: "Access Denied: Only Primary Admin can configure perk discounts." });
    }

    next();
  } catch (err: any) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function registerPerkRoutes(app: Express) {
  /** GET /api/admin/perks/settings — Get perk discount settings */
  app.get("/api/admin/perks/settings", async (_req: Request, res: Response) => {
    try {
      // Ensure table exists
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS employee_perk_settings (
          id SERIAL PRIMARY KEY,
          subadmin_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 15,
          subadmin_max_cap NUMERIC(10,2) NOT NULL DEFAULT 500,
          subadmin_monthly_limit INTEGER NOT NULL DEFAULT 4,
          delivery_partner_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 20,
          delivery_partner_max_cap NUMERIC(10,2) NOT NULL DEFAULT 300,
          delivery_partner_monthly_limit INTEGER NOT NULL DEFAULT 6,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);

      const result = await db.execute(sql`SELECT * FROM employee_perk_settings LIMIT 1`);
      if (!result.rows || result.rows.length === 0) {
        await db.execute(sql`
          INSERT INTO employee_perk_settings (id, subadmin_discount_percent, subadmin_max_cap, subadmin_monthly_limit, delivery_partner_discount_percent, delivery_partner_max_cap, delivery_partner_monthly_limit)
          VALUES (1, 15, 500, 4, 20, 300, 6);
        `);
        return res.json({
          subadminDiscountPercent: 15,
          subadminMaxCap: 500,
          subadminMonthlyLimit: 4,
          deliveryPartnerDiscountPercent: 20,
          deliveryPartnerMaxCap: 300,
          deliveryPartnerMonthlyLimit: 6,
        });
      }

      const row: any = result.rows[0];
      return res.json({
        subadminDiscountPercent: parseFloat(row.subadmin_discount_percent || 15),
        subadminMaxCap: parseFloat(row.subadmin_max_cap || 500),
        subadminMonthlyLimit: parseInt(row.subadmin_monthly_limit || 4, 10),
        deliveryPartnerDiscountPercent: parseFloat(row.delivery_partner_discount_percent || 20),
        deliveryPartnerMaxCap: parseFloat(row.delivery_partner_max_cap || 300),
        deliveryPartnerMonthlyLimit: parseInt(row.delivery_partner_monthly_limit || 6, 10),
      });
    } catch (err: any) {
      console.error("[perks] GET error:", err);
      return res.status(500).json({ message: "Failed to fetch perk settings" });
    }
  });

  /** POST /api/admin/perks/settings — Save perk discount settings (Primary Admin only) */
  app.post("/api/admin/perks/settings", requirePrimaryAdmin as any, async (req: Request, res: Response) => {
    try {
      const {
        subadminDiscountPercent, subadminMaxCap, subadminMonthlyLimit,
        deliveryPartnerDiscountPercent, deliveryPartnerMaxCap, deliveryPartnerMonthlyLimit
      } = req.body || {};

      await db.execute(sql`
        INSERT INTO employee_perk_settings (
          id, subadmin_discount_percent, subadmin_max_cap, subadmin_monthly_limit,
          delivery_partner_discount_percent, delivery_partner_max_cap, delivery_partner_monthly_limit, updated_at
        ) VALUES (
          1, ${subadminDiscountPercent || 15}, ${subadminMaxCap || 500}, ${subadminMonthlyLimit || 4},
          ${deliveryPartnerDiscountPercent || 20}, ${deliveryPartnerMaxCap || 300}, ${deliveryPartnerMonthlyLimit || 6}, NOW()
        ) ON CONFLICT (id) DO UPDATE SET
          subadmin_discount_percent = ${subadminDiscountPercent || 15},
          subadmin_max_cap = ${subadminMaxCap || 500},
          subadmin_monthly_limit = ${subadminMonthlyLimit || 4},
          delivery_partner_discount_percent = ${deliveryPartnerDiscountPercent || 20},
          delivery_partner_max_cap = ${deliveryPartnerMaxCap || 300},
          delivery_partner_monthly_limit = ${deliveryPartnerMonthlyLimit || 6},
          updated_at = NOW();
      `);

      return res.json({
        message: "Employee & Delivery Partner perk settings saved successfully",
        subadminDiscountPercent: parseFloat(subadminDiscountPercent || 15),
        subadminMaxCap: parseFloat(subadminMaxCap || 500),
        subadminMonthlyLimit: parseInt(subadminMonthlyLimit || 4, 10),
        deliveryPartnerDiscountPercent: parseFloat(deliveryPartnerDiscountPercent || 20),
        deliveryPartnerMaxCap: parseFloat(deliveryPartnerMaxCap || 300),
        deliveryPartnerMonthlyLimit: parseInt(deliveryPartnerMonthlyLimit || 6, 10),
      });
    } catch (err: any) {
      console.error("[perks] POST error:", err);
      return res.status(500).json({ message: "Failed to save perk settings" });
    }
  });
}
