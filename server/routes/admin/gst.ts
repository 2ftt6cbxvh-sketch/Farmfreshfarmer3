import { Router } from "express";
import { db } from "../../db";
import { settings, products } from "@shared/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router = Router();

const STAFF_ROLES = ["admin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin", "delivery_partner"];

async function requireAdmin(req: any, res: any, next: any) {
  let userId = req.jwtUser?.userId || req.session?.userId;
  let role = req.jwtUser?.role || req.session?.role;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
      if (decoded.userId || decoded.sub) {
        userId = Number(decoded.userId || decoded.sub);
        req.user = decoded;
      }
    } catch (e) {}
  }

  if (userId) {
    const { db } = await import("../../db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
    if (user && STAFF_ROLES.includes(user.role) && user.status !== "blocked" && user.status !== "locked" && !user.isPermanentlyLocked) {
      req.session = req.session || {};
      req.session.userId = user.id;
      req.session.role = user.role;
      return next();
    }
  }

  return res.status(401).json({ message: "Admin authentication required" });
}

// Helper to verify Super Admin authority
function isSuperAdminUser(req: any): boolean {
  const role = req.session?.role || req.user?.role;
  const email = req.user?.email || req.session?.email;
  if (req.user?.isPrimaryAdmin === true) return true;
  if (email?.toLowerCase() === "admin@farmfreshfarmer.com") return true;
  if (role === "admin" || role === "superadmin") return true;
  return false;
}

/**
 * GET /api/admin/gst-settings
 * Returns global GST tax configuration. Restricted to Admin/Super Admin.
 */
router.get("/gst-settings", requireAdmin, async (req: any, res: any) => {
  try {
    const allSettings = await db.select().from(settings);
    const map = new Map(allSettings.map((s) => [s.key, s.value]));
    
    const defaultGstPercent = parseFloat(map.get("default_gst_percent") || "5") || 5;
    const gstEnabled = map.get("gst_enabled") !== "false";
    const cgstEnabled = map.get("cgst_enabled") !== "false";
    const sgstEnabled = map.get("sgst_enabled") !== "false";

    return res.json({ defaultGstPercent, gstEnabled, cgstEnabled, sgstEnabled });
  } catch (err: any) {
    console.error("[admin/gst] Error fetching GST settings:", err);
    return res.status(500).json({ message: "Failed to fetch GST settings" });
  }
});

/**
 * PUT /api/admin/gst-settings
 * Super Admin ONLY: Updates global GST tax percentage & toggle settings.
 */
router.put("/gst-settings", requireAdmin, async (req: any, res: any) => {
  try {
    if (!isSuperAdminUser(req)) {
      return res.status(403).json({ message: "Access Denied: Only Super Admin can modify GST tax configurations." });
    }

    const { defaultGstPercent, gstEnabled, cgstEnabled, sgstEnabled } = req.body;
    const cleanGst = Math.max(0, Math.min(100, parseFloat(defaultGstPercent) || 0));

    await db.insert(settings).values({ key: "default_gst_percent", value: String(cleanGst) })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(cleanGst) } });

    await db.insert(settings).values({ key: "gst_enabled", value: gstEnabled ? "true" : "false" })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(gstEnabled ? "true" : "false") } });

    await db.insert(settings).values({ key: "cgst_enabled", value: cgstEnabled !== false ? "true" : "false" })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(cgstEnabled !== false ? "true" : "false") } });

    await db.insert(settings).values({ key: "sgst_enabled", value: sgstEnabled !== false ? "true" : "false" })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(sgstEnabled !== false ? "true" : "false") } });

    return res.json({
      message: "GST settings updated successfully",
      defaultGstPercent: cleanGst,
      gstEnabled: !!gstEnabled,
      cgstEnabled: cgstEnabled !== false,
      sgstEnabled: sgstEnabled !== false,
    });
  } catch (err: any) {
    console.error("[admin/gst] Error updating GST settings:", err);
    return res.status(500).json({ message: "Failed to update GST settings" });
  }
});

/**
 * PATCH /api/admin/products/:id/gst
 * Super Admin ONLY: Set product-specific GST % override.
 */
router.patch("/products/:id/gst", requireAdmin, async (req: any, res: any) => {
  try {
    if (!isSuperAdminUser(req)) {
      return res.status(403).json({ message: "Access Denied: Only Super Admin can modify product GST rates." });
    }

    const productId = parseInt(req.params.id, 10);
    const { gstPercent } = req.body;

    const val = (gstPercent === null || gstPercent === undefined || gstPercent === "")
      ? null
      : String(Math.max(0, Math.min(100, parseFloat(gstPercent) || 0)));

    const [updated] = await db.update(products)
      .set({ gstPercent: val, updatedAt: new Date() })
      .where(eq(products.id, productId))
      .returning();

    return res.json({ message: "Product GST rate updated", product: updated });
  } catch (err: any) {
    console.error("[admin/gst] Error updating product GST:", err);
    return res.status(500).json({ message: "Failed to update product GST" });
  }
});

export default router;
