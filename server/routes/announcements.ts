import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "../db";

const STAFF_ROLES = ["admin", "superadmin", "subadmin", "manager_admin", "warehouse_admin", "custom_subadmin"];

async function ensureAnnouncementsTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        category VARCHAR(32) NOT NULL DEFAULT 'advertisement',
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        show_popup BOOLEAN NOT NULL DEFAULT TRUE,
        priority INTEGER NOT NULL DEFAULT 0,
        target_audience VARCHAR(32) NOT NULL DEFAULT 'all',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE
      );
      CREATE INDEX IF NOT EXISTS announcements_category_idx ON announcements(category);
      CREATE INDEX IF NOT EXISTS announcements_is_active_idx ON announcements(is_active);
    `);
  } catch (e: any) {
    console.warn("[announcements table ensure notice]:", e?.message);
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  let userId: number | undefined =
    (req.session as any)?.userId ||
    (req.session as any)?.user?.id ||
    (req as any).user?.id ||
    (req.session as any)?.passport?.user;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : (req.cookies?.accessToken || req.cookies?.token || req.cookies?.admin_token);

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
    try {
      const userRes = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [Number(userId)]);
      const user = userRes.rows[0];
      if (
        user &&
        (STAFF_ROLES.includes(user.role) ||
          user.role === "admin" ||
          user.is_primary_admin ||
          user.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
          user.email?.toLowerCase() === "gp61080@gmail.com" ||
          user.id === 1) &&
        user.status !== "blocked" &&
        user.status !== "locked" &&
        !user.is_permanently_locked
      ) {
        if (req.session) {
          req.session.userId = user.id;
          req.session.role = user.role;
        }
        return next();
      }
    } catch (dbErr: any) {
      console.warn("[announcements requireAdmin db error]:", dbErr?.message);
    }
  }

  return res.status(403).json({ message: "Admin access required" });
}

export function registerAnnouncementRoutes(app: Express) {
  // Ensure database table exists on boot
  ensureAnnouncementsTable().catch(() => {});

  /** GET /api/announcements/active — Get active announcements and ads for visitors & users */
  app.get("/api/announcements/active", async (_req: Request, res: Response) => {
    try {
      await ensureAnnouncementsTable();
      const result = await pool.query(`
        SELECT 
          a.id,
          a.title,
          a.message,
          a.category,
          a.product_id as "productId",
          a.is_active as "isActive",
          a.show_popup as "showPopup",
          a.priority,
          a.target_audience as "targetAudience",
          a.created_at as "createdAt",
          a.expires_at as "expiresAt",
          CASE WHEN p.id IS NOT NULL THEN json_build_object(
            'id', p.id,
            'name', p.name,
            'slug', p.slug,
            'price', p.price,
            'originalPrice', p.original_price,
            'image', p.image,
            'categorySlug', p.category_slug,
            'rating', p.rating,
            'stock', p.stock,
            'unit', p.unit
          ) ELSE NULL END as product
        FROM announcements a
        LEFT JOIN products p ON a.product_id = p.id
        WHERE a.is_active = TRUE AND (a.expires_at IS NULL OR a.expires_at > NOW())
        ORDER BY a.priority DESC, a.created_at DESC
      `);

      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.json(result.rows || []);
    } catch (err: any) {
      console.warn("[announcements/active query error]:", err?.message);
      res.json([]);
    }
  });

  /** GET /api/admin/announcements — Admin list of all announcements */
  app.get("/api/admin/announcements", requireAdmin, async (_req: Request, res: Response) => {
    try {
      await ensureAnnouncementsTable();
      const result = await pool.query(`
        SELECT 
          a.id,
          a.title,
          a.message,
          a.category,
          a.product_id as "productId",
          a.is_active as "isActive",
          a.show_popup as "showPopup",
          a.priority,
          a.target_audience as "targetAudience",
          a.created_at as "createdAt",
          a.expires_at as "expiresAt",
          CASE WHEN p.id IS NOT NULL THEN json_build_object(
            'id', p.id,
            'name', p.name,
            'slug', p.slug,
            'price', p.price,
            'originalPrice', p.original_price,
            'image', p.image
          ) ELSE NULL END as product
        FROM announcements a
        LEFT JOIN products p ON a.product_id = p.id
        ORDER BY a.created_at DESC
      `);

      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.json(result.rows || []);
    } catch (err: any) {
      console.error("[admin/announcements query error]:", err?.message);
      res.status(500).json({ message: "Failed to fetch announcements", error: err?.message });
    }
  });

  /** POST /api/admin/announcements — Create a new announcement or ad */
  app.post("/api/admin/announcements", requireAdmin, async (req: Request, res: Response) => {
    try {
      await ensureAnnouncementsTable();
      const { title, message, category, productId, isActive, showPopup, priority, targetAudience, expiresAt } = req.body || {};
      if (!title || !message) {
        return res.status(400).json({ message: "Title and message are required" });
      }

      const validCategories = ["warning", "critical", "advertisement"];
      const finalCategory = validCategories.includes(category) ? category : "advertisement";

      const insertRes = await pool.query(
        `INSERT INTO announcements (
          title, message, category, product_id, is_active, show_popup, priority, target_audience, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING 
          id, title, message, category, product_id as "productId",
          is_active as "isActive", show_popup as "showPopup", priority,
          target_audience as "targetAudience", created_at as "createdAt", expires_at as "expiresAt"`,
        [
          String(title).trim(),
          String(message).trim(),
          finalCategory,
          productId ? Number(productId) : null,
          isActive !== undefined ? Boolean(isActive) : true,
          showPopup !== undefined ? Boolean(showPopup) : true,
          Number(priority) || 0,
          targetAudience || "all",
          expiresAt ? new Date(expiresAt) : null,
        ]
      );

      res.status(201).json(insertRes.rows[0]);
    } catch (err: any) {
      console.error("[admin/announcements insert error]:", err?.message);
      res.status(500).json({ message: "Failed to create announcement", error: err?.message });
    }
  });

  /** PATCH /api/admin/announcements/:id — Update announcement */
  app.patch("/api/admin/announcements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await ensureAnnouncementsTable();
      const id = parseInt(req.params.id, 10);
      if (!id || isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const { title, message, category, productId, isActive, showPopup, priority, targetAudience, expiresAt } = req.body || {};

      const currentRes = await pool.query("SELECT * FROM announcements WHERE id = $1 LIMIT 1", [id]);
      if (!currentRes.rows.length) {
        return res.status(404).json({ message: "Announcement not found" });
      }
      const cur = currentRes.rows[0];

      const newTitle = title !== undefined ? String(title).trim() : cur.title;
      const newMessage = message !== undefined ? String(message).trim() : cur.message;
      const newCategory = category !== undefined ? category : cur.category;
      const newProductId = productId !== undefined ? (productId ? Number(productId) : null) : cur.product_id;
      const newIsActive = isActive !== undefined ? Boolean(isActive) : cur.is_active;
      const newShowPopup = showPopup !== undefined ? Boolean(showPopup) : cur.show_popup;
      const newPriority = priority !== undefined ? Number(priority) : cur.priority;
      const newTargetAudience = targetAudience !== undefined ? targetAudience : cur.target_audience;
      const newExpiresAt = expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : cur.expires_at;

      const updateRes = await pool.query(
        `UPDATE announcements SET
          title = $1, message = $2, category = $3, product_id = $4,
          is_active = $5, show_popup = $6, priority = $7,
          target_audience = $8, expires_at = $9
        WHERE id = $10
        RETURNING 
          id, title, message, category, product_id as "productId",
          is_active as "isActive", show_popup as "showPopup", priority,
          target_audience as "targetAudience", created_at as "createdAt", expires_at as "expiresAt"`,
        [newTitle, newMessage, newCategory, newProductId, newIsActive, newShowPopup, newPriority, newTargetAudience, newExpiresAt, id]
      );

      res.json(updateRes.rows[0]);
    } catch (err: any) {
      console.error("[admin/announcements update error]:", err?.message);
      res.status(500).json({ message: "Failed to update announcement", error: err?.message });
    }
  });

  /** DELETE /api/admin/announcements/:id — Delete announcement */
  app.delete("/api/admin/announcements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await ensureAnnouncementsTable();
      const id = parseInt(req.params.id, 10);
      if (!id || isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      await pool.query("DELETE FROM announcements WHERE id = $1", [id]);
      res.json({ success: true, message: "Announcement deleted" });
    } catch (err: any) {
      console.error("[admin/announcements delete error]:", err?.message);
      res.status(500).json({ message: "Failed to delete announcement", error: err?.message });
    }
  });
}

