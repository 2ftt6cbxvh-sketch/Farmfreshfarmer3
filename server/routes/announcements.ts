import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { announcements, products, users } from "@shared/schema";
import { eq, desc, and, or, isNull, gt } from "drizzle-orm";

const STAFF_ROLES = ["admin", "superadmin", "subadmin", "manager_admin", "warehouse_admin", "custom_subadmin"];

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  let userId: number | undefined = (req.session as any)?.userId;
  let role: string | undefined = (req.session as any)?.role;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret");
      if (decoded?.userId || decoded?.sub) {
        userId = Number(decoded.userId || decoded.sub);
      }
    } catch {}
  }

  if (userId) {
    const [user] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
    if (user && (STAFF_ROLES.includes(user.role) || user.isPrimaryAdmin) && user.status !== "blocked" && user.status !== "locked" && !user.isPermanentlyLocked) {
      if (req.session) {
        req.session.userId = user.id;
        req.session.role = user.role;
      }
      return next();
    }
  }

  return res.status(403).json({ message: "Admin access required" });
}

export function registerAnnouncementRoutes(app: Express) {
  /** GET /api/announcements/active — Get active announcements and ads for visitors & users */
  app.get("/api/announcements/active", async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const rows = await db
        .select({
          id: announcements.id,
          title: announcements.title,
          message: announcements.message,
          category: announcements.category,
          productId: announcements.productId,
          isActive: announcements.isActive,
          showPopup: announcements.showPopup,
          priority: announcements.priority,
          targetAudience: announcements.targetAudience,
          createdAt: announcements.createdAt,
          expiresAt: announcements.expiresAt,
          product: {
            id: products.id,
            name: products.name,
            slug: products.slug,
            price: products.price,
            originalPrice: products.originalPrice,
            image: products.image,
            categorySlug: products.categorySlug,
            rating: products.rating,
            stock: products.stock,
            unit: products.unit,
          },
        })
        .from(announcements)
        .leftJoin(products, eq(announcements.productId, products.id))
        .where(
          and(
            eq(announcements.isActive, true),
            or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now))
          )
        )
        .orderBy(desc(announcements.priority), desc(announcements.createdAt));

      res.json(rows || []);
    } catch (err: any) {
      console.warn("[announcements/active notice]:", err?.message);
      res.json([]);
    }
  });

  /** GET /api/admin/announcements — Admin list of all announcements */
  app.get("/api/admin/announcements", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const rows = await db
        .select({
          id: announcements.id,
          title: announcements.title,
          message: announcements.message,
          category: announcements.category,
          productId: announcements.productId,
          isActive: announcements.isActive,
          showPopup: announcements.showPopup,
          priority: announcements.priority,
          targetAudience: announcements.targetAudience,
          createdAt: announcements.createdAt,
          expiresAt: announcements.expiresAt,
          product: {
            id: products.id,
            name: products.name,
            slug: products.slug,
            price: products.price,
            image: products.image,
          },
        })
        .from(announcements)
        .leftJoin(products, eq(announcements.productId, products.id))
        .orderBy(desc(announcements.createdAt));

      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch announcements", error: err?.message });
    }
  });

  /** POST /api/admin/announcements — Create a new announcement or ad */
  app.post("/api/admin/announcements", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { title, message, category, productId, isActive, showPopup, priority, targetAudience, expiresAt } = req.body || {};
      if (!title || !message) {
        return res.status(400).json({ message: "Title and message are required" });
      }

      const validCategories = ["warning", "critical", "advertisement"];
      const finalCategory = validCategories.includes(category) ? category : "advertisement";

      const [created] = await db.insert(announcements).values({
        title: title.trim(),
        message: message.trim(),
        category: finalCategory,
        productId: productId ? Number(productId) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        showPopup: showPopup !== undefined ? Boolean(showPopup) : true,
        priority: Number(priority) || 0,
        targetAudience: targetAudience || "all",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }).returning();

      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create announcement", error: err?.message });
    }
  });

  /** PATCH /api/admin/announcements/:id — Update announcement */
  app.patch("/api/admin/announcements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const updates: any = {};
      const { title, message, category, productId, isActive, showPopup, priority, targetAudience, expiresAt } = req.body || {};

      if (title !== undefined) updates.title = title.trim();
      if (message !== undefined) updates.message = message.trim();
      if (category !== undefined) updates.category = category;
      if (productId !== undefined) updates.productId = productId ? Number(productId) : null;
      if (isActive !== undefined) updates.isActive = Boolean(isActive);
      if (showPopup !== undefined) updates.showPopup = Boolean(showPopup);
      if (priority !== undefined) updates.priority = Number(priority) || 0;
      if (targetAudience !== undefined) updates.targetAudience = targetAudience;
      if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;

      const [updated] = await db.update(announcements).set(updates).where(eq(announcements.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Announcement not found" });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update announcement", error: err?.message });
    }
  });

  /** DELETE /api/admin/announcements/:id — Delete announcement */
  app.delete("/api/admin/announcements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      await db.delete(announcements).where(eq(announcements.id, id));
      res.json({ success: true, message: "Announcement deleted" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete announcement", error: err?.message });
    }
  });
}
