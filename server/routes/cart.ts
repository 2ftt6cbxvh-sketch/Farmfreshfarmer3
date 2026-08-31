/**
 * Cross-Device Persistent Cart API routes.
 * Synchronizes cart items to PostgreSQL (carts + cart_items) for authenticated users.
 */
import type { Express, Request, Response } from "express";
import { db } from "../db";
import { carts, cartItems, products } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

async function getUserIdFromReq(req: Request): Promise<number | undefined> {
  if ((req.session as any)?.userId) return (req.session as any).userId;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const { getJwtSecret } = await import("../services/encryption");
      const decoded = jwt.verify(token, getJwtSecret()) as any;
      if (decoded && (decoded.userId || decoded.sub)) {
        return typeof decoded.userId === "string" ? parseInt(decoded.userId, 10) : (decoded.userId || decoded.sub);
      }
    } catch {}
  }
  return undefined;
}

export function registerCartRoutes(app: Express) {
  /** GET /api/cart — Fetch logged-in user's saved cart from DB */
  app.get("/api/cart", async (req: Request, res: Response) => {
    const userId = await getUserIdFromReq(req);
    if (!userId) return res.json({ items: [] });

    try {
      const [userCart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      if (!userCart) return res.json({ items: [] });

      const dbItems = await db.select().from(cartItems).where(eq(cartItems.cartId, userCart.id));
      if (dbItems.length === 0) return res.json({ items: [] });

      // Consolidate duplicate productId + unit rows if any exist in DB
      const consolidatedKeyMap = new Map<string, { productId: number; unit: string; qty: number }>();
      for (const i of dbItems) {
        if (i.productId && i.qty > 0) {
          const key = `${i.productId}:${i.unit || ""}`;
          const existing = consolidatedKeyMap.get(key);
          if (existing) {
            existing.qty += i.qty;
          } else {
            consolidatedKeyMap.set(key, { productId: i.productId, unit: i.unit || "", qty: i.qty });
          }
        }
      }

      const productIds = Array.from(new Set(Array.from(consolidatedKeyMap.values()).map((v) => v.productId)));
      if (productIds.length === 0) return res.json({ items: [] });

      const productList = await db.select().from(products).where(inArray(products.id, productIds));
      const productMap = new Map(productList.map((p) => [p.id, p]));

      const items = Array.from(consolidatedKeyMap.values())
        .map(({ productId, unit, qty }) => {
          const p = productMap.get(productId);
          if (!p) return null;

          let rawPrice = Number(p.price) || 0;
          let activeUnit = unit || p.unit;

          if (unit && p.quantityTiers) {
            try {
              const tiers = typeof p.quantityTiers === "string" ? JSON.parse(p.quantityTiers) : p.quantityTiers;
              if (Array.isArray(tiers)) {
                const match = tiers.find((t: any) => t.quantity?.trim()?.toLowerCase() === unit.trim().toLowerCase());
                if (match && Number(match.price) > 0) {
                  rawPrice = Number(match.price);
                  activeUnit = match.quantity;
                }
              }
            } catch {}
          }

          const disc = Number(p.discountPercent || 0);
          const effective = disc > 0 ? Math.round(rawPrice * (1 - disc / 100)) : Math.round(rawPrice);

          return {
            productId: p.id,
            name: p.name,
            unit: activeUnit,
            price: effective,
            image: p.image,
            qty,
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
    const userId = await getUserIdFromReq(req);
    if (!userId) return res.json({ status: "guest" });

    const rawItems: Array<{ productId: number; qty: number; unit?: string }> = req.body.items || [];

    // Consolidate duplicate productId + unit combinations from client payload
    const itemMap = new Map<string, { productId: number; qty: number; unit?: string }>();
    for (const item of rawItems) {
      if (item && typeof item.productId === "number" && !isNaN(item.productId)) {
        const key = `${item.productId}:${item.unit || ""}`;
        const existing = itemMap.get(key);
        if (existing) {
          existing.qty += Number(item.qty) || 0;
        } else {
          itemMap.set(key, { productId: item.productId, qty: Number(item.qty) || 0, unit: item.unit });
        }
      }
    }

    const clientItems = Array.from(itemMap.values()).filter((i) => i.qty > 0);

    try {
      let [userCart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      if (!userCart) {
        const [inserted] = await db.insert(carts).values({ userId }).returning();
        userCart = inserted;
      }

      await db.transaction(async (tx) => {
        await tx.delete(cartItems).where(eq(cartItems.cartId, userCart.id));
        if (clientItems.length > 0) {
          await tx.insert(cartItems).values(
            clientItems.map((i) => ({
              cartId: userCart.id,
              productId: i.productId,
              qty: i.qty,
              unit: i.unit || null,
            }))
          );
        }
      });

      return res.json({ status: "synced", count: clientItems.length });
    } catch (e: any) {
      console.error("[cart] Failed to sync cart:", e);
      return res.status(500).json({ message: "Failed to sync cart" });
    }
  });

  /** POST /api/cart/merge — Merge guest cart with server cart upon login */
  app.post("/api/cart/merge", async (req: Request, res: Response) => {
    const userId = await getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const guestItems: Array<{ productId: number; qty: number }> = req.body.items || [];

    try {
      let [userCart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      if (!userCart) {
        const [inserted] = await db.insert(carts).values({ userId }).returning();
        userCart = inserted;
      }

      const dbItems = await db.select().from(cartItems).where(eq(cartItems.cartId, userCart.id));
      const itemMap = new Map<number, number>();
      for (const i of dbItems) {
        if (i.productId && i.qty > 0) {
          itemMap.set(i.productId, (itemMap.get(i.productId) || 0) + i.qty);
        }
      }

      // Merge guest quantities with existing server quantities
      for (const gi of guestItems) {
        if (gi && gi.productId && gi.qty > 0) {
          const existingQty = itemMap.get(gi.productId) || 0;
          itemMap.set(gi.productId, Math.max(existingQty, gi.qty));
        }
      }

      const mergedEntries = Array.from(itemMap.entries()).filter(([_, qty]) => qty > 0);

      await db.transaction(async (tx) => {
        await tx.delete(cartItems).where(eq(cartItems.cartId, userCart.id));
        if (mergedEntries.length > 0) {
          await tx.insert(cartItems).values(
            mergedEntries.map(([productId, qty]) => ({
              cartId: userCart.id,
              productId,
              qty,
            }))
          );
        }
      });

      const productIds = mergedEntries.map(([pId]) => pId);
      let hydratedItems: any[] = [];
      if (productIds.length > 0) {
        const productList = await db.select().from(products).where(inArray(products.id, productIds));
        const productMap = new Map(productList.map((p) => [p.id, p]));
        hydratedItems = mergedEntries
          .map(([pId, qty]) => {
            const p = productMap.get(pId);
            if (!p) return null;
            return {
              productId: p.id,
              name: p.name,
              unit: p.unit,
              price: Number(p.price) * (1 - Number(p.discountPercent || 0) / 100),
              image: p.image,
              qty,
            };
          })
          .filter(Boolean);
      }

      return res.json({ status: "merged", totalItems: mergedEntries.length, items: hydratedItems });
    } catch (e: any) {
      console.error("[cart] Failed to merge cart:", e);
      return res.status(500).json({ message: "Failed to merge cart" });
    }
  });
}
