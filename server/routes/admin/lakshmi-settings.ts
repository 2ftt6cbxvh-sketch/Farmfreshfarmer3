import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { db } from "../../db";
import { settings, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getJwtSecret } from "../../services/encryption";

export function registerAdminLakshmiRoutes(app: Express) {
  // Middleware to ensure admin access
  async function requireAdminAuth(req: Request, res: Response, next: Function) {
    let userId: number | undefined = (req as any).jwtUser?.userId || req.session?.userId;
    if (!userId) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.cookies?.accessToken || req.cookies?.token);
      if (token) {
        try {
          const jwt = (await import("jsonwebtoken")).default;
          const decoded = jwt.verify(token, getJwtSecret()) as any;
          userId = Number(decoded.userId || decoded.sub);
        } catch {}
      }
    }
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const STAFF_ROLES = ["admin", "manager_admin", "subadmin", "custom_subadmin", "warehouse_admin"];
    if (!user || (!STAFF_ROLES.includes(user.role) && !user.isPrimaryAdmin)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    (req as any).adminUser = user;
    return next();
  }

  /** GET /api/admin/lakshmi/settings — Fetch all Lakshmi AI configuration */
  app.get("/api/admin/lakshmi/settings", requireAdminAuth as any, async (_req: Request, res: Response) => {
    try {
      const allSettings = await storage.settings.all();
      const rawKey = allSettings.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
      
      let maskedKey = "";
      if (rawKey && rawKey.length > 8) {
        maskedKey = `${rawKey.slice(0, 7)}...${rawKey.slice(-4)}`;
      }

      return res.json({
        hasKey: Boolean(rawKey && rawKey.trim().length > 5),
        maskedKey,
        rawKey: rawKey || "",
        model: allSettings.gemini_model || "gemini-2.5-flash",
        temperature: Number(allSettings.gemini_temperature ?? 0.5),
        maxTokens: Number(allSettings.gemini_max_tokens ?? 450),
        customSystemPrompt: allSettings.lakshmi_custom_system_prompt || "",
        enableProductsContext: allSettings.lakshmi_enable_products_context !== "false",
        enableOrdersContext: allSettings.lakshmi_enable_orders_context !== "false",
        enableCartContext: allSettings.lakshmi_enable_cart_context !== "false",
        enableAdsContext: allSettings.lakshmi_enable_ads_context !== "false",
        enableHealthGuide: allSettings.lakshmi_enable_health_guide !== "false",
        enableCreatorBio: allSettings.lakshmi_enable_creator_bio !== "false",
        creatorName: allSettings.creator_name || "Buddaraju Ganesh Sai Varma (Ganesh Varma)",
        creatorBio: allSettings.creator_bio || "",
        creatorPortfolio: allSettings.creator_portfolio || "https://www.ganeshvarma.in/",
      });
    } catch (err: any) {
      console.error("[lakshmi-settings] Error fetching settings:", err?.message || err);
      return res.status(500).json({ error: "Failed to fetch Lakshmi AI settings" });
    }
  });

  /** POST /api/admin/lakshmi/settings — Update Lakshmi AI configuration */
  app.post("/api/admin/lakshmi/settings", requireAdminAuth as any, async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const updates: Record<string, string> = {};

      if (body.gemini_api_key !== undefined) updates.gemini_api_key = String(body.gemini_api_key).trim();
      if (body.gemini_model !== undefined) updates.gemini_model = String(body.gemini_model).trim();
      if (body.gemini_temperature !== undefined) updates.gemini_temperature = String(body.gemini_temperature);
      if (body.gemini_max_tokens !== undefined) updates.gemini_max_tokens = String(body.gemini_max_tokens);
      if (body.lakshmi_custom_system_prompt !== undefined) updates.lakshmi_custom_system_prompt = String(body.lakshmi_custom_system_prompt);
      if (body.lakshmi_enable_products_context !== undefined) updates.lakshmi_enable_products_context = String(Boolean(body.lakshmi_enable_products_context));
      if (body.lakshmi_enable_orders_context !== undefined) updates.lakshmi_enable_orders_context = String(Boolean(body.lakshmi_enable_orders_context));
      if (body.lakshmi_enable_cart_context !== undefined) updates.lakshmi_enable_cart_context = String(Boolean(body.lakshmi_enable_cart_context));
      if (body.lakshmi_enable_ads_context !== undefined) updates.lakshmi_enable_ads_context = String(Boolean(body.lakshmi_enable_ads_context));
      if (body.lakshmi_enable_health_guide !== undefined) updates.lakshmi_enable_health_guide = String(Boolean(body.lakshmi_enable_health_guide));
      if (body.lakshmi_enable_creator_bio !== undefined) updates.lakshmi_enable_creator_bio = String(Boolean(body.lakshmi_enable_creator_bio));
      if (body.creator_name !== undefined) updates.creator_name = String(body.creator_name).trim();
      if (body.creator_bio !== undefined) updates.creator_bio = String(body.creator_bio).trim();

      for (const [k, v] of Object.entries(updates)) {
        await storage.settings.set(k, v);
      }

      return res.json({ success: true, message: "Lakshmi AI settings saved successfully" });
    } catch (err: any) {
      console.error("[lakshmi-settings] Error saving settings:", err?.message || err);
      return res.status(500).json({ error: "Failed to save Lakshmi AI settings" });
    }
  });

  /** POST /api/admin/lakshmi/test-gemini — Test live connection to Google Gemini API */
  app.post("/api/admin/lakshmi/test-gemini", requireAdminAuth as any, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const allSettings = await storage.settings.all();
      const apiKey = req.body?.apiKey || allSettings.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const requestedModel = req.body?.model || allSettings.gemini_model || "gemini-2.5-flash";

      if (!apiKey || !apiKey.trim()) {
        return res.status(400).json({
          success: false,
          error: "No Gemini API Key provided. Please enter your Google AI Studio API key (starts with AIzaSy).",
        });
      }

      const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');

      // Sequence of models to try
      const candidateModels = Array.from(new Set([
        requestedModel,
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
      ])).filter(Boolean);

      let workingModel = "";
      let replyText = "";
      let lastErrorMsg = "";

      for (const mName of candidateModels) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${cleanKey}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const testRes = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": cleanKey,
            },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: "You are Lakshmi AI, the intelligent farm-fresh delivery assistant for FarmFreshFarmer. Respond warmly and concisely in 1-2 sentences." }],
              },
              contents: [{ role: "user", parts: [{ text: "Namaste Lakshmi! Confirm you are active and tell me what you specialize in." }] }],
              generationConfig: { maxOutputTokens: 150, temperature: 0.5 },
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (testRes.ok) {
            const data = await testRes.json();
            const parts = data?.candidates?.[0]?.content?.parts || [];
            const text = parts.map((p: any) => p.text || "").join(" ").trim();
            if (text) {
              replyText = text;
              workingModel = mName;
              break;
            }
          } else {
            const errorData = await testRes.json().catch(() => ({}));
            lastErrorMsg = errorData?.error?.message || `HTTP ${testRes.status} ${testRes.statusText}`;
          }
        } catch (fetchErr: any) {
          lastErrorMsg = fetchErr?.message || String(fetchErr);
        }

        // Also try SDK fallback for this model
        if (!replyText) {
          try {
            const genAI = new GoogleGenerativeAI(cleanKey);
            const model = genAI.getGenerativeModel({
              model: mName,
              generationConfig: { maxOutputTokens: 150, temperature: 0.5 },
            });
            const result = await model.generateContent("Namaste Lakshmi! Confirm you are active and tell me what you specialize in.");
            const response = await result.response;
            const text = response.text();
            if (text && text.trim()) {
              replyText = text.trim();
              workingModel = mName;
              break;
            }
          } catch (sdkErr: any) {
            lastErrorMsg = sdkErr?.message || String(sdkErr);
          }
        }
      }

      const latencyMs = Date.now() - startTime;

      if (!replyText) {
        return res.status(400).json({
          success: false,
          latencyMs,
          error: lastErrorMsg || "Failed to communicate with Google Gemini API. Please check your API key status in Google AI Studio.",
        });
      }

      return res.json({
        success: true,
        model: workingModel,
        latencyMs,
        reply: replyText.replace(/\*\*([^*]+)\*\*/g, "$1").trim(),
        message: `⚡ Google Gemini API (${workingModel}) connection verified in ${latencyMs}ms!`,
      });
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return res.status(400).json({
        success: false,
        latencyMs,
        error: err?.message || "Failed to communicate with Google Gemini API.",
      });
    }
  });
}
