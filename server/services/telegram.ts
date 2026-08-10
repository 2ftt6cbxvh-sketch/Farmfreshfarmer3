/**
 * Telegram Multi-Bot Service (Security Bot + Grievance & Support Bot)
 * ====================================================================
 * 
 * 1. 🛡️ SUPER ADMIN SECURITY BOT:
 *    - Strict 1-to-1 connection with Super Admin's private Chat ID.
 *    - Exclusive recipient of security alerts:
 *        * Platform lockdown on/off
 *        * Unauthorized /admin login attempts
 *        * Super Admin secret passage / emergency 1-click unlock approvals
 *        * Master session logins & password update alerts
 *        * Failed authentication & brute-force notifications
 *    - Exclusive executor of system control commands:
 *        * /lock on [reason], /lock off
 *        * /approve <token>
 *        * /subadmin block <email>, /subadmin unblock <email>
 *        * /flush sessions
 *        * /status, /users count
 *    - All replies are sent strictly using the SECURITY BOT TOKEN.
 * 
 * 2. 🎫 GRIEVANCE & CUSTOMER SUPPORT BOT:
 *    - Multi-chat connection for Grievance Officers & Customer Support Reps.
 *    - Supports multiple comma-separated Chat IDs or Telegram Group IDs.
 *    - Exclusive recipient of customer service events:
 *        * New customer support tickets raised (/account or chatbot)
 *        * Live Chat human support escalation requests
 *    - NEVER receives security alerts, password failure notices, or unlock requests.
 *    - Security and lockdown commands are STRICTLY BLOCKED in this bot.
 *    - Allowed support commands:
 *        * /tickets - View open support tickets
 *        * /ticket <id> - View ticket details
 *        * /resolve <id> [note] - Mark ticket resolved
 *        * /help, /start - Grievance bot help
 *    - All replies are sent strictly using the GRIEVANCE BOT TOKEN.
 */

import { setLockdown } from "./lockdown";

/* ====================================================================
   1. CREDENTIAL RESOLUTION HELPERS
   ==================================================================== */

export async function getTelegramSecurityCredentials(): Promise<{ botToken: string; chatId: string }> {
  const envToken = process.env.TELEGRAM_SECURITY_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
  const envChatId = process.env.TELEGRAM_SECURITY_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "";

  const { storage } = await import("../storage");
  const dbToken = (await storage.settings.get("telegram_security_bot_token")) || (await storage.settings.get("telegram_bot_token"));
  const dbChatId = (await storage.settings.get("telegram_security_chat_id")) || (await storage.settings.get("telegram_chat_id"));

  return {
    botToken: envToken || dbToken || "",
    chatId: envChatId || dbChatId || "",
  };
}

export async function getTelegramGrievanceCredentials(): Promise<{ botToken: string; chatIds: string[] }> {
  const envToken = process.env.TELEGRAM_GRIEVANCE_BOT_TOKEN || process.env.TELEGRAM_SUPPORT_BOT_TOKEN || "";
  const envChatIds = process.env.TELEGRAM_GRIEVANCE_CHAT_IDS || process.env.TELEGRAM_GRIEVANCE_CHAT_ID || process.env.TELEGRAM_SUPPORT_CHAT_ID || "";

  const { storage } = await import("../storage");
  let botToken = envToken;
  if (!botToken) {
    botToken = (await storage.settings.get("telegram_grievance_bot_token")) || (await storage.settings.get("telegram_support_bot_token")) || "";
  }

  let rawChatIds = envChatIds;
  if (!rawChatIds) {
    rawChatIds = (await storage.settings.get("telegram_grievance_chat_ids")) || (await storage.settings.get("telegram_support_chat_ids")) || (await storage.settings.get("telegram_grievance_chat_id")) || "";
  }

  const chatIds = rawChatIds
    ? rawChatIds
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  return { botToken, chatIds };
}

// Backwards compatibility helper
export async function getTelegramCredentials() {
  return getTelegramSecurityCredentials();
}

export async function isTelegramSecurityConfigured(): Promise<boolean> {
  const { botToken, chatId } = await getTelegramSecurityCredentials();
  return !!(botToken && chatId);
}

export async function isTelegramGrievanceConfigured(): Promise<boolean> {
  const { botToken, chatIds } = await getTelegramGrievanceCredentials();
  return !!(botToken && chatIds.length > 0);
}

/* ====================================================================
   2. LOW-LEVEL MESSAGE SENDER
   ==================================================================== */

