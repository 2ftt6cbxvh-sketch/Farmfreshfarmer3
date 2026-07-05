-- =====================================================================
-- FarmFreshFarmer — Power BI / Analytics Reporting Views
-- =====================================================================
-- Read-only PostgreSQL views for connecting Power BI (or Metabase, Tableau,
-- Superset, etc.) directly to the production/RDS database.
--
-- Design principles:
--   * Views only read from the operational tables — they never modify data.
--   * All monetary values are numeric(.,2) and safe to SUM/AVG in Power BI.
--   * Dates are timestamptz; Power BI converts to the report timezone.
--   * A dedicated read-only role is created so BI tools cannot write.
--
-- HOW TO APPLY (run once against the target database):
--   psql "$DATABASE_URL" -f reporting/powerbi_views.sql
-- Re-running is safe: every object uses CREATE OR REPLACE / IF NOT EXISTS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Orders fact — one row per order, with discount + payment breakdown.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_orders AS
SELECT
  o.id                        AS order_id,
  o.user_id,
  u.name                      AS customer_name,
  u.email                     AS customer_email,
  o.order_type,                          -- normal | subscription
  o.subscription_id,
  o.delivery_day,                        -- Saturday | Sunday (subscription orders)
  o.subtotal,
  o.discount                  AS total_discount,
  o.first_order_discount,
  o.referral_discount,
  o.referral_reward_applied,
  o.coupon_code,
  o.referral_code_used,
  o.total                     AS order_total,
  o.payment_method,                      -- COD | PHONEPE
  o.payment_status,                      -- pending | paid | failed | refunded
  o.status                    AS fulfilment_status, -- Placed | Packed | Out for delivery | Delivered | Cancelled
  o.created_at                AS order_date,
  o.created_at::date          AS order_day,
  date_trunc('month', o.created_at)::date AS order_month,
  EXTRACT(ISODOW FROM o.created_at)::int  AS order_dow, -- 1=Mon .. 7=Sun
  o.updated_at
FROM orders o
LEFT JOIN users u ON u.id = o.user_id;

-- ---------------------------------------------------------------------
-- 2. Order line items fact — one row per product line (for basket / product mix).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_order_items AS
SELECT
  oi.id                       AS order_item_id,
  oi.order_id,
  o.created_at                AS order_date,
  o.created_at::date          AS order_day,
  o.status                    AS fulfilment_status,
  o.payment_status,
  o.order_type,
  oi.product_id,
  oi.name                     AS product_name,
  p.category_slug,
  c.name                      AS category_name,
  oi.unit,
  oi.price                    AS unit_price,
  oi.qty,
  oi.line_total
FROM order_items oi
JOIN orders o        ON o.id = oi.order_id
LEFT JOIN products p ON p.id = oi.product_id
LEFT JOIN categories c ON c.slug = p.category_slug;

-- ---------------------------------------------------------------------
-- 3. Daily sales summary — revenue, orders, AOV, discounts per day.
--    "Revenue" counts paid orders + all COD orders (COD collected on delivery).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_daily_sales AS
SELECT
  o.created_at::date                                   AS sales_day,
  COUNT(*)                                             AS orders_count,
  COUNT(*) FILTER (WHERE o.order_type = 'subscription') AS subscription_orders,
  COUNT(*) FILTER (WHERE o.order_type = 'normal')       AS normal_orders,
  SUM(o.subtotal)                                      AS gross_subtotal,
  SUM(o.discount)                                      AS total_discounts,
  SUM(o.first_order_discount)                          AS first_order_discounts,
  SUM(o.referral_discount)                             AS referral_discounts,
  SUM(o.referral_reward_applied)                       AS referral_rewards_applied,
  SUM(o.total) FILTER (WHERE o.payment_status = 'paid' OR o.payment_method = 'COD') AS revenue,
  ROUND(
    AVG(o.total) FILTER (WHERE o.payment_status = 'paid' OR o.payment_method = 'COD')
  , 2)                                                 AS avg_order_value
FROM orders o
GROUP BY o.created_at::date;

-- ---------------------------------------------------------------------
-- 4. Payments fact — every PhonePe/COD transaction with linked order.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_payments AS
SELECT
  pay.id                      AS payment_id,
  pay.merchant_order_id,
  pay.provider_transaction_id,
  pay.order_id,
  pay.subscription_cycle_id,
  pay.user_id,
  pay.provider,                          -- phonepe | cod
  pay.method,                            -- UPI | CARD | ...
  pay.amount,
  pay.currency,
  pay.status,                            -- pending | success | failed | refunded
  pay.created_at              AS initiated_at,
  pay.updated_at              AS settled_at,
  o.status                    AS order_fulfilment_status
FROM payments pay
LEFT JOIN orders o ON o.id = pay.order_id;

-- ---------------------------------------------------------------------
-- 5. Payment status summary — daily counts + value by status.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_payment_summary AS
SELECT
  pay.created_at::date        AS payment_day,
  pay.provider,
  pay.status,
  COUNT(*)                    AS payment_count,
  SUM(pay.amount)             AS payment_value
FROM payments pay
GROUP BY pay.created_at::date, pay.provider, pay.status;

