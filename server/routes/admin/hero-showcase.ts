/**
 * Hero Showcase API Routes.
 * Controls homepage Hero Showcase mode (Featured Products Carousel vs Custom Photo)
 * and supports custom photo uploads from local device / internet URLs.
 */
import type { Express, Request, Response } from "express";
import multer from "multer";
import { db } from "../../db";
import { products, users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "../../storage";
import { apiCache } from "../../services/cache";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

async function requireAdmin(req: Request, res: Response, next: Function) {
  let userId = (req as any).jwtUser?.userId || req.session?.userId;
  let role = (req as any).jwtUser?.role || req.session?.role;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const { getJwtSecret } = await import("../../services/encryption");
      const decoded: any = jwt.verify(token, getJwtSecret());
      if (decoded?.userId || decoded?.sub) {
        userId = Number(decoded.userId || decoded.sub);
      }
    } catch (e) {}
  }

  const STAFF_ROLES = ["admin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin"];

  if (userId) {
    const [user] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
    if (user && (STAFF_ROLES.includes(user.role) || user.isPrimaryAdmin) && user.status !== "blocked" && user.status !== "locked" && !user.isPermanentlyLocked) {
      if (req.session) {
        req.session.userId = user.id;
        req.session.role = user.role;
      }
      return (next as any)();
    }
  }

  return res.status(403).json({ message: "Admin access required" });
}

export function registerHeroShowcaseRoutes(app: Express) {
  /** GET /api/hero-showcase — Public hero showcase configuration & featured product list */
  app.get("/api/hero-showcase", async (_req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      const data = await apiCache.getOrSet("hero:showcase", async () => {
        let settings: any = {};
        try {
          settings = await storage.settings.all();
        } catch {
          settings = {};
        }

        const mode = settings.hero_showcase_mode || "featured_products";
        const customImageUrl = settings.hero_showcase_custom_url || "/images/p-mango.jpg";
        const customTitle = settings.hero_showcase_custom_title || "Direct Farm Harvest";
        const customSubtitle = settings.hero_showcase_custom_subtitle || "Picked this morning";

        let featuredHeroProducts: any[] = [];
        try {
          featuredHeroProducts = await db
            .select()
            .from(products)
            .where(and(eq(products.featuredInHero, true), eq(products.active, true)));
        } catch (dbErr: any) {
          try {
            const { pool: _pool } = await import("../../db");
            await _pool.query(`
              ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_in_hero BOOLEAN NOT NULL DEFAULT FALSE;
              ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity_tiers TEXT;
            `);
            featuredHeroProducts = await db
              .select()
              .from(products)
              .where(and(eq(products.featuredInHero, true), eq(products.active, true)));
          } catch {
            featuredHeroProducts = [];
          }
        }

        return {
          mode,
          customImageUrl,
          customTitle,
          customSubtitle,
          featuredProducts: featuredHeroProducts,
        };
      }, 60, ["hero", "products", "settings"]);

      return res.json(data);
    } catch (err: any) {
      console.error("[hero-showcase] GET error:", err);
      return res.json({
        mode: "featured_products",
        customImageUrl: "/images/p-mango.jpg",
        customTitle: "Direct Farm Harvest",
        customSubtitle: "Picked this morning",
        featuredProducts: [],
      });
    }
  });

  /** POST /api/admin/hero-showcase/settings — Update hero showcase settings */
  app.post("/api/admin/hero-showcase/settings", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const { mode, customImageUrl, customTitle, customSubtitle } = req.body || {};

      if (mode && !["featured_products", "custom_image"].includes(mode)) {
        return res.status(400).json({ message: "Invalid mode. Use 'featured_products' or 'custom_image'." });
      }

      if (mode) await storage.settings.set("hero_showcase_mode", mode);
      if (customImageUrl !== undefined) await storage.settings.set("hero_showcase_custom_url", String(customImageUrl).trim());
      if (customTitle !== undefined) await storage.settings.set("hero_showcase_custom_title", String(customTitle).trim());
      if (customSubtitle !== undefined) await storage.settings.set("hero_showcase_custom_subtitle", String(customSubtitle).trim());

      return res.json({
        message: "Hero Showcase settings updated successfully",
        mode: mode || (await storage.settings.get("hero_showcase_mode")),
        customImageUrl: customImageUrl ?? (await storage.settings.get("hero_showcase_custom_url")),
        customTitle: customTitle ?? (await storage.settings.get("hero_showcase_custom_title")),
        customSubtitle: customSubtitle ?? (await storage.settings.get("hero_showcase_custom_subtitle")),
      });
    } catch (err: any) {
      console.error("[hero-showcase] POST settings error:", err);
      return res.status(500).json({ message: "Failed to update hero showcase settings" });
    }
  });

  /** POST /api/admin/hero-showcase/upload — Upload local image file for hero showcase */
  app.post("/api/admin/hero-showcase/upload", requireAdmin as any, upload.single("image"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      const mimeType = req.file.mimetype || "image/jpeg";
      const base64Data = req.file.buffer.toString("base64");
      const dataUri = `data:${mimeType};base64,${base64Data}`;

      // Save custom image URL
      await storage.settings.set("hero_showcase_custom_url", dataUri);
      await storage.settings.set("hero_showcase_mode", "custom_image");

      return res.json({
        message: "Hero showcase image uploaded successfully",
        imageUrl: dataUri,
        mode: "custom_image",
      });
    } catch (err: any) {
      console.error("[hero-showcase] Upload error:", err);
      return res.status(500).json({ message: "Failed to upload image" });
    }
  });
}
