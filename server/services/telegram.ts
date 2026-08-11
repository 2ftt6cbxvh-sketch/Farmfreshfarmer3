/**
 * Telegram Multi-Bot Service (Security Bot + Grievance & Support Bot)
 * ====================================================================
 * 
 * 1. 🛡️ SUPER ADMIN SECURITY BOT:
 *    - Strict 1-to-1 connection with Super Admin's private Chat ID.
 *    - Exclusive recipient of security alerts & governance:
 *        * Platform lockdown on/off
 *        * Unauthorized /admin login attempts
 *        * Super Admin secret passage / emergency 1-click unlock approvals
 *        * Master session logins & password update alerts
 *        * Failed authentication & brute-force notifications
 *        * Product & Category approval requests submitted by Sub-Admins
 *    - Exclusive executor of system control commands:
 *        * /lock on [reason], /lock off
 *        * /approve <token>
 *        * /approvals (view pending catalog moderation items)
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
 *    - NEVER receives security alerts, password failure notices, or product approvals.
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

export async function getTelegramSecurityCredentials(): Promise<{ botToken: string; chatId: string; chatIds: string[] }> {
  const envToken = process.env.TELEGRAM_SECURITY_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
  const envChatIds = process.env.TELEGRAM_SECURITY_CHAT_IDS || process.env.TELEGRAM_SECURITY_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "";

  const { storage } = await import("../storage");
  const dbToken = (await storage.settings.get("telegram_security_bot_token")) || (await storage.settings.get("telegram_bot_token"));
  const dbChatIds = (await storage.settings.get("telegram_security_chat_ids")) || (await storage.settings.get("telegram_security_chat_id")) || (await storage.settings.get("telegram_chat_id"));

  const rawChatIds = envChatIds || dbChatIds || "";
  const chatIds = rawChatIds
    ? rawChatIds
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  const primaryChatId = chatIds[0] || "";

  return {
    botToken: envToken || dbToken || "",
    chatId: primaryChatId,
    chatIds,
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

export async function getTelegramOtpCredentials(): Promise<{ botToken: string }> {
  const envToken = process.env.TELEGRAM_OTP_BOT_TOKEN || process.env.TELEGRAM_2FA_BOT_TOKEN || "";
  const { storage } = await import("../storage");
  const dbToken = (await storage.settings.get("telegram_otp_bot_token")) || (await storage.settings.get("telegram_2fa_bot_token")) || "";
  return { botToken: envToken || dbToken || "" };
}

// Backwards compatibility helper
export async function getTelegramCredentials() {
  return getTelegramSecurityCredentials();
}

export async function isTelegramSecurityConfigured(): Promise<boolean> {
  const { botToken, chatIds } = await getTelegramSecurityCredentials();
  return !!(botToken && chatIds.length > 0);
}

export async function isTelegramGrievanceConfigured(): Promise<boolean> {
  const { botToken, chatIds } = await getTelegramGrievanceCredentials();
  return !!(botToken && chatIds.length > 0);
}

export async function isTelegramOtpConfigured(): Promise<boolean> {
  const { botToken } = await getTelegramOtpCredentials();
  return !!botToken;
}

/* ====================================================================
   1B. 2FA TELEGRAM OTP IN-MEMORY SESSION STORE
   ==================================================================== */

interface Pending2faOtpSession {
  userId: number;
  email: string;
  chatId: string;
  staffName: string;
  otp: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const pending2faSessions = new Map<string, Pending2faOtpSession>();

// Periodically clean up expired 2FA sessions every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of pending2faSessions.entries()) {
    if (session.expiresAt < now) {
      pending2faSessions.delete(token);
    }
  }
}, 2 * 60 * 1000);

