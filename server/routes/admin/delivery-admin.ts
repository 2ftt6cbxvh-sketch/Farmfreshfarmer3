/**
 * Admin delivery fee rules, geofence management, and location analytics routes.
 */
import type { Express, Request, Response } from "express";
import { db } from "../../db";
import {
  deliveryFeeRules, deliverySettings, geofenceCountries,
  customerLocationLogs, insertDeliveryFeeRuleSchema,
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

const STAFF_ROLES = ["admin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin", "delivery_partner"];

async function requireAdmin(req: Request, res: Response, next: Function) {
  let userId = (req as any).jwtUser?.userId || req.session?.userId;
  let role = (req as any).jwtUser?.role || req.session?.role;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const { getJwtSecret } = await import("../../services/encryption");
      const decoded: any = jwt.verify(token, getJwtSecret());
      if (decoded?.userId || decoded?.sub) {
        userId = Number(decoded.userId || decoded.sub);
      }
    } catch (e) {}
  }

  if (userId) {
    const { db } = await import("../../db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.select().from(users).where(eq(users.id, Number(userId)));
    if (user && STAFF_ROLES.includes(user.role) && user.status !== "blocked" && user.status !== "locked" && !user.isPermanentlyLocked) {
      if (req.session) {
        req.session.userId = user.id;
        req.session.role = user.role;
      }
      return (next as any)();
    }
  }

  return res.status(403).json({ message: "Admin or Staff access required" });
}

function numStr(v: any): string | undefined {
  return v !== undefined ? String(v) : undefined;
}

