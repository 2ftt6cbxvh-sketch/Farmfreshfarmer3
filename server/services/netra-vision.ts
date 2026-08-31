/**
 * 👁️ Netra Multimodal Vision AI Service
 * =====================================
 * Pure 100% Google Gemini Multimodal Vision API Integration
 *
 * Fully Dynamic Capabilities:
 *  1. 🩺 Human Skin, Burn, Scar & Wound First-Aid Triage
 *  2. 🌿 Plant & Crop Health Doctor (Botanical ID, Disease Diagnosis & Organic Recipes)
 *  3. 🥗 Real-Time Nutritional & Macro Estimation (Portion grams, Calories, Protein, Fiber)
 *  4. 📦 Perishable Spoilage & Quality Return Inspection (Auto-Refund Decision Engine)
 *  5. 👁️ General Agricultural & Farm Visual Understanding
 */

import { getNetraVisionApiKey } from "./gemini-keys";

export interface VisionAnalysisResult {
  mode: "skin_doctor" | "plant_doctor" | "nutrition" | "return_spoilage" | "general_vision";
  title: string;
  summary: string;
  markdownContent: string;
  dataPills?: Array<{ label: string; value: string; color?: string }>;
  actionSuggestions?: string[];
  refundRecommendation?: {
    isDamaged: boolean;
    confidence: number;
    damageCategory: string;
    recommendedAction: "auto_approve_refund" | "escalate_to_officer" | "reject";
    reason: string;
    refundAmount?: number;
  };
}

/** Format Base64 and MIME Type from Data URL */
export function parseImageData(input: string): { base64Data: string; mimeType: string } {
  let mimeType = "image/jpeg";
  let base64Data = input.trim();

  if (input.startsWith("data:")) {
    const match = input.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }
  }

  return { base64Data, mimeType };
}

