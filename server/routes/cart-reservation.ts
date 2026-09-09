/**
 * Cart Reservation API Routes
 * ===========================
 * Handles anti-hoarding cart reservation requests, session heartbeats,
 * and stock release events.
 */

import type { Express, Request, Response } from "express";
import {
  reserveCart,
  getCartReservationStatus,
  releaseCartReservations,
} from "../services/cart-reservation";

function resolveSessionId(req: Request): string {
  return (
    req.sessionID ||
    (req.headers["x-session-id"] as string) ||
    req.cookies?.sessionId ||
    `sess_${(req.ip || "unknown").replace(/[^a-zA-Z0-9]/g, "")}`
  );
}

function resolveUserId(req: Request): number | null {
  return (req as any).jwtUser?.userId || req.session?.userId || null;
}

export function registerCartReservationRoutes(app: Express) {
  /**
   * POST /api/cart/reserve
   * Lock items in cart for 10 minutes
   */
  app.post("/api/cart/reserve", async (req: Request, res: Response) => {
    try {
      const sessionId = resolveSessionId(req);
      const userId = resolveUserId(req);
      const { items } = req.body || {};

      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ success: false, remainingSeconds: 0, reservedCount: 0 });
      }

      const result = await reserveCart(sessionId, userId, items);
      return res.json(result);
    } catch (err: any) {
      console.error("[cart-reservation] Reserve error:", err.message);
      return res.status(500).json({ error: "Failed to reserve cart inventory" });
    }
  });

  /**
   * GET /api/cart/reservation-status
   * Get remaining countdown seconds and active hold details
   */
  app.get("/api/cart/reservation-status", async (req: Request, res: Response) => {
    try {
      const sessionId = resolveSessionId(req);
      const status = await getCartReservationStatus(sessionId);
      return res.json(status);
    } catch (err: any) {
      console.error("[cart-reservation] Status check error:", err.message);
      return res.status(500).json({ error: "Failed to get reservation status" });
    }
  });

  /**
   * POST /api/cart/release
   * Release reserved inventory when cart is cleared or checkout completes
   */
  app.post("/api/cart/release", async (req: Request, res: Response) => {
    try {
      const sessionId = resolveSessionId(req);
      await releaseCartReservations(sessionId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to release cart reservations" });
    }
  });
}