export function registerAdminDeliveryRoutes(app: Express) {
  // Aggregate GET /api/admin/delivery
  app.get("/api/admin/delivery", requireAdmin as any, async (_req: Request, res: Response) => {
    let [setting] = await db.select().from(deliverySettings).limit(1);
    if (!setting) {
      const [created] = await db.insert(deliverySettings).values({ id: 1, featureEnabled: true }).returning();
      setting = created;
    }
    const rules = await db.select().from(deliveryFeeRules).orderBy(deliveryFeeRules.minDistanceKm);
    return res.json({ setting: { featureEnabled: setting.featureEnabled }, rules });
  });

  app.get("/api/admin/delivery/fee-rules", requireAdmin as any, async (_req: Request, res: Response) => {
    return res.json({ rules: await db.select().from(deliveryFeeRules).orderBy(deliveryFeeRules.minDistanceKm) });
  });

  app.post("/api/admin/delivery/fee-rules", requireAdmin as any, async (req: Request, res: Response) => {
    const { minDistanceKm, maxDistanceKm, baseFee, perKmFee, maxFeeCap, freeDeliveryAboveOrderValue, active } = req.body;
    const [created] = await db.insert(deliveryFeeRules).values({
      minDistanceKm: numStr(minDistanceKm) || "0",
      maxDistanceKm: numStr(maxDistanceKm) || "10",
      baseFee: numStr(baseFee) || "30",
      perKmFee: numStr(perKmFee) || "5",
      maxFeeCap: numStr(maxFeeCap) || "150",
      freeDeliveryAboveOrderValue: numStr(freeDeliveryAboveOrderValue) || "500",
      active: active ?? true,
    }).returning();
    return res.json(created);
  });

  app.patch("/api/admin/delivery/fee-rules/:id", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    const updates: any = {};
    if (req.body.minDistanceKm !== undefined) updates.minDistanceKm = String(req.body.minDistanceKm);
    if (req.body.maxDistanceKm !== undefined) updates.maxDistanceKm = String(req.body.maxDistanceKm);
    if (req.body.baseFee !== undefined) updates.baseFee = String(req.body.baseFee);
    if (req.body.perKmFee !== undefined) updates.perKmFee = String(req.body.perKmFee);
    if (req.body.maxFeeCap !== undefined) updates.maxFeeCap = String(req.body.maxFeeCap);
    if (req.body.freeDeliveryAboveOrderValue !== undefined) updates.freeDeliveryAboveOrderValue = String(req.body.freeDeliveryAboveOrderValue);
    if (req.body.active !== undefined) updates.active = Boolean(req.body.active);

    const [updated] = await db.update(deliveryFeeRules).set(updates).where(eq(deliveryFeeRules.id, id)).returning();
    return res.json(updated);
  });

  app.delete("/api/admin/delivery/fee-rules/:id", requireAdmin as any, async (req: Request, res: Response) => {
    await db.delete(deliveryFeeRules).where(eq(deliveryFeeRules.id, parseInt(String(req.params.id))));
    return res.json({ message: "Rule deleted" });
  });

  app.get("/api/admin/delivery/settings", requireAdmin as any, async (_req: Request, res: Response) => {
    let [setting] = await db.select().from(deliverySettings).limit(1);
    if (!setting) {
      const [created] = await db.insert(deliverySettings).values({ id: 1, featureEnabled: true }).returning();
      setting = created;
    }
    return res.json({ featureEnabled: setting.featureEnabled });
  });

  app.post("/api/admin/delivery/settings", requireAdmin as any, async (req: Request, res: Response) => {
    const { featureEnabled } = req.body;
    if (typeof featureEnabled !== "boolean") return res.status(400).json({ message: "featureEnabled (boolean) required" });

    let [setting] = await db.select().from(deliverySettings).limit(1);
    if (!setting) {
      const [created] = await db.insert(deliverySettings).values({ id: 1, featureEnabled, updatedAt: new Date() }).returning();
      return res.json({ featureEnabled: created.featureEnabled });
    } else {
      const [updated] = await db.update(deliverySettings).set({ featureEnabled, updatedAt: new Date() }).where(eq(deliverySettings.id, setting.id)).returning();
      return res.json({ featureEnabled: updated.featureEnabled });
    }
  });

  app.get("/api/admin/geofence", requireAdmin as any, async (_req: Request, res: Response) => {
    return res.json({ countries: await db.select().from(geofenceCountries).orderBy(geofenceCountries.countryCode) });
  });

  app.post("/api/admin/geofence", requireAdmin as any, async (req: Request, res: Response) => {
    const { countryCode, countryName, allowed } = req.body;
    if (!countryCode) return res.status(400).json({ message: "countryCode required" });
    const [created] = await db.insert(geofenceCountries)
      .values({ countryCode: countryCode.toUpperCase(), countryName: countryName || "", allowed: allowed ?? true })
      .onConflictDoUpdate({ target: geofenceCountries.countryCode, set: { allowed, countryName } })
      .returning();
    return res.json({ country: created });
  });

  app.patch("/api/admin/geofence/:id", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    const { allowed } = req.body;
    const [updated] = await db.update(geofenceCountries).set({ allowed }).where(eq(geofenceCountries.id, id)).returning();
    return res.json({ country: updated });
  });

  app.delete("/api/admin/geofence/:id", requireAdmin as any, async (req: Request, res: Response) => {
    await db.delete(geofenceCountries).where(eq(geofenceCountries.id, parseInt(String(req.params.id))));
    return res.json({ message: "Country rule deleted" });
  });

  app.get("/api/admin/delivery/logs", requireAdmin as any, async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
    const logs = await db.select().from(customerLocationLogs).orderBy(desc(customerLocationLogs.createdAt)).limit(limit);
    return res.json({ logs });
  });

  app.get("/api/admin/analytics/location", requireAdmin as any, async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 200);
    const metrics = await db.select({
      pincode: customerLocationLogs.pincode,
      totalAttempts: sql<number>`count(*)`,
      serviceableCount: sql<number>`sum(case when ${customerLocationLogs.serviceable} then 1 else 0 end)`,
      unserviceableCount: sql<number>`sum(case when not ${customerLocationLogs.serviceable} then 1 else 0 end)`,
      avgFee: sql<number>`round(avg(${customerLocationLogs.calculatedFee}::numeric), 2)`,
      avgEtaMinutes: sql<number>`round(avg(${customerLocationLogs.calculatedTimeMinutes}), 0)`,
    }).from(customerLocationLogs).groupBy(customerLocationLogs.pincode)
      .orderBy(sql`count(*) desc`).limit(limit);
    return res.json({ metrics });
  });
}
