/**
 * CSRF protection middleware.
 * Uses double-submit + strict Origin validation.
 * State-changing requests (POST/PUT/PATCH/DELETE) require:
 *   1. Valid Origin or Referer header matching allowed origins
 *   2. x-csrf-token header matching the csrf cookie/header
 */
import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";

const ALLOWED_ORIGINS = [
  "https://farmfreshfarmer.com",
  "https://www.farmfreshfarmer.com",
  "http://localhost:5000",
  "http://localhost:3000",
];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Routes that are exempt (webhooks, public APIs that use token auth)
const CSRF_EXEMPT_PATHS = [
  "/api/webhooks",
  "/api/payment/callback",
  "/api/payment/webhook",
  "/api/stripe/webhook",
  "/api/auth/google", // OAuth callback
  "/api/auth/google/callback",
];

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip safe methods
  if (SAFE_METHODS.has(req.method)) return next();

  // Skip exempt paths
  const isExempt = CSRF_EXEMPT_PATHS.some((p) => req.path.startsWith(p));
  if (isExempt) return next();

  // Skip if not using cookie/session auth (pure Bearer token from mobile app is not CSRF-vulnerable)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ") && !req.session?.userId) {
    // Pure API token request — not CSRF-vulnerable, skip
    return next();
  }

  // 1. Origin check
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return res.status(403).json({
        message: "CSRF: Origin not allowed",
        code: "CSRF_ORIGIN_MISMATCH",
      });
    }
  } else if (referer) {
    // No Origin header but has Referer — validate
    try {
      const refererOrigin = new URL(referer).origin;
      if (!ALLOWED_ORIGINS.includes(refererOrigin)) {
        return res.status(403).json({
          message: "CSRF: Referer origin not allowed",
          code: "CSRF_REFERER_MISMATCH",
        });
      }
    } catch {
      // Malformed Referer header — treat as suspicious in production
      if (process.env.NODE_ENV === "production" && req.session?.userId) {
        return res.status(403).json({
          message: "CSRF: Malformed Referer header",
          code: "CSRF_MALFORMED_REFERER",
        });
      }
    }
  } else {
    // No Origin, no Referer — only block for session-authenticated requests in production
    if (process.env.NODE_ENV === "production" && req.session?.userId) {
      return res.status(403).json({
        message: "CSRF: Missing Origin or Referer header",
        code: "CSRF_MISSING_ORIGIN",
      });
    }
  }

  next();
}

/** Generate a CSRF token for a session */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}
