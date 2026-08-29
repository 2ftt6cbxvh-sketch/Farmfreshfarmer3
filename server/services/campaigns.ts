/**
 * FarmFreshFarmer Email Marketing & Secure Coupon Engine
 * Features:
 *   1. Cryptographically Secure Unforgeable 1-Time Coupon Generation
 *   2. 10% Abandoned Cart Recovery Automation
 *   3. Broadcast & Segmented Promotional Email Engine
 *   4. First-Time Signup Terms & Conditions Automated Email
 *   5. Emergency Security & Legal Policy Revision Broadcasts
 */
import { randomBytes } from "crypto";
import { db } from "../db";
import { coupons, emailCampaigns, users, carts, cartItems, products, orders } from "@shared/schema";
import { eq, and, gt, sql, desc, isNull, inArray } from "drizzle-orm";
import { sendRealEmail } from "./email";

/** Generate an unbreachable cryptographically random unique coupon code */
export function generateSecureCouponCode(prefix = "RCV10"): string {
  const entropy = randomBytes(6).toString("hex").toUpperCase();
  const part1 = entropy.slice(0, 4);
  const part2 = entropy.slice(4, 8);
  return `${prefix.toUpperCase()}-${part1}-${part2}`;
}

/** Create a secure one-time single-use coupon in database */
export async function createOneTimeCoupon(params: {
  discountPercent: number;
  prefix?: string;
  minOrder?: number;
  restrictedUserId?: number | null;
  restrictedEmail?: string | null;
  expiresInHours?: number;
  campaignCategory?: string;
}) {
  const {
    discountPercent,
    prefix = "RCV10",
    minOrder = 0,
    restrictedUserId = null,
    restrictedEmail = null,
    expiresInHours = 48,
    campaignCategory = "abandoned_cart_recovery",
  } = params;

  let code = generateSecureCouponCode(prefix);
  // Ensure code collision avoidance
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    if (!existing) break;
    code = generateSecureCouponCode(prefix);
  }

  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null;

  const [coupon] = await db.insert(coupons).values({
    code,
    discountPercent: String(discountPercent),
    active: true,
    minOrder: String(minOrder),
    maxUses: 1,
    usedCount: 0,
    isOneTime: true,
    restrictedUserId,
    restrictedEmail: restrictedEmail ? restrictedEmail.toLowerCase().trim() : null,
    expiresAt,
    campaignCategory,
  }).returning();

  return coupon;
}

