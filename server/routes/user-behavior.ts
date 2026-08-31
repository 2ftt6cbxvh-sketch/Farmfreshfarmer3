/**
 * 🔒 Secure Customer & Guest Behavioral Intelligence Route
 * ==============================================================================
 * Security Invariants:
 *   - Strictly isolated to the authenticated user or anonymous guest session ID.
 *   - Non-logged-in (Guest) visitors are tracked anonymously via guest_behavior_sessions.
 *   - Input sanitized and bounded (Max 50 product IDs, 20 categories, 20 clean searches).
 *   - Aggregated in real-time for Super Admin Behavioral Analytics & AI Sourcing Intelligence.
 */

import type { Express, Request, Response } from "express";
import { db } from "../db";
import { customerProfiles, guestBehaviorSessions, unmetDemandEvents, users } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { getJwtSecret } from "../services/encryption";
import { createHash, randomBytes } from "crypto";

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
   * POST /api/user/behavior/track — Update logged-in user or anonymous guest behavioral trail
   */
  app.post("/api/user/behavior/track", async (req: Request, res: Response) => {
    try {
      const userId = await resolveAuthUser(req);
      const { sessionId, viewedProductIds, viewedCategories, searchQueries, aiInquiryTopics } = req.body || {};

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

      // ── 1. Authenticated User Flow ──
      if (userId) {
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

        return res.json({ ok: true, type: "user" });
      }

      // ── 2. Anonymous Guest Visitor Flow ──
      const guestSid = String(
        sessionId ||
        req.headers["x-guest-session-id"] ||
        `gst_${randomBytes(12).toString("hex")}`
      ).slice(0, 128);

      const ipHash = createHash("sha256").update(req.ip || "unknown").digest("hex").slice(0, 32);

      const [existingGuest] = await db
        .select()
        .from(guestBehaviorSessions)
        .where(eq(guestBehaviorSessions.sessionId, guestSid))
        .limit(1);

      let guestBehavior: any = {};
      if (existingGuest?.behaviorProfile) {
        try {
          guestBehavior = JSON.parse(existingGuest.behaviorProfile);
        } catch {}
      }

      const mergedGuestBehavior = {
        viewedProductIds: safeProductIds || guestBehavior.viewedProductIds || [],
        viewedCategories: safeCategories || guestBehavior.viewedCategories || [],
        searchQueries: safeSearches || guestBehavior.searchQueries || [],
        aiInquiryTopics: safeAiTopics || guestBehavior.aiInquiryTopics || [],
        lastUpdated: new Date().toISOString(),
      };

      const guestJson = JSON.stringify(mergedGuestBehavior);

      if (existingGuest) {
        await db
          .update(guestBehaviorSessions)
          .set({
            behaviorProfile: guestJson,
            updatedAt: new Date(),
          })
          .where(eq(guestBehaviorSessions.sessionId, guestSid));
      } else {
        await db.insert(guestBehaviorSessions).values({
          sessionId: guestSid,
          behaviorProfile: guestJson,
          ipHash,
        });
      }

      return res.json({ ok: true, type: "guest", sessionId: guestSid });
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
   * GET /api/admin/analytics/behavior — Aggregated customer + guest behavioral analytics for Chief Executive Super Admin
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

      const [allProfiles, allGuestSessions] = await Promise.all([
        db.select({
          id: customerProfiles.id,
          userId: customerProfiles.userId,
          behaviorProfile: customerProfiles.behaviorProfile,
          updatedAt: customerProfiles.updatedAt,
        }).from(customerProfiles),
        db.select({
          id: guestBehaviorSessions.id,
          sessionId: guestBehaviorSessions.sessionId,
          behaviorProfile: guestBehaviorSessions.behaviorProfile,
          updatedAt: guestBehaviorSessions.updatedAt,
        }).from(guestBehaviorSessions).orderBy(desc(guestBehaviorSessions.id)).limit(500),
      ]);

      const searchCounts: Record<string, number> = {};
      const categoryCounts: Record<string, number> = {};
      const healthTopicCounts: Record<string, number> = {};
      let totalTrackedProfiles = 0;
      let totalGuestSessions = 0;

      // Process logged in users
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

      // Process guest / non-logged in sessions
      for (const g of allGuestSessions) {
        if (!g.behaviorProfile) continue;
        try {
          const data = JSON.parse(g.behaviorProfile);
          totalGuestSessions++;

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
        .slice(0, 20);

      const topCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      const topHealthTopics = Object.entries(healthTopicCounts)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      return res.json({
        totalTrackedProfiles,
        totalGuestSessions,
        totalCombinedVisitors: totalTrackedProfiles + totalGuestSessions,
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

  /**
   * POST /api/user/behavior/unmet-search — Fast live tracking for zero-result product searches
   */
  app.post("/api/user/behavior/unmet-search", async (req: Request, res: Response) => {
    try {
      const userId = await resolveAuthUser(req);
      const { query, sessionId, city, pincode, resultCount } = req.body || {};

      if (!query || typeof query !== "string" || query.trim().length < 2) {
        return res.status(400).json({ message: "Invalid query" });
      }

      const cleanQuery = query.trim().replace(/<[^>]*>?/gm, "").slice(0, 255);
      const safeSid = String(sessionId || `gst_${randomBytes(8).toString("hex")}`).slice(0, 128);
      const safeCity = String(city || "Visakhapatnam").slice(0, 128);
      const safePincode = pincode ? String(pincode).slice(0, 32) : null;
      const countVal = Number(resultCount) || 0;

      // 1. Record directly into unmet_demand_events for sub-millisecond Vishnu AI streaming
      try {
        await db.insert(unmetDemandEvents).values({
          query: cleanQuery,
          sessionId: safeSid,
          userId: userId || null,
          city: safeCity,
          pincode: safePincode,
          resultCount: countVal,
        });
      } catch (insertErr: any) {
        console.warn("[unmet-search] Insert event fallback:", insertErr?.message);
      }

      // 2. Invalidate AI Procurement cached recommendations so next fetch is instant & fresh
      try {
        const { invalidateProcurementCache } = await import("../services/admin-procurement-ai");
        invalidateProcurementCache();
      } catch {}

      return res.json({ ok: true, query: cleanQuery, recordedAt: new Date().toISOString() });
    } catch (err: any) {
      console.error("[unmet-search] Error recording unmet search:", err?.message);
      return res.status(500).json({ message: "Failed to record search" });
    }
  });

  /**
   * GET /api/admin/demand/live-unmet-stream — Real-time live feed of zero-inventory searches for Vishnu AI & Admin Radar
   */
  app.get("/api/admin/demand/live-unmet-stream", async (req: Request, res: Response) => {
    try {
      const userId = await resolveAuthUser(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const [adminUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!adminUser || (adminUser.role !== "admin" && !adminUser.isPrimaryAdmin)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      let events: any[] = [];
      try {
        events = await db
          .select()
          .from(unmetDemandEvents)
          .orderBy(desc(unmetDemandEvents.id))
          .limit(50);
      } catch (e: any) {
        console.warn("[live-unmet-stream] Query fallback:", e?.message);
      }

      return res.json({
        totalRecent: events.length,
        events: events.map((e) => ({
          id: e.id,
          query: e.query,
          sessionId: e.sessionId,
          userId: e.userId,
          city: e.city || "Visakhapatnam",
          pincode: e.pincode,
          resultCount: e.resultCount || 0,
          createdAt: e.createdAt,
        })),
        fetchedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[live-unmet-stream] Fetch error:", err?.message);
      return res.status(500).json({ message: "Failed to fetch live unmet stream" });
    }
  });
}
