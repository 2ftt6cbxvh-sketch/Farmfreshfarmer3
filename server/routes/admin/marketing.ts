import type { Express, Request, Response } from "express";
import { db } from "../../db";
import { users, emailCampaigns, coupons } from "@shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { sendRealEmail } from "../../services/email";
import {
  getPendingAbandonedCarts,
  triggerCartRecoveryEmail,
  createOneTimeCoupon,
  buildSignupTermsEmailHtml,
} from "../../services/campaigns";

export function registerAdminMarketingRoutes(app: Express) {
  // Middleware: require admin
  async function requireAdmin(req: Request, res: Response, next: Function) {
    let userId: number | undefined = (req as any).jwtUser?.userId || req.session?.userId;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.accessToken;
    if (token) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any;
        userId = Number(decoded.userId || decoded.sub);
      } catch {}
    }
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || (user.role === "customer" && !user.isPrimaryAdmin)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    (req as any).currentUser = user;
    return (next as any)();
  }

  /** GET /api/admin/marketing/abandoned-carts — List abandoned carts */
  app.get("/api/admin/marketing/abandoned-carts", requireAdmin as any, async (_req: Request, res: Response) => {
    try {
      const carts = await getPendingAbandonedCarts();
      return res.json({ carts });
    } catch (err: any) {
      console.error("[abandoned-carts list error]", err);
      return res.status(500).json({ message: err?.message || "Failed to fetch abandoned carts" });
    }
  });

  /** POST /api/admin/marketing/abandoned-carts/send-recovery — Send 10% 1-time recovery coupon */
  app.post("/api/admin/marketing/abandoned-carts/send-recovery", requireAdmin as any, async (req: Request, res: Response) => {
    const { userId, customerName, customerEmail, items, cartTotal } = req.body || {};
    if (!userId || !customerEmail) {
      return res.status(400).json({ message: "User ID and Email are required." });
    }

    try {
      const result = await triggerCartRecoveryEmail({
        userId: Number(userId),
        customerName: customerName || "Valued Customer",
        customerEmail,
        items: items || [],
        cartTotal: Number(cartTotal) || 0,
      });

      return res.json({
        success: true,
        message: `10% One-Time Recovery Coupon (${result.couponCode}) dispatched to ${customerEmail}!`,
        couponCode: result.couponCode,
      });
    } catch (err: any) {
      console.error("[send-recovery error]", err);
      return res.status(500).json({ message: err?.message || "Failed to dispatch recovery email" });
    }
  });

  /** POST /api/admin/marketing/coupons/create-secure — Generate 1-time secure unforgeable coupon */
  app.post("/api/admin/marketing/coupons/create-secure", requireAdmin as any, async (req: Request, res: Response) => {
    const {
      discountPercent,
      prefix = "RCV10",
      minOrder = 0,
      restrictedUserId,
      restrictedEmail,
      expiresInHours = 48,
      campaignCategory = "custom_promotional",
    } = req.body || {};

    if (!discountPercent || Number(discountPercent) <= 0 || Number(discountPercent) > 100) {
      return res.status(400).json({ message: "Valid discount percentage between 1 and 100 is required." });
    }

    try {
      const coupon = await createOneTimeCoupon({
        discountPercent: Number(discountPercent),
        prefix,
        minOrder: Number(minOrder) || 0,
        restrictedUserId: restrictedUserId ? Number(restrictedUserId) : null,
        restrictedEmail: restrictedEmail || null,
        expiresInHours: Number(expiresInHours) || 48,
        campaignCategory,
      });

      return res.json({
        success: true,
        message: `1-Time Cryptographic Coupon ${coupon.code} generated successfully!`,
        coupon,
      });
    } catch (err: any) {
      console.error("[create-secure-coupon error]", err);
      return res.status(500).json({ message: err?.message || "Failed to generate secure coupon" });
    }
  });

  /** GET /api/admin/marketing/campaigns — List past campaigns */
  app.get("/api/admin/marketing/campaigns", requireAdmin as any, async (_req: Request, res: Response) => {
    try {
      const campaigns = await db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt)).limit(50);
      return res.json({ campaigns });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to list campaigns" });
    }
  });

  /** POST /api/admin/marketing/test-email — Send test copy to Super Admin */
  app.post("/api/admin/marketing/test-email", requireAdmin as any, async (req: Request, res: Response) => {
    const { subject, html } = req.body || {};
    const adminUser = (req as any).currentUser;
    const testTo = adminUser?.email || "admin@farmfreshfarmer.com";

    if (!subject || !html) {
      return res.status(400).json({ message: "Subject and HTML body required." });
    }

    try {
      const sent = await sendRealEmail({
        to: testTo,
        subject: `[TEST PREVIEW] ${subject}`,
        html,
      });

      if (sent) {
        return res.json({ success: true, message: `Test email successfully dispatched to ${testTo}` });
      }
      return res.status(500).json({ message: "Failed to dispatch test email. Check SMTP settings." });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Test dispatch error" });
    }
  });

  /** POST /api/admin/marketing/campaigns/send — Broadcast or segmented campaign dispatch */
  app.post("/api/admin/marketing/campaigns/send", requireAdmin as any, async (req: Request, res: Response) => {
    const {
      title,
      subject,
      category = "promotional",
      targetType = "all", // all | segment | individual
      targetUserId,
      targetEmail,
      contentHtml,
      couponCode,
    } = req.body || {};

    if (!title || !subject || !contentHtml) {
      return res.status(400).json({ message: "Title, Subject, and HTML Content are required." });
    }

    const adminUser = (req as any).currentUser;

    // Resolve Recipient List
    let recipients: Array<{ id: number; email: string; name: string; customerStars?: number }> = [];

    if (targetType === "individual") {
      if (targetEmail) {
        const [u] = await db.select().from(users).where(eq(users.email, targetEmail.toLowerCase().trim())).limit(1);
        recipients = [{ id: u?.id || 0, email: targetEmail, name: u?.name || "Customer" }];
      } else if (targetUserId) {
        const [u] = await db.select().from(users).where(eq(users.id, Number(targetUserId))).limit(1);
        if (u) recipients = [{ id: u.id, email: u.email, name: u.name }];
      }
    } else {
      // Fetch all customer users
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        customerStars: users.customerStars,
      }).from(users).where(eq(users.role, "customer"));
      recipients = allUsers;
    }

    if (recipients.length === 0) {
      return res.status(400).json({ message: "No recipient emails found matching your target selection." });
    }

    // Save Campaign Record
    const [campaign] = await db.insert(emailCampaigns).values({
      title,
      subject,
      category,
      targetType,
      targetUserId: targetUserId ? Number(targetUserId) : null,
      targetEmail: targetEmail || null,
      contentHtml,
      couponCode: couponCode || null,
      totalRecipients: recipients.length,
      sentCount: 0,
      failedCount: 0,
      status: "sending",
      createdById: adminUser?.id,
    }).returning();

    // Asynchronously dispatch in batches of 25 with 1s delay
    (async () => {
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < recipients.length; i += 25) {
        const chunk = recipients.slice(i, i + 25);
        await Promise.all(
          chunk.map(async (r) => {
            try {
              const personalizedHtml = contentHtml
                .replace(/\{\{name\}\}/gi, r.name || "Valued Customer")
                .replace(/\{\{email\}\}/gi, r.email)
                .replace(/\{\{coupon_code\}\}/gi, couponCode || "")
                .replace(/\{\{star_tier\}\}/gi, `${r.customerStars || 0}-Star Tier`);

              const sent = await sendRealEmail({
                to: r.email,
                subject,
                html: personalizedHtml,
              });
              if (sent) sentCount++;
              else failedCount++;
            } catch {
              failedCount++;
            }
          })
        );
        // Rate limit pause between chunks
        if (i + 25 < recipients.length) {
          await new Promise((res) => setTimeout(res, 1000));
        }
      }

      // Update final status
      await db.update(emailCampaigns).set({
        sentCount,
        failedCount,
        status: "completed",
      }).where(eq(emailCampaigns.id, campaign.id)).catch(() => {});
    })().catch((err) => console.error("[broadcast dispatch background error]", err));

    return res.json({
      success: true,
      message: `Campaign "${title}" queued for delivery to ${recipients.length} customer(s)!`,
      campaignId: campaign.id,
    });
  });
}
