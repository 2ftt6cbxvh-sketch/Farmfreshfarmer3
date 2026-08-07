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

async function requireAdmin(req: Request, res: Response, next: Function) {
  let userId = (req as any).jwtUser?.userId || req.session?.userId;
  let role = (req as any).jwtUser?.role || req.session?.role;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
      if (decoded.userId) {
        userId = decoded.userId;
        role = decoded.role;
      }
    } catch (e) {}
  }

  if (role === "admin") {
    return (next as any)();
  }

  if (userId) {
    const { db } = await import("../../db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user && (user.role === "admin" || user.email === "admin@farmfreshfarmer.com")) {
      if (req.session) {
        req.session.userId = user.id;
        req.session.role = "admin";
      }
      return (next as any)();
    }
  }

  return res.status(403).json({ message: "Admin access required" });
}

function numStr(v: any): string | undefined {
  return v !== undefined ? String(v) : undefined;
}

export function registerAdminDeliveryRoutes(app: Express) {
  // Aggregate GET /api/admin/delivery
  app.get("/api/admin/delivery", requireAdmin as any, async (_req: Request, res: Response) => {
    const [setting] = await db.select().from(deliverySettings).limit(1);
    const rules = await db.select().from(deliveryFeeRules).orderBy(deliveryFeeRules.minDistanceKm);
    return res.json({ setting: { featureEnabled: setting?.featureEnabled ?? false }, rules });
  });

  app.get("/api/admin/delivery/fee-rules", requireAdmin as any, async (_req: Request, res: Response) => {
    return res.json({ rules: await db.select().from(deliveryFeeRules).orderBy(deliveryFeeRules.minDistanceKm) });
  });

  app.post("/api/admin/delivery/fee-rules", requireAdmin as any, async (req: Request, res: Response) => {
    const parsed = insertDeliveryFeeRuleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const d: any = parsed.data;
    const [created] = await db.insert(deliveryFeeRules).values({
      ...d, minDistanceKm: numStr(d.minDistanceKm), maxDistanceKm: numStr(d.maxDistanceKm),
      baseFee: numStr(d.baseFee), perKmFee: numStr(d.perKmFee),
      maxFeeCap: numStr(d.maxFeeCap), freeDeliveryAboveOrderValue: numStr(d.freeDeliveryAboveOrderValue),
    }).returning();
    return res.status(201).json({ rule: created });
  });

  app.patch("/api/admin/delivery/fee-rules/:id", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const parsed = insertDeliveryFeeRuleSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const d: any = parsed.data;
    const updateData: any = { ...d };
    if (d.minDistanceKm !== undefined) updateData.minDistanceKm = String(d.minDistanceKm);
    if (d.maxDistanceKm !== undefined) updateData.maxDistanceKm = String(d.maxDistanceKm);
    if (d.baseFee !== undefined) updateData.baseFee = String(d.baseFee);
    if (d.perKmFee !== undefined) updateData.perKmFee = String(d.perKmFee);
    const [updated] = await db.update(deliveryFeeRules).set(updateData).where(eq(deliveryFeeRules.id, id)).returning();
    return res.json({ rule: updated });
  });

  app.delete("/api/admin/delivery/fee-rules/:id", requireAdmin as any, async (req: Request, res: Response) => {
    await db.delete(deliveryFeeRules).where(eq(deliveryFeeRules.id, parseInt(String(req.params.id))));
    return res.json({ message: "Rule deleted" });
  });

  app.get("/api/admin/delivery/settings", requireAdmin as any, async (_req: Request, res: Response) => {
    const [setting] = await db.select().from(deliverySettings).limit(1);
    return res.json({ featureEnabled: setting?.featureEnabled ?? false });
  });

  app.post("/api/admin/delivery/settings", requireAdmin as any, async (req: Request, res: Response) => {
    const { featureEnabled } = req.body;
    if (typeof featureEnabled !== "boolean") return res.status(400).json({ message: "featureEnabled (boolean) required" });
    await db.insert(deliverySettings).values({ featureEnabled, updatedAt: new Date() })
      .onConflictDoUpdate({ target: deliverySettings.id, set: { featureEnabled, updatedAt: new Date() } });
    return res.json({ featureEnabled });
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
