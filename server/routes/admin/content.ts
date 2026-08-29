/**
 * Admin content management & system health API routes.
 */
import type { Express, Request, Response } from "express";
import { db, pingDb } from "../../db";
import { settings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { apiCache } from "../../services/cache";

async function requireAdmin(req: Request, res: Response, next: Function) {
  let userId = (req as any).jwtUser?.userId || req.session?.userId;
  let role = (req as any).jwtUser?.role || req.session?.role;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const { getJwtSecret } = await import("../../services/encryption");
      const decoded = jwt.verify(token, getJwtSecret()) as any;
      if (decoded.userId) {
        userId = decoded.userId;
        role = decoded.role;
      }
    } catch (e) {}
  }

  if (role === "admin") {
    return (next as any)();
  }

  if (userId) {
    const { users } = await import("@shared/schema");
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user && (user.role === "admin" || user.email === "admin@farmfreshfarmer.com")) {
      if (req.session) {
        req.session.userId = user.id;
        req.session.role = "admin";
      }
      return (next as any)();
    }
  }

  return res.status(403).json({ message: "Admin access required" });
}

export const DEFAULT_SITE_TEXT: Record<string, string> = {
  header_brand_badge: "100% Organically Grown",
  hero_title_accent: "Naturally Grown.",
  hero_title_suffix: "Delivered to Your Doorstep.",
  hero_subtitle: "Order farm-fresh vegetables, seasonal sweet fruits, sun-dried spices, hand-pounded millets, and authentic Andhra pickles directly from local cultivators with live delivery tracking.",
  badge_1: "Same Day Dispatch",
  badge_2: "Zero Chemical Residue",
  badge_3: "Direct Farmer Support",
  badge_4: "Farm-to-Door Transparency",
  promise_card1_title: "Chemical-Free Produce",
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
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      const data = await apiCache.getOrSet("content:site-text", async () => {
        const [row] = await db.select().from(settings).where(eq(settings.key, "site_custom_text")).limit(1);
        const textMap = row?.value ? { ...DEFAULT_SITE_TEXT, ...JSON.parse(row.value) } : DEFAULT_SITE_TEXT;
        return { textMap };
      }, 120, ["settings", "content"]);
      return res.json(data);
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

      apiCache.invalidateTags(["settings", "content"]);
      return res.json({ message: "Site text & pills updated successfully!", textMap });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message || "Failed to update site text" });
    }
  });

  /** GET /api/admin/content/banners */
  app.get("/api/admin/content/banners", requireAdmin as any, async (_req: Request, res: Response) => {
    const data = await apiCache.getOrSet("content:banners", async () => {
      const [row] = await db.select().from(settings).where(eq(settings.key, "homepage_banners")).limit(1);
      const banners = row ? JSON.parse(row.value) : [];
      return { banners };
    }, 60, ["settings", "content"]);
    return res.json(data);
  });

  /** POST /api/admin/content/banners */
  app.post("/api/admin/content/banners", requireAdmin as any, async (req: Request, res: Response) => {
    const { banners } = req.body || {};
    if (!Array.isArray(banners)) return res.status(400).json({ message: "banners array required" });
    const strVal = JSON.stringify(banners);
    await db.insert(settings).values({ key: "homepage_banners", value: strVal })
      .onConflictDoUpdate({ target: settings.key, set: { value: strVal } });
    apiCache.invalidateTags(["settings", "content"]);
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
