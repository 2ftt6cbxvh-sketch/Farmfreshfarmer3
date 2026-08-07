/**
 * Telegram Security Alert & Remote Lockdown Bot Service.
 * Sends immediate alerts for:
 *   - Admin login attempts (success & failure)
 *   - Suspected brute force patterns
 *   - Unrecognized device logins
 * Handles /lockdown on <reason> and /lockdown off commands strictly verified
 * against verified chat ID.
 */
import { setLockdown } from "./lockdown";

export async function getTelegramCredentials(): Promise<{ botToken: string; chatId: string }> {
  const envToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const envChatId = process.env.TELEGRAM_CHAT_ID || "";

  if (envToken && envChatId) {
    return { botToken: envToken, chatId: envChatId };
  }

  const { storage } = await import("../storage");
  const dbToken = await storage.settings.get("telegram_bot_token");
  const dbChatId = await storage.settings.get("telegram_chat_id");

  return {
    botToken: envToken || dbToken || "",
    chatId: envChatId || dbChatId || "",
  };
}

export async function isTelegramConfigured(): Promise<boolean> {
  const { botToken, chatId } = await getTelegramCredentials();
  return !!(botToken && chatId);
}

/** Send notification message to verified Telegram chat ID */
export async function sendTelegramAlert(message: string): Promise<boolean> {
  const { botToken, chatId } = await getTelegramCredentials();
  if (!botToken || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
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
  const { chatId: expectedChatId } = await getTelegramCredentials();
  const message = update?.message;
  if (!message || !message.text) return { handled: false };

  const chatId = String(message.chat?.id);
  const text = message.text.trim();

  // Strict Chat ID check: reject any command from unauthorized chat IDs
  if (chatId !== expectedChatId) {
    console.warn(`[telegram security] Unauthorized command attempt from chat ID: ${chatId}`);
    if (expectedChatId) {
      await sendTelegramAlert(`⚠️ UNAUTHORIZED TELEGRAM COMMAND ATTEMPT!\nFrom Chat ID: ${chatId}\nCommand text: ${text}`);
    }
    return { handled: false };
  }

  const lowerText = text.toLowerCase();

  if (lowerText.startsWith("/lock on") || lowerText.startsWith("/lockdown on") || lowerText.startsWith("/lockon")) {
    let reason = "";
    if (lowerText.startsWith("/lock on")) reason = text.slice(8).trim();
    else if (lowerText.startsWith("/lockdown on")) reason = text.slice(12).trim();
    else if (lowerText.startsWith("/lockon")) reason = text.slice(7).trim();

    reason = reason || "Emergency remote lockdown via Telegram";
    await setLockdown(true, reason, 1);
    const reply = `🔴 <b>SYSTEM LOCKED DOWN</b>\nReason: ${reason}\n\nAll customer API routes are returning 423 (Locked).`;
    await sendTelegramAlert(reply);
    return { handled: true, reply };
  }

  if (lowerText.startsWith("/lock off") || lowerText.startsWith("/lockdown off") || lowerText.startsWith("/lockoff")) {
    await setLockdown(false, "", 1);
    const reply = `🟢 <b>SYSTEM LOCKDOWN DEACTIVATED</b>\nPlatform is now operational.`;
    await sendTelegramAlert(reply);
    return { handled: true, reply };
  }

  if (lowerText === "/status" || lowerText === "/lock") {
    const { getLockdownStatus } = await import("./lockdown");
    const status = await getLockdownStatus();
    const reply = `ℹ️ <b>SYSTEM STATUS</b>\nLockdown: ${status.active ? "🔴 ACTIVE" : "🟢 ONLINE"}\n${status.reason ? `Reason: ${status.reason}` : ""}`;
    return { handled: true, reply };
  }

  return { handled: false };
}
