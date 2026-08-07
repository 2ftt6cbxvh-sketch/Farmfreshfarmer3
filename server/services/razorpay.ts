/**
 * Razorpay payment integration for FarmFreshFarmer.
 * Primary payment gateway for Indian customers.
 */
import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";
const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function razorpayAuthHeader(): string {
  return "Basic " + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
}

export function isRazorpayConfigured(): boolean {
  return !!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

export async function createRazorpayOrder(amountINR: number, receipt: string): Promise<any> {
  const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: { Authorization: razorpayAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(amountINR * 100), currency: "INR", receipt, payment_capture: 1 }),
  });
  if (!res.ok) {
    const err = await res.json() as any;
    throw new Error(`Razorpay order creation failed: ${err.error?.description || JSON.stringify(err)}`);
  }
  return res.json();
}

export function verifyRazorpaySignature(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string): boolean {
  const message = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSig = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(message).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(razorpaySignature)); } catch { return false; }
}

export function verifyRazorpayWebhookSignature(rawBody: string, webhookSignature: string): boolean {
  if (!RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(webhookSignature)); } catch { return false; }
}

export async function initiateRazorpayRefund(paymentId: string, amountINR?: number): Promise<any> {
  const body: any = {};
  if (amountINR) body.amount = Math.round(amountINR * 100);
  const res = await fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}/refund`, {
    method: "POST",
    headers: { Authorization: razorpayAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json() as any;
    throw new Error(`Razorpay refund failed: ${err.error?.description || JSON.stringify(err)}`);
  }
  return res.json();
}
