# FarmFreshFarmer — PhonePe Payment Integration Guide

FarmFreshFarmer uses the **PhonePe Payment Gateway v2 (OAuth / Standard
Checkout)**. The integration is fully backend-driven: the browser never holds
PhonePe secrets, payment status is always verified server-side, and every event
is recorded in the database for reconciliation.

---

## 1. How the flow works

```
Customer clicks "Pay with PhonePe" at checkout
   │
   ▼
POST /api/orders            → creates the order (paymentMethod = PHONEPE, status pending)
   │
   ▼
POST /api/payments/initiate → backend gets an OAuth token, creates a PhonePe
   │                           payment, stores a `payments` row, returns a
   │                           redirectUrl
   ▼
Browser is redirected to PhonePe → customer pays
   │
   ▼
PhonePe redirects back to APP_BASE_URL/#/payment/callback
   │
   ▼
GET /api/payments/status/:merchantOrderId → backend calls PhonePe "Order Status"
                                            to CONFIRM the result (never trust
                                            the redirect alone), updates the
                                            order + payment, shows success/failure
   ▲
   │  (in parallel, asynchronously)
POST /api/payments/webhook  → PhonePe server-to-server callback; verified via the
                              Authorization header, then reconciles the payment
```

**Key safety properties**

- The **amount is re-computed on the server** from the cart before charging —
  the client cannot tamper with the price.
- Payment success is confirmed by an **explicit server-to-server status call**,
  not by the redirect query string.
- The **webhook** provides a second, independent confirmation and handles cases
  where the customer closes the browser before the redirect completes.
- Every step writes `payments`, `payment_events`, and (on refund) `refunds`
  rows.

---

## 2. Endpoints used (PhonePe v2)

| Step             | PhonePe endpoint                                        |
| ---------------- | ------------------------------------------------------- |
| Authorization    | `POST /v1/oauth/token` (client_credentials)             |
| Create payment   | `POST /checkout/v2/pay`                                 |
| Order status     | `GET /checkout/v2/order/{merchantOrderId}/status`       |
| Refund           | `POST /payments/v2/refund`                              |
| Refund status    | `GET /payments/v2/refund/{merchantRefundId}/status`     |

Base URLs (auto-selected by `PHONEPE_ENV`):

- **sandbox:** `https://api-preprod.phonepe.com/apis/pg-sandbox`
- **production:** the live PG host from your PhonePe onboarding.

---

## 3. Get your credentials

From the **PhonePe Business dashboard → Developer Settings** you receive
**separate** credentials for sandbox (UAT) and production:

- `PHONEPE_CLIENT_ID`
- `PHONEPE_CLIENT_SECRET`
- `PHONEPE_CLIENT_VERSION` (usually `1`)
- `PHONEPE_MERCHANT_ID` (shown under your business name)

Set them as environment variables (locally in `.env`, in production as EB
environment properties):

```
PHONEPE_ENV=sandbox
PHONEPE_CLIENT_ID=...
PHONEPE_CLIENT_SECRET=...
PHONEPE_CLIENT_VERSION=1
PHONEPE_MERCHANT_ID=...
APP_BASE_URL=https://your-domain.com
```

When you go live, switch `PHONEPE_ENV=production` and swap in the production
credentials.

---

## 4. Configure the webhook

In the PhonePe dashboard → **Developer Settings → Webhooks**, set the callback
URL to:

```
https://your-domain.com/api/payments/webhook
```

PhonePe lets you set a **username/password** for the webhook; it sends
`SHA256(username:password)` in the `Authorization` header. Set the same values
in the app so it can verify incoming webhooks:

```
PHONEPE_WEBHOOK_USERNAME=...
PHONEPE_WEBHOOK_PASSWORD=...
```

Unverified webhook calls are rejected.

---

## 5. Refunds

Admins issue refunds from **Admin → Payments → Refund**, which calls
`POST /api/admin/payments/:merchantOrderId/refund`. The backend calls PhonePe's
refund API, records a `refunds` row, and updates the payment/order status to
`refunded`. COD orders are marked refunded without a gateway call.

---

## 6. Testing WITHOUT live credentials (simulation mode)

If PhonePe credentials are **not** set, the app can run a built-in **payment
simulator** so you can demo the entire checkout flow (order → pay → success/
failure → order marked paid):

- In **development** (`NODE_ENV != production`) simulation is automatic.
- On a **staging / production-mode** server **without** a merchant account, set
  `PHONEPE_ALLOW_SIMULATION=true` to opt in.
- With real credentials present, or in production without the opt-in flag,
  simulation is **never** used — missing keys fail loudly so you never
  accidentally ship a fake gateway.

In simulation, `initiate` returns a redirect to `/#/payment/simulate`, where a
"Simulate success / failure" page drives the same status-verification code path
as the real gateway.

---

## 7. Production go-live checklist

- [ ] Production PhonePe credentials set as EB environment properties.
- [ ] `PHONEPE_ENV=production`.
- [ ] `PHONEPE_ALLOW_SIMULATION` unset (or `false`).
- [ ] `APP_BASE_URL` = your real HTTPS domain.
- [ ] Webhook URL registered in the PhonePe dashboard, with username/password
      matching `PHONEPE_WEBHOOK_USERNAME` / `PHONEPE_WEBHOOK_PASSWORD`.
- [ ] HTTPS enabled on the site (PhonePe requires https redirect/webhook URLs).
- [ ] A real end-to-end test transaction completed and refunded.
