# FarmFreshFarmer — Local + Render.com Guide

This app is a single Node/Express process that serves the REST API and the built
React client on `process.env.PORT`, backed by PostgreSQL (Drizzle ORM). That
makes it a perfect fit for Render's Web Service + managed Postgres.

---

## Part 1 — Run it locally

**Prerequisites:** Node.js 20+ and PostgreSQL 14+ installed and running.

```bash
# 1. Install dependencies
npm install

# 2. Create a local database
createdb farmfreshfarmer
#   (or:  psql -c "CREATE DATABASE farmfreshfarmer;")

# 3. Configure environment
cp .env.example .env
```

Edit `.env` and set at least:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/farmfreshfarmer
SESSION_SECRET=any-long-random-string
```

(Leave the PhonePe keys blank for now — the built-in payment simulator kicks in
automatically in development so you can test the full checkout.)

```bash
# 4. Create schema + reporting views + seed data (admin user, sample catalog)
npm run db:setup        # = migrate + views + seed (idempotent)

# 5a. Development mode (Vite + Express, hot reload):
npm run dev
#    -> open http://localhost:5000

# 5b. OR run exactly like production locally:
npm run build
COOKIE_SECURE=false npm start
#    -> open http://localhost:5000
```

- **Storefront:** http://localhost:5000
- **Admin:** http://localhost:5000/#/admin
  - email `admin@farmfreshfarmer.com` · password `1234567`
  - change it in Admin → Settings after logging in
- **Health check:** http://localhost:5000/health

> Note: locally the server binds to `127.0.0.1` on macOS/Windows and `0.0.0.0`
> on Linux — handled automatically. `COOKIE_SECURE=false` is needed only when
> testing production mode over plain http (no HTTPS locally).

---

## Part 2 — Deploy to Render.com

You have two options. **Option A (Blueprint)** is the easiest — it creates the
database and web service together and wires them automatically.

### Prerequisite: push to GitHub

```bash
cd farmfreshfarmer
git init
git add .
git commit -m "FarmFreshFarmer production app"
git branch -M main
git remote add origin https://github.com/<you>/farmfreshfarmer.git
git push -u origin main
```

`.gitignore` already excludes `node_modules/`, `dist/`, and `.env`, so no secrets
are pushed.

---

### Option A — One-click Blueprint (recommended)

The repo includes `render.yaml`, which describes a Postgres database + a web
service.

1. Go to the Render dashboard → **New +** → **Blueprint**.
2. Connect your GitHub account and pick the `farmfreshfarmer` repo.
3. Render reads `render.yaml` and shows the plan: a **PostgreSQL** database
   (`farmfresh-db`) and a **Web Service** (`farmfreshfarmer`). Click **Apply**.
4. Render will:
   - create the database and inject its `DATABASE_URL` into the web service,
   - generate a strong `SESSION_SECRET`,
   - run `npm install && npm run build`,
   - run `npm run db:setup` (migrations → views → seed) as the pre-deploy step,
   - start the app with `npm start`.
5. When the service is live, copy its URL (e.g.
   `https://farmfreshfarmer.onrender.com`) and set it as **`APP_BASE_URL`** in
   the web service's **Environment** tab (this is used to build PhonePe redirect
   URLs). Save — Render redeploys.
6. Add your PhonePe credentials (see Part 3) when you're ready to take real
   payments. Until then, the app runs in simulation-friendly sandbox mode.

Done. Visit the URL; admin is at `…/#/admin`.

---

### Option B — Manual setup (no Blueprint)

**1. Create the database**
- New + → **PostgreSQL** → name `farmfresh-db`, database name
  `farmfreshfarmer`, pick a region (Singapore is closest to India). Create it.
- Copy its **Internal Database URL** (used by the web service in the same
  region) — you'll paste it as `DATABASE_URL`.

**2. Create the web service**
- New + → **Web Service** → connect the GitHub repo.
- **Runtime:** Node
- **Build Command:** `npm install && npm run build`
- **Pre-Deploy Command:** `npm run db:setup`
- **Start Command:** `npm start`
- **Health Check Path:** `/health`

**3. Set environment variables** (Environment tab):

| Key                | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| `NODE_ENV`         | `production`                                              |
| `DATABASE_URL`     | the Internal Database URL from step 1                     |
| `SESSION_SECRET`   | a long random string                                      |
| `COOKIE_SECURE`    | `true`  (Render serves HTTPS)                             |
| `PGSSL`            | `true`                                                    |
| `APP_BASE_URL`     | your Render URL, e.g. `https://farmfreshfarmer.onrender.com` |
| `PHONEPE_ENV`      | `sandbox` (or `production` later)                         |
| `PHONEPE_*`        | your PhonePe keys (see Part 3) — optional at first        |

> Render sets `PORT` automatically; the app already reads `process.env.PORT`,
> so don't set it yourself.

Click **Create Web Service**. Render builds, runs the DB setup, and launches.

---

## Part 3 — PhonePe on Render

1. Get sandbox (and later production) credentials from the PhonePe Business
   dashboard → Developer Settings.
2. In the Render web service → **Environment**, set:
   `PHONEPE_ENV`, `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`,
   `PHONEPE_CLIENT_VERSION`, `PHONEPE_MERCHANT_ID`, and (for webhooks)
   `PHONEPE_WEBHOOK_USERNAME` / `PHONEPE_WEBHOOK_PASSWORD`.
3. In the PhonePe dashboard, register the webhook URL:
   `https://<your-service>.onrender.com/api/payments/webhook`
4. Make sure `APP_BASE_URL` is your real Render URL.

Full details are in `docs/PHONEPE.md`.

---

## Part 4 — Important Render notes

- **Free tier spins down.** A free web service sleeps after ~15 min idle and
  cold-starts on the next request (~30–60 s). Upgrade to **Starter** for
  always-on. Free PostgreSQL is deleted after 30 days — use a paid **Basic**
  plan for anything you want to keep.
- **Sessions are in-memory.** Fine for a single instance (Render's default). If
  you scale to multiple instances, switch to a Postgres session store
  (`connect-pg-simple`) — see `docs/DEPLOYMENT.md` §7.
- **Uploaded product images** are written to the instance disk, which is
  **ephemeral** on Render (lost on redeploy/restart). For durable images, either
  add a Render **Persistent Disk** mounted at the uploads folder, or move uploads
  to S3/Cloudinary. Seeded catalog images are bundled in the build, so the demo
  catalog always shows.
- **Auto-deploy:** with the Blueprint, pushing to `main` triggers a new build +
  pre-deploy migrations + release automatically.
- **Logs & shell:** the Render dashboard has live logs and a shell for the
  service if you need to run `npm run db:seed` manually.

---

## Local vs Render — command cheat sheet

| Task                       | Local                                   | Render                                  |
| -------------------------- | --------------------------------------- | --------------------------------------- |
| Install                    | `npm install`                           | Build Command                           |
| Build                      | `npm run build`                         | Build Command                           |
| Create schema/views/seed   | `npm run db:setup`                      | Pre-Deploy Command                      |
| Start                      | `npm run dev` / `npm start`             | Start Command (`npm start`)             |
| Database                   | local PostgreSQL                        | Render PostgreSQL (`DATABASE_URL`)      |
| HTTPS / secure cookies     | off (`COOKIE_SECURE=false`)             | on (`COOKIE_SECURE=true`)               |
