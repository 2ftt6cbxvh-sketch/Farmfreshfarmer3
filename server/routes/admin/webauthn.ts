/**
 * WebAuthn / Passkey management routes for Chief Executive Admin.
 * GET  /api/admin/webauthn/credentials         — list enrolled credentials
 * POST /api/admin/webauthn/register/options    — get registration challenge
 * POST /api/admin/webauthn/register/verify     — verify + save new credential
 * POST /api/admin/webauthn/auth/options        — get auth challenge
 * POST /api/admin/webauthn/auth/verify         — verify assertion (login step-up)
 * DELETE /api/admin/webauthn/credentials/:id  — remove credential
 */
import type { Express, Request, Response } from "express";
import {
  generateWebAuthnRegistrationOptions,
  verifyAndSaveWebAuthnRegistration,
  generateWebAuthnAuthOptions,
  verifyWebAuthnAssertion,
  listWebAuthnCredentials,
  deleteWebAuthnCredential,
  countWebAuthnCredentials,
} from "../../services/webauthn";
import { writeAuditEvent } from "../../services/audit";

export function registerAdminWebAuthnRoutes(app: Express) {
  // Middleware: require primary admin via existing requirePrimaryAdmin pattern
  async function requirePrimary(req: Request, res: Response, next: Function) {
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
    const { db } = await import("../../db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || (!user.isPrimaryAdmin && user.email?.toLowerCase() !== "admin@farmfreshfarmer.com" && user.id !== 1)) {
      return res.status(403).json({ message: "Chief Executive Admin access required" });
    }
    (req as any).currentUser = user;
    return (next as any)();
  }

  /** List enrolled passkeys */
  app.get("/api/admin/webauthn/credentials", requirePrimary as any, async (req: Request, res: Response) => {
    const user = (req as any).currentUser;
    const creds = await listWebAuthnCredentials(user.id);
    return res.json({ credentials: creds, count: creds.length });
  });

  /** Get registration options (challenge) */
  app.post("/api/admin/webauthn/register/options", requirePrimary as any, async (req: Request, res: Response) => {
    const user = (req as any).currentUser;
    const options = await generateWebAuthnRegistrationOptions(user.id, user.email, user.name);
    // Store challenge in session
    (req.session as any).webauthnRegChallenge = options.challenge;
    return res.json(options);
  });

  /** Verify registration and save credential */
  app.post("/api/admin/webauthn/register/verify", requirePrimary as any, async (req: Request, res: Response) => {
    const user = (req as any).currentUser;
    const { response, nickname } = req.body || {};
    const expectedChallenge = (req.session as any).webauthnRegChallenge;
    if (!expectedChallenge) {
      return res.status(400).json({ message: "No registration challenge found. Start over." });
    }
    try {
      await verifyAndSaveWebAuthnRegistration(user.id, response, expectedChallenge, nickname || "Passkey");
      delete (req.session as any).webauthnRegChallenge;
      const count = await countWebAuthnCredentials(user.id);
      await writeAuditEvent({
        eventType: "webauthn_credential_registered",
        severity: "warning",
        userId: user.id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        actionTaken: `New passkey enrolled: ${nickname || "Passkey"} (total: ${count})`,
      });
      return res.json({ verified: true, count });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  /** Get authentication options (challenge for step-up or login) */
  app.post("/api/admin/webauthn/auth/options", requirePrimary as any, async (req: Request, res: Response) => {
    const user = (req as any).currentUser;
    const options = await generateWebAuthnAuthOptions(user.id);
    (req.session as any).webauthnAuthChallenge = options.challenge;
    return res.json(options);
  });

  /** Verify authentication assertion (step-up auth) */
  app.post("/api/admin/webauthn/auth/verify", requirePrimary as any, async (req: Request, res: Response) => {
    const user = (req as any).currentUser;
    const { response } = req.body || {};
    const expectedChallenge = (req.session as any).webauthnAuthChallenge;
    if (!expectedChallenge) {
      return res.status(400).json({ message: "No authentication challenge found. Start over." });
    }
    try {
      await verifyWebAuthnAssertion(user.id, response, expectedChallenge);
      delete (req.session as any).webauthnAuthChallenge;
      // Record step-up auth timestamp in session (for step-up gate checks)
      (req.session as any).webauthnStepUpAt = Date.now();
      await writeAuditEvent({
        eventType: "webauthn_stepup_verified",
        severity: "info",
        userId: user.id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        actionTaken: "WebAuthn step-up authentication successful",
      });
      return res.json({ verified: true });
    } catch (err: any) {
      await writeAuditEvent({
        eventType: "webauthn_stepup_failed",
        severity: "warning",
        userId: user.id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        actionTaken: `WebAuthn step-up failed: ${err.message}`,
      });
      return res.status(400).json({ message: err.message });
    }
  });

  /** Delete a credential */
  app.delete("/api/admin/webauthn/credentials/:id", requirePrimary as any, async (req: Request, res: Response) => {
    const user = (req as any).currentUser;
    const credId = Number(req.params.id);
    try {
      await deleteWebAuthnCredential(user.id, credId);
      await writeAuditEvent({
        eventType: "webauthn_credential_deleted",
        severity: "critical",
        userId: user.id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        actionTaken: `Passkey deleted (db id: ${credId})`,
      });
      return res.json({ deleted: true });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });
}
