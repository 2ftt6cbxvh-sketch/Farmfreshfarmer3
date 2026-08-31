import type { Express, Request, Response } from "express";
import { executeCopilotTurn, getQuickExecutiveInsights } from "../../services/admin-copilot";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getJwtSecret } from "../../services/encryption";

export function registerAdminCopilotRoutes(app: Express) {
  async function requireSuperAdminAuth(req: Request, res: Response, next: Function) {
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
    const isSuperAdmin = Boolean(
      user?.isPrimaryAdmin === true ||
      user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
      user?.id === 1
    );

    if (!user || !isSuperAdmin) {
      return res.status(403).json({
        message: "⛔ Access Denied. Narayana AI Executive Copilot is strictly restricted to the Chief Executive Super Admin.",
      });
    }
    (req as any).adminUser = user;
    return next();
  }

  /**
   * POST /api/admin/copilot/chat — Conversational turn with tool execution (Super Admin Only)
   */
  app.post("/api/admin/copilot/chat", requireSuperAdminAuth as any, async (req: Request, res: Response) => {
    try {
      const { messages, language } = req.body || {};
      const adminUser = (req as any).adminUser;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: "Messages array is required" });
      }

      const response = await executeCopilotTurn(adminUser, messages, language || "en");
      return res.json(response);
    } catch (err: any) {
      console.error("[admin-copilot] Error:", err.message);
      return res.status(500).json({ message: err.message || "Admin Copilot turn failed" });
    }
  });

  /**
   * GET /api/admin/copilot/quick-insights — Real-time summary chips (Super Admin Only)
   */
  app.get("/api/admin/copilot/quick-insights", requireSuperAdminAuth as any, async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).adminUser;
      const isSuperAdmin = Boolean(
        adminUser.isPrimaryAdmin === true ||
        adminUser.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
        adminUser.id === 1
      );
      const insights = await getQuickExecutiveInsights(isSuperAdmin);
      return res.json(insights);
    } catch (err: any) {
      console.error("[admin-copilot] Insights error:", err.message);
      return res.status(500).json({ message: "Failed to fetch quick insights" });
    }
  });
}
