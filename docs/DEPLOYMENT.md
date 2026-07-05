# FarmFreshFarmer — Deployment Guide (AWS Elastic Beanstalk + RDS PostgreSQL)

This is a production-ready Node.js (Express + React) e-commerce app. It uses a
**single web process** that serves both the REST API and the built React client
on `process.env.PORT`. Data lives in **PostgreSQL** (AWS RDS in production) via
Drizzle ORM. Payments go through **PhonePe**. Analytics are exposed as
read-only SQL **views** for Power BI.

---

## 1. What's in the box

```
farmfreshfarmer/                 <-- ZIP root (package.json is HERE, no wrapper folder)
├── .ebextensions/               <-- EB config: env, build, migrate, views
│   ├── 01-node.config
│   ├── 02-migrate.config
│   └── 03-build.config
├── Procfile                     <-- "web: npm start"
├── package.json                 <-- start script: node dist/index.cjs
├── client/                      <-- React source (built by `npm run build`)
├── server/                      <-- Express API, engine, PhonePe service
├── shared/schema.ts             <-- Drizzle schema (single source of truth)
├── migrations/                  <-- generated SQL migrations
├── reporting/powerbi_views.sql  <-- Power BI read-only views
├── script/                      <-- build / migrate / seed / apply-views
├── docs/                        <-- these guides
├── .env.example                 <-- copy to .env for local dev
└── OWNER_GUIDE.md               <-- non-technical store-owner manual
```

`node_modules/` and `dist/` are NOT committed — EB installs dependencies and
builds on deploy.

---

## 2. Local development

**Prerequisites:** Node.js 20+ and a local PostgreSQL 14+.

```bash
# 1. Install deps
npm install

# 2. Create the database
createdb farmfreshfarmer

# 3. Configure env
cp .env.example .env
#   edit DATABASE_URL, SESSION_SECRET, (optional) PhonePe keys

# 4. Create the schema + reporting views + seed data
npm run db:migrate     # applies migrations/*.sql
npm run db:views       # creates the Power BI views
npm run db:seed        # settings, admin user, sample catalog (idempotent)

# 5. Run in dev (Vite + Express, hot reload)
npm run dev
#   -> http://localhost:5000

# ...or run exactly like production:
npm run build
COOKIE_SECURE=false npm start
```

Default admin: **admin@farmfreshfarmer.com** / **1234567** (change it in
Admin → Settings after first login).

---

## 3. Provision AWS RDS PostgreSQL

1. RDS → Create database → **PostgreSQL** (14 or newer).
2. Templates: **Free tier** (for testing) or **Production** (Multi-AZ).
3. Set a master username/password. DB instance identifier: `farmfresh-db`.
4. **Public access:** No (recommended). Put RDS and EB in the **same VPC**.
5. Under **Additional configuration → Initial database name**, enter
   `farmfreshfarmer`.
6. After creation, note the **endpoint** (e.g.
   `farmfresh-db.xxxx.ap-south-1.rds.amazonaws.com`).
7. **Security group:** allow inbound TCP **5432** from the EB environment's
   security group (not from `0.0.0.0/0`).

Your `DATABASE_URL` will look like:

```
postgres://masteruser:PASSWORD@farmfresh-db.xxxx.ap-south-1.rds.amazonaws.com:5432/farmfreshfarmer
```

SSL to RDS is auto-enabled (the pg pool detects `*.rds.amazonaws.com`), and
`PGSSL=true` is set in `.ebextensions/01-node.config` to be explicit.

---

## 4. Create the Elastic Beanstalk environment

### Option A — EB Console (easiest)

1. Elastic Beanstalk → **Create application**.
2. Platform: **Node.js** (Amazon Linux 2023, Node 20 or newer).
3. Application code: **Upload your code** → upload the ZIP (see §5).
4. Presets: **Single instance** (cheapest) or **High availability** (load
   balanced). Either works — the app is stateless except for in-memory
   sessions (see §7).
