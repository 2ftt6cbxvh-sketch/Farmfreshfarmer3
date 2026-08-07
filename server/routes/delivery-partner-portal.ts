/**
 * Delivery Partner Portal API routes.
 * Handles delivery partner availability toggle ("I am Available" / "I am Not Available"),
 * viewing assigned orders with complete customer details (phone, address),
 * manual order pickup, and delivery status updates.
 */
import type { Express, Request, Response } from "express";
import { db } from "../db";
import { users, deliveryPartners, orders, orderItems, products } from "@shared/schema";
import { eq, and, isNull, inArray, desc } from "drizzle-orm";

async function getPartnerUser(req: Request): Promise<{ user: any; partner: any } | null> {
  let userId: number | undefined = (req.session as any)?.userId;
  if (!userId) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
    if (token) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
        userId = decoded?.userId || decoded?.sub;
      } catch {}
    }
  }

  if (!userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
  if (!user) return null;

  // Find linked delivery partner record
  const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, user.id)).limit(1);
  if (!partner) return null;

  return { user, partner };
}

export function registerDeliveryPartnerPortalRoutes(app: Express) {
  /** GET /api/partner/me — Fetch delivery partner profile & status */
  app.get("/api/partner/me", async (req: Request, res: Response) => {
    const ctx = await getPartnerUser(req);
    if (!ctx) return res.status(401).json({ message: "Authentication required for delivery partner portal" });

    const { user, partner } = ctx;

    // Fetch count of active assigned orders
    const activeOrders = await db.select().from(orders).where(
      and(eq(orders.assignedPartnerId, partner.id))
    );
    const activeCount = activeOrders.filter((o) => o.status !== "Delivered" && o.status !== "Cancelled").length;

    return res.json({
      partner: {
        ...partner,
        username: user.username,
        userStatus: user.status,
        activeOrdersCount: activeCount,
      },
    });
  });

  /** POST /api/partner/availability — Toggle "I am Available" / "I am Not Available" */
  app.post("/api/partner/availability", async (req: Request, res: Response) => {
    const ctx = await getPartnerUser(req);
    if (!ctx) return res.status(401).json({ message: "Authentication required" });

    const { partner } = ctx;
    const { status } = req.body || {}; // 'available' | 'offline'

    if (partner.isBlockedByAdmin) {
      return res.status(403).json({ message: "Superadmin has disabled availability mode for your account. Please contact Primary Admin." });
    }

    const newStatus = status === "available" ? "available" : "offline";
    const updates: any = {
      availabilityStatus: newStatus,
      updatedAt: new Date(),
    };
    if (newStatus === "available") {
      updates.lastAvailableAt = new Date();
    }

    const [updated] = await db.update(deliveryPartners).set(updates).where(eq(deliveryPartners.id, partner.id)).returning();

    return res.json({
      partner: updated,
      message: newStatus === "available" ? "🟢 You are now AVAILABLE for new order allocations" : "🔴 You are now NOT AVAILABLE",
    });
  });

  /** GET /api/partner/orders — Fetch assigned orders + available unassigned orders */
  app.get("/api/partner/orders", async (req: Request, res: Response) => {
    const ctx = await getPartnerUser(req);
    if (!ctx) return res.status(401).json({ message: "Authentication required" });

    const { partner } = ctx;

    try {
      // 1. Fetch orders assigned to this partner
      const assigned = await db.select().from(orders)
        .where(eq(orders.assignedPartnerId, partner.id))
        .orderBy(desc(orders.createdAt));

      // 2. Fetch available unassigned orders (Placed or Packed, no assigned partner)
      const unassigned = await db.select().from(orders)
        .where(and(isNull(orders.assignedPartnerId)))
        .orderBy(desc(orders.createdAt))
        .limit(20);

      // Fetch order items for both lists
      const allOrderIds = [...assigned.map((o) => o.id), ...unassigned.map((o) => o.id)];
      let itemsMap = new Map<number, any[]>();
      if (allOrderIds.length > 0) {
        const itemsList = await db.select().from(orderItems).where(inArray(orderItems.orderId, allOrderIds));
        for (const item of itemsList) {
          const list = itemsMap.get(item.orderId) || [];
          list.push(item);
          itemsMap.set(item.orderId, list);
        }
      }

      const formatOrder = (o: any) => ({
        ...o,
        items: itemsMap.get(o.id) || [],
      });

      return res.json({
        assignedOrders: assigned.map(formatOrder),
        availableUnassignedOrders: unassigned.filter((o) => o.status !== "Delivered" && o.status !== "Cancelled").map(formatOrder),
      });
    } catch (err: any) {
      console.error("[partner-portal] GET orders error:", err);
      return res.status(500).json({ message: "Failed to fetch delivery orders" });
    }
  });

  /** POST /api/partner/orders/:id/accept — Manually pick/accept an available order */
  app.post("/api/partner/orders/:id/accept", async (req: Request, res: Response) => {
    const ctx = await getPartnerUser(req);
    if (!ctx) return res.status(401).json({ message: "Authentication required" });

    const { partner } = ctx;
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order ID" });

    try {
      const [targetOrder] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!targetOrder) return res.status(404).json({ message: "Order not found" });

      if (targetOrder.assignedPartnerId && targetOrder.assignedPartnerId !== partner.id) {
        return res.status(400).json({ message: "This order has already been picked by another delivery partner." });
      }

      // Assign order to partner
      const [updatedOrder] = await db.update(orders).set({
        assignedPartnerId: partner.id,
        assignedAt: new Date(),
        status: targetOrder.status === "Placed" ? "Packed" : targetOrder.status,
        updatedAt: new Date(),
      }).where(eq(orders.id, orderId)).returning();

      // Update partner status to busy
      await db.update(deliveryPartners).set({
        availabilityStatus: "busy",
        updatedAt: new Date(),
      }).where(eq(deliveryPartners.id, partner.id));

      return res.json({ order: updatedOrder, message: "Order picked successfully!" });
    } catch (err: any) {
      console.error("[partner-portal] Accept order error:", err);
      return res.status(500).json({ message: "Failed to accept order" });
    }
  });

  /** POST /api/partner/orders/:id/status — Update order status (Out for delivery / Delivered) */
  app.post("/api/partner/orders/:id/status", async (req: Request, res: Response) => {
    const ctx = await getPartnerUser(req);
    if (!ctx) return res.status(401).json({ message: "Authentication required" });

    const { partner } = ctx;
    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body || {}; // 'Packed' | 'Out for delivery' | 'Delivered'

    if (!["Packed", "Out for delivery", "Delivered"].includes(status)) {
      return res.status(400).json({ message: "Invalid delivery status" });
    }

    try {
      const [targetOrder] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!targetOrder) return res.status(404).json({ message: "Order not found" });

      if (targetOrder.assignedPartnerId !== partner.id) {
        return res.status(403).json({ message: "You are not assigned to this order." });
      }

      const updates: any = {
        status,
        updatedAt: new Date(),
      };
      if (status === "Delivered") {
        updates.paymentStatus = "paid"; // Mark COD as paid upon delivery
      }

      const [updatedOrder] = await db.update(orders).set(updates).where(eq(orders.id, orderId)).returning();

      // If delivered, check if partner has other active orders. If none, restore status to 'available'
      if (status === "Delivered") {
        const remainingActive = await db.select().from(orders).where(
          and(eq(orders.assignedPartnerId, partner.id))
        );
        const pendingCount = remainingActive.filter((o) => o.id !== orderId && o.status !== "Delivered" && o.status !== "Cancelled").length;
        if (pendingCount === 0) {
          await db.update(deliveryPartners).set({
            availabilityStatus: "available",
            lastAvailableAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(deliveryPartners.id, partner.id));
        }
      }

      return res.json({ order: updatedOrder, message: `Order status updated to ${status}` });
    } catch (err: any) {
      console.error("[partner-portal] Update status error:", err);
      return res.status(500).json({ message: "Failed to update order status" });
    }
  });
}
