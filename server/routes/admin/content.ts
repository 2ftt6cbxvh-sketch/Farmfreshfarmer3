/**
 * Admin content management & system health API routes.
 */
import type { Express, Request, Response } from "express";
import { db, pingDb } from "../../db";
import { settings } from "@shared/schema";
import { eq } from "drizzle-orm";

function requireAdmin(req: Request, res: Response, next: Function) {
  const userId = (req as any).jwtUser?.userId || req.session?.userId;
  const role = (req as any).jwtUser?.role || req.session?.role;
  if (!userId || role !== "admin") return res.status(403).json({ message: "Admin access required" });
  (next as any)();
}

export const DEFAULT_SITE_TEXT: Record<string, string> = {
  hero_badge_text: "Visakhapatnam's #1 Instant Organic Farm Delivery",
  hero_headline_text: "Fresh from local farms, delivered straight to your doorstep.",
  hero_subtitle_text: "Hand-picked organic fruits, vine-ripened vegetables, authentic ghee sweets, traditional Andhra pickles, millets & spices.",
  promise_badge_text: "Visakhapatnam Farm to Fork",
  promise_title_text: "Our Farm-to-Home Promise",
  promise_desc_text: "Connecting households directly with local organic farms and authentic Andhra kitchens. Zero chemicals, zero artificial ripening, and instant delivery right when you need it.",
  promise_card1_title: "100% Organic",
  promise_card1_desc: "Sourced daily from certified local organic farms in Andhra Pradesh with zero chemical pesticides.",
  promise_card2_title: "Combined ETA",
  promise_card2_desc: "Haversine distance transit calculation + warehouse packing mins returned live for your PIN code.",
  promise_card3_title: "Authentic Recipes",
  promise_card3_desc: "Handcrafted ghee boondi laddus, spicy avakaya pickles, and namkeen made in small traditional batches.",
  promise_card4_title: "Rated 4.9/5 Stars",
  promise_card4_desc: "Trusted by 1,200+ households across Visakhapatnam and Vijayawada.",
};

export function registerAdminContentRoutes(app: Express) {
  /** GET /api/content/site-text — Public endpoint for dynamic pills, badges & site text */
  app.get("/api/content/site-text", async (_req: Request, res: Response) => {
    try {
      const [row] = await db.select().from(settings).where(eq(settings.key, "site_custom_text")).limit(1);
      const textMap = row?.value ? { ...DEFAULT_SITE_TEXT, ...JSON.parse(row.value) } : DEFAULT_SITE_TEXT;
      return res.json({ textMap });
    } catch (e) {
      return res.json({ textMap: DEFAULT_SITE_TEXT });
    }
  });

  /** POST /api/admin/content/site-text — Admin updates pills, badges & site text */
  app.post("/api/admin/content/site-text", requireAdmin as any, async (req: Request, res: Response) => {
    const { textMap } = req.body || {};
    if (!textMap || typeof textMap !== "object") return res.status(400).json({ message: "textMap object required" });

    try {
      const strVal = JSON.stringify(textMap);
      await db.insert(settings).values({ key: "site_custom_text", value: strVal })
        .onConflictDoUpdate({ target: settings.key, set: { value: strVal } });

      return res.json({ message: "Site text & pills updated successfully!", textMap });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message || "Failed to update site text" });
    }
  });

  /** GET /api/admin/content/banners */
  app.get("/api/admin/content/banners", requireAdmin as any, async (_req: Request, res: Response) => {
    const [row] = await db.select().from(settings).where(eq(settings.key, "homepage_banners")).limit(1);
    const banners = row ? JSON.parse(row.value) : [];
    return res.json({ banners });
  });

  /** POST /api/admin/content/banners */
  app.post("/api/admin/content/banners", requireAdmin as any, async (req: Request, res: Response) => {
    const { banners } = req.body || {};
    if (!Array.isArray(banners)) return res.status(400).json({ message: "banners array required" });
    const strVal = JSON.stringify(banners);
    await db.insert(settings).values({ key: "homepage_banners", value: strVal, updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value: strVal, updatedAt: new Date() } });
    return res.json({ banners });
  });

  /** GET /api/admin/system/health */
  app.get("/api/admin/system/health", requireAdmin as any, async (_req: Request, res: Response) => {
    const dbConnected = await pingDb();
    const memory = process.memoryUsage();
    return res.json({
      status: dbConnected ? "healthy" : "degraded",
      database: dbConnected ? "connected" : "disconnected",
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(memory.heapUsed / 1024 / 1024),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  });
}
