import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";

const LAST_UPDATED = "10 August 2026";

const LEGAL_NAV_ITEMS = [
  { href: "/terms", label: "📜 Terms & Conditions" },
  { href: "/privacy", label: "🔒 Privacy Policy" },
  { href: "/refund-policy", label: "💸 Refund & Cancellation" },
  { href: "/return-policy", label: "📦 Return Policy" },
  { href: "/shipping-policy", label: "🚚 Shipping & Delivery" },
  { href: "/grievance", label: "⚖️ Grievance Redressal" },
];

function LegalSubNav() {
  const [location] = useLocation();
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-6 border-b border-card-border/80 no-scrollbar">
      {LEGAL_NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href}>
          <a
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              location === item.href
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </a>
        </Link>
      ))}
    </div>
  );
}

interface PublicSettings {
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  operating_hours?: string;
  store_name?: string;
  store_city?: string;
  store_state?: string;
  governing_court_city?: string;
  grievance_officer_name?: string;
  grievance_officer_email?: string;
  grievance_officer_phone?: string;
  grievance_officer_designation?: string;
  grievance_officer_address?: string;
  complaint_ack_hours?: string;
  complaint_resolve_days?: string;
  return_window_hours?: string;
  shipping_policy_custom_notes?: string;
}

/** Shared page shell so all policies look consistent. */
function PolicyShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { data: publicSettings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      return res.json();
    },
  });

  const business = publicSettings?.store_name || "FarmFreshFarmer";
  const phone = publicSettings?.contact_phone || "+91 79897 93669";
  const email = publicSettings?.contact_email || "admin@farmfreshfarmer.com";
  const city = publicSettings?.store_city || "Visakhapatnam";
  const state = publicSettings?.store_state || "Andhra Pradesh";
  const address = publicSettings?.contact_address || `${city}, ${state}`;
  const hours = publicSettings?.operating_hours || "6:00 AM – 10:00 PM IST";

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <LegalSubNav />
        <h1 className="font-serif text-xl font-bold text-foreground" data-testid={`heading-${title}`}>
          {title}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        <div className="prose-policy mt-6 space-y-5 text-sm leading-relaxed text-foreground/90">
          {children}
        </div>
        <div className="mt-10 rounded-xl border border-emerald-500/30 bg-card p-5 text-sm text-muted-foreground shadow-md">
          <p className="font-bold text-foreground text-base">📞 Contact Us & Support</p>
          <p className="mt-2 text-foreground/90">📍 {business} · {address}</p>
          <p className="mt-1">📱 Phone / WhatsApp: <span className="font-semibold text-emerald-400">{phone}</span></p>
          <p className="mt-1">✉️ Email: <span className="font-semibold text-emerald-400">{email}</span></p>
          <p className="mt-1">⏱️ Support Operating Hours: <span className="font-semibold text-foreground">{hours}</span></p>
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
  const { data: publicSettings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      return res.json();
    },
  });

  const business = publicSettings?.store_name || "FarmFreshFarmer";
  const city = publicSettings?.store_city || "Visakhapatnam";
  const state = publicSettings?.store_state || "Andhra Pradesh";
  const governingCourtCity = publicSettings?.governing_court_city || city;

  return (
    <PolicyShell title="Terms & Conditions">
      <p>
        Welcome to {business}. By accessing or placing an order on our website, you agree to be bound by these Terms & Conditions. Please read them carefully. If you do not agree, please do not use our service.
      </p>

      <H2>1. About Us</H2>
      <p>
        {business} is a farm-fresh instant-delivery platform in {city}, {state}. We sell fresh fruits, vegetables, homemade sweets, namkeen, spices, and related items.
      </p>

      <H2>2. Eligibility & Accounts</H2>
      <p>
        18+ required. Keep credentials secure. Provide accurate delivery info.
      </p>

      <H2>3. Perishable Goods & Natural Variance</H2>
      <p>
        Farm produce is perishable by nature. Minor variations in size, colour, weight, shape, or ripeness are INHERENT characteristics of fresh produce and are NOT grounds for return or refund. Products are sold as-is.
      </p>

      <H2>4. Product Availability & Substitution Policy</H2>
      <p>
        We reserve the right to substitute out-of-stock items with similar-value equivalents or issue a full refund. Customers will be notified before substitution. No extra charge applies.
      </p>

      <H2>5. Pricing, GST & Market Rate Fluctuations</H2>
      <p>
        Prices in INR including applicable GST. Fresh produce prices may vary with seasonal market conditions. Subscription customers will receive 7 days advance notice for price changes. The price shown at order confirmation is final.
      </p>

      <H2>6. Orders & Cancellation Cutoff</H2>
      <p>
        Placing an order is an offer to buy. Confirmed on payment or COD acceptance. Orders cannot be cancelled once packed or dispatched. Subscription delivery cycles must be cancelled by 8:00 PM the night before the scheduled delivery date.
      </p>

      <H2>7. Delivery Timelines & Force Majeure</H2>
      <p>
        ETAs are estimates. {business} shall not be held liable for delivery delays caused by weather events, traffic disruptions, crop supply shortages, natural calamities, government restrictions, or power outages.
      </p>

      <H2>8. Subscription Services & RBI Mandate Compliance</H2>
      <p>
        Subscriptions auto-renew. Pre-debit notification sent 1 day before each billing cycle via SMS and email. Customers may pause, skip, or cancel at any time before the cutoff. Billing occurs on delivery day. We comply with RBI recurring mandate guidelines.
      </p>

      <H2>9. Payments</H2>
      <p>
        Online payments processed securely via PhonePe. COD available where offered. We do not store card, UPI, or banking credentials.
      </p>

      <H2>10. Acceptable Use</H2>
      <p>
        No misuse. No abuse of referral codes, coupons, or subscription features.
      </p>

      <H2>11. Product Listings & Quality Assurance</H2>
      <p>
        All product listings are verified and approved by our Chief Administrator before going live. Product details, images, and weights are subject to seasonal updates.
      </p>

      <H2>12. Limitation of Liability</H2>
      <p>
        Maximum liability limited to the amount paid for the specific order.
      </p>

      <H2>13. Governing Law & Grievance Redressal</H2>
      <p>
        Governed by Indian law. Disputes subject to courts in {governingCourtCity}, {state}. For grievances see our Grievance Redressal page.
      </p>

      <H2>14. Changes to Terms</H2>
      <p>
        We may update these terms from time to time. The latest version is always on this page.
      </p>
    </PolicyShell>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Privacy Policy                                                  */
/* ------------------------------------------------------------------ */
export function PrivacyPage() {
  const { data: publicSettings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      return res.json();
    },
  });

  const business = publicSettings?.store_name || "FarmFreshFarmer";
  const email = publicSettings?.contact_email || "admin@farmfreshfarmer.com";
  const complaintResolveDays = publicSettings?.complaint_resolve_days || "30";

  return (
    <PolicyShell title="Privacy Policy">
      <H2>1. Information We Collect</H2>
      <p>
        We collect name, phone, email, address, order details, and payment transaction references (not card details).
      </p>

      <H2>2. How We Use Information</H2>
      <p>
        We process orders, manage subscriptions/referrals, provide customer support, prevent fraud, and comply with legal requirements.
      </p>

      <H2>3. Lakshmi AI Assistant Personalization & Privacy Policy</H2>
      <p>
        When you log in to {business}, Lakshmi AI Assistant accesses your registered full name from your account login details solely to address you warmly and personalize conversational support in live chat. Lakshmi AI uses Gemini AI models to generate dynamic, intelligent responses — your phone number is strictly kept private and used exclusively for delivery dispatch updates, never for AI chat greetings or public display. Anonymized chatbot interaction data is used to improve service quality, and queries escalated to human support are shared only with authorized customer representatives.
      </p>

      <H2>4. Sharing of Information</H2>
      <p>
        Shared only as needed: payment gateway for payments, delivery personnel for fulfilment. We do not sell personal data.
      </p>

      <H2>5. Cookies & Sessions</H2>
      <p>
        Secure session cookies for login, cart, checkout. Necessary for site function.
      </p>

      <H2>6. Data Security</H2>
      <p>
        HTTPS, server-side payment verification, reasonable technical safeguards.
      </p>

      <H2>7. Data Retention</H2>
      <p>
        Order and transaction records: 7 years per Indian accounting and tax law. User accounts: retained while active and for 2 years after a deletion request is received.
      </p>

      <H2>8. Your Rights</H2>
      <p>
        Request data access/correction/deletion at {email}. Data requests handled by our Grievance Officer within {complaintResolveDays} working days.
      </p>

      <H2>9. Operational Workflow Data</H2>
      <p>
        Product approval submissions, sub-admin activities, and admin login audit logs are retained for compliance and audit purposes.
      </p>

      <H2>10. Updates</H2>
      <p>
        Latest policy always on this page.
      </p>
    </PolicyShell>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Refund, Return & Cancellation Policy                            */
/* ------------------------------------------------------------------ */
export function RefundPage() {
  const { data: publicSettings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      return res.json();
    },
  });

  const returnHours = publicSettings?.return_window_hours || "4";
  const complaintResolveDays = publicSettings?.complaint_resolve_days || "30";

  return (
    <PolicyShell title="Refund, Return & Cancellation Policy">
      <H2>1. No Refund After Delivery</H2>
      <p>Due to the nature of perishables, there are no refunds after delivery.</p>

      <H2>2. When We WILL Replace or Refund</H2>
      <p>For damaged/wrong items reported within {returnHours} hours, accompanied by photos.</p>

      <H2>3. Cancellations Before Dispatch</H2>
      <p>Orders can be cancelled before dispatch for a full refund.</p>

      <H2>4. Substitution Refunds</H2>
      <p>
        If we substitute an item and you are not satisfied with the substitution, you may reject it at delivery and a full refund for that item will be processed within 2 business days.
      </p>

      <H2>5. Subscription Cancellations & Billing Disputes</H2>
      <p>
        Subscription delivery cycles must be cancelled by 8:00 PM the night before the scheduled delivery date. Billing disputes must be raised within 7 days of the billing date. Unresolved disputes may be escalated to our Grievance Officer. Resolution within {complaintResolveDays} working days.
      </p>

      <H2>6. How Refunds Are Processed</H2>
      <p>
        Refunds take 2 business days to initiate, and an additional 5-7 bank days to reflect in your account.
      </p>

      <H2>7. Non-Refundable</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Change of mind after delivery</li>
        <li>Customer unavailability or incorrect delivery address provided</li>
        <li>Inherent natural variations in farm produce</li>
        <li>Claims reported after the {returnHours}-hour window OR without photographic proof.</li>
      </ul>
    </PolicyShell>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Return Policy                                                   */
/* ------------------------------------------------------------------ */
export function ReturnPage() {
  const { data: publicSettings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      return res.json();
    },
  });

  const business = publicSettings?.store_name || "FarmFreshFarmer";
  const returnHours = publicSettings?.return_window_hours || "4";
  const email = publicSettings?.contact_email || "admin@farmfreshfarmer.com";
  const phone = publicSettings?.contact_phone || "+91 79897 93669";

  return (
    <PolicyShell title="Return Policy">
      <p>
        At {business}, we take utmost pride in delivering farm-fresh produce and artisanal groceries directly to your doorstep. Due to the perishable nature of fresh fruits, vegetables, and homemade perishables, our return policy is crafted to protect product safety and freshness.
      </p>

      <H2>1. Perishable Items (Fruits, Vegetables, Dairy, Sweets & Pickles)</H2>
      <p>
        Perishable goods cannot be returned once accepted at delivery due to health and safety standards. However, if you receive items that are damaged, spoiled, or incorrect:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Report the issue within <strong>{returnHours} hours</strong> of delivery.</li>
        <li>Provide clear photographic proof of the damaged or defective item via WhatsApp ({phone}), app/web support, or email ({email}).</li>
        <li>Once verified, we will immediately initiate a <strong>free replacement delivery</strong> or a <strong>100% refund</strong> for the affected item.</li>
      </ul>

      <H2>2. Non-Perishable Goods & Packaged Goods</H2>
      <p>
        Unopened, undamaged packaged goods (such as dry millets, pulses, spices, and sealed gourmet jars) can be returned within 48 hours of delivery if the original tamper-evident seal is intact.
      </p>

      <H2>3. How to Request a Return or Replacement</H2>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Navigate to your <strong>My Orders</strong> section on the website or mobile app.</li>
        <li>Select the order and tap <strong>Request Refund / Return</strong>.</li>
        <li>Upload a photo proof of the damaged product and submit your request. Alternatively, contact support directly at {phone}.</li>
      </ol>

      <H2>4. Return Pickups</H2>
      <p>
        For approved returns of non-perishable goods, our delivery agent will collect the item from your registered address at zero additional cost.
      </p>
    </PolicyShell>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Shipping & Delivery Policy                                      */
/* ------------------------------------------------------------------ */
export function ShippingPage() {
  const { data: publicSettings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      return res.json();
    },
  });

  const customNotes = publicSettings?.shipping_policy_custom_notes;
  const business = publicSettings?.store_name || "FarmFreshFarmer";
  const grievanceOfficerEmail = publicSettings?.grievance_officer_email;

  return (
    <PolicyShell title="Shipping & Delivery Policy">
      <p>
        {business} operates a hyper-local instant farm-to-home delivery network alongside national express courier shipping and international air freight.
      </p>

      <H2>1. Delivery Coverage & Service Areas</H2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Instant Local Express (30–60 Mins)</strong>: Operates across our service cities.
        </li>
        <li>
          <strong>Pan-India Domestic Express Courier (2–4 Days)</strong>: Servicing 19,000+ PIN codes.
        </li>
        <li>
          <strong>International Air Cargo (4–7 Days)</strong>: Worldwide express delivery.
        </li>
      </ul>

      <H2>2. Estimated Time of Arrival (ETA)</H2>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Local Instant Orders</strong>: 30 to 60 minutes from order placement.</li>
        <li><strong>Out-of-Station Domestic Shipping</strong>: Delivered in 2 to 4 business days.</li>
        <li><strong>International Orders</strong>: Delivered in 4 to 7 business days.</li>
      </ul>

      <H2>3. Shipping Charges & Thresholds</H2>
      <p>Applicable shipping charges are calculated at checkout.</p>

      <H2>4. Delivery Process & Temperature Protection</H2>
      <p>Items are packed securely to maintain freshness.</p>

      <H2>5. Delivery Delays & Force Majeure</H2>
      <p>
        {business} shall not be liable for delivery delays caused by weather events, traffic disruptions, crop supply shortages, natural calamities, or government restrictions. Estimated delivery times are indicative and non-binding.
      </p>

      <H2>6. Unresolved Delivery Issues</H2>
      <p>
        If your delivery complaint is not resolved within 48 hours, please contact our Grievance Officer directly{grievanceOfficerEmail ? ` at ${grievanceOfficerEmail}` : ""}.
      </p>

      {customNotes && (
        <>
          <H2>7. Special Delivery Notes</H2>
          <p className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200 text-xs font-semibold leading-relaxed">
            {customNotes}
          </p>
        </>
      )}
    </PolicyShell>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Grievance Redressal                                             */
/* ------------------------------------------------------------------ */
export function GrievancePage() {
  const { data: publicSettings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      return res.json();
    },
  });

  const business = publicSettings?.store_name || "FarmFreshFarmer";
  const email = publicSettings?.contact_email || "admin@farmfreshfarmer.com";
  const phone = publicSettings?.contact_phone || "+91 79897 93669";
  const officerName = publicSettings?.grievance_officer_name || "";
  const officerEmail = publicSettings?.grievance_officer_email || "";
  const officerPhone = publicSettings?.grievance_officer_phone || "";
  const officerDesignation = publicSettings?.grievance_officer_designation || "";
  const officerAddress = publicSettings?.grievance_officer_address || "";
  const ackHours = publicSettings?.complaint_ack_hours || "48";
  const resolveDays = publicSettings?.complaint_resolve_days || "30";
  const hasOfficer = officerName && officerEmail;

  return (
    <PolicyShell title="Grievance Redressal">
      <p>
        In accordance with the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000, {business} has established a Grievance Redressal mechanism to address customer complaints promptly and fairly.
      </p>

      <H2>1. How to Raise a Complaint</H2>
      <ol className="list-decimal pl-6 space-y-2">
        <li>
          Contact our customer support team via WhatsApp/Call at {phone} or email {email}. You may also use our Lakshmi AI chatbot available on the website and app.
        </li>
        <li>
          If your complaint is not resolved within {ackHours} hours, please escalate it to our Grievance Officer directly using the contact details below.
        </li>
        <li>
          If your complaint remains unresolved after {resolveDays} working days, you may approach the appropriate consumer forum (SCDRC/NCDRC) or file a complaint on the National Consumer Helpline (NCH) at 1800-11-4000.
        </li>
      </ol>

      <H2>2. Grievance Officer</H2>
      {hasOfficer ? (
        <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-900/10 p-5 space-y-2">
          <p className="font-bold text-base text-emerald-700 dark:text-emerald-400">
            🏛️ Designated Grievance Officer
          </p>
          <p>
            <strong>Name:</strong> {officerName}
          </p>
          {officerDesignation && (
            <p>
              <strong>Designation:</strong> {officerDesignation}
            </p>
          )}
          <p>
            <strong>Email:</strong>{" "}
            <a href={`mailto:${officerEmail}`} className="text-emerald-600 hover:underline">
              {officerEmail}
            </a>
          </p>
          {officerPhone && (
            <p>
              <strong>Phone:</strong> {officerPhone}
            </p>
          )}
          {officerAddress && (
            <p>
              <strong>Office Address:</strong> {officerAddress}
            </p>
          )}
          <div className="border-t border-emerald-200 dark:border-emerald-800 pt-2 mt-2">
            <p className="text-xs text-muted-foreground">
              Complaint Acknowledgment: within <strong>{ackHours} hours</strong> of receipt
            </p>
            <p className="text-xs text-muted-foreground">
              Resolution Timeline: within <strong>{resolveDays} working days</strong>
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/10 p-4 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            ⚠️ Grievance Officer details are being configured.
          </p>
          <p className="mt-1 text-muted-foreground">
            For immediate assistance, please contact us at{" "}
            <a href={`mailto:${email}`} className="underline">
              {email}
            </a>{" "}
            or call {phone}.
          </p>
        </div>
      )}

      <H2>3. Acknowledgment & Resolution Timeline</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          Complaint Acknowledgment: within <strong>{ackHours} hours</strong> of receipt during business hours.
        </li>
        <li>
          Resolution: within <strong>{resolveDays} working days</strong> from the date of complaint receipt.
        </li>
        <li>
          If additional time is required, you will be informed with a reason and revised timeline.
        </li>
      </ul>

      <H2>4. Escalation to Consumer Forum</H2>
      <p>If your grievance is not resolved within the stipulated timeline, you may:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          File a complaint with the <strong>State Consumer Disputes Redressal Commission (SCDRC)</strong> in Andhra Pradesh.
        </li>
        <li>
          Contact the <strong>National Consumer Helpline</strong> at <strong>1800-11-4000</strong> (toll-free) or visit consumerhelpline.gov.in.
        </li>
        <li>
          File an online complaint at <strong>edaakhil.nic.in</strong> (e-Daakhil portal for consumer complaints).
        </li>
      </ul>
    </PolicyShell>
  );
}
