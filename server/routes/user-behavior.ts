/**
 * 🔒 Secure Customer Behavioral Intelligence Route
 * ==============================================================================
 * Security Invariants:
 *   - Strictly isolated to the authenticated user (Zero cross-user data leakage)
 *   - Public / Unauthenticated callers receive 401 Unauthorized
 *   - Input sanitized and bounded (Max 50 product IDs, 20 categories, 20 clean searches)
 *   - Compact JSON rolling window in customer_profiles table (< 4 KB per user)
 */

import type { Express, Request, Response } from "express";
import { db } from "../db";
import { customerProfiles, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getJwtSecret } from "../services/encryption";

// Helper to authenticate user via session or Bearer token
async function resolveAuthUser(req: Request): Promise<number | null> {
  let userId: number | undefined = (req as any).jwtUser?.userId || req.session?.userId;
  if (userId) return userId;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const decoded = jwt.verify(token, getJwtSecret()) as any;
      return Number(decoded.userId || decoded.sub) || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function registerUserBehaviorRoutes(app: Express) {
  /**
   * POST /api/user/behavior/track — Update authenticated user's private rolling behavioral trail
   */
  app.post("/api/user/behavior/track", async (req: Request, res: Response) => {
    try {
      const userId = await resolveAuthUser(req);
      if (!userId) {
        // Guests store behavior exclusively in client-side RAM (0ms privacy preservation)
        return res.status(200).json({ ok: true, guest: true });
      }

      const { viewedProductIds, viewedCategories, searchQueries, aiInquiryTopics } = req.body || {};

      // Sanitize inputs
      const safeProductIds = Array.isArray(viewedProductIds)
        ? viewedProductIds.filter((id) => typeof id === "number" && id > 0).slice(0, 50)
        : undefined;

      const safeCategories = Array.isArray(viewedCategories)
        ? viewedCategories.filter((c) => typeof c === "string" && c.length <= 64).map((c) => c.slice(0, 64)).slice(0, 20)
        : undefined;

      const safeSearches = Array.isArray(searchQueries)
        ? searchQueries
            .filter((s) => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim().replace(/<[^>]*>?/gm, "").slice(0, 64))
            .slice(0, 20)
        : undefined;

      const safeAiTopics = Array.isArray(aiInquiryTopics)
        ? aiInquiryTopics
            .filter((t) => typeof t === "string" && t.length <= 32)
            .map((t) => t.slice(0, 32))
            .slice(0, 20)
        : undefined;

      // Find or create customer profile
      const [profile] = await db
        .select()
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, userId))
        .limit(1);

      let currentBehavior: any = {};
      if (profile?.behaviorProfile) {
        try {
          currentBehavior = JSON.parse(profile.behaviorProfile);
        } catch {}
      }

      const mergedBehavior = {
        viewedProductIds: safeProductIds || currentBehavior.viewedProductIds || [],
        viewedCategories: safeCategories || currentBehavior.viewedCategories || [],
        searchQueries: safeSearches || currentBehavior.searchQueries || [],
        aiInquiryTopics: safeAiTopics || currentBehavior.aiInquiryTopics || [],
        lastUpdated: new Date().toISOString(),
      };

      const jsonString = JSON.stringify(mergedBehavior);

      if (profile) {
        await db
          .update(customerProfiles)
          .set({
            behaviorProfile: jsonString,
            updatedAt: new Date(),
          })
          .where(eq(customerProfiles.userId, userId));
      } else {
        await db.insert(customerProfiles).values({
          userId,
          behaviorProfile: jsonString,
        });
      }

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("[user-behavior] Tracking error:", err?.message);
      return res.status(500).json({ message: "Failed to record behavior" });
    }
  });

  /**
   * GET /api/user/behavior/profile — Fetch private behavioral trail for the authenticated user only
   */
  app.get("/api/user/behavior/profile", async (req: Request, res: Response) => {
    try {
      const userId = await resolveAuthUser(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const [profile] = await db
        .select({
          behaviorProfile: customerProfiles.behaviorProfile,
        })
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, userId))
        .limit(1);

      if (!profile || !profile.behaviorProfile) {
        return res.json({ profile: null });
      }

      const parsed = JSON.parse(profile.behaviorProfile);
      return res.json({ profile: parsed });
    } catch (err: any) {
      console.error("[user-behavior] Fetch error:", err?.message);
      return res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  /**
   * GET /api/admin/analytics/behavior — Aggregated customer behavioral analytics for Chief Executive Super Admin
   */
  app.get("/api/admin/analytics/behavior", async (req: Request, res: Response) => {
    try {
      const userId = await resolveAuthUser(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify Super Admin access
      const [adminUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const isSuper = Boolean(
        adminUser?.isPrimaryAdmin === true ||
        adminUser?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
        adminUser?.id === 1
      );
      if (!isSuper) {
        return res.status(403).json({ message: "⛔ Chief Executive Super Admin access required" });
      }

      const allProfiles = await db
        .select({
          id: customerProfiles.id,
          userId: customerProfiles.userId,
          behaviorProfile: customerProfiles.behaviorProfile,
          updatedAt: customerProfiles.updatedAt,
        })
        .from(customerProfiles);

      const searchCounts: Record<string, number> = {};
      const categoryCounts: Record<string, number> = {};
      const healthTopicCounts: Record<string, number> = {};
      let totalTrackedProfiles = 0;

      for (const p of allProfiles) {
        if (!p.behaviorProfile) continue;
        try {
          const data = JSON.parse(p.behaviorProfile);
          totalTrackedProfiles++;

          if (Array.isArray(data.searchQueries)) {
            for (const q of data.searchQueries) {
              const clean = String(q).trim().toLowerCase();
              if (clean) searchCounts[clean] = (searchCounts[clean] || 0) + 1;
            }
          }

          if (Array.isArray(data.viewedCategories)) {
            for (const c of data.viewedCategories) {
              const clean = String(c).trim().toLowerCase();
              if (clean) categoryCounts[clean] = (categoryCounts[clean] || 0) + 1;
            }
          }

          if (Array.isArray(data.aiInquiryTopics)) {
            for (const t of data.aiInquiryTopics) {
              const clean = String(t).trim().toLowerCase();
              if (clean) healthTopicCounts[clean] = (healthTopicCounts[clean] || 0) + 1;
            }
          }
        } catch {}
      }

      // Sort and extract top items
      const topSearches = Object.entries(searchCounts)
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      const topCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const topHealthTopics = Object.entries(healthTopicCounts)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return res.json({
        totalTrackedProfiles,
        topSearches,
        topCategories,
        topHealthTopics,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[user-behavior] Analytics error:", err?.message);
      return res.status(500).json({ message: "Failed to generate behavior analytics" });
    }
  });
}
