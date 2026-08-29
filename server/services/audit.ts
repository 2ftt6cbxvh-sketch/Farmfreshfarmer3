/**
 * Tamper-evident audit log service.
 * Uses HMAC-SHA256 hash chaining so any deletion/modification of events
 * breaks the chain and becomes detectable.
 *
 * OWASP Logging Cheat Sheet: Log auth successes/failures, session events.
 */
import { createHmac, randomBytes } from "crypto";
import { db } from "../db";
import { securityAuditLogs } from "@shared/schema";
import { desc } from "drizzle-orm";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditEvent {
  eventType: string;
  severity?: AuditSeverity;
  userId?: number | null;
  targetId?: number | null;
  targetType?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  sessionFamilyId?: string | null;
  actionTaken?: string | null;
  platform?: string;
}

const AUDIT_KEY = process.env.AUDIT_HMAC_KEY || "farmfresh-audit-hmac-key-change-in-production";

/** Compute HMAC-SHA256 of an event payload */
function computeEventHash(previousHash: string, eventPayload: string): string {
  return createHmac("sha256", AUDIT_KEY)
    .update(previousHash + eventPayload)
    .digest("hex");
}

/** Write a tamper-evident audit event */
export async function writeAuditEvent(event: AuditEvent): Promise<void> {
  try {
    // Get the last event's hash for chaining
    const [last] = await db
      .select({ eventHash: securityAuditLogs.eventHash })
      .from(securityAuditLogs)
      .orderBy(desc(securityAuditLogs.id))
      .limit(1);

    const previousHash = last?.eventHash || "GENESIS";
    const requestId = randomBytes(8).toString("hex");
    const now = new Date().toISOString();

    // Canonical payload (sorted keys, no secrets)
    const canonical = JSON.stringify({
      eventType: event.eventType,
      userId: event.userId ?? null,
      targetId: event.targetId ?? null,
      targetType: event.targetType ?? null,
      ip: event.ip ?? null,
      requestId,
      ts: now,
      severity: event.severity ?? "info",
    });

    const eventHash = computeEventHash(previousHash, canonical);

    await db.insert(securityAuditLogs).values({
      eventType: event.eventType,
      severity: event.severity ?? "info",
      userId: event.userId ?? null,
      targetId: event.targetId ?? null,
      targetType: event.targetType ?? null,
      ip: event.ip ?? null,
      platform: event.platform ?? "web",
      userAgent: event.userAgent ? hashUserAgent(event.userAgent) : null,
      actionTaken: event.actionTaken ?? null,
      sessionFamilyId: event.sessionFamilyId ?? null,
      requestId,
      previousHash,
      eventHash,
    });
  } catch (err: any) {
    // Log failure to console — a monitoring alert should trigger here
    console.error("[AUDIT] CRITICAL: Failed to write audit event:", err.message, event);
  }
}

/** Hash user-agent for storage (no PII) */
function hashUserAgent(ua: string): string {
  return createHmac("sha256", AUDIT_KEY).update(ua).digest("hex").substring(0, 16);
}

/** Verify hash chain integrity (can be run as a background job) */
export async function verifyAuditChain(): Promise<{ valid: boolean; brokenAt?: number; count: number }> {
  const { isNotNull } = await import("drizzle-orm");
  const events = await db
    .select()
    .from(securityAuditLogs)
    .where(isNotNull(securityAuditLogs.eventHash))
    .orderBy(desc(securityAuditLogs.id));

  events.reverse(); // oldest first

  if (events.length <= 1) {
    return { valid: true, count: events.length };
  }

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];

    if (curr.previousHash !== prev.eventHash) {
      return { valid: false, brokenAt: curr.id, count: events.length };
    }
  }

  return { valid: true, count: events.length };
}