/** Helper: Generate Abandoned Cart Recovery Email HTML */
export function buildAbandonedCartEmailHtml(params: {
  customerName: string;
  couponCode: string;
  discountPercent: number;
  items: Array<{ name: string; price: number; qty: number; image?: string }>;
  cartTotal: number;
  expiresInHours?: number;
}): string {
  const {
    customerName,
    couponCode,
    discountPercent,
    items,
    cartTotal,
    expiresInHours = 48,
  } = params;

  const itemsHtml = items.map((item) => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width: 48px; vertical-align: middle;">
              ${item.image ? `<img src="${item.image.startsWith('http') ? item.image : `https://farmfreshfarmer.com${item.image}`}" width="44" height="44" style="border-radius: 8px; object-fit: cover; border: 1px solid #e2e8f0;" alt="${item.name}" />` : `<div style="width:44px; height:44px; background:#f1f5f9; border-radius:8px; text-align:center; line-height:44px; font-size:18px;">🌿</div>`}
            </td>
            <td style="padding-left: 12px; vertical-align: middle;">
              <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${item.name}</div>
              <div style="font-size: 11px; color: #64748b;">Qty: ${item.qty} × ₹${item.price}</div>
            </td>
            <td align="right" style="vertical-align: middle; font-weight: 700; font-size: 13px; color: #15803d;">
              ₹${item.price * item.qty}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  const directCartUrl = `https://farmfreshfarmer.com/cart?coupon=${encodeURIComponent(couponCode)}`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Fresh Harvest is Waiting + 10% OFF</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <span style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        You left fresh items in your cart! Here is an exclusive 10% OFF voucher (${couponCode}) to complete your order today.
      </span>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #0d3820 0%, #15803d 100%); padding: 32px 24px; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff;">🌿 FarmFreshFarmer</h1>
                  <p style="margin: 6px 0 0; font-size: 12px; color: #bbf7d0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Special Harvest Reward</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 30px 28px;">
                  <h2 style="margin: 0 0 12px; font-size: 19px; color: #0f172a; font-weight: 800;">Namaste ${customerName}, you left something fresh behind! 🛒</h2>
                  <p style="margin: 0 0 18px; font-size: 14px; color: #475569; line-height: 1.6;">
                    We saved the organic produce in your cart so you won't miss out on today's morning harvest. To make your day even sweeter, here is an <strong>exclusive ${discountPercent}% OFF one-time discount code</strong> reserved just for you:
                  </p>

                  <!-- 1-Time Secure Coupon Badge Card -->
                  <div style="background-color: #f0fdf4; border: 2px dashed #22c55e; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0;">
                    <div style="font-size: 11px; font-weight: 800; color: #15803d; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
                      🎁 Your Exclusive Single-Use Coupon Code
                    </div>
                    <div style="font-family: 'Courier New', monospace; font-size: 28px; font-weight: 800; letter-spacing: 4px; color: #166534; padding: 6px 0;">
                      ${couponCode}
                    </div>
                    <div style="font-size: 12px; color: #15803d; font-weight: 700; margin-top: 4px;">
                      ✨ ${discountPercent}% Extra Discount · Valid for ${expiresInHours} Hours Only
                    </div>
                  </div>

                  <!-- Cart Items Preview -->
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 24px;">
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                      🧺 Items in Your Reserved Basket:
                    </div>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      ${itemsHtml}
                      <tr>
                        <td colspan="2" style="padding-top: 12px; font-weight: 700; font-size: 13px; color: #475569;">Cart Subtotal:</td>
                        <td align="right" style="padding-top: 12px; font-weight: 800; font-size: 15px; color: #0f172a;">₹${cartTotal}</td>
                      </tr>
                    </table>
                  </div>

                  <!-- Direct 1-Click Action Button -->
                  <div style="text-align: center; margin: 28px 0;">
                    <a href="${directCartUrl}" style="background: linear-gradient(135deg, #15803d 0%, #16a34a 100%); color: #ffffff; font-size: 16px; font-weight: 800; text-decoration: none; padding: 16px 36px; border-radius: 14px; display: inline-block; box-shadow: 0 6px 18px rgba(22,163,74,0.35);">
                      ⚡ Claim 10% OFF &amp; Complete Order
                    </a>
                  </div>

                  <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
                    🚀 30–90 Mins Express Farm-to-Door Delivery in Vijayawada &amp; Vizag.<br/>
                    100% Chemical-Free · Fresh Daily Morning Harvest.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                  <p style="margin: 0 0 4px;">Sent exclusively to you by FarmFreshFarmer · <a href="https://farmfreshfarmer.com" style="color: #16a34a; text-decoration: none;">farmfreshfarmer.com</a></p>
                  <p style="margin: 0;">© ${new Date().getFullYear()} FarmFreshFarmer. All rights reserved.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/** Helper: Generate Signup Welcome + Terms & Conditions Summary Email */
export function buildSignupTermsEmailHtml(name: string, email: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to FarmFreshFarmer + Important Terms & Conditions</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <span style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        Welcome to FarmFreshFarmer! Review our simple terms of service, freshness guarantee, and fast delivery policy.
      </span>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #0d3820 0%, #15803d 100%); padding: 34px 24px; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff;">🌿 FarmFreshFarmer</h1>
                  <p style="margin: 6px 0 0; font-size: 12px; color: #bbf7d0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Welcome &amp; Customer Rights Policy</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px 28px;">
                  <h2 style="margin: 0 0 12px; font-size: 19px; color: #0f172a; font-weight: 800;">Namaste ${name}! 🙏</h2>
                  <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6;">
                    Thank you for joining <strong>FarmFreshFarmer</strong> — connecting local organic cultivators directly with your kitchen.
                  </p>

                  <!-- Terms & Conditions Summary Box -->
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                      📜 Summary of Terms, Quality Guarantee &amp; Policies:
                    </div>
                    
                    <div style="margin-bottom: 10px; font-size: 12px; color: #334155; line-height: 1.5;">
                      🌱 <strong>1. 100% Chemical-Free Guarantee:</strong> All fruits, veggies, sun-dried spices, and homemade Andhra pickles are sourced directly from verified natural farmers.
                    </div>

                    <div style="margin-bottom: 10px; font-size: 12px; color: #334155; line-height: 1.5;">
                      ⚡ <strong>2. Express Delivery (30–90 Mins):</strong> Local orders in Vijayawada &amp; Vizag are dispatched from our micro-hubs within minutes of harvest arrival.
                    </div>

                    <div style="margin-bottom: 10px; font-size: 12px; color: #334155; line-height: 1.5;">
                      🛡️ <strong>3. 2-Hour Doorstep Return &amp; Refund:</strong> If any perishable item arrives bruised or unsatisfactory, report via Live Chat or phone within 2 hours for instant full refund.
                    </div>

                    <div style="margin-bottom: 10px; font-size: 12px; color: #334155; line-height: 1.5;">
                      🔒 <strong>4. Data Privacy Safeguard:</strong> Your phone, address, and order records are cryptographically protected under the Digital Personal Data Protection (DPDP) Act 2023. We never sell your personal information.
                    </div>

                    <div style="font-size: 12px; color: #334155; line-height: 1.5;">
                      ⭐ <strong>5. Star Loyalty Rewards:</strong> Every completed order earns experience towards permanent VIP Star discounts (up to 15% site-wide).
                    </div>
                  </div>

                  <!-- Quick Policy Links -->
                  <div style="text-align: center; margin: 20px 0;">
                    <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; font-size: 11px; font-weight: 700;">
                      <tr>
                        <td style="padding: 0 8px;"><a href="https://farmfreshfarmer.com/terms" style="color: #16a34a; text-decoration: underline;">Full Terms &amp; Conditions</a></td>
                        <td style="color: #cbd5e1;">•</td>
                        <td style="padding: 0 8px;"><a href="https://farmfreshfarmer.com/privacy" style="color: #16a34a; text-decoration: underline;">Privacy Policy</a></td>
                        <td style="color: #cbd5e1;">•</td>
                        <td style="padding: 0 8px;"><a href="https://farmfreshfarmer.com/refund" style="color: #16a34a; text-decoration: underline;">Refund Policy</a></td>
                      </tr>
                    </table>
                  </div>

                  <!-- Start Shopping CTA -->
                  <div style="text-align: center; margin: 24px 0 16px;">
                    <a href="https://farmfreshfarmer.com" style="background: linear-gradient(135deg, #15803d 0%, #16a34a 100%); color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 14px rgba(22,163,74,0.35);">
                      🛒 Start Exploring Today's Fresh Harvest
                    </a>
                  </div>

                  <!-- Support Details -->
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px; font-size: 11px; color: #166534;">
                    <strong>Need assistance with your orders?</strong><br/>
                    • 📧 Email: <a href="mailto:admin@farmfreshfarmer.com" style="color: #15803d; font-weight: 700;">admin@farmfreshfarmer.com</a><br/>
                    • 📞 Helpline &amp; WhatsApp: <a href="tel:+917989793669" style="color: #15803d; font-weight: 700;">+91 79897 93669</a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                  <p style="margin: 0 0 4px;">Sent with care by FarmFreshFarmer · <a href="https://farmfreshfarmer.com" style="color: #16a34a; text-decoration: none;">farmfreshfarmer.com</a></p>
                  <p style="margin: 0;">© ${new Date().getFullYear()} FarmFreshFarmer. All rights reserved.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/** Fetch pending carts for recovery */
export async function getPendingAbandonedCarts() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // Find carts with non-empty items updated in last 7 days but older than 1 hour
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const cartRows = await db
    .select({
      cartId: carts.id,
      userId: carts.userId,
      createdAt: carts.createdAt,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
      customerStars: users.customerStars,
      productId: cartItems.productId,
      qty: cartItems.qty,
      productName: products.name,
      productPrice: products.price,
      productImage: products.image,
    })
    .from(carts)
    .innerJoin(users, eq(carts.userId, users.id))
    .innerJoin(cartItems, eq(carts.id, cartItems.cartId))
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(
      and(
        sql`${carts.createdAt} < ${oneHourAgo}`,
        sql`${carts.createdAt} > ${sevenDaysAgo}`
      )
    )
    .orderBy(desc(carts.createdAt))
    .limit(100);

  // Group items by cart
  const cartMap = new Map<number, any>();
  for (const row of cartRows) {
    if (!row.userId) continue;
    if (!cartMap.has(row.cartId)) {
      cartMap.set(row.cartId, {
        cartId: row.cartId,
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail,
        userPhone: row.userPhone,
        customerStars: row.customerStars,
        updatedAt: row.createdAt,
        items: [],
      });
    }
    const cart = cartMap.get(row.cartId);
    cart.items.push({
      productId: row.productId,
      name: row.productName,
      price: Number(row.productPrice) || 0,
      qty: row.qty,
      image: row.productImage,
    });
  }

  return Array.from(cartMap.values());
}

/** Dispatch 10% recovery coupon email for a single abandoned cart */
export async function triggerCartRecoveryEmail(params: {
  userId: number;
  customerName: string;
  customerEmail: string;
  items: Array<{ name: string; price: number; qty: number; image?: string }>;
  cartTotal: number;
}) {
  const { userId, customerName, customerEmail, items, cartTotal } = params;

  // 1. Generate unbreachable 1-time 10% coupon locked to this user and email
  const coupon = await createOneTimeCoupon({
    discountPercent: 10,
    prefix: "RCV10",
    restrictedUserId: userId,
    restrictedEmail: customerEmail,
    expiresInHours: 48,
    campaignCategory: "abandoned_cart_recovery",
  });

  // 2. Build email HTML
  const html = buildAbandonedCartEmailHtml({
    customerName,
    couponCode: coupon.code,
    discountPercent: 10,
    items,
    cartTotal,
    expiresInHours: 48,
  });

  // 3. Dispatch Email
  const sent = await sendRealEmail({
    to: customerEmail,
    subject: `🛒 Special 10% OFF on your reserved Farm-Fresh basket! Code: ${coupon.code}`,
    html,
  });

  // 4. Record Campaign Event
  await db.insert(emailCampaigns).values({
    title: `Cart Recovery 10% — ${customerName}`,
    subject: `🛒 Special 10% OFF on your reserved Farm-Fresh basket!`,
    category: "promotional",
    targetType: "abandoned_cart",
    targetUserId: userId,
    targetEmail: customerEmail,
    couponCode: coupon.code,
    contentHtml: html,
    totalRecipients: 1,
    sentCount: sent ? 1 : 0,
    failedCount: sent ? 0 : 1,
    status: sent ? "completed" : "failed",
  }).catch(() => {});

  return { success: sent, couponCode: coupon.code };
}
