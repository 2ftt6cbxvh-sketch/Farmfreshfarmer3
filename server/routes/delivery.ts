/**
 * Delivery resolution API routes.
 */
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { resolveByCoords, resolveByPincode, isDeliveryFeatureEnabled } from "../services/delivery";
import { getLockdownStatus } from "../services/lockdown";

const coordsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  orderValue: z.coerce.number().optional(),
});

const pincodeSchema = z.object({
  pincode: z.string().min(4).max(12),
  orderValue: z.coerce.number().optional(),
});

export function registerDeliveryRoutes(app: Express) {
  /** POST /api/delivery/resolve */
  app.post("/api/delivery/resolve", async (req: Request, res: Response) => {
    const body = req.body || {};
    const userId: number | undefined = (req.session as any)?.userId || (req as any).jwtUser?.userId;
    const orderValue = body.orderValue ?? 0;
    try {
      let result;
      if ("pincode" in body) {
        const parsed = pincodeSchema.safeParse(body);
        if (!parsed.success) return res.status(400).json({ message: "Invalid pincode" });
        result = await resolveByPincode(parsed.data.pincode, userId, orderValue);
      } else {
        const parsed = coordsSchema.safeParse(body);
        if (!parsed.success) return res.status(400).json({ message: "Provide {lat, lng} or {pincode}" });
        result = await resolveByCoords(parsed.data.lat, parsed.data.lng, userId, orderValue);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Delivery resolution failed" });
    }
  });

  /** GET /api/delivery/settings */
  app.get("/api/delivery/settings", async (_req: Request, res: Response) => {
    const enabled = await isDeliveryFeatureEnabled();
    return res.json({ featureEnabled: enabled });
  });

  /** GET /api/delivery/status — combined status check */
  app.get("/api/delivery/status", async (_req: Request, res: Response) => {
    const [lockdown, deliveryFeatureEnabled] = await Promise.all([
      getLockdownStatus(),
      isDeliveryFeatureEnabled(),
    ]);
    return res.json({ lockdown, deliveryFeatureEnabled });
  });
}