-- ---------------------------------------------------------------------
-- 6. Subscriptions fact — active/paused/cancelled state + plan info.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_subscriptions AS
SELECT
  s.id                        AS subscription_id,
  s.user_id,
  u.name                      AS customer_name,
  u.email                     AS customer_email,
  s.plan_id,
  pl.name                     AS plan_name,
  s.weekly_price,
  s.delivery_days,                       -- saturday | sunday | both
  s.status,                              -- pending | active | paused | cancelled | expired
  s.start_date,
  s.next_delivery_date,
  s.cancelled_at,
  s.created_at
FROM user_subscriptions s
LEFT JOIN users u              ON u.id = s.user_id
LEFT JOIN subscription_plans pl ON pl.id = s.plan_id;

-- ---------------------------------------------------------------------
-- 7. Subscription delivery cycles — the Saturday/Sunday delivery schedule.
--    Powers "upcoming deliveries" and subscription fulfilment reporting.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_subscription_cycles AS
SELECT
  bc.id                       AS cycle_id,
  bc.subscription_id,
  s.user_id,
  u.name                      AS customer_name,
  bc.order_id,
  bc.delivery_date,
  bc.delivery_date::date      AS delivery_day_date,
  bc.delivery_day,                       -- Saturday | Sunday
  bc.amount,
  bc.status,                             -- scheduled | generated | skipped | paid | delivered | failed
  bc.created_at
FROM subscription_billing_cycles bc
JOIN user_subscriptions s ON s.id = bc.subscription_id
LEFT JOIN users u          ON u.id = s.user_id;

-- ---------------------------------------------------------------------
-- 8. Referral performance — per referrer roll-up of the referral program.
--    New customer gets 10% off; referrer earns 5% per successful referral,
--    redeemable up to a 30% cap per order.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_referral_performance AS
SELECT
  rc.user_id                  AS referrer_user_id,
  u.name                      AS referrer_name,
  u.email                     AS referrer_email,
  rc.code                     AS referral_code,
  COUNT(DISTINCT r.id)                                          AS total_referrals,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'converted')    AS successful_referrals,
  COALESCE(SUM(rw.amount) FILTER (WHERE rw.status IN ('approved','used')), 0) AS total_reward_earned,
  COALESCE((
    SELECT SUM(rwu.amount) FROM referral_reward_usages rwu WHERE rwu.referrer_user_id = rc.user_id
  ), 0)                                                         AS total_reward_redeemed,
  COALESCE(SUM(rw.amount) FILTER (WHERE rw.status = 'approved'), 0)
    - COALESCE((
        SELECT SUM(rwu.amount) FROM referral_reward_usages rwu WHERE rwu.referrer_user_id = rc.user_id
      ), 0)                                                     AS available_balance
FROM referral_codes rc
JOIN users u ON u.id = rc.user_id
LEFT JOIN referrals r        ON r.referrer_user_id = rc.user_id
LEFT JOIN referral_rewards rw ON rw.referrer_user_id = rc.user_id
GROUP BY rc.user_id, u.name, u.email, rc.code;

-- ---------------------------------------------------------------------
-- 9. Customer value — lifetime orders/spend + first-order + referral stats.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_customer_value AS
SELECT
  u.id                        AS user_id,
  u.name,
  u.email,
  u.phone,
  u.status                    AS account_status,
  cp.has_completed_first_order,
  cp.total_orders,
  cp.total_spent,
  rc.code                     AS referral_code,
  (SELECT COUNT(*) FROM referrals r
     WHERE r.referrer_user_id = u.id AND r.status = 'converted') AS successful_referrals,
  u.created_at                AS signup_date
FROM users u
LEFT JOIN customer_profiles cp ON cp.user_id = u.id
LEFT JOIN referral_codes rc    ON rc.user_id = u.id
WHERE u.role = 'customer';

-- ---------------------------------------------------------------------
-- 10. Inventory status — current stock + low-stock flag.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_inventory AS
SELECT
  p.id                        AS product_id,
  p.name                      AS product_name,
  p.category_slug,
  c.name                      AS category_name,
  p.price,
  p.stock,
  p.low_stock_threshold,
  (p.stock <= p.low_stock_threshold) AS is_low_stock,
  p.active
FROM products p
LEFT JOIN categories c ON c.slug = p.category_slug;

-- =====================================================================
-- Read-only BI role — point Power BI at these credentials, not the app's.
-- Change the password before running in production.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'farmfresh_bi') THEN
    CREATE ROLE farmfresh_bi LOGIN PASSWORD 'change-me-strong-bi-password';
  END IF;
END
$$;

-- Grant connect on the current database. Postgres GRANT ... ON DATABASE needs a
-- literal name, so we build it dynamically from current_database().
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO farmfresh_bi', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO farmfresh_bi;

-- Grant SELECT on all reporting views (and only views/tables that exist).
GRANT SELECT ON
  vw_orders, vw_order_items, vw_daily_sales, vw_payments, vw_payment_summary,
  vw_subscriptions, vw_subscription_cycles, vw_referral_performance,
  vw_customer_value, vw_inventory
TO farmfresh_bi;

-- Ensure future views are also readable by the BI role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO farmfresh_bi;
