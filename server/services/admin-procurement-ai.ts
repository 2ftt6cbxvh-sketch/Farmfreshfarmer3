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
import { products, categories, customerProfiles, settings } from "@shared/schema";
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

/** Retrieve Gemini API key from settings or environment */
async function getGeminiApiKey(): Promise<string> {
  try {
    const allSettings = await db.select().from(settings);
    const keySetting = allSettings.find((s) => s.key === "gemini_api_key");
    if (keySetting && keySetting.value && keySetting.value.trim().length > 10) {
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

  // 2. Fetch live user behavioral signals
  const allProfiles = await db.select().from(customerProfiles);

  const searchCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const healthInquiries: Record<string, number> = {};

  for (const p of allProfiles) {
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

  // Identify unmet searches (searches with 0 or weak matches in catalog)
  const unmetSearches: { keyword: string; count: number }[] = [];
  const catalogNames = activeProducts.map((p) => p.name.toLowerCase());

  for (const [kw, count] of Object.entries(searchCounts)) {
    const hasMatch = catalogNames.some((name) => name.includes(kw) || kw.includes(name));
    if (!hasMatch && count >= 1) {
      unmetSearches.push({ keyword: kw, count });
    }
  }

  // Find low stock products
  const lowStockItems = activeProducts
    .filter((p) => Number(p.stock) <= Number(p.lowStockThreshold || 10))
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock, category: p.categorySlug }));

  // Month & Season context
  const currentMonthName = new Date().toLocaleString("en-US", { month: "long" });
  const categorySlugs = allCategories.map((c) => c.slug);

  // 3. Prepare Gemini API Request
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
- Unmet Searches (0-match in catalog): ${JSON.stringify(unmetSearches.slice(0, 15))}
- Live Lakshmi AI Health & Wellness Inquiries: ${JSON.stringify(Object.entries(healthInquiries))}
- Top Visited Categories: ${JSON.stringify(Object.entries(categoryCounts))}
- Low Stock Items: ${JSON.stringify(lowStockItems.slice(0, 10))}

TASK:
Produce a comprehensive, highly specific JSON report containing:
1. "executiveSummary": A concise 2-3 sentence strategic overview of current consumer demand, seasonal wellness patterns, and immediate harvest procurement priorities.
2. "unmetDemands": List of 3 to 6 high-value customer search demands that are currently missing from the catalog, with estimated search count, category, lost revenue potential in INR, and recommended sourcing action.
3. "recommendedNewProducts": List of 4 to 8 brand-new products that FarmFreshFarmer should immediately procure from local organic farmers and add to the catalog. Each item MUST include:
   - "name": English product name
   - "nameTe": Authentic Telugu script name (e.g. నాటు గులాబీలు, సేంద్రీయ దానిమ్మ, కొండ అల్లం)
   - "categorySlug": One of ${JSON.stringify(categorySlugs)}
   - "suggestedPrice": Realistic retail price in INR (number)
   - "suggestedUnit": e.g. "1 Kg", "500 Grams", "250 Grams", "1 Ltr"
   - "description": 1-2 sentence enticing consumer description
   - "sourcingReason": Why to procure now based on customer inquiries & season
   - "clinicalHealthBenefits": Medicinal or nutritional benefits (e.g. respiratory decongestion, immunity, low glycemic)
   - "urgency": "high" | "medium" | "low"
   - "targetSeason": Peak harvest window
   - "suggestedImage": Realistic image keyword or URL placeholder
4. "restockAlerts": List of 2 to 5 existing catalog items that are seeing heavy demand spikes or low stock, with suggested re-order quantities.
5. "seasonalHarvestGuidance": 2 to 4 regional farm harvesting insights for Andhra Pradesh / Telangana belts (e.g. Araku Valley, Guntur, East Godavari).

OUTPUT FORMAT:
Return ONLY valid JSON matching this structure with NO markdown fences, NO extra text:
{
  "executiveSummary": "...",
  "unmetDemands": [
    {
      "keyword": "...",
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

  // Try direct REST API for maximum speed and reliable JSON output
  try {
    const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(restUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      responseJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
  } catch (e: any) {
    console.warn("[procurement-ai] REST call failed, trying SDK fallback:", e?.message);
  }

  // Fallback to @google/generative-ai SDK if REST failed
  if (!responseJsonText) {
    modelUsed = "gemini-1.5-flash";
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2500,
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    responseJsonText = response.text();
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

  const resultData: ProcurementAiResult = {
    generatedAt: new Date().toISOString(),
    modelUsed,
    executiveSummary: parsed.executiveSummary || "Real-time demand analysis generated successfully.",
    unmetDemands: Array.isArray(parsed.unmetDemands) ? parsed.unmetDemands : [],
    recommendedNewProducts: Array.isArray(parsed.recommendedNewProducts) ? parsed.recommendedNewProducts : [],
    restockAlerts: Array.isArray(parsed.restockAlerts) ? parsed.restockAlerts : [],
    seasonalHarvestGuidance: Array.isArray(parsed.seasonalHarvestGuidance) ? parsed.seasonalHarvestGuidance : [],
  };

  // Cache result
  cachedResult = resultData;
  lastCacheTime = Date.now();

  return resultData;
}
