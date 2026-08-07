/**
 * Stripe payment integration for FarmFreshFarmer.
 * Fallback gateway for international/non-UPI customers.
 */
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-05-28.basil" });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!stripeSecretKey;
}

export async function createPaymentIntent(amountINR: number, metadata: Record<string, string> = {}): Promise<Stripe.PaymentIntent> {
  return getStripe().paymentIntents.create({
    amount: Math.round(amountINR * 100),
    currency: "inr",
    automatic_payment_methods: { enabled: true },
    metadata,
  });
}

export async function retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return getStripe().paymentIntents.retrieve(paymentIntentId);
}

export async function createStripeRefund(paymentIntentId: string, amountINR?: number): Promise<Stripe.Refund> {
  const params: Stripe.RefundCreateParams = { payment_intent: paymentIntentId };
  if (amountINR) params.amount = Math.round(amountINR * 100);
  return getStripe().refunds.create(params);
}

export function verifyStripeWebhook(rawBody: Buffer | string, signature: string): Stripe.Event {
  if (!STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  return getStripe().webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
}