export async function create2faOtpSession(
  userId: number,
  email: string,
  chatId: string,
  staffName = "Staff Member"
): Promise<{ tempToken: string; otp: string; maskedTelegram: string }> {
  const crypto = await import("crypto");
  const otp = crypto.randomInt(100000, 999999).toString();
  const tempToken = crypto.randomBytes(32).toString("hex");

  const cleanChatId = chatId.trim();
  const maskedTelegram = cleanChatId.length > 4 ? `••••${cleanChatId.slice(-4)}` : cleanChatId;

  pending2faSessions.set(tempToken, {
    userId,
    email,
    chatId: cleanChatId,
    staffName,
    otp,
    expiresAt: Date.now() + 3 * 60 * 1000, // 3 Minutes TTL
    attempts: 0,
    lastSentAt: Date.now(),
  });

  return { tempToken, otp, maskedTelegram };
}

export function verify2faOtpSession(
  tempToken: string,
  userOtp: string
): { success: boolean; userId?: number; email?: string; message?: string } {
  if (!tempToken || !userOtp) {
    return { success: false, message: "Missing session token or OTP code" };
  }

  const session = pending2faSessions.get(tempToken);
  if (!session) {
    return { success: false, message: "Session expired or invalid. Please sign in again." };
  }

  if (session.expiresAt < Date.now()) {
    pending2faSessions.delete(tempToken);
    return { success: false, message: "OTP has expired (3-minute time limit). Please request a new code." };
  }

  if (session.attempts >= 3) {
    pending2faSessions.delete(tempToken);
    return { success: false, message: "Too many failed attempts. Security session terminated." };
  }

  const cleanInput = String(userOtp).trim();
  if (cleanInput !== session.otp) {
    session.attempts += 1;
    const remaining = 3 - session.attempts;
    return {
      success: false,
      message: `Invalid 6-digit OTP code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : "Session locked."}`,
    };
  }

  // Single-use burn: destroy OTP session upon successful verification
  pending2faSessions.delete(tempToken);
  return { success: true, userId: session.userId, email: session.email };
}

export async function resend2faOtpSession(
  tempToken: string
): Promise<{ success: boolean; message: string; maskedTelegram?: string }> {
  const session = pending2faSessions.get(tempToken);
  if (!session) {
    return { success: false, message: "Session expired. Please sign in again." };
  }

  // 30 seconds cooldown between resends
  if (Date.now() - session.lastSentAt < 30 * 1000) {
    const waitSec = Math.ceil((30 * 1000 - (Date.now() - session.lastSentAt)) / 1000);
    return { success: false, message: `Please wait ${waitSec}s before requesting a new OTP.` };
  }

  const crypto = await import("crypto");
  const newOtp = crypto.randomInt(100000, 999999).toString();
  session.otp = newOtp;
  session.expiresAt = Date.now() + 3 * 60 * 1000;
  session.lastSentAt = Date.now();
  session.attempts = 0;

  const sent = await sendTelegram2faOtp(session.chatId, newOtp, session.staffName);
  if (!sent) {
    return { success: false, message: "Failed to dispatch Telegram OTP. Verify staff Chat ID." };
  }

  const maskedTelegram = session.chatId.length > 4 ? `••••${session.chatId.slice(-4)}` : session.chatId;
  return { success: true, message: `New OTP dispatched to Telegram (${maskedTelegram})!`, maskedTelegram };
}

