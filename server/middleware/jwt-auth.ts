/**
 * JWT authentication middleware.
 * Supports BOTH Bearer token (mobile/new API) AND express-session (existing web auth).
 * This allows backward compatibility while mobile app uses JWT.
 */
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/token";

// Extend Express Request to include JWT payload
declare module "express" {
  interface Request {
    jwtUser?: { userId: number; role: string; platform: string };
  }
}

/**
 * requireJwtOrSession — accepts EITHER:
 *   1. Authorization: Bearer <accessToken>  (mobile + new web)
 *   2. req.session.userId  (existing web session auth)
 */
export function requireJwtOrSession(req: Request, res: Response, next: NextFunction) {
  // Try Bearer token first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token);
      req.jwtUser = { userId: payload.userId, role: payload.role, platform: payload.platform || "web" };
      return next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  }

  // Fall back to session auth
  if (req.session?.userId) {
    req.jwtUser = { userId: req.session.userId, role: req.session.role || "customer", platform: "web" };
    return next();
  }

  return res.status(401).json({ message: "Authentication required" });
}

/** requireJwtAdmin — admin-only JWT or session check */
export function requireJwtAdmin(req: Request, res: Response, next: NextFunction) {
  requireJwtOrSession(req, res, () => {
    if (req.jwtUser?.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  });
}

/** Optional JWT extraction — does not reject if missing, just populates req.jwtUser */
export function optionalJwt(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token);
      req.jwtUser = { userId: payload.userId, role: payload.role, platform: payload.platform || "web" };
    } catch {
      // Ignore invalid token in optional mode
    }
  } else if (req.session?.userId) {
    req.jwtUser = { userId: req.session.userId, role: req.session.role || "customer", platform: "web" };
  }
  next();
}
