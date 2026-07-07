import { Layout } from "@/components/Layout";

const BUSINESS = "FarmFreshFarmer";
const EMAIL = "admin@farmfreshfarmer.com";
const PHONE = "+91 79897 93663";
const CITY = "Visakhapatnam, Andhra Pradesh, India";
const LAST_UPDATED = "07 July 2026";

/** Shared page shell so all four policies look consistent. */
function PolicyShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-xl font-bold text-foreground" data-testid={`heading-${title}`}>
          {title}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        <div className="prose-policy mt-6 space-y-5 text-sm leading-relaxed text-foreground/90">
          {children}
        </div>
        <div className="mt-10 rounded-lg border border-card-border bg-card p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Contact us</p>
          <p className="mt-1">{BUSINESS} · {CITY}</p>
          <p>Email: {EMAIL} · Phone: {PHONE}</p>
        </div>
      </div>
    </Layout>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-semibold text-base text-foreground pt-2">{children}</h2>;
}

/* ------------------------------------------------------------------ */
/* 1. Terms & Conditions                                              */
/* ------------------------------------------------------------------ */
export function TermsPage() {
  return (
    <PolicyShell title="Terms & Conditions">
      <p>
        Welcome to {BUSINESS}. By accessing or placing an order on our website, you agree to be
        bound by these Terms & Conditions. Please read them carefully. If you do not agree, please
        do not use our service.
      </p>

      <H2>1. About us</H2>
      <p>
        {BUSINESS} is a farm-fresh instant-delivery business operating in {CITY}. We sell fresh
        fruits, vegetables, homemade sweets, namkeen, spices and related items for same-day delivery
        within our service area.
      </p>

      <H2>2. Eligibility & accounts</H2>
      <p>
        You must be at least 18 years old to place an order. You are responsible for keeping your
        account details and password secure and for all activity under your account. Please provide
        accurate delivery and contact information — incorrect details may cause failed deliveries.
      </p>

      <H2>3. Products & pricing</H2>
      <p>
        As our products are fresh and seasonal, availability, weight and appearance may vary. All
        prices are listed in Indian Rupees (INR) and include applicable taxes unless stated
        otherwise. We reserve the right to change prices and product listings at any time. In case
        of an obvious pricing error, we may cancel the affected order and refund any amount paid.
      </p>

      <H2>4. Orders</H2>
      <p>
        Placing an order is an offer to buy. An order is confirmed once payment is completed (for
        prepaid orders) or accepted (for cash on delivery, where offered). We may refuse or cancel
        an order due to stock unavailability, delivery-area limits, suspected fraud, or errors in
        product or pricing information.
      </p>

      <H2>5. Payments</H2>
      <p>
        Online payments are processed securely through our payment gateway partner, PhonePe. We do
        not store your card, UPI or banking credentials on our servers. Payment success is confirmed
        by a server-to-server verification with the payment gateway.
      </p>

      <H2>6. Delivery</H2>
      <p>
        We deliver only within our current service area in and around Visakhapatnam. Delivery
        timelines are estimates and may be affected by weather, traffic or operational factors. See
        our Shipping & Delivery Policy for details.
      </p>

      <H2>7. Cancellations, returns & refunds</H2>
      <p>
        Because we sell perishable fresh produce, our cancellation and refund rules are specific.
        Please read our Refund, Return & Cancellation Policy, which forms part of these Terms.
      </p>

      <H2>8. Acceptable use</H2>
      <p>
        You agree not to misuse the website, attempt unauthorised access, interfere with its
        operation, or use it for any unlawful purpose. Referral, coupon and subscription features
        must not be abused; we may reverse rewards or suspend accounts involved in abuse.
      </p>

      <H2>9. Limitation of liability</H2>
      <p>
        To the extent permitted by law, {BUSINESS} is not liable for indirect or consequential
        losses. Our total liability for any order is limited to the amount you paid for that order.
      </p>

      <H2>10. Changes & governing law</H2>
      <p>
        We may update these Terms from time to time; the latest version is always posted here.
        These Terms are governed by the laws of India, and disputes are subject to the jurisdiction
        of the courts in Visakhapatnam, Andhra Pradesh.
      </p>
    </PolicyShell>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Privacy Policy                                                  */
/* ------------------------------------------------------------------ */
export function PrivacyPage() {
  return (
    <PolicyShell title="Privacy Policy">
      <p>
        This Privacy Policy explains how {BUSINESS} collects, uses and protects your personal
        information when you use our website and services.
      </p>

      <H2>1. Information we collect</H2>
      <p>
        We collect information you provide directly — such as your name, phone number, email
        address, delivery address, and order details. When you pay online, payment is handled by our
        gateway partner (PhonePe); we receive a transaction reference and status, but we do not
        collect or store your full card, UPI or banking credentials.
      </p>

      <H2>2. How we use your information</H2>
      <p>
        We use your information to process and deliver orders, confirm and verify payments, manage
        subscriptions and referrals, provide customer support, prevent fraud, and comply with legal
        obligations. With your consent, we may send you order updates and offers.
      </p>

      <H2>3. Sharing of information</H2>
      <p>
        We share information only as needed to run our service — for example, with our payment
        gateway to process payments and with delivery personnel to fulfil your order. We do not sell
        your personal data. We may disclose information if required by law.
      </p>

      <H2>4. Cookies & sessions</H2>
      <p>
        We use secure session cookies to keep you logged in and to operate the cart and checkout.
        These are necessary for the website to function.
      </p>

      <H2>5. Data security</H2>
      <p>
        We use reasonable technical and organisational measures to protect your data, including
        encrypted (HTTPS) connections and server-side payment verification. No method of transmission
        over the internet is completely secure, but we work to safeguard your information.
      </p>

      <H2>6. Data retention</H2>
      <p>
        We retain order and transaction records for as long as necessary to provide the service and
        to meet accounting, tax and legal requirements.
      </p>

      <H2>7. Your rights</H2>
      <p>
        You may request access to, correction of, or deletion of your personal information by
        contacting us at {EMAIL}. Some data may be retained where required for legal or accounting
        reasons.
      </p>

      <H2>8. Updates</H2>
      <p>
        We may update this Privacy Policy from time to time. The latest version will always be
        available on this page.
      </p>
    </PolicyShell>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Refund, Return & Cancellation Policy                            */
/* ------------------------------------------------------------------ */
export function RefundPage() {
  return (
    <PolicyShell title="Refund, Return & Cancellation Policy">
      <p>
        {BUSINESS} sells fresh, perishable produce (fruits, vegetables and homemade items). Because
        of the nature of these products, our refund and return rules are strict. Please read this
        policy carefully before ordering.
      </p>

      <H2>1. No refund after delivery</H2>
      <p>
        <strong>
          Once a fresh-produce order has been delivered, it cannot be refunded, returned or
          exchanged
        </strong>{" "}
        — except in the two situations described below (Section 2). This is because fruits,
        vegetables and homemade foods are perishable and cannot be restocked or resold once handed
        over.
      </p>

      <H2>2. When we WILL replace or refund</H2>
      <p>We will arrange a replacement or refund only if, at the time of delivery, the product is:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>Completely damaged / spoiled</strong> — clearly rotten, crushed or unusable on
          arrival; or
        </li>
        <li>
          <strong>The wrong product</strong> — you received an item different from what you ordered.
        </li>
      </ul>
      <p>
        To claim, you must report the issue <strong>within 4 hours of delivery</strong> with clear
        photos of the product and your order number, sent to {EMAIL} or {PHONE}. Claims without
        photographic proof, or reported after this window, cannot be accepted.
      </p>

      <H2>3. Cancellations before dispatch</H2>
      <p>
        You may cancel an order <strong>before it is dispatched / out for delivery</strong>. If you
        paid online, the amount will be refunded to your original payment method. Once an order is
        out for delivery, it can no longer be cancelled.
      </p>

      <H2>4. Subscriptions</H2>
      <p>
        For subscription deliveries, you can skip or cancel an upcoming cycle before it is generated
        or dispatched. Cycles already delivered follow the no-refund rule above, subject to the
        damaged/wrong-product exception.
      </p>

      <H2>5. How refunds are processed</H2>
      <p>
        Approved refunds are issued to your <strong>original payment method</strong> (PhonePe / UPI /
        card / bank) through our payment gateway. Refunds are typically initiated within 2 business
        days of approval and may take an additional 5–7 business days to reflect, depending on your
        bank. Cash-on-delivery orders, where approved for refund, are settled via UPI/bank transfer.
      </p>

      <H2>6. Non-refundable situations</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Change of mind after delivery.</li>
        <li>Failure to be available to receive a delivered order.</li>
        <li>Minor natural variation in size, colour, ripeness or weight of fresh produce.</li>
        <li>Claims reported after the 4-hour window or without photo proof.</li>
      </ul>

      <p className="pt-2">
        We want you to be happy with every order. If something is genuinely wrong, contact us
        quickly and we will make it right.
      </p>
    </PolicyShell>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Shipping & Delivery Policy                                      */
/* ------------------------------------------------------------------ */
export function ShippingPage() {
  return (
    <PolicyShell title="Shipping & Delivery Policy">
      <p>
        {BUSINESS} is an instant-delivery business. This policy explains where, when and how we
        deliver.
      </p>

      <H2>1. Service area</H2>
      <p>
        We currently deliver within {CITY} and nearby serviceable areas. If your address falls
        outside our delivery zone, we will notify you and refund any prepaid amount.
      </p>

      <H2>2. Delivery timelines</H2>
      <p>
        We aim for <strong>same-day delivery</strong> within Visakhapatnam for orders placed during
        working hours. Subscription orders are delivered on their scheduled days (for example,
        Saturday and/or Sunday). All timelines are estimates and may be affected by weather, traffic,
        stock or operational factors.
      </p>

      <H2>3. Delivery charges</H2>
      <p>
        Any applicable delivery charge is shown at checkout before you pay. Charges may vary based on
        order value and distance. Free-delivery thresholds, if any, are displayed at checkout.
      </p>

      <H2>4. Order tracking & confirmation</H2>
      <p>
        You will receive confirmation of your order and can view its status under “My Orders”. Our
        team may contact you by phone for delivery coordination.
      </p>

      <H2>5. Receiving your order</H2>
      <p>
        Please ensure someone is available at the delivery address to receive fresh produce.
        <strong> We recommend checking your items at the time of delivery</strong>, since damaged or
        wrong items must be reported within 4 hours (see our Refund, Return & Cancellation Policy).
        If a delivery fails because no one is available or the address is incorrect, re-delivery may
        incur an additional charge, and perishable items may not be re-delivered.
      </p>

      <H2>6. Delays</H2>
      <p>
        In rare cases of unavoidable delay (weather, road conditions, high demand), we will keep you
        informed. Fresh produce is dispatched as quickly as possible to preserve quality.
      </p>
    </PolicyShell>
  );
}