export async function sendTelegram2faOtp(
  chatId: string,
  otp: string,
  staffName = "Staff Member"
): Promise<boolean> {
  const { botToken } = await getTelegramOtpCredentials();
  if (!botToken || !chatId) return false;

  const text = `🔐 <b>FarmFreshFarmer Staff 2FA Verification</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
👋 Hello, <b>${staffName}</b>!

🔑 Your one-time login verification code is:
<pre><b>${otp}</b></pre>

⏳ <b>Validity:</b> 3 Minutes (Single-Use Only)
⚠️ <i>Do not share this OTP code with anyone, including other administrators.</i>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>FarmFresh Security &amp; Access Governance</i>`;

  return sendRawTelegramMessage(botToken, chatId, text);
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
   3. SECURITY BOT ALERT DISPATCHER (SUPER ADMIN & SUB-SUPER-ADMINS)
   ==================================================================== */

export async function sendTelegramSecurityAlert(message: string): Promise<boolean> {
  const { botToken, chatIds } = await getTelegramSecurityCredentials();
  if (!botToken || chatIds.length === 0) return false;
  const formatted = `🚨 [FarmFreshFarmer Security]\n${message}`;
  const results = await Promise.all(
    chatIds.map((cId) => sendRawTelegramMessage(botToken, cId, formatted))
  );
  return results.some((r) => r === true);
}

// Alias for backwards compatibility across existing security imports
export const sendTelegramAlert = sendTelegramSecurityAlert;

/* ====================================================================
   3B. FORMAL PRODUCT & CATEGORY APPROVAL NOTIFICATIONS (SECURITY BOT)
   ==================================================================== */

export interface ApprovalNotificationParams {
  entityType: "product" | "category";
  action: "create" | "edit" | "delete";
  entityName: string;
  entityId: number;
  submitterName?: string | null;
  submitterEmail?: string | null;
  price?: string | number | null;
  unit?: string | null;
  stock?: number | null;
  categorySlug?: string | null;
}

export async function sendTelegramApprovalNotification(params: ApprovalNotificationParams): Promise<boolean> {
  const { botToken, chatIds } = await getTelegramSecurityCredentials();
  if (!botToken || chatIds.length === 0) return false;

  const actionText =
    params.action === "create" ? "➕ NEW CREATION REQUEST" :
    params.action === "edit" ? "📝 MODIFICATION / EDIT REQUEST" :
    "🗑️ DELETION REQUEST";

  const entityTitle = params.entityType === "product" ? "Product" : "Category";
  const submitter = params.submitterName
    ? `${params.submitterName}${params.submitterEmail ? ` (${params.submitterEmail})` : ""}`
    : params.submitterEmail || "Sub-Admin";

  let detailsBlock = "";
  if (params.entityType === "product") {
    const pPrice = params.price ? `₹${params.price}` : "N/A";
    const pUnit = params.unit || "Standard";
    const pStock = params.stock != null ? String(params.stock) : "N/A";
    const pCat = params.categorySlug || "Uncategorized";
    detailsBlock = `\n💰 <b>Price:</b> ${pPrice} | <b>Unit:</b> ${pUnit}\n📦 <b>Stock:</b> ${pStock} | <b>Category:</b> ${pCat}\n`;
  }

  const message = `🔔 <b>APPROVAL REQUIRED (SUPER ADMIN)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>Type:</b> ${entityTitle}
⚡ <b>Action:</b> ${actionText}
🏷️ <b>Item:</b> <b>${params.entityName}</b> (ID: #${params.entityId})
${detailsBlock}
👤 <b>Submitted By:</b> ${submitter}
⏰ <b>Time:</b> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}

🛡️ <b>Storefront Status:</b> ⏳ Moderation Queue (Hidden from customers until approved)
━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 <b>Instructions:</b> Please log into the Admin Dashboard with your Super Admin credentials and navigate to <b>Approvals</b> to review, modify, or approve. (Direct links are omitted for security)`;

  const results = await Promise.all(
    chatIds.map((cId) => sendRawTelegramMessage(botToken, cId, message))
  );
  return results.some((r) => r === true);
}

/* ====================================================================
   3B-2. PRODUCT RECONSIDERATION & CHANGE REQUEST NOTIFIER (GRIEVANCE BOT)
   ==================================================================== */

export interface ReconsiderationNotificationParams {
  entityType: "product" | "category";
  entityName: string;
  entityId: number;
  submitterName?: string | null;
  submitterEmail?: string | null;
  submitterChatId?: string | null;
  adminFeedback: string;
  price?: string | number | null;
  categorySlug?: string | null;
}

export async function sendTelegramReconsiderationNotification(params: ReconsiderationNotificationParams): Promise<boolean> {
  const entityTitle = params.entityType === "product" ? "Product" : "Category";
  const submitter = params.submitterName
    ? `${params.submitterName}${params.submitterEmail ? ` (${params.submitterEmail})` : ""}`
    : params.submitterEmail || "Sub-Admin";

  const message = `⚠️ <b>PRODUCT RECONSIDERATION REQUESTED</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>Entity:</b> ${entityTitle}
🏷️ <b>Item:</b> <b>${params.entityName}</b> (ID: #${params.entityId})
${params.price ? `💰 <b>Price:</b> ₹${params.price} | <b>Category:</b> ${params.categorySlug || "N/A"}\n` : ""}👤 <b>Assigned Sub-Admin:</b> ${submitter}
⏰ <b>Time:</b> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}

💬 <b>SUPER ADMIN FEEDBACK / REQUIRED CHANGES:</b>
<blockquote>${params.adminFeedback}</blockquote>

━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 <b>Action Required:</b> Please log into your Sub-Admin Dashboard and open the <b>Re-Consideration Queue</b> to review notes, make the necessary corrections, and click <b>Resubmit for Approval</b>.`;

  const results: boolean[] = [];

  // 1. Direct message to Sub-Admin's personal Telegram Chat ID if available
  if (params.submitterChatId) {
    const { botToken: grievToken } = await getTelegramGrievanceCredentials();
    const { botToken: secToken } = await getTelegramSecurityCredentials();
    const token = grievToken || secToken;
    if (token) {
      const res = await sendRawTelegramMessage(token, params.submitterChatId, message);
      results.push(res);
    }
  }

  // 2. Broadcast to Grievance & Support Bot channel
  const grievAlert = await sendTelegramGrievanceAlert(message);
  results.push(grievAlert);

  return results.some((r) => r === true);
}

/* ====================================================================
   3C. ORDER, CANCELLATION & REFUND NOTIFICATIONS (SUPER ADMIN SECURITY BOT ONLY)
   ==================================================================== */

export interface OrderSecurityNotificationParams {
  orderId: number;
  customerName: string;
  phone: string;
  address: string;
  items: Array<{ name: string; unit?: string; price: number | string; qty: number }>;
  subtotal: number | string;
  discount?: number | string;
  deliveryFee?: number | string;
  total: number | string;
  paymentMethod: string;
  couponCode?: string | null;
  orderType?: string | null;
}

export async function sendTelegramOrderSecurityNotification(params: OrderSecurityNotificationParams): Promise<boolean> {
  const { botToken, chatIds } = await getTelegramSecurityCredentials();
  if (!botToken || chatIds.length === 0) return false;

  const itemLines = (params.items || [])
    .map((it) => `• <b>${it.name}</b> (${it.unit || "1 pc"}) × ${it.qty} = ₹${(Number(it.price) * it.qty).toFixed(0)}`)
    .join("\n");

  const message = `🛍️ <b>NEW ORDER PLACED (SECURITY BOT)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Order ID:</b> #${params.orderId}
💰 <b>Grand Total:</b> ₹${Number(params.total).toFixed(0)} (${params.paymentMethod})
👤 <b>Customer:</b> ${params.customerName}
📱 <b>Phone:</b> ${params.phone}
📍 <b>Delivery Address:</b>
${params.address}

🛒 <b>Ordered Items (${params.items?.length || 0}):</b>
${itemLines || "• General farm produce"}

🧾 <b>Price Breakdown:</b>
• Subtotal: ₹${Number(params.subtotal).toFixed(0)}
${Number(params.discount) > 0 ? `• Discount: -₹${Number(params.discount).toFixed(0)}\n` : ""}${Number(params.deliveryFee) > 0 ? `• Delivery Fee: ₹${Number(params.deliveryFee).toFixed(0)}\n` : "• Delivery: FREE\n"}• <b>Total: ₹${Number(params.total).toFixed(0)}</b>
💳 <b>Payment Method:</b> ${params.paymentMethod}
${params.couponCode ? `🏷️ <b>Coupon Code:</b> ${params.couponCode}\n` : ""}${params.orderType === "subscription" ? "📦 <b>Order Type:</b> Weekly Subscription Box\n" : ""}⏰ <b>Time:</b> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;

  const results = await Promise.all(
    chatIds.map((cId) => sendRawTelegramMessage(botToken, cId, message))
  );
  return results.some((r) => r === true);
}

export interface OrderCancellationSecurityNotificationParams {
  orderId: number;
  customerName?: string | null;
  phone?: string | null;
  total: number | string;
  paymentMethod: string;
  reason?: string | null;
  cancelledBy?: string | null;
}

export async function sendTelegramOrderCancellationSecurityNotification(params: OrderCancellationSecurityNotificationParams): Promise<boolean> {
  const { botToken, chatIds } = await getTelegramSecurityCredentials();
  if (!botToken || chatIds.length === 0) return false;

  const message = `❌ <b>ORDER CANCELLED (SECURITY BOT)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Order ID:</b> #${params.orderId}
👤 <b>Customer:</b> ${params.customerName || "Customer"} ${params.phone ? `(${params.phone})` : ""}
💰 <b>Order Value:</b> ₹${Number(params.total).toFixed(0)}
💳 <b>Payment Method:</b> ${params.paymentMethod}
📝 <b>Reason / Note:</b> ${params.reason || "Cancelled by user / admin"}
👤 <b>Cancelled By:</b> ${params.cancelledBy || "Customer / Admin"}
⏰ <b>Time:</b> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;

  const results = await Promise.all(
    chatIds.map((cId) => sendRawTelegramMessage(botToken, cId, message))
  );
  return results.some((r) => r === true);
}

export interface RefundSecurityNotificationParams {
  ticketId?: string | null;
  orderId: number;
  customerName: string;
  phone: string;
  refundAmount: number | string;
  refundStatus: string;
  concern: string;
  photoUrl?: string | null;
  processedBy?: string | null;
  gatewayMessage?: string | null;
}

export async function sendTelegramRefundSecurityNotification(params: RefundSecurityNotificationParams): Promise<boolean> {
  const { botToken, chatIds } = await getTelegramSecurityCredentials();
  if (!botToken || chatIds.length === 0) return false;

  const isApproved = params.refundStatus === "refunded" || params.refundStatus === "approved";
  const icon = isApproved ? "✅" : "🚨";
  const statusTitle = isApproved ? "REFUND PROCESSED & COMPLETED" : "NEW RETURN & REFUND REQUESTED";

  const message = `${icon} <b>${statusTitle} (SECURITY BOT)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Order ID:</b> #${params.orderId} ${params.ticketId ? `(Ticket: <code>${params.ticketId}</code>)` : ""}
💵 <b>Refund Amount:</b> ₹${Number(params.refundAmount).toFixed(0)}
📊 <b>Status:</b> ${params.refundStatus.toUpperCase()}
👤 <b>Customer:</b> ${params.customerName} (${params.phone})
📋 <b>Reason / Concern:</b>
<blockquote>${params.concern}</blockquote>
${params.photoUrl ? `📸 <b>Damage Proof Photo:</b> ${params.photoUrl.startsWith("data:") ? "[Base64 Image Attached in Ticket]" : `<a href="${params.photoUrl}">View Uploaded Photo</a>`}\n` : ""}${params.processedBy ? `👤 <b>Processed By:</b> ${params.processedBy}\n` : ""}${params.gatewayMessage ? `💳 <b>Gateway Note:</b> ${params.gatewayMessage}\n` : ""}⏰ <b>Time:</b> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;

  const results = await Promise.all(
    chatIds.map((cId) => sendRawTelegramMessage(botToken, cId, message))
  );
  return results.some((r) => r === true);
}

/* ====================================================================
   3D. DEPLOYMENT / VERSION UPDATE PUSH BROADCASTER (SECURITY BOT)
   ==================================================================== */

export async function sendTelegramDeployNotification(version: string, details?: string): Promise<boolean> {
  const { botToken, chatIds } = await getTelegramSecurityCredentials();
  if (!botToken || chatIds.length === 0) return false;

  const defaultDetails = details ||
    `• Multi-Admin Telegram Security Bot with dynamic Chat ID access\n` +
    `• Product Category selector in approval modal\n` +
    `• Real-time 1.5s live approval sync & refresh queue\n` +
    `• Automated deploy alerts on version releases`;

  const message = `🚀 <b>NEW UPDATE PUSHED & LIVE (VERSION ${version})</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 <b>Build Release:</b> <code>${version}</code>
📅 <b>Timestamp:</b> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
🌐 <b>Environment:</b> Live Production

📋 <b>Release Highlights & Updates:</b>
${defaultDetails}

🛡️ <b>System Status:</b>
✅ Security Bot: Active (${chatIds.length} Super Admin / Sub-Super-Admin Broadcast)
✅ Storefront & Order Processing: Operational
✅ Database & Stock Management: Synced
━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>This broadcast was automatically delivered to all authorized Super Admins.</i>`;

  const results = await Promise.all(
    chatIds.map((cId) => sendRawTelegramMessage(botToken, cId, message))
  );
  return results.some((r) => r === true);
}

export async function notifyDeploymentIfNewVersion(currentVersion = "v8.1.1") {
  try {
    const { storage } = await import("../storage");
    const lastNotified = await storage.settings.get("last_notified_deploy_version");
    if (lastNotified !== currentVersion) {
      await storage.settings.set("last_notified_deploy_version", currentVersion);
      await sendTelegramDeployNotification(currentVersion);
      console.log(`[telegram] Sent deployment go-live notification for version ${currentVersion}`);
    }
  } catch (e) {
    console.warn("[telegram deploy notify error]", e);
  }
}

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
  const { botToken, chatIds } = await getTelegramSecurityCredentials();
  if (!botToken || chatIds.length === 0) return false;

  const text = `🔐 <b>SUPER ADMIN SECRET PASSAGE UNLOCK REQUEST</b>\n\nSession Token: <code>${token}</code>\nDevice Info: ${deviceInfo}\nTimestamp: ${new Date().toLocaleString()}\n\nReply <code>/approve ${token}</code> or tap button to grant instant Super Admin unlock!`;

  const results = await Promise.all(
    chatIds.map((cId) =>
      sendRawTelegramMessage(botToken, cId, text, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Authorize Super Admin Unlock", callback_data: `approve_${token}` },
              { text: "🚫 Reject Request", callback_data: `reject_${token}` },
            ],
          ],
        },
      })
    )
  );
  return results.some((r) => r === true);
}

/* ====================================================================
   6. SECURITY BOT WEBHOOK HANDLER (/api/telegram/security/webhook)
   ==================================================================== */

export async function processSecurityTelegramWebhook(update: any): Promise<{ handled: boolean; reply?: string }> {
  const { botToken, chatIds: expectedChatIds, chatId: primaryChatId } = await getTelegramSecurityCredentials();
  if (!botToken) return { handled: false, reply: "Security Bot token not configured" };

  // Handle Inline Keyboard Button Taps
  if (update?.callback_query) {
    const cb = update.callback_query;
    const cbChatId = String(cb.message?.chat?.id);
    if (expectedChatIds.includes(cbChatId)) {
      const data = String(cb.data || "");
      if (data.startsWith("approve_")) {
        const token = data.replace("approve_", "");
        approveTelegramUnlockToken(token);
        const reply = `✅ <b>SUPER ADMIN OVERRIDE SESSION APPROVED!</b>\nToken: <code>${token}</code>\nSuper Admin session authorized. Global platform lockdown remains ACTIVE for all other users.`;
        await sendRawTelegramMessage(botToken, cbChatId, reply);
        return { handled: true, reply };
      } else if (data.startsWith("reject_")) {
        const token = data.replace("reject_", "");
        const reply = `🚫 <b>SUPER ADMIN EMERGENCY UNLOCK REJECTED!</b>\nToken: <code>${token}</code>\nSession request was rejected by Super Admin.`;
        await sendRawTelegramMessage(botToken, cbChatId, reply);
        return { handled: true, reply };
      }
    }
  }

  const message = update?.message;
  if (!message || !message.text) return { handled: false };

  const senderChatId = String(message.chat?.id);
  const text = message.text.trim();

  // Strict Chat ID check: allow only authorized Super Admins & Sub-Super-Admins
  if (!expectedChatIds.includes(senderChatId)) {
    console.warn(`[telegram security] Unauthorized command attempt on Security Bot from chat ID: ${senderChatId}`);
    if (primaryChatId) {
      await sendRawTelegramMessage(
        botToken,
        primaryChatId,
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

  if (lowerText === "/approvals" || lowerText === "/pending") {
    const { db } = await import("../db");
    const { products, categories } = await import("@shared/schema");
    const { or, eq } = await import("drizzle-orm");
    const pRows = await db.select().from(products).where(or(eq(products.approvalStatus, "pending"), eq(products.approvalStatus, "under_review"), eq(products.approvalStatus, "pending_deletion")));
    const cRows = await db.select().from(categories).where(or(eq(categories.approvalStatus, "pending"), eq(categories.approvalStatus, "under_review"), eq(categories.approvalStatus, "pending_deletion")));

    let reply = `📋 <b>PENDING APPROVALS QUEUE</b>\n━━━━━━━━━━━━━━━━━━━━\n📦 Products: ${pRows.length}\n🏷️ Categories: ${cRows.length}\n\n`;
    if (pRows.length === 0 && cRows.length === 0) {
      reply += "✅ All clear! No items pending Super Admin approval.";
    } else {
      if (pRows.length > 0) {
        reply += "<b>Products:</b>\n" + pRows.slice(0, 5).map((p) => `• ${p.name} (${p.approvalStatus === "pending_deletion" ? "🗑️ Deletion" : `₹${p.price}`})`).join("\n") + (pRows.length > 5 ? `\n...and ${pRows.length - 5} more` : "") + "\n\n";
      }
      if (cRows.length > 0) {
        reply += "<b>Categories:</b>\n" + cRows.slice(0, 5).map((c) => `• ${c.name} (${c.approvalStatus === "pending_deletion" ? "🗑️ Deletion" : "New/Edit"})`).join("\n") + (cRows.length > 5 ? `\n...and ${cRows.length - 5} more` : "") + "\n\n";
      }
      reply += "👉 <i>Instructions: Please log into your Admin Dashboard and open Approvals to take action. (Direct links omitted for security)</i>";
    }
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

  if (lowerText.startsWith("/approve ")) {
    const token = text.replace("/approve", "").trim();
    if (approveTelegramUnlockToken(token)) {
      const reply = `✅ <b>SUPER ADMIN EMERGENCY UNLOCK APPROVED!</b>\nToken: <code>${token}</code>\nSuper Admin session authorized. Global platform lockdown remains ACTIVE for all other users.`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    } else {
      const reply = `⚠️ Invalid or expired token: <code>${token}</code>`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
  }

  if (lowerText === "/users" || lowerText === "/users count") {
    const { storage } = await import("../storage");
    const allUsers = await storage.users.list();
    const reply = `👥 <b>REGISTERED USERS</b>\nTotal: ${allUsers.length}\nAdmins: ${allUsers.filter((u) => u.role === "admin").length}\nCustomers: ${allUsers.filter((u) => u.role === "customer").length}`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText === "/help" || lowerText === "/start") {
    const help = `🛡️ <b>SUPER ADMIN SECURITY BOT COMMANDS</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 <code>/lock on [reason]</code> - Activate platform lockdown
🔓 <code>/lock off</code> - Deactivate platform lockdown
ℹ️ <code>/status</code> - Check lockdown & platform status
📋 <code>/approvals</code> - View pending product & category approvals
🚫 <code>/subadmin block &lt;email&gt;</code> - Block a user or sub-admin
✅ <code>/subadmin unblock &lt;email&gt;</code> - Unblock a user or sub-admin
🔑 <code>/approve &lt;token&gt;</code> - Approve emergency unlock token
👥 <code>/users</code> - View registered user count
❓ <code>/help</code> - Show this commands manual

<i>Note: All product & category approval requests from sub-admins are automatically sent to this bot!</i>`;
    await sendRawTelegramMessage(botToken, senderChatId, help);
    return { handled: true, reply: help };
  }

  return { handled: false };
}

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

  // Verify sender is in authorized chat IDs
  if (!chatIds.includes(senderChatId)) {
    console.warn(`[telegram grievance] Command from unauthorized chat ID: ${senderChatId}`);
    return { handled: false };
  }

  const lowerText = text.toLowerCase();

  // Strictly reject any security or lockdown commands in Grievance bot
  if (
    lowerText.startsWith("/lock") ||
    lowerText.startsWith("/approve") ||
    lowerText.startsWith("/subadmin") ||
    lowerText.startsWith("/block") ||
    lowerText.startsWith("/unblock")
  ) {
    const reply = `🚫 <b>SECURITY RESTRICTION</b>\nThis bot is for Customer Support & Grievances only. Security and administrative control commands are strictly restricted to the Super Admin Security Bot.`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText === "/tickets" || lowerText === "/open") {
    const { storage } = await import("../storage");
    const openTickets = await storage.supportTickets.listOpen();
    if (openTickets.length === 0) {
      const reply = `🎫 <b>CUSTOMER SUPPORT TICKETS</b>\n\n✅ No open tickets. All customer issues resolved!`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
    const ticketList = openTickets
      .slice(0, 10)
      .map((t) => `• #${t.id} [${t.category}] <b>${t.subject}</b> (${t.priority})\n  From: ${t.userEmail} | Status: ${t.status}`)
      .join("\n\n");
    const reply = `🎫 <b>OPEN CUSTOMER TICKETS (${openTickets.length})</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n${ticketList}\n\n<i>Reply /ticket &lt;id&gt; for details or /resolve &lt;id&gt; [note] to close.</i>`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText.startsWith("/ticket ")) {
    const id = parseInt(text.replace("/ticket", "").trim(), 10);
    if (isNaN(id)) {
      const reply = "⚠️ Usage: <code>/ticket 123</code>";
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
    const { storage } = await import("../storage");
    const ticket = await storage.supportTickets.get(id);
    if (!ticket) {
      const reply = `⚠️ Ticket #${id} not found.`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
    const reply = `🎫 <b>TICKET #${ticket.id} DETAILS</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Subject:</b> ${ticket.subject}
<b>Category:</b> ${ticket.category}
<b>Priority:</b> ${ticket.priority}
<b>Status:</b> ${ticket.status}
<b>Customer Email:</b> ${ticket.userEmail}
<b>Created:</b> ${new Date(ticket.createdAt).toLocaleString()}

<b>Description:</b>
${ticket.description}

${ticket.adminNotes ? `<b>Staff Notes:</b> ${ticket.adminNotes}` : ""}`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText.startsWith("/resolve ")) {
    const parts = text.replace("/resolve", "").trim().split(/\s+/);
    const id = parseInt(parts[0], 10);
    const note = parts.slice(1).join(" ") || "Resolved via Telegram Support Bot";
    if (isNaN(id)) {
      const reply = "⚠️ Usage: <code>/resolve 123 [resolution note]</code>";
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
    const { storage } = await import("../storage");
    const updated = await storage.supportTickets.update(id, {
      status: "resolved",
      adminNotes: note,
      resolvedAt: new Date(),
    });
    if (!updated) {
      const reply = `⚠️ Ticket #${id} not found.`;
      await sendRawTelegramMessage(botToken, senderChatId, reply);
      return { handled: true, reply };
    }
    const reply = `✅ <b>TICKET #${id} RESOLVED</b>\nSubject: ${updated.subject}\nCustomer: ${updated.userEmail}\nNote: ${note}`;
    await sendRawTelegramMessage(botToken, senderChatId, reply);
    return { handled: true, reply };
  }

  if (lowerText === "/help" || lowerText === "/start") {
    const help = `🎫 <b>FARM FRESH GRIEVANCE & SUPPORT BOT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 <code>/tickets</code> - View all open customer tickets
🔍 <code>/ticket &lt;id&gt;</code> - View specific ticket details
✅ <code>/resolve &lt;id&gt; [note]</code> - Mark ticket resolved
❓ <code>/help</code> - Show this commands manual

<i>Notifications for new customer support tickets and live chat escalations arrive in this bot automatically.</i>`;
    await sendRawTelegramMessage(botToken, senderChatId, help);
    return { handled: true, reply: help };
  }

  return { handled: false };
}
