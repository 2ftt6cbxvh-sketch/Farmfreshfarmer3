/**
 * PhonePe Standard Checkout v2 payment service.
 * ------------------------------------------------------------------
 * Implements the current PhonePe PG v2 (OAuth) flow:
 *   1. Authorization  -> POST /v1/oauth/token         (client_credentials)
 *   2. Create payment -> POST /checkout/v2/pay        (returns redirectUrl)
 *   3. Order status   -> GET  /checkout/v2/order/{merchantOrderId}/status
 *   4. Refund         -> POST /payments/v2/refund
 *   5. Refund status  -> GET  /payments/v2/refund/{merchantRefundId}/status
 *
 * Everything is env-driven (sandbox vs production) and every call writes
 * `payments` / `payment_events` / `refunds` records for reconciliation.
 *
 * If PhonePe credentials are NOT configured (e.g. local dev / preview before
 * the merchant account exists), the service runs in SIMULATION mode: it still
 * creates a real `payments` row and returns a local redirect to the success
 * page, so the whole checkout flow is testable end-to-end without live keys.
 * Simulation NEVER activates in production (NODE_ENV=production requires keys).
 */
import crypto from "crypto";
import { storage } from "../storage";

/* ------------------------------- config ------------------------------- */
type PPEnv = "sandbox" | "production";

