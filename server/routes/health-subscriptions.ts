/**
 * Subhiksha Family Health Subscription Routes
 * ===========================================
 * Curated Andhra/Telangana regional health boxes:
 * - Diabetic Care & Metabolic Health Box (₹599)
 * - Immunity & Monsoon Cold Defense Box (₹499)
 * - Andhra Heritage Pickles & Pure Ghee Sweets Club (₹799)
 */

import type { Express, Request, Response } from "express";
import { db } from "../db";
import { healthSubscriptions, users } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const SUBHIKSHA_PLANS = [
  {
    id: "diabetic_care",
    title: "Diabetic Care & Metabolic Balance Box",
    teluguTitle: "మధుమేహం రక్షణ బుట్ట (Diabetic Care)",
    tagline: "Low GI, Fiber-Dense Native Andhra Farm Harvest",
    price: 599,
    badge: "Doctor & Nutritionist Recommended",
    icon: "HeartPulse",
    accentColor: "emerald",
    contents: [
      "Organic Bitter Gourd (కాకరకాయ) - 500g",
      "Farm-Fresh Country Green Brinjal (వంకాయ) - 500g",
      "Fresh Andhra Palakura / Spinach (పాలకూర) - 2 Crisp Bundles",
      "Native Foxtail Millet / Korralu (కొర్రలు) - 1 kg",
      "Organic Finger Millet / Ragi (రాగులు) - 1 kg",
      "Crisp Tindora / Dondakaya (దొండకాయ) - 500g",
    ],
    benefits: [
      "Rich in polypeptide-p and charantin for natural glycemic regulation",
      "Zero polished grains; 100% unpolished stone-ground Andhra millets",
      "Harvested within 6 hours of early morning delivery",
    ],
  },
  {
    id: "immunity_defense",
    title: "Monsoon & Cold Immunity Defense Box",
    teluguTitle: "రోగనిరోధక శక్తి బుట్ట (Immunity Shield)",
    tagline: "Spicy, Pungent & Antimicrobial Farm Essentials",
    price: 499,
    badge: "Ayurvedic Potency",
    icon: "ShieldAlert",
    accentColor: "amber",
    contents: [
      "Country Ginger / Allam (తాజా అల్లం) - 250g",
      "Guntur Farm Green Chillies (పచ్చిమిర్చి) - 250g",
      "Pungent Native Garlic / Vellulli (వెల్లుల్లి) - 250g",
      "Organic Fresh Lemon / Nimmakayalu (నిమ్మకాయలు) - 6 pieces",
      "Cold-Pressed Turmeric Powder (పసుపు) - 200g",
      "Crisp Bitter Gourd (కాకరకాయ) - 500g",
    ],
    benefits: [
      "High natural curcumin and gingerol concentration directly from Godavari delta",
      "Flushes respiratory toxins and boosts seasonal histamine resistance",
      "100% pesticide-free organic certification",
    ],
  },
  {
    id: "andhra_pickles_sweets",
    title: "Andhra Heritage Pickles & Pure Ghee Sweets Club",
    teluguTitle: "ఆంధ్రా సాంప్రదాయ పిండివంటలు & నెయ్యి మిఠాయిలు",
    tagline: "Wood-Pressed Sesame Oil & A2 Cow Ghee Delicacies",
    price: 799,
    badge: "Artisan Grandmothers' Recipe",
    icon: "Sparkles",
    accentColor: "rose",
    contents: [
      "Signature Gongura Pickle / గోంగూర పచ్చడి (Cold-pressed sesame oil) - 300g",
      "Authentic Avakaya Mango Pickle / ఆవకాయ (Guntur chilli) - 300g",
      "Pure Ghee Boondi Laddu / నెయ్యి బూంది లడ్డు (Zero refined sugar) - 400g",
      "Traditional Mysore Pak / మైసూర్ పాక్ (Melt-in-mouth gram flour) - 350g",
      "Crunchy Hand-Rolled Murukku / జంతికలు - 250g",
    ],
    benefits: [
      "Zero chemical preservatives, vinegar, or synthetic colorings",
      "Made exclusively with pure churned cow/buffalo ghee and cold-pressed oils",
      "Slow-crafted by rural women self-help collectives in Anakapalle & Guntur",
    ],
  },
];

