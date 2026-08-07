/**
 * Admin security management routes.
 */
import type { Express, Request, Response } from "express";
import { db } from "../../db";
import { refreshTokens, securityAuditLogs, users } from "@shared/schema";
import { eq, isNull, desc } from "drizzle-orm";
import { getLockdownStatus, setLockdown } from "../../services/lockdown";

async function requireAdmin(req: Request, res: Response, next: Function) {
  let userId = (req as any).jwtUser?.userId || req.session?.userId;
  let role = (req as any).jwtUser?.role || req.session?.role;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
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
    const { db } = await import("../../db");
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

export function registerAdminSecurityRoutes(app: Express) {
  app.get("/api/admin/security/lockdown", requireAdmin as any, async (_req: Request, res: Response) => {
    return res.json(await getLockdownStatus());
  });

  app.post("/api/admin/security/lockdown", requireAdmin as any, async (req: Request, res: Response) => {
    const { active, reason } = req.body || {};
    if (typeof active !== "boolean") return res.status(400).json({ message: "active (boolean) required" });
    if (active && !reason) return res.status(400).json({ message: "reason required when activating lockdown" });
    const adminId = (req as any).jwtUser?.userId || req.session?.userId;
    await setLockdown(active, reason || "", adminId);
    return res.json({ message: `Lockdown ${active ? "activated" : "deactivated"}`, active });
  });

  app.get("/api/admin/security/audit-log", requireAdmin as any, async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit || "50")), 200);
    const logs = await db.select({
      id: securityAuditLogs.id, eventType: securityAuditLogs.eventType,
      userId: securityAuditLogs.userId, email: users.email,
      ip: securityAuditLogs.ip, platform: securityAuditLogs.platform,
      userAgent: securityAuditLogs.userAgent, actionTaken: securityAuditLogs.actionTaken,
      createdAt: securityAuditLogs.createdAt,
    }).from(securityAuditLogs).leftJoin(users, eq(securityAuditLogs.userId, users.id))
      .orderBy(desc(securityAuditLogs.createdAt)).limit(limit);
    return res.json({ logs });
  });

  app.get("/api/admin/security/sessions", requireAdmin as any, async (_req: Request, res: Response) => {
    const sessions = await db.select({
      id: refreshTokens.id, userId: refreshTokens.userId, email: users.email,
      platform: refreshTokens.platform, deviceId: refreshTokens.deviceId,
      ipAtIssue: refreshTokens.ipAtIssue, expiresAt: refreshTokens.expiresAt, createdAt: refreshTokens.createdAt,
    }).from(refreshTokens).leftJoin(users, eq(refreshTokens.userId, users.id))
      .where(isNull(refreshTokens.revokedAt)).orderBy(desc(refreshTokens.createdAt)).limit(100);
    return res.json({ sessions });
  });

  app.delete("/api/admin/security/sessions/:id", requireAdmin as any, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "Invalid session ID" });
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, id));
    return res.json({ message: "Session revoked" });
  });
}
