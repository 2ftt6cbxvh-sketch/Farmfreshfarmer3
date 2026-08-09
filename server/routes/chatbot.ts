import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { chatbotMissedQueries, chatbotProductSuggestions } from "../../shared/schema";
import { eq, desc, sql, ilike } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Language = "en" | "hi" | "te";

interface HistoryEntry {
  role: "user" | "model";
  content: string;
}

interface MessageBody {
  message: string;
  sessionToken: string;
  language: Language;
  history: HistoryEntry[];
}

interface MissedBody {
  query: string;
  sessionToken: string;
  language: string;
  triggerType: "unresolved" | "human_request";
  chatHistory?: string;
}

interface ProductSuggestionBody {
  productName: string;
  sessionToken: string;
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// ---------------------------------------------------------------------------
// Gemini system prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(language: Language): string {
  const langInstruction =
    language === "te"
      ? "Please respond ONLY in Telugu (తెలుగు)."
      : language === "hi"
      ? "Please respond ONLY in Hindi (హిన్దీ)."
      : "Please respond in English.";

  return `You are a friendly customer support assistant for FarmFreshFarmer, a farm-fresh grocery delivery service operating in Vijayawada, Guntur, and Visakhapatnam, Andhra Pradesh, India.

${langInstruction}

FarmFreshFarmer delivers fresh vegetables, fruits, and homemade foods directly from local farmers to customers doorsteps. Our products are 100% natural, chemical-free, and harvested fresh daily.

Your responsibilities:
- Help customers with product information, pricing, availability, delivery ETA, and policies.
- Be warm, concise, and helpful. Keep responses short (2-4 sentences max).
- If a customer asks to add a product to the cart, respond ONLY with a JSON marker (no other text): {"action":"ADD_TO_CART","productName":"<product name>"}
- If a customer asks to go to checkout or place an order, respond ONLY with: {"action":"GO_TO_CHECKOUT"}
- Do NOT make up prices if you are unsure — tell the customer to check the app for live pricing.
- Our delivery slots are morning (6 AM - 10 AM) and evening (4 PM - 8 PM), 7 days a week.
- Return/refund policy: Report issues within 24 hours of delivery, full refund or replacement guaranteed.
- Cancellations: accepted up to 1 hour before the delivery slot.
- Contact: support@farmfreshfarmer.in | WhatsApp: +91-9999999999
- Minimum order: Rs.200. Free delivery on orders above Rs.500.`;
}

// ---------------------------------------------------------------------------
// Rule-based fallback
// ---------------------------------------------------------------------------

interface RuleBasedResult {
  reply: string;
  needsHuman?: boolean;
}

