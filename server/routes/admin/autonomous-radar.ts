import type { Express, Request, Response } from "express";
import {
  triggerHarvestBriefing,
  triggerFinancialDigest,
  triggerSourcingSpikeAlert
} from "../../services/autonomous-radar";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getJwtSecret } from "../../services/encryption";

export function registerAdminAutonomousRadarRoutes(app: Express) {
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
    const isSuper = Boolean(
      user?.isPrimaryAdmin === true ||
      user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
      user?.id === 1
    );
    if (!isSuper) {
      return res.status(403).json({ message: "⛔ Chief Executive Super Admin access required" });
    }
    (req as any).adminUser = user;
    return next();
  }

  /**
   * POST /api/admin/radar/trigger-briefing — Dispatch Morning Harvest Briefing to Telegram
   */
  app.post("/api/admin/radar/trigger-briefing", requireSuperAdminAuth as any, async (_req: Request, res: Response) => {
    try {
      const result = await triggerHarvestBriefing();
      return res.json(result);
    } catch (err: any) {
      console.error("[radar] Briefing error:", err.message);
      return res.status(500).json({ message: err.message || "Failed to trigger briefing" });
    }
  });

  /**
   * POST /api/admin/radar/trigger-digest — Dispatch Nightly Financial Digest to Telegram
   */
  app.post("/api/admin/radar/trigger-digest", requireSuperAdminAuth as any, async (_req: Request, res: Response) => {
    try {
      const result = await triggerFinancialDigest();
      return res.json(result);
    } catch (err: any) {
      console.error("[radar] Digest error:", err.message);
      return res.status(500).json({ message: err.message || "Failed to trigger financial digest" });
    }
  });

  /**
   * POST /api/admin/radar/test-alert — Dispatch Sourcing Spike Alert to Telegram
   */
  app.post("/api/admin/radar/test-alert", requireSuperAdminAuth as any, async (req: Request, res: Response) => {
    try {
      const { keyword, count } = req.body || {};
      const result = await triggerSourcingSpikeAlert(keyword, count);
      return res.json(result);
    } catch (err: any) {
      console.error("[radar] Test alert error:", err.message);
      return res.status(500).json({ message: err.message || "Failed to send test alert" });
    }
  });

  /**
   * GET /api/admin/radar/status — Status of autonomous background monitors
   */
  app.get("/api/admin/radar/status", requireSuperAdminAuth as any, async (_req: Request, res: Response) => {
    return res.json({
      autonomousMonitoring: true,
      telegramBridge: true,
      sourcingSpikeDetection: true,
      morningBriefingSchedule: "06:00 AM IST",
      nightlyDigestSchedule: "11:30 PM IST",
      activeTwoWayCommands: ["/briefing", "/digest", "/stock", "/coupon", "/status", "/approvals", "/lock"],
    });
  });
}
