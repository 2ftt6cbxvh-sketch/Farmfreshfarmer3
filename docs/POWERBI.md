# FarmFreshFarmer — Power BI / Analytics Guide

The database exposes **10 read-only SQL views** (all prefixed `vw_`) designed
for direct connection from Power BI (or Tableau, Metabase, Superset). They join
the operational tables into clean, report-ready fact and summary tables. All
money columns are `numeric(.,2)` and safe to `SUM`/`AVG`.

The views are created by `reporting/powerbi_views.sql` and applied with:

```bash
npm run db:views          # local / any environment (uses DATABASE_URL)
# or directly:
psql "$DATABASE_URL" -f reporting/powerbi_views.sql
```

They are also applied automatically on every Elastic Beanstalk deploy
(`.ebextensions/02-migrate.config`). The file is idempotent
(`CREATE OR REPLACE VIEW`), so re-running never breaks anything.

---

## 1. The views

| View                      | Grain / purpose                                                                 |
| ------------------------- | ------------------------------------------------------------------------------- |
| `vw_orders`               | One row per order: totals, discount breakdown, payment + fulfilment status, day-of-week. The core sales fact. |
| `vw_order_items`          | One row per product line — for basket analysis and product mix.                 |
| `vw_daily_sales`          | Daily roll-up: orders, revenue, AOV, and each discount type (first-order, referral, referral-reward). |
| `vw_payments`             | Every PhonePe/COD transaction linked to its order.                              |
| `vw_payment_summary`      | Daily counts + value by payment status (success / failed / pending / refunded). |
| `vw_subscriptions`        | Subscription state: plan, weekly price, active/paused/cancelled, delivery days. |
| `vw_subscription_cycles`  | The Saturday/Sunday delivery schedule per subscription (upcoming + historical). |
| `vw_referral_performance` | Per-referrer roll-up: referrals, conversions, rewards earned/redeemed, balance. |
| `vw_customer_value`       | Per-customer lifetime value, order count, first-order flag.                     |
| `vw_inventory`            | Current stock, low-stock flag, category — for stock dashboards.                 |

---

## 2. Create a read-only BI user

`reporting/powerbi_views.sql` also creates a dedicated **read-only role**
`farmfresh_bi` so Power BI can never modify data. **Change its password** right
after applying the file:

```sql
ALTER ROLE farmfresh_bi PASSWORD 'a-strong-unique-password';
```

The role has `CONNECT` on the database, `USAGE` on `public`, and `SELECT` on the
reporting views only. Use this role's credentials in Power BI — not the master
DB user.

---

## 3. Connect Power BI Desktop to RDS PostgreSQL

**Prerequisite:** install the **Npgsql** provider (Power BI's PostgreSQL
connector needs it). Power BI Desktop usually prompts and installs it, or get it
from the Npgsql GitHub releases.

1. **Make RDS reachable.** Either:
   - Add your machine's IP to the RDS security group inbound rule for port
     5432 (quickest for a laptop), or
   - Use an SSH tunnel / VPN into the VPC (more secure).
2. Power BI Desktop → **Home → Get data → More → Database → PostgreSQL database**.
3. **Server:** `farmfresh-db.xxxx.ap-south-1.rds.amazonaws.com:5432`
   **Database:** `farmfreshfarmer`
4. Data Connectivity mode: **Import** (recommended) or **DirectQuery** for live.
5. Credentials: **Database** → username `farmfresh_bi`, the password you set.
6. Encryption: enable **"Use encrypted connection"** (RDS requires SSL).
7. In the Navigator, tick the `vw_*` views you want and click **Load**.

---

## 4. Suggested Power BI model & visuals

**Relationships (Model view):**

- `vw_orders[order_id]` → `vw_order_items[order_id]` (1-to-many)
- `vw_orders[user_id]` → `vw_customer_value[user_id]`
- `vw_orders[order_id]` → `vw_payments[order_id]`
- Add a **Date dimension** table and relate it to `vw_orders[created_at]` (date)
  for proper time intelligence.

**Starter dashboard pages:**

1. **Sales overview** — KPI cards (Total revenue, Orders, AOV from
   `vw_daily_sales`), a revenue line chart over `sales_day`, and a discount
   stacked column (first-order vs referral vs referral-reward).
2. **Product mix** — bar chart of quantity & revenue by product/category from
   `vw_order_items`.
3. **Payments** — donut of `vw_payment_summary` by status; PhonePe vs COD split.
4. **Subscriptions** — active vs paused vs cancelled from `vw_subscriptions`;
   upcoming Sat/Sun deliveries from `vw_subscription_cycles`.
5. **Referral program** — table from `vw_referral_performance` (top referrers,
   rewards earned, available balance) and a conversion funnel.
6. **Inventory** — table from `vw_inventory` filtered to `is_low_stock = true`.

**Useful measures (DAX):**

```DAX
Total Revenue = SUM(vw_daily_sales[revenue])
Total Orders  = SUM(vw_daily_sales[orders_count])
AOV           = DIVIDE([Total Revenue], [Total Orders])
Referral Rewards Paid = SUM(vw_referral_performance[total_reward_redeemed])
```

---

## 5. Scheduling refresh (Power BI Service)

To refresh a published report against RDS, install the **On-premises data
gateway (standard mode)** on a machine that can reach RDS, then configure the
dataset's scheduled refresh in the Power BI Service using the `farmfresh_bi`
credentials.
