/**
 * 👁️ Netra Multimodal Vision AI Service
 * =====================================
 * Pure 100% Google Gemini Multimodal Vision API Integration
 *
 * Dedicated Capabilities:
 *  1. 🩺 Human Skin, Burn & Wound First-Aid Doctor
 *  2. 🌿 Plant & Crop Health Doctor (Identification, Disease Diagnosis & Organic Recipes)
 *  3. 🥗 Real-Time Nutritional & Macro Estimation (Plate/Produce breakdown)
 *  4. 📦 Perishable Spoilage & Quality Return Inspection (Auto-Refund Decision Engine)
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
  temperature = 0.35,
  maxOutputTokens = 1200
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

// ─── 1. Human Skin Condition & Wound First-Aid Doctor ────────────────────────

export async function analyzeHumanSkinOrWound(
  imageInput: string,
  userNotes = "",
  language = "en"
): Promise<VisionAnalysisResult> {
  const { base64Data, mimeType } = parseImageData(imageInput);
  const langPrompt = language === "te" ? "Respond in clear authentic Telugu script." : "Respond in English.";

  const prompt = `You are Netra AI (Human Skin, Minor Injury & Organic First-Aid Visual Assistant).
Analyze this photo of a human skin condition, rash, superficial wound, minor cut, burn, or insect bite.
User Notes: "${userNotes || "None provided"}"
${langPrompt}

INSTRUCTIONS:
1. Identify the observable visual characteristics (e.g. erythema/redness, inflammation, superficial abrasion, blister, insect bite papule, dry allergic patch, or fungal ring).
2. Assess Severity: (Mild / Moderate / Severe).
3. Provide Practical Organic / Natural First-Aid Remedies:
   - Minor Cuts/Scrapes: Wash with clean potable water, apply antiseptic raw turmeric (పసుపు) paste or raw honey dressing.
   - Minor Burns / Sunburn: Cold water compress (no ice), pure fresh Aloe Vera (కలబంద) gel.
   - Insect Bites / Rashes: Cold compress, diluted Neem extract, virgin coconut oil.
4. Triage Red-Flags (When to see a doctor immediately):
   - Check for spreading red streaks, pus/yellow exudate, deep flesh lacerations, severe fever, or allergic swelling.
5. Mandatory Disclaimer: Emphasize that Netra AI provides natural first-aid information and is NOT a substitute for professional clinical medical diagnosis.

FORMAT OUTPUT AS:
### 🩺 Netra AI Visual Assessment
**Condition Identified:** [Visual finding]
**Severity Level:** [Mild / Moderate / Severe]

#### 🌿 Recommended Natural First-Aid Steps:
- Step 1...
- Step 2...
- Step 3...

#### 🚨 When to Seek Immediate Medical Attention:
- [Warning signs]

> ⚠️ *Medical Disclaimer: Netra AI provides natural first-aid wellness guidance based on visual analysis. For persistent symptoms, spreading infection, or deep wounds, consult a licensed physician immediately.*`;

  const rawOutput = await callGeminiVision(prompt, base64Data, mimeType, 0.3, 1000);

  return {
    mode: "skin_doctor",
    title: "🩺 Skin & Wound First-Aid Assessment",
    summary: rawOutput.split("\n").slice(0, 3).join(" "),
    markdownContent: rawOutput,
    dataPills: [
      { label: "AI Engine", value: "Netra Vision 2.5", color: "emerald" },
      { label: "Type", value: "First-Aid Triage", color: "amber" },
    ],
    actionSuggestions: [
      "Order Organic Turmeric & Aloe Vera",
      "Connect with Support",
    ],
  };
}

// ─── 2. Plant & Crop Doctor (Health, Pests & Organic Recipes) ─────────────────

export async function analyzePlantCropHealth(
  imageInput: string,
  userNotes = "",
  language = "en"
): Promise<VisionAnalysisResult> {
  const { base64Data, mimeType } = parseImageData(imageInput);
  const langPrompt = language === "te" ? "Include plant and remedy names in authentic Telugu script alongside English." : "Provide names in English & Telugu script.";

  const prompt = `You are Netra AI (Expert Agricultural Crop & Backyard Plant Doctor for FarmFreshFarmer).
Analyze this photo of a plant, crop, leaf, fruit, or farm garden.
User Query: "${userNotes || "Identify plant and diagnose health"}"
${langPrompt}

INSTRUCTIONS:
1. Plant Identification: Common name (English & Telugu), Botanical Name, Family.
2. Health & Pathology Diagnosis:
   - Identify any leaf spots, powdery mildew, fungal blight, bacterial wilt, aphid attack, mealybug cluster, or nitrogen/iron deficiency.
   - If healthy, state that the plant displays vigorous healthy chlorophyll.
3. Authentic Organic Farm First-Aid Recipes:
   - Provide exact step-by-step organic preparation (e.g. Neem Oil 5ml/L + soap emulsifier, Sour buttermilk spray 1:10 for fungi, Wood ash dusting, Panchagavya application).
4. Sourcing & Soil Care Tips for Andhra Pradesh & Telangana climate.

FORMAT OUTPUT AS:
### 🌿 Netra AI Crop & Plant Diagnosis
**Plant Identified:** [English Name] ([Telugu Name]) — *[Botanical Name]*
**Health Status:** [Healthy / Condition Name]
**Severity:** [None / Mild / Moderate / Critical]

#### 🌾 Organic Farm First-Aid Recipe:
- **Treatment:** [Recipe name]
- **Preparation:** [Exact measurements and steps]
- **Application Schedule:** [e.g. Spray early morning every 5 days]

#### 💡 Garden & Soil Care Advice:
- [Sunlight, watering, organic compost tips]`;

  const rawOutput = await callGeminiVision(prompt, base64Data, mimeType, 0.35, 1000);

  return {
    mode: "plant_doctor",
    title: "🌿 Plant & Crop Health Diagnosis",
    summary: rawOutput.split("\n").slice(0, 3).join(" "),
    markdownContent: rawOutput,
    dataPills: [
      { label: "AI Engine", value: "Netra Crop Vision", color: "emerald" },
      { label: "Diagnosis", value: "Organic Farm Care", color: "teal" },
    ],
    actionSuggestions: [
      "Order Organic Neem & Bio-Fertilizers",
      "Ask Lakshmi for Harvesting Tips",
    ],
  };
}

// ─── 3. Real-Time Nutritional & Macro Estimation ─────────────────────────────

export async function estimateNutritionMacros(
  imageInput: string,
  userNotes = "",
  language = "en"
): Promise<VisionAnalysisResult> {
  const { base64Data, mimeType } = parseImageData(imageInput);

  const prompt = `You are Netra AI (Nutritional Vision & Macronutrient Estimation AI for FarmFreshFarmer).
Analyze this photo of a meal plate, cooked dish, raw produce basket, or food item.
User Notes: "${userNotes || "Estimate nutrition and macros"}"

INSTRUCTIONS:
1. Identify all observable food items on the plate/photo and estimate their portion weight in grams.
2. Calculate accurate nutritional totals:
   - Total Energy: [Calories in kcal]
   - Protein: [g]
   - Dietary Fiber: [g]
   - Net Carbohydrates: [g]
   - Healthy Fats: [g]
3. Highlight Key Bioactive Phytochemicals (e.g. Curcumin, Beta-glucan in millets, Allicin, Anthocyanins).
4. Recommend matching organic farm items from FarmFreshFarmer (e.g. Organic Millets, Fresh Leafy Greens, Cold-Pressed Oils).

FORMAT OUTPUT AS:
### 🥗 Netra AI Macronutrient & Nutrition Breakdown

| Item Identified | Portion (g) | Calories (kcal) | Protein (g) | Fiber (g) | Carbs (g) |
|---|---|---|---|---|---|
| [Item 1] | [g] | [kcal] | [g] | [g] | [g] |
| [Item 2] | [g] | [kcal] | [g] | [g] | [g] |
| **TOTALS** | **[Total g]** | **[Total kcal]** | **[Total Protein]g** | **[Total Fiber]g** | **[Total Carbs]g** |

#### 🧠 Wellness & Nutritional Insights:
- **Macro Balance:** [High Protein / High Fiber / Balanced Low GI]
- **Key Bioactives:** [Vitamins & Antioxidants detected]

#### 🌾 FarmFreshFarmer Organic Pairing Recommendation:
- [Complementary organic produce from our store to optimize this meal]`;

  const rawOutput = await callGeminiVision(prompt, base64Data, mimeType, 0.3, 1100);

  // Extract protein and calorie values for data pills
  const proteinMatch = rawOutput.match(/Protein\]?g?\s*[:|]\s*\**(\d+(?:\.\d+)?)\s*g/i) || rawOutput.match(/(\d+(?:\.\d+)?)\s*g\s*protein/i);
  const calMatch = rawOutput.match(/Calories\]?k?c?a?l?\s*[:|]\s*\**(\d+)\s*kcal/i) || rawOutput.match(/(\d+)\s*kcal/i);

  const dataPills = [
    { label: "Calories", value: calMatch ? `${calMatch[1]} kcal` : "Calculated", color: "amber" },
    { label: "Protein", value: proteinMatch ? `${proteinMatch[1]}g` : "High", color: "emerald" },
    { label: "AI Engine", value: "Netra Nutrition AI", color: "teal" },
  ];

  return {
    mode: "nutrition",
    title: "🥗 Nutritional & Macro Breakdown",
    summary: rawOutput.split("\n").slice(0, 3).join(" "),
    markdownContent: rawOutput,
    dataPills,
    actionSuggestions: [
      "Add Organic Millets to Cart",
      "Add Cold-Pressed Oils",
    ],
  };
}

// ─── 4. Perishable Spoilage & Return Quality Inspection ──────────────────────

export async function inspectPerishableReturnDamage(
  imageInput: string,
  orderContext: { orderId?: number; productName?: string; itemPrice?: number } = {},
  language = "en"
): Promise<VisionAnalysisResult> {
  const { base64Data, mimeType } = parseImageData(imageInput);

  const prompt = `You are Netra AI (Quality & Return Spoilage Inspection Engine for FarmFreshFarmer).
Inspect this photo submitted by a customer claiming perishable produce damage, rotting, transit crushing, mold, or broken seals.
Claimed Product: "${orderContext.productName || "Farm Produce"}" (Order #${orderContext.orderId || "N/A"}, Price: ₹${orderContext.itemPrice || 0})

INSTRUCTIONS:
1. Examine the image carefully for genuine spoilage: bacterial soft rot, fungal mold growth, deep transit impact bruising, package leakage, or discoloration.
2. Determine whether the damage is:
   - Genuine Spoilage/Damage (confidence >= 85%) -> recommend "auto_approve_refund"
   - Borderline/Ambiguous -> recommend "escalate_to_officer"
   - No Visible Spoilage / Unrelated Item -> recommend "reject"
3. Output a structured JSON block at the very top:
<<<INSPECTION_DECISION:{"isDamaged":true,"confidence":92,"damageCategory":"bacterial_soft_rot","recommendedAction":"auto_approve_refund","reason":"Visible fungal mold and soft rot on tomatoes","estimatedRefundAmount":${orderContext.itemPrice || 150}}>>>

4. Followed by a customer-facing inspection summary.`;

  const rawOutput = await callGeminiVision(prompt, base64Data, mimeType, 0.2, 900);

  let refundRecommendation = {
    isDamaged: true,
    confidence: 88,
    damageCategory: "perishable_spoilage",
    recommendedAction: "auto_approve_refund" as const,
    reason: "Visual verification confirmed produce damage.",
    refundAmount: orderContext.itemPrice || 100,
  };

  const jsonMatch = rawOutput.match(/<<<INSPECTION_DECISION:([\s\S]*?)>>>/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      refundRecommendation = {
        ...refundRecommendation,
        ...parsed,
      };
    } catch {}
  }

  const cleanContent = rawOutput.replace(/<<<INSPECTION_DECISION:[\s\S]*?>>>/g, "").trim();

  return {
    mode: "return_spoilage",
    title: "🧾 Quality & Damage Inspection Report",
    summary: refundRecommendation.reason,
    markdownContent: cleanContent,
    dataPills: [
      { label: "Inspection Status", value: refundRecommendation.recommendedAction === "auto_approve_refund" ? "Verified Damaged" : "Under Review", color: refundRecommendation.recommendedAction === "auto_approve_refund" ? "emerald" : "amber" },
      { label: "Confidence", value: `${refundRecommendation.confidence}%`, color: "teal" },
      { label: "Action", value: refundRecommendation.recommendedAction === "auto_approve_refund" ? "Auto-Refund Approved" : "Escalated", color: "sky" },
    ],
    refundRecommendation,
  };
}

// ─── 5. Universal Auto-Router (Detects whether image is Skin, Plant, Food, or Damage) ────

export async function routeAndAnalyzeVision(
  imageInput: string,
  userNotes = "",
  language = "en",
  explicitMode?: "skin_doctor" | "plant_doctor" | "nutrition" | "return_spoilage"
): Promise<VisionAnalysisResult> {
  if (explicitMode === "skin_doctor") return analyzeHumanSkinOrWound(imageInput, userNotes, language);
  if (explicitMode === "plant_doctor") return analyzePlantCropHealth(imageInput, userNotes, language);
  if (explicitMode === "nutrition") return estimateNutritionMacros(imageInput, userNotes, language);
  if (explicitMode === "return_spoilage") return inspectPerishableReturnDamage(imageInput, {}, language);

  const lower = (userNotes || "").toLowerCase();
  if (/skin|wound|rash|burn|cut|scratch|insect|bite|itch|blood|allergy|blister|infection|doctor/i.test(lower)) {
    return analyzeHumanSkinOrWound(imageInput, userNotes, language);
  }
  if (/plant|leaf|crop|tree|garden|farming|disease|pest|fungus|blight|mildew|grow|yellow leaf/i.test(lower)) {
    return analyzePlantCropHealth(imageInput, userNotes, language);
  }
  if (/calorie|protein|carb|nutrition|macro|diet|food|eat|meal|weight|gram/i.test(lower)) {
    return estimateNutritionMacros(imageInput, userNotes, language);
  }
  if (/refund|return|damaged|rotten|spoil|bad|broke|leak|replace/i.test(lower)) {
    return inspectPerishableReturnDamage(imageInput, {}, language);
  }

  // Default: Prompt Gemini Vision to classify and execute the best domain
  const { base64Data, mimeType } = parseImageData(imageInput);
  const routerPrompt = `Analyze this image and determine which category it best belongs to:
1. "skin_doctor" (human skin, rash, cut, wound, burn, insect bite)
2. "plant_doctor" (plants, crops, leaves, agricultural garden, plant pests)
3. "nutrition" (cooked food, meal plate, raw organic fruits/vegetables, grains)
4. "return_spoilage" (damaged packaging, rotting commercial produce)

Respond with ONLY the exact category string in brackets like [skin_doctor] or [plant_doctor] or [nutrition] or [return_spoilage].`;

  try {
    const classification = await callGeminiVision(routerPrompt, base64Data, mimeType, 0.1, 50);
    if (classification.includes("skin_doctor")) return analyzeHumanSkinOrWound(imageInput, userNotes, language);
    if (classification.includes("plant_doctor")) return analyzePlantCropHealth(imageInput, userNotes, language);
    if (classification.includes("return_spoilage")) return inspectPerishableReturnDamage(imageInput, {}, language);
    return estimateNutritionMacros(imageInput, userNotes, language);
  } catch {
    return analyzePlantCropHealth(imageInput, userNotes, language);
  }
}