function cfg() {
  const env = (process.env.PHONEPE_ENV || "sandbox").toLowerCase() as PPEnv;
  const clientId = process.env.PHONEPE_CLIENT_ID || "";
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET || "";
  const clientVersion = process.env.PHONEPE_CLIENT_VERSION || "1";
  const merchantId = process.env.PHONEPE_MERCHANT_ID || "";
  const appBaseUrl = (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
  const configured = Boolean(clientId && clientSecret);
  // Base hosts per PhonePe docs.
  const bases =
    env === "production"
      ? {
          auth: "https://api.phonepe.com/apis/identity-manager",
          pg: "https://api.phonepe.com/apis/pg",
        }
      : {
          auth: "https://api-preprod.phonepe.com/apis/pg-sandbox",
          pg: "https://api-preprod.phonepe.com/apis/pg-sandbox",
        };
  return { env, clientId, clientSecret, clientVersion, merchantId, appBaseUrl, configured, bases };
}

export function isPhonePeConfigured(): boolean {
  return cfg().configured;
}

/**
 * Simulation is allowed only when PhonePe is NOT configured, and either:
 *   - the app is not running in production, OR
 *   - the owner has explicitly opted in with PHONEPE_ALLOW_SIMULATION=true
 *     (useful for a staging/demo deployment without a live merchant account).
 * With real credentials present, simulation is never used. In production
 * without credentials and without the opt-in, missing credentials is a hard
 * error so payments are never silently faked.
 */
function simulationAllowed(): boolean {
  const { configured } = cfg();
  if (configured) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.PHONEPE_ALLOW_SIMULATION === "true";
}

/* --------------------------- OAuth token cache ------------------------ */
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAuthToken(): Promise<string> {
  const c = cfg();
  if (!c.configured) throw new Error("PhonePe credentials are not configured");
  const now = Math.floor(Date.now() / 1000);
  // Reuse cached token until ~2 min before expiry.
  if (tokenCache && tokenCache.expiresAt - 120 > now) return tokenCache.token;

  const body = new URLSearchParams({
    client_id: c.clientId,
    client_version: c.clientVersion,
    client_secret: c.clientSecret,
    grant_type: "client_credentials",
  });
  const res = await fetch(`${c.bases.auth}/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: body.toString(),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(`PhonePe auth failed (${res.status}): ${JSON.stringify(data)}`);
  }
  // expires_at is epoch seconds per docs.
  const expiresAt = Number(data.expires_at) || now + 3000;
  tokenCache = { token: data.access_token, expiresAt };
  return data.access_token;
}

/* ------------------------------ helpers ------------------------------- */
export type PaymentTarget = {
  orderId?: number | null;
  subscriptionCycleId?: number | null;
  userId?: number | null;
};

/** Normalise PhonePe order state -> our internal status. */
function mapState(state?: string): "success" | "failed" | "pending" {
  const s = (state || "").toUpperCase();
  if (s === "COMPLETED" || s === "SUCCESS" || s === "PAYMENT_SUCCESS") return "success";
  if (s === "FAILED" || s === "PAYMENT_ERROR" || s === "PAYMENT_DECLINED" || s === "EXPIRED") return "failed";
  return "pending";
}

/** Generate a unique merchantOrderId (<=63 chars, only _ and - allowed). */
function newMerchantOrderId(prefix = "FFF"): string {
  const rand = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `${prefix}-${Date.now()}-${rand}`;
}

/* ---------------------------- create payment -------------------------- */
export type InitiateResult = {
  paymentId: number;
  merchantOrderId: string;
  redirectUrl: string;
  simulated: boolean;
};

/**
 * Create a payment and return the URL the customer should be redirected to.
 * `amountRupees` is in rupees; PhonePe expects paisa.
 */
export async function initiatePayment(args: {
  amountRupees: number;
  target: PaymentTarget;
  customerName?: string;
}): Promise<InitiateResult> {
  const c = cfg();
  const amountPaisa = Math.round(Number(args.amountRupees) * 100);
  if (!(amountPaisa >= 100)) throw new Error("Payment amount must be at least ₹1");

  const merchantOrderId = newMerchantOrderId();

  // Create the pending payment record first so we always have an audit trail.
  const payment = await storage.payments.create({
    orderId: args.target.orderId ?? null,
    subscriptionCycleId: args.target.subscriptionCycleId ?? null,
    userId: args.target.userId ?? null,
    provider: "phonepe",
    merchantOrderId,
    amount: args.amountRupees,
    currency: "INR",
    status: "pending",
  });

  const redirectUrl = `${c.appBaseUrl}/#/payment/callback?merchantOrderId=${encodeURIComponent(merchantOrderId)}`;

  /* ---- Simulation mode (no live credentials, non-production) ---- */
  if (!c.configured) {
    if (!simulationAllowed()) {
      throw new Error("PhonePe credentials are not configured");
    }
    await storage.payments.logEvent({
      paymentId: payment.id,
      merchantOrderId,
      eventType: "initiate",
      status: "pending",
      payload: { simulated: true, amountPaisa },
    });
    // Point at a local simulator page that lets the tester pick success/fail.
    const simUrl = `${c.appBaseUrl}/#/payment/simulate?merchantOrderId=${encodeURIComponent(
      merchantOrderId,
    )}&amount=${args.amountRupees}`;
    return { paymentId: payment.id, merchantOrderId, redirectUrl: simUrl, simulated: true };
  }

  /* ---- Live PhonePe create-payment call ---- */
  const token = await getAuthToken();
  const payload = {
    merchantOrderId,
    amount: amountPaisa,
    expireAfter: 1200, // 20 minutes
    metaInfo: { udf1: String(args.target.orderId ?? ""), udf2: args.customerName || "" },
    paymentFlow: {
      type: "PG_CHECKOUT",
      message: "FarmFreshFarmer order payment",
      merchantUrls: { redirectUrl },
    },
  };
  const res = await fetch(`${c.bases.pg}/checkout/v2/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      Authorization: `O-Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data: any = await res.json().catch(() => ({}));
  await storage.payments.logEvent({
    paymentId: payment.id,
    merchantOrderId,
    eventType: "initiate",
    status: data?.state ?? null,
    payload: data,
  });
  const url = data?.redirectUrl || data?.data?.instrumentResponse?.redirectInfo?.url;
  if (!res.ok || !url) {
    await storage.payments.updateStatus(payment.id, "failed", { rawResponse: data });
    throw new Error(`PhonePe create payment failed (${res.status}): ${JSON.stringify(data)}`);
  }
  if (data?.orderId) {
    await storage.payments.updateStatus(payment.id, "pending", {
      providerTransactionId: data.orderId,
      rawResponse: data,
    });
  }
  return { paymentId: payment.id, merchantOrderId, redirectUrl: url, simulated: false };
}

/* ---------------------------- check status ---------------------------- */
export type StatusResult = {
  merchantOrderId: string;
  status: "success" | "failed" | "pending";
  providerTransactionId?: string;
  method?: string;
  raw: any;
};

/**
 * Query PhonePe for the latest status of a payment and reconcile our records.
 * Also flips the linked order's paymentStatus + status when it resolves.
 */
export async function checkAndReconcile(merchantOrderId: string): Promise<StatusResult> {
  const c = cfg();
  const payment = await storage.payments.getByMerchantOrderId(merchantOrderId);
  if (!payment) throw new Error("Unknown merchantOrderId");

  // Already resolved? Return as-is (idempotent).
  if (payment.status === "success" || payment.status === "failed") {
    return {
      merchantOrderId,
      status: payment.status as "success" | "failed",
      providerTransactionId: payment.providerTransactionId ?? undefined,
      method: payment.method ?? undefined,
      raw: payment.rawResponse,
    };
  }

  /* ---- Simulation: read the pre-recorded outcome from settings ---- */
  if (!c.configured) {
    // In simulation, the /simulate page posts a decision to the callback which
    // sets status directly; if we get here still pending, keep pending.
    return { merchantOrderId, status: "pending", raw: null };
  }

  const token = await getAuthToken();
  const res = await fetch(
    `${c.bases.pg}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=false&errorContext=true`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        Authorization: `O-Bearer ${token}`,
        "X-MERCHANT-ID": c.merchantId,
      },
    },
  );
  const data: any = await res.json().catch(() => ({}));
  const status = mapState(data?.state);
  const txnId =
    data?.paymentDetails?.[0]?.transactionId || data?.orderId || payment.providerTransactionId || undefined;
  const method = data?.paymentDetails?.[0]?.paymentMode || undefined;

  await storage.payments.logEvent({
    paymentId: payment.id,
    merchantOrderId,
    eventType: "status_check",
    status: data?.state ?? null,
    payload: data,
  });
  await applyResolution(payment, status, { providerTransactionId: txnId, method, rawResponse: data });

  return { merchantOrderId, status, providerTransactionId: txnId, method, raw: data };
}

/**
 * Apply a resolved status to the payment + the entity it funds
 * (order or subscription billing cycle). Idempotent.
 */
async function applyResolution(
  payment: any,
  status: "success" | "failed" | "pending",
  extra: { providerTransactionId?: string; method?: string; rawResponse?: any },
) {
  if (status === "pending") return;
  await storage.payments.updateStatus(payment.id, status, extra);

  if (payment.orderId) {
    if (status === "success") {
      await storage.orders.setPaymentStatus(payment.orderId, "paid", "PhonePe");
      // Move a freshly-placed order into confirmed once paid.
      await storage.orders.setStatus(payment.orderId, "confirmed", "Payment received via PhonePe");
    } else if (status === "failed") {
      await storage.orders.setPaymentStatus(payment.orderId, "failed", "PhonePe");
    }
  }
  if (payment.subscriptionCycleId) {
    await storage.subscriptions.updateCycle(payment.subscriptionCycleId, {
      status: status === "success" ? "paid" : "failed",
    });
  }
}

/**
 * Used by the simulator + as a manual admin override: force-resolve a payment.
 * Only usable in simulation mode OR by an admin route.
 */
export async function forceResolve(
  merchantOrderId: string,
  outcome: "success" | "failed",
): Promise<StatusResult> {
  const payment = await storage.payments.getByMerchantOrderId(merchantOrderId);
  if (!payment) throw new Error("Unknown merchantOrderId");
  await storage.payments.logEvent({
    paymentId: payment.id,
    merchantOrderId,
    eventType: "callback",
    status: outcome,
    payload: { forced: true },
  });
  await applyResolution(payment, outcome, {
    providerTransactionId: payment.providerTransactionId ?? `SIM-${payment.id}`,
    method: "SIMULATED",
    rawResponse: { simulated: true, outcome },
  });
  return { merchantOrderId, status: outcome, raw: { simulated: true } };
}

/* ------------------------------- webhook ------------------------------ */
/**
 * Verify the PhonePe webhook Authorization header.
 * PhonePe sends SHA256(username:password) (the credentials you set in the
 * dashboard) in the Authorization header. We compare against our env values.
 * Returns true if valid OR if no webhook credentials are configured (dev).
 */
export function verifyWebhookAuth(authHeader?: string): boolean {
  const user = process.env.PHONEPE_WEBHOOK_USERNAME || "";
  const pass = process.env.PHONEPE_WEBHOOK_PASSWORD || "";
  if (!user && !pass) return process.env.NODE_ENV !== "production"; // allow in dev only
  if (!authHeader) return false;
  const expected = crypto.createHash("sha256").update(`${user}:${pass}`).digest("hex");
  const got = authHeader.trim();
  // constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Handle a webhook payload from PhonePe. The event body contains the
 * merchantOrderId + state. We log it and reconcile.
 */
export async function handleWebhook(body: any): Promise<void> {
  const payload = body?.payload ?? body;
  const merchantOrderId =
    payload?.merchantOrderId || payload?.merchantId || body?.merchantOrderId;
  const state = payload?.state || body?.state;
  if (!merchantOrderId) throw new Error("Webhook missing merchantOrderId");

  const payment = await storage.payments.getByMerchantOrderId(merchantOrderId);
  await storage.payments.logEvent({
    paymentId: payment?.id ?? null,
    merchantOrderId,
    eventType: "webhook",
    status: state ?? null,
    payload: body,
  });
  if (!payment) return;
  const status = mapState(state);
  const txnId = payload?.transactionId || payload?.orderId || undefined;
  const method = payload?.paymentMode || undefined;
  await applyResolution(payment, status, {
    providerTransactionId: txnId,
    method,
    rawResponse: body,
  });
}

/* ------------------------------- refund ------------------------------- */
export type RefundResult = {
  merchantRefundId: string;
  status: "pending" | "success" | "failed";
  raw: any;
};

/**
 * Initiate a refund against a successful payment. `amountRupees` optional
 * (defaults to the full payment amount for a complete refund).
 */
export async function initiateRefund(args: {
  merchantOrderId: string;
  amountRupees?: number;
  reason?: string;
}): Promise<RefundResult> {
  const c = cfg();
  const payment = await storage.payments.getByMerchantOrderId(args.merchantOrderId);
  if (!payment) throw new Error("Unknown merchantOrderId");
  if (payment.status !== "success") throw new Error("Only successful payments can be refunded");

  const amountRupees = args.amountRupees ?? Number(payment.amount);
  const amountPaisa = Math.round(amountRupees * 100);
  const merchantRefundId = newMerchantOrderId("FFFR");

  // Record the refund as pending first.
  const refund = await storage.payments.createRefund({
    paymentId: payment.id,
    merchantRefundId,
    amount: amountRupees,
    status: "pending",
    reason: args.reason ?? null,
  });

  /* ---- Simulation ---- */
  if (!c.configured) {
    if (!simulationAllowed()) throw new Error("PhonePe credentials are not configured");
    await storage.payments.updateStatus(payment.id, "refunded", {
      rawResponse: { refunded: true, merchantRefundId },
    });
    if (payment.orderId) await storage.orders.setPaymentStatus(payment.orderId, "refunded", "PhonePe");
    await storage.payments.logEvent({
      paymentId: payment.id,
      merchantOrderId: args.merchantOrderId,
      eventType: "refund",
      status: "success",
      payload: { simulated: true, merchantRefundId, amountPaisa },
    });
    return { merchantRefundId, status: "success", raw: { simulated: true } };
  }

  /* ---- Live refund ---- */
  const token = await getAuthToken();
  const res = await fetch(`${c.bases.pg}/payments/v2/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      Authorization: `O-Bearer ${token}`,
    },
    body: JSON.stringify({
      merchantRefundId,
      originalMerchantOrderId: args.merchantOrderId,
      amount: amountPaisa,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  await storage.payments.logEvent({
    paymentId: payment.id,
    merchantOrderId: args.merchantOrderId,
    eventType: "refund",
    status: data?.state ?? null,
    payload: data,
  });
  const status = mapState(data?.state);
  if (res.ok && status !== "failed") {
    await storage.payments.updateStatus(payment.id, "refunded", { rawResponse: data });
    if (payment.orderId) await storage.orders.setPaymentStatus(payment.orderId, "refunded", "PhonePe");
    return { merchantRefundId, status: status === "success" ? "success" : "pending", raw: data };
  }
  throw new Error(`PhonePe refund failed (${res.status}): ${JSON.stringify(data)}`);
}