5. Before finishing, or right after, set **Environment properties**
   (Configuration → Software → Environment properties):

   | Key                       | Value                                                    |
   | ------------------------- | -------------------------------------------------------- |
   | `DATABASE_URL`            | your RDS connection string                               |
   | `SESSION_SECRET`          | a long random string                                     |
   | `PHONEPE_ENV`             | `sandbox` (or `production`)                              |
   | `PHONEPE_CLIENT_ID`       | from PhonePe dashboard (see docs/PHONEPE.md)             |
   | `PHONEPE_CLIENT_SECRET`   | from PhonePe dashboard                                   |
   | `PHONEPE_CLIENT_VERSION`  | `1`                                                      |
   | `PHONEPE_MERCHANT_ID`     | from PhonePe dashboard                                   |
   | `APP_BASE_URL`            | your public URL, e.g. `https://farmfresh.example.com`    |
   | `COOKIE_SECURE`           | `true` if you have HTTPS; `false` if plain http for now  |

   > `NODE_ENV`, `PGSSL`, and `NPM_USE_PRODUCTION` are already set in
   > `.ebextensions/01-node.config`. Environment properties you set in the
   > console override the config file.

6. EB deploys, runs `npm install`, then the `.ebextensions` container commands:
   `npm run build` → `migrate` → `apply-views`. Then `npm start` launches.

### Option B — EB CLI

```bash
pip install awsebcli
eb init -p node.js farmfreshfarmer --region ap-south-1
eb create farmfresh-prod --single           # or omit --single for load-balanced
eb setenv DATABASE_URL="postgres://..." SESSION_SECRET="..." \
          PHONEPE_ENV=sandbox APP_BASE_URL="https://..." COOKIE_SECURE=true
eb deploy
eb open
```

---

## 5. Build the deployable ZIP

The ZIP **must have `package.json` at the root** (no extra wrapper folder).
From the project root:

```bash
# excludes node_modules, dist, .env, git, and OS junk; keeps .ebextensions & Procfile
zip -r ../farmfreshfarmer-eb.zip . \
  -x "node_modules/*" -x "dist/*" -x ".git/*" \
  -x ".env" -x "*.log" -x ".DS_Store"
```

Upload `farmfreshfarmer-eb.zip` in the EB console (or use `eb deploy`).
(A ready-made ZIP is included in this delivery.)

---

## 6. Verify the deploy

- **Health check:** `GET https://<your-eb-url>/health` →
  `{"status":"ok","db":true,"phonepe":"...","time":"..."}`
- **Storefront:** open the EB URL.
- **Admin:** `https://<your-eb-url>/#/admin` → log in →
  Dashboard shows KPIs, upcoming Sat/Sun deliveries, orders chart, low stock.
- **Logs:** EB console → Logs → Request logs. Migration output appears under
  `/var/log/eb-engine.log` and `cfn-init` logs.

---

## 7. Production notes & hardening

- **Sessions are in-memory** (`memorystore`). For a **single instance** this is
  fine. For a **load-balanced** environment, either enable **sticky sessions**
  on the load balancer, OR switch to a Postgres-backed store
  (`connect-pg-simple`) — a one-file change in `server/routes.ts`. Sticky
  sessions is the simplest path to start.
- **HTTPS:** add an HTTPS listener (ACM certificate) on the EB load balancer,
  or front the single instance with CloudFront. Then set `COOKIE_SECURE=true`
  so the session cookie is only sent over TLS. `trust proxy` is already set to
  `1` so secure cookies work behind the EB proxy.
- **Cookies** are `httpOnly` + `sameSite=lax`, so they resist XSS token theft
  and most CSRF. All admin routes are gated by `requireAdmin`; customer routes
  by `requireAuth`.
- **Uploads** are limited to 5 MB (multer). For durable image storage across
  instances, move uploads to S3 (currently written to the instance filesystem).
- **Secrets** live only in EB environment properties — never in the ZIP. `.env`
  is git-ignored.
- **Migrations** run `leader_only` on deploy, so only one instance touches the
  schema. They are additive; review `migrations/` before deploying schema
  changes to production data.

---

## 8. GitHub → EB continuous deployment (optional)

1. Push this repo to GitHub.
2. In EB: Configuration → **Managed updates** for platform patches.
3. For app deploys, use **GitHub Actions** with the
   `einaregilsson/beanstalk-deploy` action (or CodePipeline). On push to
   `main`: zip the repo (excluding node_modules/dist) and deploy the version to
   your EB environment. Store AWS keys as GitHub repository secrets.
