/**
 * Admin warehouse management routes.
 */
import type { Express, Request, Response } from "express";
import { db } from "../../db";
import { warehouses, warehousePincodes, insertWarehouseSchema, insertWarehousePincodeSchema, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

async function requireAdmin(req: Request, res: Response, next: Function) {
  let userId = (req as any).jwtUser?.userId || req.session?.userId;
  let role = (req as any).jwtUser?.role || req.session?.role;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
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

export function registerAdminWarehouseRoutes(app: Express) {
  app.get("/api/admin/warehouses", requireAdmin as any, async (_req: Request, res: Response) => {
    return res.json({ warehouses: await db.select().from(warehouses).orderBy(warehouses.name) });
  });

  app.post("/api/admin/warehouses", requireAdmin as any, async (req: Request, res: Response) => {
    const { initialPincodes, defaultPackingMins, ...rest } = req.body;
    const parsed = insertWarehouseSchema.safeParse(rest);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const data: any = { ...parsed.data, latitude: String(parsed.data.latitude), longitude: String(parsed.data.longitude), averageSpeedKmph: String(parsed.data.averageSpeedKmph || 30) };
    const [created] = await db.insert(warehouses).values(data).returning();

    let pincodesCreated = 0;
    if (initialPincodes) {
      const pins = initialPincodes.split(",").map((p: string) => p.trim()).filter(Boolean);
      const packingMins = parseInt(defaultPackingMins, 10) || 30;
      for (const pin of pins) {
        await db.insert(warehousePincodes).values({
          warehouseId: created.id,
          pincode: pin,
          packingTimeMinutes: packingMins
        });
        pincodesCreated++;
      }
    }

    return res.status(201).json({ warehouse: created, pincodesCreated });
  });

  app.patch("/api/admin/warehouses/:id", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const parsed = insertWarehouseSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const updateData: any = { ...parsed.data, updatedAt: new Date() };
    if (updateData.latitude !== undefined) updateData.latitude = String(updateData.latitude);
    if (updateData.longitude !== undefined) updateData.longitude = String(updateData.longitude);
    if (updateData.averageSpeedKmph !== undefined) updateData.averageSpeedKmph = String(updateData.averageSpeedKmph);
    const [updated] = await db.update(warehouses).set(updateData).where(eq(warehouses.id, id)).returning();
    if (!updated) return res.status(404).json({ message: "Warehouse not found" });
    return res.json({ warehouse: updated });
  });

  app.delete("/api/admin/warehouses/:id", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    await db.delete(warehouses).where(eq(warehouses.id, id));
    return res.json({ message: "Warehouse deleted" });
  });

  app.get("/api/admin/warehouses/:id/pincodes", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    return res.json({ pincodes: await db.select().from(warehousePincodes).where(eq(warehousePincodes.warehouseId, id)) });
  });

  app.post("/api/admin/warehouses/:id/pincodes", requireAdmin as any, async (req: Request, res: Response) => {
    const warehouseId = parseInt(String(req.params.id));
    const parsed = insertWarehousePincodeSchema.safeParse({ ...req.body, warehouseId });
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const [created] = await db.insert(warehousePincodes).values(parsed.data).returning();
    return res.status(201).json({ pincode: created });
  });

  app.delete("/api/admin/warehouses/pincodes/:id", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    await db.delete(warehousePincodes).where(eq(warehousePincodes.id, id));
    return res.json({ message: "Pincode deleted" });
  });
}
