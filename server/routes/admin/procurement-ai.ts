import type { Express, Request, Response } from "express";
import { generateProcurementIntelligence } from "../../services/admin-procurement-ai";
import { db } from "../../db";
import { products, users, categories } from "@shared/schema";
import { eq } from "drizzle-orm";
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
    const STAFF_ROLES = ["admin", "manager_admin", "subadmin", "custom_subadmin", "warehouse_admin"];
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

      return res.json({ ok: true, product: newProduct, message: `✨ "${name}" was successfully added to the catalog!` });
    } catch (err: any) {
      console.error("[procurement-ai] Failed to add product:", err.message);
      return res.status(500).json({ message: "Failed to create product in catalog" });
    }
  });
}
