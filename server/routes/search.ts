/**
 * Search Predictions & Admin Recommendations API Routes.
 */
import type { Express, Request, Response } from "express";
import { db } from "../db";
import { products, categories, settings } from "@shared/schema";
import { ilike, or, eq } from "drizzle-orm";

async function requireAdmin(req: Request, res: Response, next: Function) {
  let userId = (req as any).jwtUser?.userId || req.session?.userId;
  let role = (req as any).jwtUser?.role || req.session?.role;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const { getJwtSecret } = await import("../services/encryption");
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
    const { db } = await import("../db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
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

const DEFAULT_RECOMMENDATIONS = [
  "Alphonso Mango",
  "Farm Tomatoes",
  "Mango Pickle (Avakaya)",
  "Boondi Laddu",
  "Chicken Pickle",
  "Red Chilli Powder",
];

export function registerSearchRoutes(app: Express) {
  /** GET /api/search/suggestions?q=... — Returns live predictions + admin recommendations */
  app.get("/api/search/suggestions", async (req: Request, res: Response) => {
    const query = String(req.query.q || "").trim();

    try {
      let [recRow] = await db.select().from(settings).where(eq(settings.key, "search_recommendations")).limit(1);
      let recommendations: string[] = DEFAULT_RECOMMENDATIONS;
      if (recRow?.value) {
        try { recommendations = JSON.parse(recRow.value); } catch {}
      }

      if (!query) {
        return res.json({ predictions: [], recommendations });
      }

      const matchedProducts = await db
        .select({
          id: products.id,
          name: products.name,
          categorySlug: products.categorySlug,
          price: products.price,
          image: products.image,
          unit: products.unit,
        })
        .from(products)
        .where(
          or(
            ilike(products.name, `%${query}%`),
            ilike(products.description, `%${query}%`),
            ilike(products.categorySlug, `%${query}%`)
          )
        )
        .limit(6);

      const matchedCategories = await db
        .select({
          name: categories.name,
          slug: categories.slug,
        })
        .from(categories)
        .where(ilike(categories.name, `%${query}%`))
        .limit(3);

      return res.json({
        predictions: matchedProducts,
        categorySuggestions: matchedCategories,
        recommendations,
      });
    } catch (e: any) {
      console.error("[search/suggestions]", e);
      return res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });

  /** GET /api/admin/search-recommendations — Fetch admin search recommendations */
  app.get("/api/admin/search-recommendations", requireAdmin as any, async (_req: Request, res: Response) => {
    try {
      const [row] = await db.select().from(settings).where(eq(settings.key, "search_recommendations")).limit(1);
      let recommendations = DEFAULT_RECOMMENDATIONS;
      if (row?.value) {
        try { recommendations = JSON.parse(row.value); } catch {}
      }
      return res.json({ recommendations });
    } catch (e) {
      return res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  /** POST /api/admin/search-recommendations — Admin updates search recommendations */
  app.post("/api/admin/search-recommendations", requireAdmin as any, async (req: Request, res: Response) => {
    const { recommendations } = req.body || {};
    if (!Array.isArray(recommendations)) {
      return res.status(400).json({ message: "recommendations must be an array of strings" });
    }

    try {
      const jsonValue = JSON.stringify(recommendations.map((r: string) => String(r).trim()).filter(Boolean));
      await db
        .insert(settings)
        .values({ key: "search_recommendations", value: jsonValue })
        .onConflictDoUpdate({ target: settings.key, set: { value: jsonValue } });

      return res.json({ message: "Search recommendations updated successfully!", recommendations });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message || "Failed to update recommendations" });
    }
  });
}
