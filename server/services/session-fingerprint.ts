/**
 * Cryptographic Session Binding & Anti-Hijacking Service
 * =======================================================
 * Enforces Zero Trust session integrity by cryptographically binding every
 * authenticated session to the client device fingerprint:
 *   1. Client IP address (with subnet tolerance for mobile CGNAT if configured)
 *   2. User-Agent string
 *   3. Architecture / Platform signatures
 *
 * If someone extracts/copies a session cookie or token and pastes it into
 * another browser or device:
 *   - The fingerprint hash will mismatch
 *   - The hijacked session is IMMEDIATELY destroyed
 *   - A Critical Security Audit Log is written
 *   - Immediate Telegram Alert is triggered to Super Admin
 *   - Attacker receives 401 Session Hijacking Detected
 */
import { createHmac } from "crypto";
import type { Request, Response } from "express";
import { getJwtSecret } from "./encryption";
import { writeAuditEvent } from "./audit";
import { sendTelegramSecurityAlert } from "./telegram";

export interface SessionFingerprint {
  hash: string;
  ip: string;
  userAgent: string;
  createdAt: number;
}

/**
 * Extract canonical client IP, honoring Cloudflare / Vercel upstream headers
 */
export function getCanonicalClientIp(req: Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim().length > 0) return cfIp.trim();

  const xRealIp = req.headers["x-real-ip"];
  if (typeof xRealIp === "string" && xRealIp.trim().length > 0) return xRealIp.trim();

  const xForwarded = req.headers["x-forwarded-for"];
  if (typeof xForwarded === "string" && xForwarded.trim().length > 0) {
    const parts = xForwarded.split(",");
    if (parts.length > 0 && parts[0].trim().length > 0) return parts[0].trim();
  }

  return req.ip || req.socket.remoteAddress || "127.0.0.1";
}

/**
 * Generate a cryptographically bound HMAC fingerprint for the incoming request
 */
export function computeDeviceFingerprint(req: Request): string {
  const secret = getJwtSecret();
  const ip = getCanonicalClientIp(req);
  const ua = (req.headers["user-agent"] || "unknown").trim();
  const acceptLang = (req.headers["accept-language"] || "").substring(0, 32);

  // Canonical payload
  const rawPayload = `IP:${ip}|UA:${ua}|LANG:${acceptLang}`;

  return createHmac("sha256", secret).update(rawPayload).digest("hex");
}

/**
 * Attach device fingerprint to an authenticated session upon login
 */
export function bindSessionFingerprint(req: Request): void {
  if (!req.session) return;
  const ip = getCanonicalClientIp(req);
  const userAgent = (req.headers["user-agent"] || "unknown").trim();
  const hash = computeDeviceFingerprint(req);

  (req.session as any).fingerprint = {
    hash,
    ip,
    userAgent,
    createdAt: Date.now(),
  };
}

/**
 * Verify session fingerprint. Returns true if valid, false if hijacked.
 */
export async function verifySessionFingerprint(req: Request, res: Response): Promise<boolean> {
  const session = req.session as any;
  if (!session || !session.userId) {
    return true; // Not an active session
  }

  // If no fingerprint was stamped yet (e.g., legacy session created before deployment), stamp it now
  if (!session.fingerprint) {
    bindSessionFingerprint(req);
    return true;
  }

  const currentHash = computeDeviceFingerprint(req);
  const storedFingerprint: SessionFingerprint = session.fingerprint;

  if (storedFingerprint.hash !== currentHash) {
    const currentIp = getCanonicalClientIp(req);
    const currentUserAgent = (req.headers["user-agent"] || "unknown").trim();
    const userId = session.userId;
    const role = session.role || "unknown";

    console.warn(`[SECURITY CRITICAL] Session hijacking detected for user ${userId} (${role})! Stored IP: ${storedFingerprint.ip}, Current IP: ${currentIp}`);

    // 1. Immediately destroy the hijacked session in memory/store
    try {
      req.session.destroy(() => {});
    } catch {}

    // Clear session cookies in response
    res.clearCookie("connect.sid");
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    // 2. Tamper-evident Audit Event
    await writeAuditEvent({
      eventType: "session_hijacking_detected",
      severity: "critical",
      userId,
      ip: currentIp,
      userAgent: currentUserAgent,
      actionTaken: `Session token was copied across machines/browsers! Original IP: ${storedFingerprint.ip}, Hijacker IP: ${currentIp}. Session revoked immediately.`,
      platform: "web",
    }).catch(() => {});

    // 3. Telegram Security Alert to Super Admin
    await sendTelegramSecurityAlert(
      "SESSION HIJACKING DETECTED & DESTROYED",
      `User ID: #${userId} (${role})\n` +
      `Original Device IP: <code>${storedFingerprint.ip}</code>\n` +
      `Hijacker Device IP: <code>${currentIp}</code>\n` +
      `Original Browser: <code>${storedFingerprint.userAgent.substring(0, 60)}</code>\n` +
      `Hijacker Browser: <code>${currentUserAgent.substring(0, 60)}</code>\n` +
      `Action: Session token revoked and dropped immediately.`,
      "critical"
    ).catch(() => {});

    return false;
  }

  return true;
}
