/**
 * Active Sessions & Device Management Routes.
 * Allows Chief Admin and Staff to view all active token families/sessions
 * and perform remote session revocation.
 */
import type { Express, Request, Response } from "express";
import { db } from "../../db";
import { refreshTokens, users } from "@shared/schema";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import { writeAuditEvent } from "../../services/audit";

export function registerAdminSessionRoutes(app: Express) {
  /** Middleware: resolve authenticated user */
  async function requireAuthUser(req: Request, res: Response, next: Function) {
    let userId: number | undefined = (req as any).jwtUser?.userId || req.session?.userId;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.accessToken;
    if (token) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
        userId = Number(decoded.userId || decoded.sub);
      } catch { /* ignore */ }
    }
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(401).json({ message: "User not found" });

    (req as any).currentUser = user;
    return (next as any)();
  }

  /** GET /api/admin/sessions — List active device sessions */
  app.get("/api/admin/sessions", requireAuthUser as any, async (req: Request, res: Response) => {
    const user = (req as any).currentUser;
    const now = new Date();

    const activeTokens = await db
      .select({
        id: refreshTokens.id,
        deviceId: refreshTokens.deviceId,
        platform: refreshTokens.platform,
        ip: refreshTokens.ipAtIssue,
        userAgent: refreshTokens.userAgent,
        createdAt: refreshTokens.createdAt,
        expiresAt: refreshTokens.expiresAt,
      })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, user.id),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, now)
        )
      )
      .orderBy(desc(refreshTokens.createdAt));

    return res.json({
      sessions: activeTokens,
      count: activeTokens.length,
      currentSessionIp: req.ip,
    });
  });

  /** POST /api/admin/sessions/revoke-others — Revoke all other active sessions */
  app.post("/api/admin/sessions/revoke-others", requireAuthUser as any, async (req: Request, res: Response) => {
    const user = (req as any).currentUser;
    const now = new Date();

    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.userId, user.id),
          isNull(refreshTokens.revokedAt)
        )
      );

    await writeAuditEvent({
      eventType: "all_sessions_revoked",
      severity: "warning",
      userId: user.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      actionTaken: "User remotely revoked all other active device sessions and token families",
    });

    return res.json({
      message: "🔒 All other device sessions have been revoked successfully.",
    });
  });

  /** POST /api/admin/sessions/:id/revoke — Revoke specific session by ID */
  app.post("/api/admin/sessions/:id/revoke", requireAuthUser as any, async (req: Request, res: Response) => {
    const user = (req as any).currentUser;
    const sessionId = Number(req.params.id);

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.id, sessionId),
          eq(refreshTokens.userId, user.id)
        )
      );

    await writeAuditEvent({
      eventType: "single_session_revoked",
      severity: "info",
      userId: user.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      actionTaken: `Revoked session id: ${sessionId}`,
    });

    return res.json({ message: "Session revoked successfully." });
  });
}
