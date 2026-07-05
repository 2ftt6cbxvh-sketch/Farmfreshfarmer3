# FarmFreshFarmer

A production-ready full-stack e-commerce platform for a fresh-produce store —
customer storefront + admin dashboard, weekly subscriptions, a referral &
discount engine, PhonePe payments, and Power BI analytics.

**Stack:** Node.js · Express · TypeScript · React · Tailwind · PostgreSQL ·
Drizzle ORM. Single web process serves the API + built client on
`process.env.PORT`. Deploys to AWS Elastic Beanstalk with RDS PostgreSQL.

---

## Quick start (local)

```bash
npm install
cp .env.example .env            # set DATABASE_URL, SESSION_SECRET
createdb farmfreshfarmer
npm run db:migrate              # create schema
npm run db:views                # create Power BI reporting views
npm run db:seed                 # settings, admin user, sample catalog
npm run dev                     # http://localhost:5000
```

Admin: `http://localhost:5000/#/admin` — `admin@farmfreshfarmer.com` / `1234567`
(change it in Admin → Settings).

Run like production locally:

```bash
npm run build
COOKIE_SECURE=false npm start
```

---

## npm scripts

| Script             | Does                                             |
| ------------------ | ------------------------------------------------ |
| `npm run dev`      | Dev server (Vite + Express, hot reload)          |
| `npm run build`    | Build client + server into `dist/`               |
| `npm start`        | Production: `node dist/index.cjs`                |
| `npm run check`    | TypeScript type-check                            |
| `npm run db:generate` | Generate Drizzle SQL migrations from schema   |
| `npm run db:migrate`  | Apply migrations to `DATABASE_URL`            |
| `npm run db:views`    | Apply Power BI reporting views                |
| `npm run db:seed`     | Seed settings / admin / sample catalog (idempotent) |

---

## Core features

- **Storefront:** catalog, cart, live server-priced checkout, order history.
- **Admin dashboard:** KPIs, orders-by-status chart, upcoming Sat/Sun
  deliveries, low-stock alerts; manage catalog, categories, inventory (with
  adjustment history), orders, customers, reviews, discounts, referrals,
  payments, and settings.
- **Subscriptions:** weekly Saturday/Sunday deliveries; fixed admin plans +
  customer add-ons; pause / resume / skip / cancel / reactivate / change-plan;
  automated weekly order generation.
- **Discounts & referrals:** first-order 10% off; referral program (new
  customer 10% off, referrer 5% per successful referral) with abuse protection
  and a 30%-per-order reward cap. All pricing re-computed server-side.
- **Payments:** PhonePe v2 (OAuth) — initiate, verify, webhook, refund — with
  full transaction records. COD supported. Built-in simulator for testing.
- **Analytics:** 10 read-only PostgreSQL views for Power BI, behind a
  least-privilege BI role.
- **`GET /health`** endpoint for load-balancer / EB health checks.

---

## Documentation

| Guide                        | For                                             |
| ---------------------------- | ----------------------------------------------- |
| `docs/DEPLOYMENT.md`         | AWS Elastic Beanstalk + RDS setup, ZIP, CI/CD   |
| `docs/PHONEPE.md`            | PhonePe credentials, webhook, refunds, testing  |
| `docs/POWERBI.md`            | Connecting Power BI, the views, dashboard ideas |
| `docs/RESUME.md`             | Resume / portfolio bullet points                |
| `OWNER_GUIDE.md`             | Non-technical store-owner manual                |

---

## Project layout

```
client/        React frontend (built by npm run build)
server/        Express API, business engine, PhonePe service
  ├── engine/  pricing, orders, referral, subscription logic
  └── services/phonepe.ts
shared/        schema.ts — Drizzle schema (single source of truth)
migrations/    generated SQL migrations
reporting/     powerbi_views.sql
script/        build / migrate / seed / apply-views
.ebextensions/ EB deploy config (env, build, migrate, views)
Procfile       web: npm start
```

---

## Environment variables

See `.env.example` for the full list with comments. The essentials:
`DATABASE_URL`, `SESSION_SECRET`, `APP_BASE_URL`, `COOKIE_SECURE`, and the
`PHONEPE_*` credentials. In production, set these as Elastic Beanstalk
environment properties — never commit `.env`.
