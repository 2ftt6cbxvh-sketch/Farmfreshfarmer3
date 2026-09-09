/**
 * Meta WhatsApp Cloud API Service
 * Official integration using Meta Graph API (v19.0)
 *
 * Provides:
 * - 1,000 Free User-Initiated Service Conversations per month (Zero Meta fee, Zero SMS gateway cost)
 * - Inbound Webhook verification & token processing
 * - Outbound automated confirmation & transaction receipts
 */
import { storage } from "../storage";

export interface WhatsAppConfig {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  verifyToken: string;
  businessPhone: string;
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const dbPhoneId = await storage.settings.get("whatsapp_phone_number_id");
  const dbWabaId = await storage.settings.get("whatsapp_business_account_id");
  const dbToken = await storage.settings.get("whatsapp_access_token");
  const dbVerify = await storage.settings.get("whatsapp_webhook_verify_token");
  const dbBizPhone = await storage.settings.get("whatsapp_business_phone");

  return {
    phoneNumberId: dbPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    wabaId: dbWabaId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    accessToken: dbToken || process.env.WHATSAPP_ACCESS_TOKEN || "",
    verifyToken: dbVerify || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "farmfresh_wa_verify_2026",
    businessPhone: dbBizPhone || process.env.WHATSAPP_BUSINESS_PHONE || "917989793669",
  };
}

/**
 * Send an outbound text message via Meta WhatsApp Cloud API
 */
export async function sendWhatsAppTextMessage({
  to,
  text,
  previewUrl = false,
}: {
  to: string;
  text: string;
  previewUrl?: boolean;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const config = await getWhatsAppConfig();
    if (!config.phoneNumberId || !config.accessToken) {
      console.warn("[WhatsApp Cloud API] Missing phoneNumberId or accessToken in settings.");
      return { success: false, error: "Meta WhatsApp credentials not configured in Admin Settings." };
    }

    // Clean recipient phone (E.164 format without + sign, e.g. 919876543210)
    let cleanTo = to.replace(/\D/g, "");
    if (cleanTo.length === 10) {
      cleanTo = `91${cleanTo}`;
    }

    const url = `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: {
          preview_url: previewUrl,
          body: text,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error?.message || `WhatsApp API error ${res.status}`;
      console.error("[WhatsApp Cloud API Send Error]:", errMsg);
      return { success: false, error: errMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err: any) {
    console.error("[WhatsApp Cloud API Exception]:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Automatically send a celebratory verification confirmation to customer on WhatsApp
 */
export async function sendWhatsAppVerificationConfirmation(phone: string, customerName?: string) {
  const name = customerName ? ` ${customerName}` : "";
  const text = 
`🎉 *Welcome to FarmFreshFarmer${name}!*

Your mobile phone number has been verified successfully via our official WhatsApp Gateway.

✅ *Status*: Blue Verification Badge Activated
🚚 *Privilege*: Farm-fresh instant harvest delivery unlocked
🌾 *Support*: Reply here anytime for direct concierge assistance

_FarmFreshFarmer — Pure Harvest, Direct From AP & Telangana Partner Farms._`;

  return sendWhatsAppTextMessage({ to: phone, text });
}
