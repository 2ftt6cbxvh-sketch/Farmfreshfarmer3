/**
 * Admin warehouse management routes.
 */
import type { Express, Request, Response } from "express";
import { db } from "../../db";
import { warehouses, warehousePincodes, insertWarehouseSchema, insertWarehousePincodeSchema } from "@shared/schema";
import { eq } from "drizzle-orm";

function requireAdmin(req: Request, res: Response, next: Function) {
  const userId = (req as any).jwtUser?.userId || req.session?.userId;
  const role = (req as any).jwtUser?.role || req.session?.role;
  if (!userId || role !== "admin") return res.status(403).json({ message: "Admin access required" });
  (next as any)();
}

export function registerAdminWarehouseRoutes(app: Express) {
  app.get("/api/admin/warehouses", requireAdmin as any, async (_req: Request, res: Response) => {
    return res.json({ warehouses: await db.select().from(warehouses).orderBy(warehouses.name) });
  });

  app.post("/api/admin/warehouses", requireAdmin as any, async (req: Request, res: Response) => {
    const parsed = insertWarehouseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const data: any = { ...parsed.data, latitude: String(parsed.data.latitude), longitude: String(parsed.data.longitude), averageSpeedKmph: String(parsed.data.averageSpeedKmph || 30) };
    const [created] = await db.insert(warehouses).values(data).returning();
    return res.status(201).json({ warehouse: created });
  });

  app.patch("/api/admin/warehouses/:id", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
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
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    await db.delete(warehouses).where(eq(warehouses.id, id));
    return res.json({ message: "Warehouse deleted" });
  });

  app.get("/api/admin/warehouses/:id/pincodes", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    return res.json({ pincodes: await db.select().from(warehousePincodes).where(eq(warehousePincodes.warehouseId, id)) });
  });

  app.post("/api/admin/warehouses/:id/pincodes", requireAdmin as any, async (req: Request, res: Response) => {
    const warehouseId = parseInt(req.params.id);
    const parsed = insertWarehousePincodeSchema.safeParse({ ...req.body, warehouseId });
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const [created] = await db.insert(warehousePincodes).values(parsed.data).returning();
    return res.status(201).json({ pincode: created });
  });

  app.delete("/api/admin/warehouses/pincodes/:id", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    await db.delete(warehousePincodes).where(eq(warehousePincodes.id, id));
    return res.json({ message: "Pincode deleted" });
  });
}