export function registerHealthSubscriptionRoutes(app: Express) {
  /**
   * GET /api/subscriptions/plans
   * List available Subhiksha health subscription boxes
   */
  app.get("/api/subscriptions/plans", (_req: Request, res: Response) => {
    return res.json({
      success: true,
      plans: SUBHIKSHA_PLANS,
      deliveryDays: ["Wednesday", "Saturday"],
      frequencies: ["weekly", "bi-weekly", "monthly"],
    });
  });

  /**
   * GET /api/subscriptions/mine
   * Fetch current authenticated user's subscriptions
   */
  app.get("/api/subscriptions/mine", async (req: Request, res: Response) => {
    const userId = (req as any).jwtUser?.userId || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const subs = await db
        .select()
        .from(healthSubscriptions)
        .where(eq(healthSubscriptions.userId, userId))
        .orderBy(desc(healthSubscriptions.createdAt));

      return res.json({ success: true, subscriptions: subs });
    } catch (err: any) {
      console.error("[health-subscriptions] Error fetching user subscriptions:", err.message);
      return res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  /**
   * POST /api/subscriptions/subscribe
   * Create a new Subhiksha health subscription
   */
  app.post("/api/subscriptions/subscribe", async (req: Request, res: Response) => {
    const userId = (req as any).jwtUser?.userId || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Please sign in to subscribe" });
    }

    const { planType, frequency = "bi-weekly", deliveryDay = "Saturday", address, phone } = req.body || {};

    const plan = SUBHIKSHA_PLANS.find((p) => p.id === planType);
    if (!plan) {
      return res.status(400).json({ message: "Invalid subscription plan selected" });
    }

    if (!address || !phone) {
      return res.status(400).json({ message: "Delivery address and contact phone are required" });
    }

    // Calculate next delivery date (next upcoming deliveryDay)
    const now = new Date();
    const targetDayIndex = deliveryDay === "Wednesday" ? 3 : 6; // 3 = Wed, 6 = Sat
    const currentDayIndex = now.getDay();
    let daysUntil = (targetDayIndex - currentDayIndex + 7) % 7;
    if (daysUntil === 0) daysUntil = 7; // Deliver next week's slot if today

    const nextDelivery = new Date(now.getTime() + daysUntil * 24 * 60 * 60 * 1000);
    nextDelivery.setHours(7, 30, 0, 0); // 7:30 AM Morning Dew dispatch

    try {
      const [newSub] = await db
        .insert(healthSubscriptions)
        .values({
          userId,
          planType,
          frequency,
          deliveryDay,
          price: String(plan.price),
          status: "active",
          nextDeliveryDate: nextDelivery,
          address,
          phone,
        })
        .returning();

      return res.status(201).json({
        success: true,
        message: `Subscribed successfully to ${plan.title}! Your first box is scheduled for ${deliveryDay}, ${nextDelivery.toLocaleDateString("en-IN")}.`,
        subscription: newSub,
      });
    } catch (err: any) {
      console.error("[health-subscriptions] Subscription creation failed:", err.message);
      return res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  /**
   * PATCH /api/subscriptions/:id/status
   * Toggle pause, resume, or cancel
   */
  app.patch("/api/subscriptions/:id/status", async (req: Request, res: Response) => {
    const userId = (req as any).jwtUser?.userId || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const subId = Number(req.params.id);
    const { status } = req.body || {};

    if (!["active", "paused", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    try {
      const [existing] = await db
        .select()
        .from(healthSubscriptions)
        .where(eq(healthSubscriptions.id, subId))
        .limit(1);

      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      const [updated] = await db
        .update(healthSubscriptions)
        .set({ status })
        .where(eq(healthSubscriptions.id, subId))
        .returning();

      return res.json({
        success: true,
        message: `Subscription has been ${status === "active" ? "resumed" : status === "paused" ? "paused" : "cancelled"}.`,
        subscription: updated,
      });
    } catch (err: any) {
      console.error("[health-subscriptions] Status update failed:", err.message);
      return res.status(500).json({ error: "Failed to update subscription status" });
    }
  });
}
