import type { Express, Request, Response } from "express";
import { generateProcurementIntelligence, invalidateProcurementCache } from "../../services/admin-procurement-ai";
import { db } from "../../db";
import { products, users, categories, coupons, discountRules, securityAuditLogs } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { getJwtSecret } from "../../services/encryption";

export function registerAdminProcurementAiRoutes(app: Express) {
  async function requireAdminAuth(req: Request, res: Response, next: Function) {
    let userId: number | undefined = (req as any).jwtUser?.userId || req.session?.userId;
    if (!userId) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.cookies?.accessToken || req.cookies?.token);
      if (token) {
        try {
          const jwt = (await import("jsonwebtoken")).default;
          const decoded = jwt.verify(token, getJwtSecret()) as any;
          userId = Number(decoded.userId || decoded.sub);
        } catch {}
      }
    }
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const STAFF_ROLES = ["admin", "superadmin", "manager_admin", "subadmin", "custom_subadmin", "warehouse_admin"];
    if (!user || (!STAFF_ROLES.includes(user.role) && !user.isPrimaryAdmin)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    (req as any).adminUser = user;
    return next();
  }

  /**
   * GET /api/admin/procurement-ai/recommendations
   */
  app.get("/api/admin/procurement-ai/recommendations", requireAdminAuth as any, async (req: Request, res: Response) => {
    try {
      const force = req.query.force === "true";
      const intelligence = await generateProcurementIntelligence(force);
      return res.json(intelligence);
    } catch (err: any) {
      console.error("[procurement-ai] Error generating recommendations:", err.message);
      return res.status(500).json({ message: err.message || "Failed to generate procurement recommendations" });
    }
  });

  /**
   * POST /api/admin/procurement-ai/add-product — 1-Click addition of AI recommended product
   */
  app.post("/api/admin/procurement-ai/add-product", requireAdminAuth as any, async (req: Request, res: Response) => {
    try {
      const { name, nameTe, categorySlug, price, unit, description, image, stock } = req.body || {};

      if (!name || !categorySlug || !price) {
        return res.status(400).json({ message: "Name, category, and price are required" });
      }

      // Verify category exists or fallback to first category
      const [existingCat] = await db.select().from(categories).where(eq(categories.slug, categorySlug)).limit(1);
      const validCategory = existingCat ? categorySlug : "vegetables";

      const [newProduct] = await db
        .insert(products)
        .values({
          name: String(name).trim(),
          nameTe: nameTe ? String(nameTe).trim() : null,
          categorySlug: validCategory,
          price: String(price),
          unit: unit ? String(unit).trim() : "1 Kg",
          description: description ? String(description).trim() : "",
          image: image || "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80",
          stock: typeof stock === "number" ? stock : 50,
          lowStockThreshold: 10,
          active: true,
          approvalStatus: "approved",
          submittedBy: (req as any).adminUser?.id || 1,
        })
        .returning();

      invalidateProcurementCache();

      return res.json({ ok: true, product: newProduct, message: `✨ "${name}" was successfully added to the catalog!` });
    } catch (err: any) {
      console.error("[procurement-ai] Failed to add product:", err.message);
      return res.status(500).json({ message: "Failed to create product in catalog" });
    }
  });

  /**
   * POST /api/admin/procurement-ai/auto-restock — 1-Click Auto Restock from Restock Radar
   */
  app.post("/api/admin/procurement-ai/auto-restock", requireAdminAuth as any, async (req: Request, res: Response) => {
    try {
      const { productId, productName, restockQty = 50 } = req.body || {};
      const qtyToAdd = Math.max(1, Number(restockQty));

      if (productId) {
        const [existing] = await db.select().from(products).where(eq(products.id, Number(productId))).limit(1);
        if (existing) {
          const newStock = Number(existing.stock || 0) + qtyToAdd;
          await db.update(products).set({ stock: newStock, active: true }).where(eq(products.id, existing.id));

          invalidateProcurementCache();

          return res.json({
            ok: true,
            productId: existing.id,
            productName: existing.name,
            newStock,
            message: `📦 Restocked "${existing.name}" by +${qtyToAdd} units! Current stock is now ${newStock} units.`,
          });
        }
      }

      if (productName) {
        const [existingByName] = await db.select().from(products).where(sql`LOWER(${products.name}) = LOWER(${String(productName).trim()})`).limit(1);
        if (existingByName) {
          const newStock = Number(existingByName.stock || 0) + qtyToAdd;
          await db.update(products).set({ stock: newStock, active: true }).where(eq(products.id, existingByName.id));

          invalidateProcurementCache();

          return res.json({
            ok: true,
            productId: existingByName.id,
            productName: existingByName.name,
            newStock,
            message: `📦 Restocked "${existingByName.name}" by +${qtyToAdd} units! Current stock is now ${newStock} units.`,
          });
        }
      }

      return res.status(404).json({ message: "Product not found in catalog to restock" });
    } catch (err: any) {
      console.error("[procurement-ai] Auto restock error:", err.message);
      return res.status(500).json({ message: "Failed to execute auto-restock action" });
    }
  });

  /**
   * POST /api/admin/procurement-ai/dispatch-po-telegram — Send structured farm PO alert to Telegram
   */
  app.post("/api/admin/procurement-ai/dispatch-po-telegram", requireAdminAuth as any, async (req: Request, res: Response) => {
    try {
      const { crop, cropTe, growingRegion, district, farmerHub, peakProcurementWindow, targetQty = "100 Kg", recommendedPrice } = req.body || {};

      const { sendTelegramEmergencySecurityAlert, isTelegramEmergencyConfigured } = await import("../../services/telegram");

      const message = `🌾 <b>DIRECT FARM PROCUREMENT DISPATCH ORDER</b>\n\n` +
        `• <b>Crop:</b> ${crop} (${cropTe || ""})\n` +
        `• <b>Harvest Belt:</b> 📍 ${growingRegion} (${district})\n` +
        `• <b>Farmer Hub / Collective:</b> 🚜 ${farmerHub || "Regional Farm Hub"}\n` +
        `• <b>Harvest Window:</b> 🗓️ ${peakProcurementWindow || "Active Season"}\n` +
        `• <b>Target PO Quantity:</b> 📦 ${targetQty}\n` +
        `• <b>Est. Farm-Gate Rate:</b> ₹${recommendedPrice || 150}\n\n` +
        `<i>Dispatched by Chief Admin via Vishnu AI Procurement Engine</i>`;

      let sent = false;
      try {
        if (await isTelegramEmergencyConfigured()) {
          sent = await sendTelegramEmergencySecurityAlert(message, req);
        }
      } catch {}

      return res.json({
        ok: true,
        telegramDispatched: sent,
        message: `📢 Farm Procurement Dispatch for "${crop}" (${growingRegion}) has been initiated and broadcast to the Telegram operations channel!`,
      });
    } catch (err: any) {
      console.error("[procurement-ai] Telegram PO dispatch error:", err.message);
      return res.status(500).json({ message: "Failed to dispatch Telegram PO alert" });
    }
  });

  /**
   * POST /api/admin/procurement-ai/launch-flash-promo — Launch Flash Crop Promotion / Coupon
   */
  app.post("/api/admin/procurement-ai/launch-flash-promo", requireAdminAuth as any, async (req: Request, res: Response) => {
    try {
      const { crop, discountPercent = "15.00" } = req.body || {};
      const cleanCrop = String(crop || "HARVEST").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
      const code = `HARVEST-${cleanCrop}-${Math.floor(10 + Math.random() * 90)}`;

      await db.insert(coupons).values({
        code,
        discountPercent: String(discountPercent),
        minOrder: "200.00",
        active: true,
      });

      return res.json({
        ok: true,
        couponCode: code,
        message: `🚀 Flash Harvest Promo "${code}" (${discountPercent}% OFF) successfully created and activated!`,
      });
    } catch (err: any) {
      console.error("[procurement-ai] Flash promo error:", err.message);
      return res.status(500).json({ message: "Failed to launch flash promo coupon" });
    }
  });
}