async function sendRawTelegramMessage(botToken: string, chatId: string, text: string, extra?: any): Promise<boolean> {
  if (!botToken || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...extra,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error(`[telegram send error to ${chatId}]`, err);
    return false;
  }
}

/* ====================================================================
   3. SECURITY BOT ALERT DISPATCHER (SUPER ADMIN ONLY)
   ==================================================================== */

export async function sendTelegramSecurityAlert(message: string): Promise<boolean> {
  const { botToken, chatId } = await getTelegramSecurityCredentials();
  if (!botToken || !chatId) return false;
  const formatted = `🚨 [FarmFreshFarmer Security]\n${message}`;
  return sendRawTelegramMessage(botToken, chatId, formatted);
}

// Alias for backwards compatibility across existing security imports
export const sendTelegramAlert = sendTelegramSecurityAlert;

/* ====================================================================
   4. GRIEVANCE & SUPPORT BOT ALERT DISPATCHER (MULTI-ADMIN / SUPPORT)
   ==================================================================== */

export async function sendTelegramGrievanceAlert(message: string): Promise<boolean> {
  const { botToken, chatIds } = await getTelegramGrievanceCredentials();
  if (!botToken || chatIds.length === 0) return false;

  const formatted = `🎫 [FarmFresh Support & Grievance]\n${message}`;
  const results = await Promise.all(
    chatIds.map((cId) => sendRawTelegramMessage(botToken, cId, formatted))
  );
  return results.some((r) => r === true);
}

/* ====================================================================
   5. SECRET UNLOCK TOKEN MANAGER (SUPER ADMIN EMERGENCY UNLOCK)
   ==================================================================== */

const telegramUnlockTokens: Record<string, { status: "pending" | "approved" | "rejected"; createdAt: number; deviceInfo?: string }> = {};

export function createTelegramUnlockToken(deviceInfo: string): string {
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  telegramUnlockTokens[token] = { status: "pending", createdAt: Date.now(), deviceInfo };
  return token;
}

export function checkTelegramUnlockToken(token: string): boolean {
  const data = telegramUnlockTokens[token];
  if (!data) return false;
  if (Date.now() - data.createdAt > 5 * 60 * 1000) {
    delete telegramUnlockTokens[token];
    return false;
  }
  if (data.status === "approved") {
    delete telegramUnlockTokens[token];
    return true;
  }
  return false;
}

export function approveTelegramUnlockToken(token: string): boolean {
  if (telegramUnlockTokens[token]) {
    telegramUnlockTokens[token].status = "approved";
    return true;
  }
  return false;
}

export async function sendTelegramUnlockRequest(token: string, deviceInfo: string): Promise<boolean> {
  const { botToken, chatId } = await getTelegramSecurityCredentials();
  if (!botToken || !chatId) return false;

  const text = `🔐 <b>SUPER ADMIN SECRET PASSAGE UNLOCK REQUEST</b>\n\nSession Token: <code>${token}</code>\nDevice Info: ${deviceInfo}\nTimestamp: ${new Date().toLocaleString()}\n\nClick button below or reply <code>/approve ${token}</code> to grant instant Super Admin unlock!`;

  return sendRawTelegramMessage(botToken, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Authorize Super Admin Unlock", callback_data: `approve_${token}` },
          { text: "🚫 Reject Request", callback_data: `reject_${token}` },
        ],
      ],
    },
  });
}

/* ====================================================================
   6. SECURITY BOT WEBHOOK HANDLER (/api/telegram/security/webhook)
   ==================================================================== */

