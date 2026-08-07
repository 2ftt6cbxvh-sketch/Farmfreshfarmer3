/**
 * Telegram Security Alert & Remote Lockdown Bot Service.
 * Sends immediate alerts for:
 *   - Admin login attempts (success & failure)
 *   - Suspected brute force patterns
 *   - Unrecognized device logins
 * Handles /lockdown on <reason> and /lockdown off commands strictly verified
 * against process.env.TELEGRAM_CHAT_ID.
 */
import { setLockdown } from "./lockdown";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

export function isTelegramConfigured(): boolean {
  return !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
}

/** Send notification message to verified Telegram chat ID */
export async function sendTelegramAlert(message: string): Promise<boolean> {
  if (!isTelegramConfigured()) return false;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `🚨 [FarmFreshFarmer Security]\n${message}`,
        parse_mode: "HTML",
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[telegram alert error]", err);
    return false;
  }
}

/** Process incoming Telegram webhook updates for /lockdown commands */
export async function processTelegramWebhook(update: any): Promise<{ handled: boolean; reply?: string }> {
  const message = update?.message;
  if (!message || !message.text) return { handled: false };

  const chatId = String(message.chat?.id);
  const text = message.text.trim();

  // Strict Chat ID check: reject any command from unauthorized chat IDs
  if (chatId !== TELEGRAM_CHAT_ID) {
    console.warn(`[telegram security] Unauthorized command attempt from chat ID: ${chatId}`);
    // Alert owner about unauthorized attempt
    if (TELEGRAM_CHAT_ID) {
      await sendTelegramAlert(`⚠️ UNAUTHORIZED TELEGRAM COMMAND ATTEMPT!\nFrom Chat ID: ${chatId}\nCommand text: ${text}`);
    }
    return { handled: false };
  }

  if (text.startsWith("/lockdown on")) {
    const reason = text.slice(12).trim() || "Emergency remote lockdown via Telegram";
    await setLockdown(true, reason, 1);
    const reply = `🔴 <b>SYSTEM LOCKED DOWN</b>\nReason: ${reason}\n\nAll customer API routes are returning 423 (Locked).`;
    await sendTelegramAlert(reply);
    return { handled: true, reply };
  }

  if (text.startsWith("/lockdown off")) {
    await setLockdown(false, "", 1);
    const reply = `🟢 <b>SYSTEM LOCKDOWN DEACTIVATED</b>\nPlatform is now operational.`;
    await sendTelegramAlert(reply);
    return { handled: true, reply };
  }

  if (text === "/status") {
    const { getLockdownStatus } = await import("./lockdown");
    const status = await getLockdownStatus();
    const reply = `ℹ️ <b>SYSTEM STATUS</b>\nLockdown: ${status.active ? "🔴 ACTIVE" : "🟢 ONLINE"}\n${status.reason ? `Reason: ${status.reason}` : ""}`;
    return { handled: true, reply };
  }

  return { handled: false };
}