/** Low-Level Raw Gemini Multimodal Vision Execution */
async function callGeminiVision(
  prompt: string,
  base64Data: string,
  mimeType: string,
  temperature = 0.3,
  maxOutputTokens = 1500
): Promise<string> {
  const apiKey = await getNetraVisionApiKey();
  if (!apiKey) {
    throw new Error("Netra Vision AI API key is not configured.");
  }

  const candidateModels = [
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
  ];

  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text = parts
          .find((p: any) => !p.thought && typeof p.text === "string" && p.text.trim())
          ?.text?.trim();

        if (text) return text;
      } else {
        const errText = await response.text();
        lastError = new Error(`Gemini Vision API (${modelName}) returned ${response.status}: ${errText.slice(0, 200)}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to process image with Netra Vision AI.");
}

/**
 * 🌟 Dynamic Universal Multimodal Vision Engine
 * Intelligently recognizes Human Skin / Plant Health / Nutrition Macros / Return Damage
 */
export async function routeAndAnalyzeVision(
  imageInput: string,
  userNotes = "",
  language = "en",
  explicitMode?: "skin_doctor" | "plant_doctor" | "nutrition" | "return_spoilage"
): Promise<VisionAnalysisResult> {
  const { base64Data, mimeType } = parseImageData(imageInput);
  const langDirective = language === "te"
    ? "Include relevant names and instructions in authentic Telugu script alongside English."
    : "Respond in clear English.";

  const prompt = `You are Netra AI, the Multimodal Visual Intelligence Engine for FarmFreshFarmer (Organic Direct-from-Farm Platform).
Analyze this photo carefully.
User Notes / Question: "${userNotes || "Analyze this image and provide guidance"}"
${langDirective}

DYNAMIC INTENT & DOMAIN RECOGNITION:
Visually inspect the image and categorize what is depicted:

1. Human Skin / Burn / Scar / Rash / Cut / Wound / Insect Bite / Dermatological Issue:
   - Identify the visual condition (e.g. Healed hypertrophic scar, second-degree burn, eczema erythema, superficial abrasion, fungal rash, allergic papule).
   - Assess severity (Mild / Moderate / Severe).
   - Provide practical natural Ayurvedic & organic first-aid (pure Aloe Vera gel, raw Turmeric paste, virgin Coconut Oil, cold water compress).
   - Provide dermatologist consultation advice and red-flag warning signs (fever, spreading infection, deep wound).
   - Include a concise medical disclaimer.
   - Mode: "skin_doctor" | Title: "🩺 Skin & Wound First-Aid Assessment"

2. Plant / Crop / Leaf / Fruit / Backyard Garden / Agricultural Health:
   - Identify plant species (Common Name, Telugu Name, Botanical Name).
   - Identify health status (Healthy, Powdery Mildew, Early Blight, Aphids, Mealybugs, Iron/Nitrogen deficiency).
   - Provide 100% natural organic farm spray recipes (Neem Oil spray 5ml/L, Sour buttermilk spray 1:10, Wood ash dusting, Jeevamrutham).
   - Garden & soil care advice.
   - Mode: "plant_doctor" | Title: "🌿 Plant & Crop Health Diagnosis"

3. Meal Plate / Cooked Dish / Food Item / Raw Organic Produce / Grain:
   - Identify every food item and estimate portion weight in grams.
   - Provide a clean markdown table with Calories (kcal), Protein (g), Fiber (g), Net Carbs (g), and Healthy Fats (g).
   - Wellness & bioactive insights (e.g., Curcumin, Anthocyanins, Low GI).
   - Recommended organic FarmFresh store pairings.
   - Mode: "nutrition" | Title: "🥗 Nutritional & Macro Breakdown"

4. Damaged Grocery / Rotten Perishable Produce / Transit Damage:
   - Inspect for genuine spoilage (bacterial soft rot, mold, crushing, broken seal).
   - Recommend auto_approve_refund, escalate_to_officer, or reject.
   - Mode: "return_spoilage" | Title: "🧾 Quality & Spoilage Inspection"

5. General Farm / Agricultural Scene:
   - Mode: "general_vision" | Title: "👁️ Netra AI Visual Analysis"

MANDATORY OUTPUT FORMAT:
At the very top of your response, output a single-line JSON metadata block:
<<<VISION_METADATA:{"mode":"skin_doctor","title":"🩺 Skin & Scar First-Aid Assessment","dataPills":[{"label":"Observation","value":"Contracted Burn Scar","color":"amber"},{"label":"First-Aid","value":"Aloe Vera & Moisturization","color":"emerald"},{"label":"Consultation","value":"Dermatologist Recommended","color":"teal"}],"actionSuggestions":["Explore Organic Aloe Vera & Coconut Oil","Connect with Support"]}>>>

Followed immediately by your clean, well-formatted, detailed response.`;

  const rawOutput = await callGeminiVision(prompt, base64Data, mimeType, 0.25, 1400);

  let mode: VisionAnalysisResult["mode"] = "general_vision";
  let title = "👁️ Netra AI Visual Analysis";
  let dataPills: Array<{ label: string; value: string; color?: string }> = [
    { label: "AI Engine", value: "Netra Vision 3.6", color: "emerald" },
  ];
  let actionSuggestions: string[] = ["Ask Lakshmi AI for more details"];

  // Parse Metadata Block
  const metaMatch = rawOutput.match(/<<<VISION_METADATA:([\s\S]*?)>>>/);
  if (metaMatch) {
    try {
      const parsed = JSON.parse(metaMatch[1]);
      if (parsed.mode) mode = parsed.mode;
      if (parsed.title) title = parsed.title;
      if (Array.isArray(parsed.dataPills) && parsed.dataPills.length > 0) {
        dataPills = parsed.dataPills;
      }
      if (Array.isArray(parsed.actionSuggestions) && parsed.actionSuggestions.length > 0) {
        actionSuggestions = parsed.actionSuggestions;
      }
    } catch {}
  }

  const cleanContent = rawOutput.replace(/<<<VISION_METADATA:[\s\S]*?>>>/g, "").trim();

  return {
    mode,
    title,
    summary: cleanContent.split("\n").slice(0, 3).join(" "),
    markdownContent: cleanContent,
    dataPills,
    actionSuggestions,
  };
}

// Backward-compatibility exports for specific callers
export async function analyzeHumanSkinOrWound(imageInput: string, userNotes = "", language = "en") {
  return routeAndAnalyzeVision(imageInput, userNotes, language, "skin_doctor");
}

export async function analyzePlantCropHealth(imageInput: string, userNotes = "", language = "en") {
  return routeAndAnalyzeVision(imageInput, userNotes, language, "plant_doctor");
}

export async function estimateNutritionMacros(imageInput: string, userNotes = "", language = "en") {
  return routeAndAnalyzeVision(imageInput, userNotes, language, "nutrition");
}

export async function inspectPerishableReturnDamage(
  imageInput: string,
  orderContext: { orderId?: number; productName?: string; itemPrice?: number } = {},
  language = "en"
) {
  const notes = `Order #${orderContext.orderId || "N/A"}, Product: ${orderContext.productName || "Farm Produce"}, Price: ₹${orderContext.itemPrice || 0}`;
  return routeAndAnalyzeVision(imageInput, notes, language, "return_spoilage");
}
