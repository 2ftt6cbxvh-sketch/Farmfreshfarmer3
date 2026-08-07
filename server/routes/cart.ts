/**
 * Cross-Device Persistent Cart API routes.
 * Synchronizes cart items to PostgreSQL (carts + cart_items) for authenticated users.
 */
import type { Express, Request, Response } from "express";
import { db } from "../db";
import { carts, cartItems, products } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

export function registerCartRoutes(app: Express) {
  /** GET /api/cart — Fetch logged-in user's saved cart from DB */
  app.get("/api/cart", async (req: Request, res: Response) => {
    const userId: number | undefined = (req.session as any)?.userId || (req as any).jwtUser?.userId;
    if (!userId) return res.json({ items: [] });

    try {
      const [userCart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      if (!userCart) return res.json({ items: [] });

      const dbItems = await db.select().from(cartItems).where(eq(cartItems.cartId, userCart.id));
      if (dbItems.length === 0) return res.json({ items: [] });

      const productIds = dbItems.map((i) => i.productId);
      const productList = await db.select().from(products).where(inArray(products.id, productIds));
      const productMap = new Map(productList.map((p) => [p.id, p]));

      const items = dbItems
        .map((i) => {
          const p = productMap.get(i.productId);
          if (!p) return null;
          return {
            productId: p.id,
            name: p.name,
            unit: p.unit,
            price: Number(p.price) * (1 - Number(p.discountPercent || 0) / 100),
            image: p.image,
            qty: i.qty,
          };
        })
        .filter(Boolean);

      return res.json({ items });
    } catch (e: any) {
      console.error("[cart] Failed to fetch cart:", e);
      return res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  /** POST /api/cart — Sync current cart items to DB for logged-in user */
  app.post("/api/cart", async (req: Request, res: Response) => {
    const userId: number | undefined = (req.session as any)?.userId || (req as any).jwtUser?.userId;
    if (!userId) return res.json({ status: "guest" });

    const clientItems: Array<{ productId: number; qty: number }> = req.body.items || [];

    try {
      let [userCart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      if (!userCart) {
        const [inserted] = await db.insert(carts).values({ userId }).returning();
        userCart = inserted;
      }

      // Clear existing cart items and replace with current sync state
      await db.delete(cartItems).where(eq(cartItems.cartId, userCart.id));

      if (clientItems.length > 0) {
        await db.insert(cartItems).values(
          clientItems.map((i) => ({
            cartId: userCart.id,
            productId: i.productId,
            qty: i.qty,
          }))
        );
      }

      return res.json({ status: "synced", count: clientItems.length });
    } catch (e: any) {
      console.error("[cart] Failed to sync cart:", e);
      return res.status(500).json({ message: "Failed to sync cart" });
    }
  });

  /** POST /api/cart/merge — Merge guest cart with server cart upon login */
  app.post("/api/cart/merge", async (req: Request, res: Response) => {
    const userId: number | undefined = (req.session as any)?.userId || (req as any).jwtUser?.userId;
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const guestItems: Array<{ productId: number; qty: number }> = req.body.items || [];

    try {
      let [userCart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      if (!userCart) {
        const [inserted] = await db.insert(carts).values({ userId }).returning();
        userCart = inserted;
      }

      const dbItems = await db.select().from(cartItems).where(eq(cartItems.cartId, userCart.id));
      const itemMap = new Map(dbItems.map((i) => [i.productId, i.qty]));

      // Merge guest quantities with existing server quantities
      for (const gi of guestItems) {
        const existingQty = itemMap.get(gi.productId) || 0;
        itemMap.set(gi.productId, Math.max(existingQty, gi.qty));
      }

      await db.delete(cartItems).where(eq(cartItems.cartId, userCart.id));

      const mergedEntries = Array.from(itemMap.entries());
      if (mergedEntries.length > 0) {
        await db.insert(cartItems).values(
          mergedEntries.map(([productId, qty]) => ({
            cartId: userCart.id,
            productId,
            qty,
          }))
        );
      }

      return res.json({ status: "merged", totalItems: mergedEntries.length });
    } catch (e: any) {
      console.error("[cart] Failed to merge cart:", e);
      return res.status(500).json({ message: "Failed to merge cart" });
    }
  });
}
