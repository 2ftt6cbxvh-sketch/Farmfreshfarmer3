# FarmFreshFarmer — Owner's Guide

Everything you need to run your store: add products, set prices and discounts, create coupons, see your customers, change the admin password, and put the site live on your GoDaddy domain.

---

## 1. Logging in as Admin

- **Admin login page:** add `/#/admin` to the end of your site address.
  - On the live preview: open the site, then go to `…/#/admin`.
  - On your own domain later: `https://yourdomain.com/#/admin`.
- **Default admin email:** `admin@farmfreshfarmer.com`
- **Default admin password:** `1234567`

After logging in you land on the **Admin dashboard** with a dark-green sidebar
grouped into sections:

- **Overview:** Dashboard (sales KPIs, this weekend's Saturday/Sunday deliveries, orders chart, low-stock alerts)
- **Catalog:** Products · Categories · Inventory
- **Sales:** Orders · Subscriptions · Payments
- **Growth:** Customers · Reviews · Coupons · Discounts · Referrals
- **System:** Settings

> Tip: There's a **"View store"** link at the bottom of the sidebar to jump back to the public shop, and **"Log out"** to end your admin session.

---

## 2. Adding Products (no coding needed)

You add products directly in the website — never in the backend.

1. Log in to **Admin** (`/#/admin`).
2. Click **Products** in the sidebar.
3. Click **+ Add product** (top right).
4. Fill in the dialog:
   - **Name** — e.g. "Alphonso Mango"
   - **Category** — pick from the dropdown (Fruits, Vegetables, Homemade Sweets, Namkeen, Pickles (Veg), Pickles (Non-Veg), Millets, Pulses, Spices)
   - **Description** — a short line about the product
   - **Price (₹)** — the normal selling price
   - **Discount %** — optional; e.g. `10` shows a struck-through price and the discounted price automatically
   - **Unit** — e.g. "1 Kg", "500 Grams", "1 Dozen"
   - **Stock** — how many you have
   - **Diet type** — Veg or Non-Veg (controls the green/red food indicator)
   - **Featured** — toggle ON to show it on the homepage "Fresh picks" section
5. **Product image** — two easy ways:
   - **Upload image** — click *Upload image* and choose a photo from your computer/phone. You'll see an "Image uploaded" confirmation and a preview.
   - **Paste image URL** — if your photo is already online, paste its link.
6. Click **Save**. The product appears immediately in the store.

**Editing or deleting:** In the Products table, use the **pencil** icon to edit or the **trash** icon to delete any product.

> The 29 sample products are there so the site looks complete. Edit them, replace their photos, or delete them and add your own — it's all done from this same page.

---

## 3. Changing Prices & Adding Discounts

- **Change a price:** Products → pencil icon → change **Price** → Save.
- **Add a discount:** Products → pencil icon → set **Discount %** (e.g. `15`) → Save.
  The store shows the original price struck through and the new price in green.
- **Remove a discount:** set Discount % back to `0`.

---

## 4. Creating Coupon Codes

1. Admin → **Coupons**.
2. Click **+ Add coupon**.
3. Enter:
   - **Code** — what customers type, e.g. `FRESH10` (a sample one is already created)
   - **Discount %** — e.g. `10`
   - **Minimum order (₹)** — optional; leave `0` for no minimum
   - **Active** — toggle ON to make it usable
4. Save. Customers enter the code in their **Cart** and the discount applies automatically.

You can deactivate or delete a coupon any time from the same page.

---

## 5. Viewing Your Customers (logins, emails, phones)

1. Admin → **Users**.
2. You'll see every registered user: **ID, Name, Email, Phone, Role** (customer or admin).

> **About passwords:** For everyone's safety, passwords are stored **encrypted** (hashed) and cannot be shown as plain text — this is the security standard for any real store. If a customer is locked out, the right fix is a password reset, not reading their old password. You can always see their **email** here to identify and help them.

---

## 6. Viewing & Managing Orders

1. Admin → **Orders**.
2. Each order shows customer name, phone, address, items, totals, coupon used, and payment method (Cash on Delivery for now).
3. Update an order's **status** (Placed → Packed → Out for delivery → Delivered) from the dropdown on each order.

---

## 7. Changing the Admin Password

**Easiest way (recommended) — from the website:**

1. Admin → **Settings**.
2. Enter your **current password**, then your **new password** twice.
3. Click **Update password**. It changes instantly — no code editing.

**Alternative — the default in the code:**

If you ever reset the database and want a different *starting* password, open the file
`server/storage.ts` and find this line near the top of the seed section:

```
const ADMIN_DEFAULT_PASSWORD = "1234567"; // change the default admin password here
```

Change `"1234567"` to your preferred password, save the file, and restart the server. (This only affects a fresh database. If your store already has data, use the Settings page method above instead.)

---

## 8. Opening & Running the Code in VS Code (on your computer)

You'll receive a **zip file** of the whole project.

1. Install **Node.js** (LTS version) from https://nodejs.org — this is required to run the site.
2. Unzip the project, then open the folder in **VS Code** (File → Open Folder).
3. Open a terminal in VS Code (Terminal → New Terminal) and run:
   ```
   npm install
   ```
   (this downloads the libraries — do it once)
4. Start the site locally:
   ```
   npm run dev
   ```
5. Open your browser to **http://localhost:5000** — that's your store running on your machine.
   - Storefront: `http://localhost:5000`
   - Admin: `http://localhost:5000/#/admin`

Your data is stored in a file called `data.db` in the project folder. Back it up to keep your products/orders.

---

## 9. Hosting on Your GoDaddy Domain

**Important — read this first.** FarmFreshFarmer is a **full web application** (it has a backend server that handles products, logins, orders, and image uploads). It is **not** a simple set of static HTML pages.

This matters because **GoDaddy's basic "Web Hosting" / cPanel shared plans cannot run this kind of Node.js app.** You need hosting that can run a **Node.js server**. You have two clean paths:

### Path A (Recommended): Use a Node-friendly host + point your GoDaddy domain to it

This keeps your domain at GoDaddy but runs the app on a host built for Node apps. Good, affordable options: **Render**, **Railway**, **Fly.io**, or a **VPS** (e.g. DigitalOcean, Hostinger VPS).

**Steps (example using Render):**

1. Put your project on GitHub (free), or upload it directly — Render supports both.
2. On Render, create a **New Web Service** from your project.
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - Render gives you a temporary address like `https://farmfreshfarmer.onrender.com`. Confirm the site works there.
3. **Point your GoDaddy domain to Render:**
   - In Render: open your service → **Settings → Custom Domains** → add `www.yourdomain.com` (and `yourdomain.com`). Render shows you the DNS records to add.
   - In **GoDaddy:** go to **My Products → your domain → DNS → Manage DNS**, and add the records Render gave you:
     - A **CNAME** record for `www` pointing to your Render address, and
     - the **A record / forwarding** for the root domain as Render instructs.
   - Save. DNS can take from a few minutes up to a few hours to take effect.
4. Once DNS propagates, `https://www.yourdomain.com` shows your store. (Render provides free HTTPS/SSL automatically.)

### Path B: GoDaddy VPS / Server hosting

If you prefer to stay entirely within GoDaddy, buy a **GoDaddy VPS or dedicated server** (not the basic shared plan). Then:

1. Install **Node.js** on the server.
2. Upload the project, run `npm install`, then `npm run build`.
3. Run `npm start` and keep it running with a process manager like **pm2** (`npm i -g pm2`, then `pm2 start "npm start"`).
4. Point your domain's DNS (in GoDaddy DNS settings) to your server's IP via an **A record**, and set up HTTPS (e.g. with a free Let's Encrypt certificate / Caddy / Nginx).

### Quick decision helper

| What you have at GoDaddy | Can it run this app? | What to do |
|---|---|---|
| Basic Web Hosting / cPanel (shared) | ❌ No (static only) | Use **Path A** — keep the domain, host the app on Render/Railway |
| GoDaddy VPS or dedicated server | ✅ Yes | Use **Path B** |
| Only the domain name | — | Use **Path A** |

> Whichever path you choose, the **domain stays yours at GoDaddy** — you're only changing the DNS so it points at wherever the app actually runs. If you'd like, I can walk you through the exact Render + GoDaddy steps once you've bought the domain.

---

## 10. Quick Reference

| Thing | Where |
|---|---|
| Admin login | `/#/admin` |
| Admin email | `admin@farmfreshfarmer.com` |
| Admin password (default) | `1234567` |
| Add / edit products | Admin → Products |
| Set prices & discounts | Admin → Products → edit |
| Coupon codes | Admin → Coupons (sample: `FRESH10`) |
| See customers & emails | Admin → Users |
| See & update orders | Admin → Orders |
| Change admin password | Admin → Settings |
| Run locally | `npm install` then `npm run dev` → http://localhost:5000 |
| Categories | Fruits · Vegetables · Homemade Sweets · Namkeen · Pickles (Veg) · Pickles (Non-Veg) · Millets · Pulses · Spices |

Payments are **Cash on Delivery** for now. When you're ready, online payment (Razorpay/UPI) can be added later.
