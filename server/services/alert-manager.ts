/**
 * Real-Time Security Incident & Alert Manager.
 * Detects high-risk platform events and dispatches immediate out-of-band alerts
 * to the Super Admin via Telegram Security Bot and HMAC-chained audit log.
 */
import { writeAuditEvent, AuditSeverity } from "./audit";
import { storage } from "../storage";

export type SecurityAlertEvent =
  | "ROOT_ADMIN_LOGIN"
  | "EMERGENCY_RECOVERY_CODE_USED"
  | "TOKEN_FAMILY_REPLAY_ATTACK"
  | "FAILED_LOGIN_SPIKE"
  | "WEBAUTHN_CREDENTIAL_CHANGE"
  | "PAYMENT_CREDENTIALS_MODIFIED"
  | "GLOBAL_LOCKDOWN_TOGGLED"
  | "STAFF_PRIVILEGE_MODIFIED";

export interface AlertDetails {
  event: SecurityAlertEvent;
  severity: AuditSeverity;
  userId?: number | null;
  actorEmail?: string;
  ip?: string;
  location?: string;
  userAgent?: string;
  details: string;
}

export async function dispatchSecurityAlert(alert: AlertDetails): Promise<void> {
  // 1. Write immutable HMAC audit log entry
  await writeAuditEvent({
    eventType: `alert_${alert.event.toLowerCase()}`,
    severity: alert.severity,
    userId: alert.userId ?? null,
    ip: alert.ip ?? null,
    userAgent: alert.userAgent ?? null,
    actionTaken: `[${alert.severity.toUpperCase()}] ${alert.details}`,
  });

  // 2. Dispatch to Super Admin Security Telegram Bot
  try {
    const botToken = await storage.settings.get("telegram_security_bot_token");
    const chatId = await storage.settings.get("telegram_security_chat_id");

    if (botToken && chatId) {
      const emoji = alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "🛡️";
      const message = `${emoji} <b>SECURITY ALERT: ${alert.event}</b>\n\n` +
        `<b>Severity:</b> ${alert.severity.toUpperCase()}\n` +
        `<b>Actor:</b> ${alert.actorEmail || "Anonymous / Unknown"}\n` +
        `<b>IP Address:</b> <code>${alert.ip || "Unknown"}</code>\n` +
        `<b>Details:</b> ${alert.details}\n` +
        `<b>Timestamp:</b> ${new Date().toISOString()}\n\n` +
        `<i>FarmFreshFarmer Security Operations Center</i>`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      });
    }
  } catch (err: any) {
    console.error("[ALERT-MANAGER] Failed to send Telegram security alert:", err.message);
  }
}