export async function processSecurityTelegramWebhook(update: any): Promise<{ handled: boolean; reply?: string }> {
  const { botToken, chatId: expectedChatId } = await getTelegramSecurityCredentials();
  if (!botToken) return { handled: false, reply: "Security Bot token not configured" };

  // Handle Inline Keyboard Button Taps
  if (update?.callback_query) {
    const cb = update.callback_query;
    const cbChatId = String(cb.message?.chat?.id);
    if (cbChatId === expectedChatId) {
      const data = String(cb.data || "");
      if (data.startsWith("approve_")) {
        const token = data.replace("approve_", "");
        approveTelegramUnlockToken(token);
        const reply = `✅ <b>SUPER ADMIN OVERRIDE SESSION APPROVED!</b>\nToken: <code>${token}</code>\nSuper Admin session authorized. Global platform lockdown remains ACTIVE for all other users.`;
        await sendRawTelegramMessage(botToken, expectedChatId, reply);
        return { handled: true, reply };
      } else if (data.startsWith("reject_")) {
        const token = data.replace("reject_", "");
        const reply = `🚫 <b>SUPER ADMIN EMERGENCY UNLOCK REJECTED!</b>\nToken: <code>${token}</code>\nSession request was rejected by Super Admin.`;
        await sendRawTelegramMessage(botToken, expectedChatId, reply);
        return { handled: true, reply };
      }
    }
  }

  const message = update?.message;
  if (!message || !message.text) return { handled: false };

  const senderChatId = String(message.chat?.id);
  const text = message.text.trim();

  // Strict Chat ID check: reject any command from unauthorized chat IDs
  if (senderChatId !== expectedChatId) {
    console.warn(`[telegram security] Unauthorized command attempt on Security Bot from chat ID: ${senderChatId}`);
    if (expectedChatId) {
      await sendRawTelegramMessage(
        botToken,
        expectedChatId,
        `⚠️ UNAUTHORIZED SECURITY BOT COMMAND ATTEMPT!\nFrom Chat ID: ${senderChatId}\nCommand: ${text}`
      );
    }
    return { handled: false };
  }

  const lowerText = text.toLowerCase();

  // Security Commands
  if (lowerText.startsWith("/lock on") || lowerText.startsWith("/lockdown on") || lowerText.startsWith("/lockon")) {
    let reason = "";
    if (lowerText.startsWith("/lock on")) reason = text.slice(8).trim();
    else if (lowerText.startsWith("/lockdown on")) reason = text.slice(12).trim();
    else if (lowerText.startsWith("/lockon")) reason = text.slice(7).trim();

    reason = reason || "Unauthorised activity detected";
    await setLockdown(true, reason, 1);
    const reply = `🔴 <b>SYSTEM LOCKED DOWN</b>\nReason: ${reason}\n\nAll customer and Sub-admin API routes returning 423 (Locked) except Chief Admin.`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText.startsWith("/lock off") || lowerText.startsWith("/lockdown off") || lowerText.startsWith("/lockoff")) {
    await setLockdown(false, "", 1);
    const reply = `🟢 <b>SYSTEM LOCKDOWN DEACTIVATED</b>\nPlatform is now fully operational.`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText === "/status" || lowerText === "/lock") {
    const { getLockdownStatus } = await import("./lockdown");
    const status = await getLockdownStatus();
    const reply = `ℹ️ <b>SYSTEM STATUS</b>\nLockdown: ${status.active ? "🔴 ACTIVE" : "🟢 ONLINE"}\n${status.reason ? `Reason: ${status.reason}` : ""}`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText.startsWith("/subadmin block") || lowerText.startsWith("/block ")) {
    const target = text.replace("/subadmin block", "").replace("/block", "").trim().toLowerCase();
    if (!target) {
      const reply = "⚠️ Usage: <code>/subadmin block user@email.com</code>";
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
    const { storage } = await import("../storage");
    const user = await storage.users.getByEmail(target);
    if (user) {
      const { db } = await import("../db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(users).set({ status: "blocked" }).where(eq(users.id, user.id));
      const reply = `🚫 <b>USER/SUBADMIN BLOCKED</b>\nUser: ${user.name} (${user.email})\nRole: ${user.role}\nStatus: Blocked.`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
    const reply = `⚠️ User <code>${target}</code> not found.`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText.startsWith("/subadmin unblock") || lowerText.startsWith("/unblock ")) {
    const target = text.replace("/subadmin unblock", "").replace("/unblock", "").trim().toLowerCase();
    if (!target) {
      const reply = "⚠️ Usage: <code>/subadmin unblock user@email.com</code>";
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
    const { storage } = await import("../storage");
    const user = await storage.users.getByEmail(target);
    if (user) {
      const { db } = await import("../db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(users).set({ status: "active" }).where(eq(users.id, user.id));
      const reply = `✅ <b>USER/SUBADMIN UNBLOCKED</b>\nUser: ${user.name} (${user.email})\nStatus: Active.`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
    const reply = `⚠️ User <code>${target}</code> not found.`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText === "/flush sessions" || lowerText === "/flush") {
    const { db } = await import("../db");
    const { refreshTokens } = await import("@shared/schema");
    await db.delete(refreshTokens);
    const reply = `🧹 <b>ALL ACTIVE SESSIONS FLUSHED</b>\nAll user & sub-admin refresh tokens have been revoked. Users must re-authenticate.`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText === "/users count" || lowerText === "/users") {
    const { storage } = await import("../storage");
    const allUsers = await storage.users.list();
    const activeCount = allUsers.filter((u) => u.status !== "blocked").length;
    const blockedCount = allUsers.filter((u) => u.status === "blocked").length;
    const reply = `👥 <b>FARMFRESH USER METRICS</b>\nTotal Users: ${allUsers.length}\nActive: ${activeCount}\nBlocked: ${blockedCount}`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText.startsWith("/approve") || lowerText.startsWith("/unlock ")) {
    const token = text.replace("/approve", "").replace("/unlock", "").trim();
    if (!token) {
      const reply = "⚠️ Usage: <code>/approve 123456</code> or tap the inline button.";
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
    const success = approveTelegramUnlockToken(token);
    if (success) {
      const reply = `✅ <b>SUPER ADMIN OVERRIDE SESSION APPROVED!</b>\nToken: <code>${token}</code>\nSuper Admin session authorized. Global platform lockdown remains ACTIVE for all other users.`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    } else {
      const reply = `⚠️ Token <code>${token}</code> not found or expired.`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
  }

  if (lowerText === "/help" || lowerText === "/start") {
    const reply =
      `🛡️ <b>FARMFRESH SUPER ADMIN SECURITY BOT</b>\n\n` +
      `🔴 <code>/lock on [reason]</code> - Remote emergency lockdown\n` +
      `🟢 <code>/lock off</code> - Deactivate platform lockdown\n` +
      `🔑 <code>/approve &lt;token&gt;</code> - Approve Super Admin emergency unlock\n` +
      `ℹ️ <code>/status</code> or <code>/lock</code> - Check live system status\n` +
      `🚫 <code>/subadmin block &lt;email&gt;</code> - Instantly block a sub-admin\n` +
      `✅ <code>/subadmin unblock &lt;email&gt;</code> - Unblock a user/sub-admin\n` +
      `🧹 <code>/flush sessions</code> - Revoke all active session tokens\n` +
      `👥 <code>/users count</code> - Get total user statistics\n\n` +
      `<i>Note: Support tickets and live customer queries are routed to the separate Grievance Bot.</i>`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  return { handled: false };
}

// Backwards compatibility
export const processTelegramWebhook = processSecurityTelegramWebhook;

/* ====================================================================
   7. GRIEVANCE & SUPPORT BOT WEBHOOK HANDLER (/api/telegram/grievance/webhook)
   ==================================================================== */

export async function processGrievanceTelegramWebhook(update: any): Promise<{ handled: boolean; reply?: string }> {
  const { botToken, chatIds } = await getTelegramGrievanceCredentials();
  if (!botToken) return { handled: false, reply: "Grievance Bot token not configured" };

  const message = update?.message;
  if (!message || !message.text) return { handled: false };

  const senderChatId = String(message.chat?.id);
  const text = message.text.trim();
  const lowerText = text.toLowerCase();

  // 1. STRICT SECURITY GUARD: BLOCK ALL SECURITY & LOCKDOWN COMMANDS IN GRIEVANCE BOT
  const isSecurityCommand = [
    "/lock", "/lockdown", "/lockon", "/lockoff", "/approve", "/unlock",
    "/subadmin", "/block", "/unblock", "/flush",
  ].some((prefix) => lowerText.startsWith(prefix));

  if (isSecurityCommand) {
    const reply =
      `🚫 <b>SECURITY COMMAND RESTRICTED</b>\n\n` +
      `Platform lockdown, security authorization, and user blocking controls are strictly restricted to the private <b>Super Admin Security Bot</b>.\n\n` +
      `Customer representatives and grievance staff cannot execute website control commands from this bot.`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  // 2. SUPPORT BOT COMMANDS
  if (lowerText === "/help" || lowerText === "/start") {
    const reply =
      `🎫 <b>FARMFRESH GRIEVANCE & CUSTOMER SUPPORT BOT</b>\n\n` +
      `Commands for Support Representatives & Grievance Officers:\n` +
      `📋 <code>/tickets</code> - View recent open customer support tickets\n` +
      `🔍 <code>/ticket &lt;id&gt;</code> - View details of a specific ticket (e.g. <code>/ticket TICK-1234</code>)\n` +
      `✅ <code>/resolve &lt;id&gt; [note]</code> - Mark a ticket as resolved\n\n` +
      `🌐 <b>Staff Dashboards:</b>\n` +
      `• Live Chat Portal: https://www.farmfreshfarmer.com/admin/live-chat\n` +
      `• Support Tickets Portal: https://www.farmfreshfarmer.com/admin/tickets`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText === "/tickets" || lowerText === "/open") {
    try {
      const { db } = await import("../db");
      const { supportTickets } = await import("@shared/schema");
      const { or, eq, desc } = await import("drizzle-orm");

      const rows = await db
        .select()
        .from(supportTickets)
        .where(or(eq(supportTickets.status, "open"), eq(supportTickets.status, "under_solving")))
        .orderBy(desc(supportTickets.createdAt))
        .limit(10);

      if (rows.length === 0) {
        const reply = "✅ <b>No open support tickets!</b> All customer inquiries are currently resolved.";
        await sendRawTelegramMessage(botToken, senderChatId, reply);
        return { handled: true, reply };
      }

      let reply = `🎫 <b>OPEN CUSTOMER SUPPORT TICKETS (${rows.length}):</b>\n\n`;
      rows.forEach((t, i) => {
        reply += `${i + 1}. <b>${t.ticketId}</b> (${t.status.toUpperCase()})\n` +
          `   👤 ${t.customerName} (${t.customerPhone || t.customerEmail})\n` +
          `   📝 "${t.concern.substring(0, 70)}${t.concern.length > 70 ? '...' : ''}"\n\n`;
      });
      reply += `👉 Reply <code>/ticket &lt;id&gt;</code> or visit https://www.farmfreshfarmer.com/admin/tickets`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    } catch (err: any) {
      const reply = `⚠️ Error fetching tickets: ${err?.message || "Internal error"}`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
  }

  if (lowerText.startsWith("/ticket ")) {
    const targetId = text.replace("/ticket", "").trim();
    try {
      const { db } = await import("../db");
      const { supportTickets } = await import("@shared/schema");
      const { or, eq, ilike } = await import("drizzle-orm");

      const [row] = await db
        .select()
        .from(supportTickets)
        .where(or(eq(supportTickets.ticketId, targetId), ilike(supportTickets.ticketId, `%${targetId}%`)))
        .limit(1);

      if (!row) {
        const reply = `⚠️ Ticket <code>${targetId}</code> not found.`;
        await sendRawTelegramMessage(botToken, senderChatId, reply);
        return { handled: true, reply };
      }

      const reply =
        `🎫 <b>TICKET DETAILS: ${row.ticketId}</b>\n\n` +
        `<b>Status:</b> ${row.status.toUpperCase()}\n` +
        `<b>Customer:</b> ${row.customerName}\n` +
        `<b>Phone:</b> ${row.customerPhone}\n` +
        `<b>Email:</b> ${row.customerEmail}\n` +
        `<b>Priority:</b> ${row.priority}\n` +
        `<b>Created:</b> ${new Date(row.createdAt).toLocaleString()}\n\n` +
        `<b>Concern:</b>\n"${row.concern}"\n\n` +
        (row.adminNotes ? `<b>Staff Notes:</b> ${row.adminNotes}\n\n` : "") +
        `👉 <code>/resolve ${row.ticketId} [note]</code> to mark as resolved.`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    } catch (err: any) {
      const reply = `⚠️ Error fetching ticket: ${err?.message || "Internal error"}`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
  }

  if (lowerText.startsWith("/resolve ")) {
    const parts = text.replace("/resolve", "").trim().split(/\s+/);
    const targetId = parts[0];
    const note = parts.slice(1).join(" ") || "Resolved via Grievance Telegram Bot";

    try {
      const { db } = await import("../db");
      const { supportTickets } = await import("@shared/schema");
      const { or, eq, ilike } = await import("drizzle-orm");

      const [row] = await db
        .select()
        .from(supportTickets)
        .where(or(eq(supportTickets.ticketId, targetId), ilike(supportTickets.ticketId, `%${targetId}%`)))
        .limit(1);

      if (!row) {
        const reply = `⚠️ Ticket <code>${targetId}</code> not found.`;
        await sendRawTelegramMessage(botToken, senderChatId, reply);
        return { handled: true, reply };
      }

      await db
        .update(supportTickets)
        .set({ status: "solved", adminNotes: note })
        .where(eq(supportTickets.id, row.id));

      const reply = `✅ <b>TICKET RESOLVED!</b>\nTicket: <code>${row.ticketId}</code>\nCustomer: ${row.customerName}\nNote: ${note}`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    } catch (err: any) {
      const reply = `⚠️ Error resolving ticket: ${err?.message || "Internal error"}`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
  }

  return { handled: false };
}