function getRuleBasedReply(
  message: string,
  language: Language
): RuleBasedResult | null {
  const lower = message.toLowerCase();

  const responses: Record<string, Record<Language, string>> = {
    price: {
      en: "Our prices vary by product and season. Please check the app for live pricing. We always aim to offer the best farm-fresh rates!",
      hi: "हमारी कीमतें उत्पाद और मौसम के अनुसार अलग-अलग होती हैं। लाइव मूल्य के लिए कृपया ऐप देखें!",
      te: "మా ధరలు ఉత్పత్తి మరియు సీజన్ ప్రకారం మారతాయి. లైవ్ ధరల కోసం దయచేసి యాప్ చెక్ చేయండి!",
    },
    delivery: {
      en: "We deliver in Vijayawada, Guntur, and Visakhapatnam. Slots: Morning 6-10 AM and Evening 4-8 PM, 7 days a week. Free delivery above Rs.500!",
      hi: "हम विजयवाड़ा, गुंटूर और विशाखापट्टनम में डिलीवरी करते हैं। डिलीवरी स्लॉट: सुबह 6-10 बजे और शाम 4-8 बजे। Rs.500 से अधिक पर मुफ्त डिलीवरी!",
      te: "మేము విజయవాడ, గుంటూరు మరియు విశాఖపట్నంలో డెలివరీ చేస్తాం. స్లాట్లు: ఉదయం 6-10 AM మరియు సాయంత్రం 4-8 PM. Rs.500కి పైన ఉచిత డెలివరీ!",
    },
    return: {
      en: "Report any issues within 24 hours of delivery. We guarantee a full refund or replacement for quality concerns. Your satisfaction is our priority!",
      hi: "डिलीवरी के 24 घंटे के भीतर किसी भी समस्या की रिपोर्ट करें। हम पूर्ण धनवापसी या प्रतिस्थापन की गारंटी देते हैं!",
      te: "డెలివరీ అయిన 24 గంటల్లోపు ఏదైనా సమస్యను నివేదించండి. పూర్తి రీఫండ్ లేదా భర్తీ హామీ ఇస్తాం!",
    },
    refund: {
      en: "Refunds are processed within 3-5 business days to your original payment method. For COD orders, refunds are via bank transfer. Contact us within 24 hours.",
      hi: "रिफंड 3-5 कार्य दिवसों में आपके मूल भुगतान विधि में होते हैं। COD के लिए बैंक ट्रांसफर। 24 घंटे में संपर्क करें।",
      te: "రీఫండ్లు 3-5 వ్యాపార దినాల్లో ప్రాసెస్ అవుతాయి. COD ఆర్డర్లకు బ్యాంక్ బదిలీ ద్వారా రీఫండ్. 24 గంటల్లోపు సంప్రదించండి.",
    },
    cancel: {
      en: "You can cancel your order up to 1 hour before your delivery slot. Go to My Orders in the app to cancel.",
      hi: "डिलीवरी स्लॉट से 1 घंटे पहले तक ऑर्डर रद्द कर सकते हैं। ऐप में मेरे ऑर्डर में जाएं।",
      te: "డెలివరీ స్లాట్కు 1 గంట ముందు వరకు ఆర్డర్ రద్దు చేయవచ్చు. యాప్‌లో నా ఆర్డర్లు కి వెళ్ళండి.",
    },
    timing: {
      en: "Delivery slots: Morning (6 AM - 10 AM) and Evening (4 PM - 8 PM), available 7 days a week!",
      hi: "डिलीवरी स्लॉट: सुबह (6 AM - 10 AM) और शाम (4 PM - 8 PM), सप्ताह के 7 दिन!",
      te: "డెలివరీ స్లాట్లు: ఉదయం (6 AM - 10 AM) మరియు సాయంత్రం (4 PM - 8 PM), వారంలో 7 రోజులు!",
    },
    contact: {
      en: "Reach us at support@farmfreshfarmer.in or WhatsApp +91-9999999999. Available daily 7 AM - 9 PM!",
      hi: "support@farmfreshfarmer.in या WhatsApp +91-9999999999 पर संपर्क करें। सुबह 7 - रात 9 बजे उपलब्ध!",
      te: "support@farmfreshfarmer.in లేదా WhatsApp +91-9999999999 సంప్రదించండి. ఉదయం 7 - రాత్రి 9 అందుబాటులో!",
    },
    fresh: {
      en: "All produce is harvested fresh daily from local Andhra Pradesh farms. No cold storage, no chemicals — straight from farm to table!",
      hi: "सभी उपज आंध्र प्रदेश के फार्मों से दैनिक ताजा काटी जाती है। कोई कोल्ड स्टोरेज नहीं, कोई रसायन नहीं!",
      te: "మా అన్ని ఉత్పత్తులూ ఆంధ్రప్రదేశ్ వ్యవసాయ క్షేత్రాల నుండి రోజూ తాజాగా కోయబడతాయి. రసాయనాలు లేవు!",
    },
    organic: {
      en: "Yes! Our products are 100% natural and chemical-free, sourced directly from trusted local farmers using sustainable practices.",
      hi: "हाँ! हमारे उत्पाद 100% प्राकृतिक और रसायन मुक्त हैं, विश्वसनीय स्थानीय किसानों से सीधे प्राप्त।",
      te: "అవును! మా ఉత్పత్తులు 100% సహజంగా మరియు రసాయన రహితంగా ఉంటాయి, విశ్వసనీయ స్థానిక రైతుల నుండి నేరుగా సేకరించబడతాయి.",
    },
  };

  const keywordMap: Record<string, string> = {
    price: "price",
    cost: "price",
    "how much": "price",
    rate: "price",
    delivery: "delivery",
    "deliver time": "delivery",
    eta: "delivery",
    return: "return",
    refund: "refund",
    cancel: "cancel",
    cancellation: "cancel",
    timing: "timing",
    hours: "timing",
    schedule: "timing",
    contact: "contact",
    phone: "contact",
    email: "contact",
    whatsapp: "contact",
    fresh: "fresh",
    organic: "organic",
    natural: "organic",
    chemical: "organic",
  };

  for (const [keyword, category] of Object.entries(keywordMap)) {
    if (lower.includes(keyword)) {
      const responseSet = responses[category];
      if (responseSet) {
        return { reply: responseSet[language] || responseSet["en"] };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Gemini API call
// ---------------------------------------------------------------------------

async function callGemini(
  apiKey: string,
  message: string,
  history: HistoryEntry[],
  language: Language
): Promise<string> {
  const systemPrompt = buildSystemPrompt(language);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      ...history.map((h) => ({
        role: h.role,
        parts: [{ text: h.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data: any = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  return text.trim();
}

// ---------------------------------------------------------------------------
// Parse action from Gemini reply
// ---------------------------------------------------------------------------

function parseAction(reply: string): {
  cleanReply: string;
  action?: string;
  actionData?: any;
} {
  const jsonMatch = reply.match(/\{[^}]*"action"\s*:\s*"[^"]+"[^}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.action === "ADD_TO_CART") {
        return {
          cleanReply: reply.replace(jsonMatch[0], "").trim(),
          action: parsed.action,
          actionData: { productName: parsed.productName },
        };
      }
      if (parsed.action === "GO_TO_CHECKOUT") {
        return {
          cleanReply: reply.replace(jsonMatch[0], "").trim(),
          action: parsed.action,
        };
      }
    } catch {
      // Not valid JSON, ignore
    }
  }
  return { cleanReply: reply };
}

// ---------------------------------------------------------------------------
// Telegram alert sender
// ---------------------------------------------------------------------------

async function sendTelegramAlert(
  botToken: string,
  chatIds: string[],
  message: string
): Promise<void> {
  const promises = chatIds.map((chatId) =>
    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    }).catch((err) =>
      console.error(`[Chatbot] Telegram alert failed for chatId ${chatId}:`, err)
    )
  );
  await Promise.allSettled(promises);
}

// ---------------------------------------------------------------------------
// IST timestamp helper
// ---------------------------------------------------------------------------

function getISTTimestamp(): string {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Register all chatbot routes
// ---------------------------------------------------------------------------

export function registerChatbotRoutes(app: any, storage: any) {
  // -------------------------------------------------------------------------
  // POST /api/chatbot/message
  // -------------------------------------------------------------------------
  app.post("/api/chatbot/message", async (req: Request, res: Response) => {
    try {
      const { message, sessionToken, language = "en", history = [] } =
        req.body as MessageBody;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "message is required" });
      }

      const lang: Language = (["en", "hi", "te"].includes(language)
        ? language
        : "en") as Language;

      // Fetch Gemini API key from settings
      let geminiApiKey: string | null = null;
      try {
        const allSettings = await storage.settings.all();
        geminiApiKey = allSettings?.gemini_api_key || null;
      } catch (err) {
        console.warn("[Chatbot] Could not fetch settings:", err);
      }

      // Try Gemini first
      if (geminiApiKey) {
        try {
          const geminiReply = await callGemini(
            geminiApiKey,
            message,
            history,
            lang
          );
          const { cleanReply, action, actionData } = parseAction(geminiReply);

          return res.json({
            reply: cleanReply || geminiReply,
            ...(action ? { action } : {}),
            ...(actionData ? { actionData } : {}),
          });
        } catch (geminiErr: any) {
          console.error(
            "[Chatbot] Gemini API failed, falling back to rule-based:",
            geminiErr.message
          );
        }
      }

      // Rule-based fallback
      const ruleResult = getRuleBasedReply(message, lang);
      if (ruleResult) {
        return res.json(ruleResult);
      }

      // Unknown query — log to DB and signal human needed
      try {
        await db.insert(chatbotMissedQueries).values({
          query: message,
          sessionToken: sessionToken || null,
          language: lang,
          triggerType: "unresolved",
          telegramAlertSent: false,
        });
      } catch (dbErr) {
        console.error("[Chatbot] Failed to log missed query:", dbErr);
      }

      const humanNeededMessages: Record<Language, string> = {
        en: "I am not sure about that. A human support agent will reach out to you shortly. Sorry for the inconvenience!",
        hi: "मुझे इसकी जानकारी नहीं है। एक मानव सहायता एजेंट जल्द ही आपसे संपर्क करेगा। असुविधा के लिए खेद है!",
        te: "నాకు దాని గురించి తెలియదు. మానవ సహాయ ఏజెంట్ త్వరలో మీతో సంప్రదిస్తారు. అసౌకర్యానికి క్షమించండి!",
      };

      return res.json({
        reply: humanNeededMessages[lang],
        needsHuman: true,
      });
    } catch (err: any) {
      console.error("[Chatbot] /message error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/chatbot/missed
  // -------------------------------------------------------------------------
  app.post("/api/chatbot/missed", async (req: Request, res: Response) => {
    try {
      const { query, sessionToken, language, triggerType, chatHistory } =
        req.body as MissedBody;

      if (!query || !triggerType) {
        return res
          .status(400)
          .json({ message: "query and triggerType are required" });
      }

      // Insert into DB
      const [inserted] = await db
        .insert(chatbotMissedQueries)
        .values({
          query,
          sessionToken: sessionToken || null,
          language: language || "en",
          triggerType,
          telegramAlertSent: false,
        })
        .returning();

      // Fetch Telegram credentials
      let telegramAlertSent = false;
      try {
        const allSettings = await storage.settings.all();
        const botToken: string = allSettings?.telegram_bot_token || "";
        let chatIds: string[] = [];
        try {
          chatIds = JSON.parse(allSettings?.telegram_chat_ids || "[]");
        } catch {
          chatIds = [];
        }

        if (botToken && chatIds.length > 0) {
          const timestamp = getISTTimestamp();
          const alertText =
            `<b>FarmFreshFarmer Customer Support Alert</b>\n\n` +
            `<b>Trigger:</b> ${triggerType}\n` +
            `<b>Query:</b> ${query}\n` +
            `<b>Language:</b> ${language || "en"}\n` +
            `<b>Time:</b> ${timestamp} IST\n` +
            (chatHistory
              ? `\n<b>Recent chat:</b>\n<pre>${chatHistory.slice(0, 800)}</pre>`
              : "");

          await sendTelegramAlert(botToken, chatIds, alertText);

          if (inserted?.id) {
            await db
              .update(chatbotMissedQueries)
              .set({ telegramAlertSent: true })
              .where(eq(chatbotMissedQueries.id, inserted.id));
          }

          telegramAlertSent = true;
        }
      } catch (telegramErr) {
        console.error("[Chatbot] Telegram alert error:", telegramErr);
      }

      return res.json({ success: true, telegramAlertSent });
    } catch (err: any) {
      console.error("[Chatbot] /missed error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/chatbot/product-suggestion
  // -------------------------------------------------------------------------
  app.post(
    "/api/chatbot/product-suggestion",
    async (req: Request, res: Response) => {
      try {
        const { productName, sessionToken } = req.body as ProductSuggestionBody;

        if (!productName || typeof productName !== "string") {
          return res.status(400).json({ message: "productName is required" });
        }

        const normalizedName = productName.trim().toLowerCase();

        // Check if already exists (case-insensitive)
        const existing = await db
          .select()
          .from(chatbotProductSuggestions)
          .where(ilike(chatbotProductSuggestions.productName, normalizedName))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(chatbotProductSuggestions)
            .set({
              mentionCount: sql`${chatbotProductSuggestions.mentionCount} + 1`,
            })
            .where(eq(chatbotProductSuggestions.id, existing[0].id));
        } else {
          await db.insert(chatbotProductSuggestions).values({
            productName: productName.trim(),
            mentionCount: 1,
            resolved: false,
          });
        }

        return res.json({ success: true });
      } catch (err: any) {
        console.error("[Chatbot] /product-suggestion error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /api/admin/chatbot/missed-queries
  // -------------------------------------------------------------------------
  app.get(
    "/api/admin/chatbot/missed-queries",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
        const limit = Math.min(
          100,
          Math.max(1, parseInt(String(req.query.limit || "20"), 10))
        );
        const offset = (page - 1) * limit;

        const resolvedParam = req.query.resolved;
        let resolvedFilter: boolean | undefined;
        if (resolvedParam === "true") resolvedFilter = true;
        else if (resolvedParam === "false") resolvedFilter = false;

        const [rows, countResult] = await Promise.all([
          resolvedFilter !== undefined
            ? db
                .select()
                .from(chatbotMissedQueries)
                .where(eq(chatbotMissedQueries.resolved, resolvedFilter))
                .orderBy(desc(chatbotMissedQueries.createdAt))
                .limit(limit)
                .offset(offset)
            : db
                .select()
                .from(chatbotMissedQueries)
                .orderBy(desc(chatbotMissedQueries.createdAt))
                .limit(limit)
                .offset(offset),

          resolvedFilter !== undefined
            ? db
                .select({ count: sql<number>`count(*)` })
                .from(chatbotMissedQueries)
                .where(eq(chatbotMissedQueries.resolved, resolvedFilter))
            : db
                .select({ count: sql<number>`count(*)` })
                .from(chatbotMissedQueries),
        ]);

        const total = Number(countResult[0]?.count ?? 0);

        return res.json({
          data: rows,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (err: any) {
        console.error("[Chatbot] GET /missed-queries error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // -------------------------------------------------------------------------
  // PATCH /api/admin/chatbot/missed-queries/:id
  // -------------------------------------------------------------------------
  app.patch(
    "/api/admin/chatbot/missed-queries/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const idRaw = req.params.id;
        const id = parseInt(Array.isArray(idRaw) ? idRaw[0] : idRaw, 10);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid ID" });
        }

        const { resolved } = req.body;
        if (typeof resolved !== "boolean") {
          return res
            .status(400)
            .json({ message: "resolved (boolean) is required" });
        }

        const [updated] = await db
          .update(chatbotMissedQueries)
          .set({ resolved })
          .where(eq(chatbotMissedQueries.id, id))
          .returning();

        if (!updated) {
          return res.status(404).json({ message: "Record not found" });
        }

        return res.json({ success: true, data: updated });
      } catch (err: any) {
        console.error("[Chatbot] PATCH /missed-queries/:id error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /api/admin/chatbot/product-suggestions
  // -------------------------------------------------------------------------
  app.get(
    "/api/admin/chatbot/product-suggestions",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const showResolved = req.query.resolved === "true";

        const rows = await db
          .select()
          .from(chatbotProductSuggestions)
          .where(eq(chatbotProductSuggestions.resolved, showResolved))
          .orderBy(desc(chatbotProductSuggestions.mentionCount));

        return res.json({ data: rows });
      } catch (err: any) {
        console.error("[Chatbot] GET /product-suggestions error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // -------------------------------------------------------------------------
  // PATCH /api/admin/chatbot/product-suggestions/:id
  // -------------------------------------------------------------------------
  app.patch(
    "/api/admin/chatbot/product-suggestions/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const idRaw = req.params.id;
        const id = parseInt(Array.isArray(idRaw) ? idRaw[0] : idRaw, 10);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid ID" });
        }

        const { resolved } = req.body;
        if (typeof resolved !== "boolean") {
          return res
            .status(400)
            .json({ message: "resolved (boolean) is required" });
        }

        const [updated] = await db
          .update(chatbotProductSuggestions)
          .set({ resolved })
          .where(eq(chatbotProductSuggestions.id, id))
          .returning();

        if (!updated) {
          return res.status(404).json({ message: "Record not found" });
        }

        return res.json({ success: true, data: updated });
      } catch (err: any) {
        console.error("[Chatbot] PATCH /product-suggestions/:id error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );
}
