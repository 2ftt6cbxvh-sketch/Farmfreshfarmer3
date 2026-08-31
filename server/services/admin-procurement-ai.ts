/**
 * 🌾 Admin Sourcing & Inventory Intelligence Service
 * ==============================================================================
 * Powered dynamically by Google Gemini AI (No hardcoded responses).
 *
 * Capabilities:
 *   1. Analyzes live customer search trails, 0-result searches, and Lakshmi health inquiries.
 *   2. Cross-references against current catalog stock levels.
 *   3. Synthesizes high-priority crop procurement opportunities with Telugu naming & pricing.
 *   4. Flags high-velocity restock needs and unmet customer demand gaps.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import { products, categories, customerProfiles, guestBehaviorSessions, unmetDemandEvents, settings } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface UnmetDemandItem {
  keyword: string;
  searchCount: number;
  categorySuggestion: string;
  lostRevenuePotential: string;
  sourcingAction: string;
}

export interface RecommendedNewProduct {
  name: string;
  nameTe: string;
  categorySlug: string;
  suggestedPrice: number;
  suggestedUnit: string;
  description: string;
  sourcingReason: string;
  clinicalHealthBenefits: string;
  urgency: "high" | "medium" | "low";
  targetSeason: string;
  suggestedImage: string;
}

export interface RestockAlertItem {
  productId?: number;
  productName: string;
  categorySlug: string;
  currentStock: number;
  demandVelocity: string;
  recommendedRestockQty: number;
  rationale: string;
}

export interface SeasonalGuidanceItem {
  crop: string;
  growingRegion: string;
  peakProcurementWindow: string;
  healthDefenseProfile: string;
}

export interface ProcurementAiResult {
  generatedAt: string;
  modelUsed: string;
  executiveSummary: string;
  unmetDemands: UnmetDemandItem[];
  recommendedNewProducts: RecommendedNewProduct[];
  restockAlerts: RestockAlertItem[];
  seasonalHarvestGuidance: SeasonalGuidanceItem[];
}

// In-memory cache for 5 minutes
let cachedResult: ProcurementAiResult | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateProcurementCache() {
  cachedResult = null;
  lastCacheTime = 0;
}

/** Retrieve Gemini API key from settings or environment */
async function getGeminiApiKey(): Promise<string> {
  try {
    const { storage } = await import("../storage");
    const all = await storage.settings.all();
    const k = (all.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
    if (k.length > 5) return k;
  } catch {}

  try {
    const allSettings = await db.select().from(settings);
    const keySetting = allSettings.find((s) => s.key === "gemini_api_key");
    if (keySetting && keySetting.value && keySetting.value.trim().length > 5) {
      return keySetting.value.trim();
    }
  } catch {}

  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
}

/**
 * Generate Real-time AI Procurement & Demand Intelligence using Gemini
 */
export async function generateProcurementIntelligence(forceRefresh = false): Promise<ProcurementAiResult> {
  const now = Date.now();
  if (!forceRefresh && cachedResult && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedResult;
  }

  // 1. Fetch live catalog
  const allProducts = await db.select().from(products);
  const activeProducts = allProducts.filter((p) => p.active !== false && p.approvalStatus !== "rejected");
  const allCategories = await db.select().from(categories);

  // 2. Fetch live customer + guest behavioral signals & raw unmet search events
  let allProfiles: any[] = [];
  let allGuestSessions: any[] = [];
  let rawUnmetEvents: any[] = [];

  try {
    allProfiles = await db.select().from(customerProfiles);
  } catch (err: any) {
    console.warn("[procurement-ai] customerProfiles fallback:", err?.message);
  }
  try {
    allGuestSessions = await db.select().from(guestBehaviorSessions).orderBy(desc(guestBehaviorSessions.id)).limit(500);
  } catch (err: any) {
    console.warn("[procurement-ai] guestBehaviorSessions fallback:", err?.message);
  }
  try {
    rawUnmetEvents = await db.select().from(unmetDemandEvents).orderBy(desc(unmetDemandEvents.id)).limit(200);
  } catch (err: any) {
    console.warn("[procurement-ai] unmetDemandEvents fallback:", err?.message);
  }

  const allBehaviorRecords = [...allProfiles, ...allGuestSessions];

  const searchCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const healthInquiries: Record<string, number> = {};

  // Aggregate searches from behavior records
  for (const p of allBehaviorRecords) {
    if (!p.behaviorProfile) continue;
    try {
      const data = JSON.parse(p.behaviorProfile);
      if (Array.isArray(data.searchQueries)) {
        for (const q of data.searchQueries) {
          const clean = String(q).trim().toLowerCase();
          if (clean && clean.length > 1) {
            searchCounts[clean] = (searchCounts[clean] || 0) + 1;
          }
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
          if (clean) healthInquiries[clean] = (healthInquiries[clean] || 0) + 1;
        }
      }
    } catch {}
  }

  // Also aggregate directly from live unmetDemandEvents (e.g. watermelon, dragonfruit)
  for (const ev of rawUnmetEvents) {
    if (!ev.query) continue;
    const clean = String(ev.query).trim().toLowerCase();
    if (clean && clean.length > 1) {
      searchCounts[clean] = (searchCounts[clean] || 0) + 1;
    }
  }

  // Identify unmet searches (searches with 0 or weak matches in catalog)
  const unmetSearches: { keyword: string; count: number }[] = [];
  const catalogNames = activeProducts.map((p) => p.name.toLowerCase());

  for (const [kw, count] of Object.entries(searchCounts)) {
    const hasMatch = catalogNames.some((name) => name.includes(kw) || kw.includes(name));
    if (!hasMatch && count >= 1) {
      unmetSearches.push({ keyword: kw, count });
    }
  }

  // Sort unmet searches by count
  unmetSearches.sort((a, b) => b.count - a.count);

  // Find low stock products
  const lowStockItems = activeProducts
    .filter((p) => Number(p.stock) <= Number(p.lowStockThreshold || 10))
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock, category: p.categorySlug }));

  // Month & Season context
  const currentMonthName = new Date().toLocaleString("en-US", { month: "long" });
  const categorySlugs = allCategories.map((c) => c.slug);

  // 3. Build verified real data arrays — NEVER let Gemini invent these
  const verifiedUnmetDemands = unmetSearches.slice(0, 12).map((u) => ({
    keyword: u.keyword,
    searchCount: u.count,
  }));

  const verifiedRestockItems = lowStockItems.slice(0, 8).map((p) => ({
    productId: p.id,
    productName: p.name,
    currentStock: Number(p.stock),
    categorySlug: p.category,
  }));

  // 4. Prepare Gemini API Request
  const geminiKey = await getGeminiApiKey();
  if (!geminiKey) {
    throw new Error("Gemini API key is not configured. Please set your Gemini key in Admin -> Lakshmi AI Settings.");
  }

  const prompt = `
You are the Chief Agricultural Intelligence & Procurement Officer for FarmFreshFarmer, an organic direct-from-farm e-commerce platform operating in Andhra Pradesh & Telangana, India.

Analyze the following REAL-TIME store data and synthesize actionable inventory procurement recommendations.

CURRENT PLATFORM CONTEXT:
- Month / Season: ${currentMonthName} (India Agricultural Calendar)
- Available Categories: ${JSON.stringify(categorySlugs)}
- Existing Catalog Count: ${activeProducts.length} active crops/products
- Sample Catalog Items: ${JSON.stringify(activeProducts.slice(0, 30).map((p) => ({ id: p.id, name: p.name, category: p.categorySlug, price: p.price, stock: p.stock })))}
- Live Customer Search Signals: ${JSON.stringify(Object.entries(searchCounts).slice(0, 25))}
- Live Lakshmi AI Health & Wellness Inquiries: ${JSON.stringify(Object.entries(healthInquiries))}
- Top Visited Categories: ${JSON.stringify(Object.entries(categoryCounts))}

⚠️ STRICT REAL-DATA INTEGRITY RULES (CRITICAL):
1. For "unmetDemands":
   - VERIFIED 0-MATCH SEARCH LIST: ${JSON.stringify(verifiedUnmetDemands)}
   - YOU MUST USE ONLY items from this verified list above. DO NOT INVENT or HALLUCINATE ANY search queries.
   - If the list is empty: return "unmetDemands": []
   - If the list has items: for each item in the verified list, provide categorySuggestion, lostRevenuePotential (e.g. searchCount * ₹250), and recommended sourcingAction.
2. For "restockAlerts":
   - VERIFIED LOW-STOCK CATALOG ITEMS: ${JSON.stringify(verifiedRestockItems)}
   - YOU MUST USE ONLY products from this verified low-stock list. DO NOT INVENT any product names.
   - If the list is empty: return "restockAlerts": []
   - For each item, provide demandVelocity, recommendedRestockQty, and rationale.
3. For "recommendedNewProducts":
   - Suggest 4 to 8 brand-new farm crops or traditional GI-tagged organic products for Andhra Pradesh & Telangana that FarmFreshFarmer should procure and add to the catalog.
   - Each item MUST include:
     * "name": English product name
     * "nameTe": Authentic Telugu script name (e.g. నాటు గులాబీలు, సేంద్రీయ దానిమ్మ, కొండ అల్లం, ఆత్రేయపురం పూతరేకులు)
     * "categorySlug": One of ${JSON.stringify(categorySlugs)}
     * "suggestedPrice": Realistic retail price in INR (number)
     * "suggestedUnit": e.g. "1 Kg", "500 Grams", "250 Grams", "1 Ltr"
     * "description": 1-2 sentence enticing consumer description
     * "sourcingReason": Sourcing rationale based on season & regional farm belts
     * "clinicalHealthBenefits": Medicinal or nutritional benefits
     * "urgency": "high" | "medium" | "low"
     * "targetSeason": Peak harvest window
     * "suggestedImage": Realistic image URL keyword
4. For "seasonalHarvestGuidance":
   - Provide 2 to 4 regional farm harvesting insights for AP / Telangana belts (e.g. Araku Valley, Guntur, East Godavari, Anantapur).
5. For "executiveSummary":
   - 2-3 sentence strategic overview based on actual search trends and seasonal harvest.

OUTPUT FORMAT:
Return ONLY valid JSON matching this structure with NO markdown fences, NO extra text:
{
  "executiveSummary": "...",
  "unmetDemands": [
    {
      "keyword": "exact keyword from verified list",
      "searchCount": 12,
      "categorySuggestion": "...",
      "lostRevenuePotential": "₹4,800",
      "sourcingAction": "..."
    }
  ],
  "recommendedNewProducts": [
    {
      "name": "...",
      "nameTe": "...",
      "categorySlug": "...",
      "suggestedPrice": 120,
      "suggestedUnit": "1 Kg",
      "description": "...",
      "sourcingReason": "...",
      "clinicalHealthBenefits": "...",
      "urgency": "high",
      "targetSeason": "...",
      "suggestedImage": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80"
    }
  ],
  "restockAlerts": [
    {
      "productName": "...",
      "categorySlug": "...",
      "currentStock": 5,
      "demandVelocity": "High (+240% inquiries)",
      "recommendedRestockQty": 50,
      "rationale": "..."
    }
  ],
  "seasonalHarvestGuidance": [
    {
      "crop": "...",
      "growingRegion": "...",
      "peakProcurementWindow": "...",
      "healthDefenseProfile": "..."
    }
  ]
}
`;

  let responseJsonText = "";
  let modelUsed = "gemini-2.5-flash";

  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
  ];

  // 1. Try direct REST API for maximum speed and reliable JSON output
  for (const mName of candidateModels) {
    if (responseJsonText) break;
    try {
      const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const res = await fetch(restUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2500,
            responseMimeType: "application/json",
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const actualPart = parts.find((p: any) => !p.thought && typeof p.text === "string" && p.text.trim().length > 0);
        const text = actualPart?.text?.trim() || parts?.[0]?.text?.trim() || "";
        if (text) {
          responseJsonText = text;
          modelUsed = mName;
          break;
        }
      }
    } catch (e: any) {
      console.warn(`[procurement-ai] REST model ${mName} error:`, e?.message);
    }
  }

  // 2. Fallback to @google/generative-ai SDK if REST failed
  if (!responseJsonText) {
    for (const mName of candidateModels) {
      if (responseJsonText) break;
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: mName,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2500,
          },
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        responseJsonText = response.text();
        if (responseJsonText) {
          modelUsed = mName;
          break;
        }
      } catch (e: any) {
        console.warn(`[procurement-ai] SDK model ${mName} error:`, e?.message);
      }
    }
  }

  if (!responseJsonText) {
    throw new Error("Unable to synthesize procurement intelligence with Gemini AI. Please check your API key.");
  }

  // Clean and parse JSON
  let parsed: any;
  try {
    const cleanJson = responseJsonText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(cleanJson);
  } catch (err: any) {
    console.error("[procurement-ai] Failed to parse Gemini response:", responseJsonText);
    throw new Error("Failed to parse AI procurement response. Please try again.");
  }

  // ── STRICT REAL-DATA ENFORCEMENT ON OUTPUT ──
  // 1. Unmet demands: If DB has 0 unmet searches, force empty array. If DB has unmet searches, ensure only verified keywords are shown.
  let finalUnmetDemands: UnmetDemandItem[] = [];
  if (verifiedUnmetDemands.length > 0) {
    const aiUnmetMap = new Map<string, any>();
    if (Array.isArray(parsed.unmetDemands)) {
      for (const item of parsed.unmetDemands) {
        if (item?.keyword) aiUnmetMap.set(String(item.keyword).toLowerCase().trim(), item);
      }
    }
    finalUnmetDemands = verifiedUnmetDemands.map((v) => {
      const aiMatch = aiUnmetMap.get(v.keyword.toLowerCase().trim());
      return {
        keyword: v.keyword,
        searchCount: v.searchCount,
        categorySuggestion: aiMatch?.categorySuggestion || "Produce",
        lostRevenuePotential: aiMatch?.lostRevenuePotential || `₹${v.searchCount * 250}`,
        sourcingAction: aiMatch?.sourcingAction || `Procure fresh ${v.keyword} directly from local organic farmers to fulfill customer search demand.`,
      };
    });
  }

  // 2. Restock alerts: Only include real low-stock products from DB
  let finalRestockAlerts: RestockAlertItem[] = [];
  if (verifiedRestockItems.length > 0) {
    const aiRestockMap = new Map<string, any>();
    if (Array.isArray(parsed.restockAlerts)) {
      for (const item of parsed.restockAlerts) {
        if (item?.productName) aiRestockMap.set(String(item.productName).toLowerCase().trim(), item);
      }
    }
    finalRestockAlerts = verifiedRestockItems.map((p) => {
      const aiMatch = aiRestockMap.get(p.productName.toLowerCase().trim());
      return {
        productId: p.productId,
        productName: p.productName,
        categorySlug: p.categorySlug || "produce",
        currentStock: p.currentStock,
        demandVelocity: aiMatch?.demandVelocity || "Accelerating Demand",
        recommendedRestockQty: aiMatch?.recommendedRestockQty || 30,
        rationale: aiMatch?.rationale || `Current stock is ${p.currentStock} units. Sourcing re-order required to prevent out-of-stock.`,
      };
    });
  }

  const resultData: ProcurementAiResult = {
    generatedAt: new Date().toISOString(),
    modelUsed,
    executiveSummary: parsed.executiveSummary || "Real-time demand analysis generated successfully.",
    unmetDemands: finalUnmetDemands,
    recommendedNewProducts: Array.isArray(parsed.recommendedNewProducts) ? parsed.recommendedNewProducts : [],
    restockAlerts: finalRestockAlerts,
    seasonalHarvestGuidance: Array.isArray(parsed.seasonalHarvestGuidance) ? parsed.seasonalHarvestGuidance : [],
  };

  // Cache result
  cachedResult = resultData;
  lastCacheTime = Date.now();

  return resultData;
}
