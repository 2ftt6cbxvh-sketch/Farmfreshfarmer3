/**
 * Step-Up Authentication Middleware & Utilities.
 * Enforces fresh WebAuthn or TOTP verification within the last 5 minutes (300s)
 * before allowing high-risk administrative actions.
 *
 * NIST SP 800-63B / Zero Trust Step-Up Assurance.
 */
import type { Request, Response, NextFunction } from "express";
import { verifyTotpCode } from "../services/totp";
import { storage } from "../storage";
import { writeAuditEvent } from "../services/audit";

const DEFAULT_STEP_UP_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export function requireStepUpAuth(maxAgeMs: number = DEFAULT_STEP_UP_MAX_AGE_MS) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = req.session as any;
    const now = Date.now();

    const lastStepUp = Math.max(
      Number(session?.stepUpAt || 0),
      Number(session?.webauthnStepUpAt || 0)
    );

    const isStepUpValid = lastStepUp > 0 && (now - lastStepUp) <= maxAgeMs;

    if (!isStepUpValid) {
      return res.status(403).json({
        stepUpRequired: true,
        message: "🔐 Step-Up Authentication Required: Verify your Touch ID/Passkey or 6-digit TOTP code to proceed.",
        maxAgeSeconds: Math.floor(maxAgeMs / 1000),
      });
    }

    return next();
  };
}

/** Verify TOTP code for Step-Up verification */
export async function verifyStepUpTotp(req: Request, code: string): Promise<boolean> {
  const secret = await storage.settings.get("admin_totp_secret");
  if (!secret) return false;

  const valid = verifyTotpCode(secret, String(code || ""));
  if (valid) {
    if (req.session) {
      (req.session as any).stepUpAt = Date.now();
    }
    const userId = (req as any).resolvedUser?.id || req.session?.userId;
    await writeAuditEvent({
      eventType: "step_up_totp_verified",
      severity: "info",
      userId,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      actionTaken: "Step-up verification satisfied via TOTP",
    });
    return true;
  }
  return false;
}
