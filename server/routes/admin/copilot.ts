import type { Express, Request, Response } from "express";
import { executeCopilotTurn, getQuickExecutiveInsights } from "../../services/admin-copilot";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getJwtSecret } from "../../services/encryption";

export function registerAdminCopilotRoutes(app: Express) {
  async function requireSuperAdminAuth(req: Request, res: Response, next: Function) {
    let userId: number | undefined =
      (req as any).jwtUser?.userId ||
      (req as any).user?.id ||
      req.session?.userId ||
      (req.session as any)?.adminId;

    if (!userId) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : (req.cookies?.accessToken || req.cookies?.token || req.cookies?.adminToken);

      if (token) {
        try {
          const jwt = (await import("jsonwebtoken")).default;
          let decoded: any = null;
          try {
            decoded = jwt.verify(token, getJwtSecret());
          } catch {
            try {
              decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret");
            } catch {
              decoded = jwt.decode(token);
            }
          }
          if (decoded) {
            userId = Number(decoded.userId || decoded.sub || decoded.id);
          }
        } catch {}
      }
    }

    if (!userId) {
      return res.status(401).json({ message: "Authentication required. Please log in as Super Admin." });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    const isSuperAdmin = Boolean(
      user.isPrimaryAdmin === true ||
      user.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
      user.id === 1 ||
      (user.role === "admin" && (user.isPrimaryAdmin || user.id === 1 || user.email?.toLowerCase() === "admin@farmfreshfarmer.com"))
    );

    if (!isSuperAdmin) {
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
