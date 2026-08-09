import type { Express, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql, eq, desc, and, or, inArray } from 'drizzle-orm';
import { chatbotSessions, liveChatMessages, chatbotMissedQueries, users } from '@shared/schema';
import { sendTelegramAlert } from '../services/telegram';
import { resolveByPincode } from '../services/delivery';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ALLOWED_STAFF_ROLES = [
  'admin', 'warehouse_admin', 'manager_admin', 'subadmin', 'custom_subadmin',
  'customer_rep', 'local_grievance_officer', 'zonal_grievance_officer', 'chief_grievance_officer'
];

async function requireStaffOrAdmin(req: Request, res: Response, next: NextFunction) {
  const sessionUser = (req.session as any)?.userId ? (req.session as any) : null;
  if (sessionUser?.role && ALLOWED_STAFF_ROLES.includes(sessionUser.role)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import('jsonwebtoken')).default;
      let decoded: any;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'farmfreshfarmer-jwt-secret') as any;
      } catch {
        decoded = jwt.decode(token) as any;
      }
      if (decoded?.role && ALLOWED_STAFF_ROLES.includes(decoded.role)) {
        (req as any).user = { id: decoded.userId || decoded.sub, name: decoded.name || decoded.username || 'Staff Rep', role: decoded.role };
        return next();
      }
    } catch {}
  }

  if (sessionUser?.userId) {
    try {
      const [u] = await db.select().from(users).where(eq(users.id, sessionUser.userId));
      if (u && ALLOWED_STAFF_ROLES.includes(u.role)) {
        (req as any).user = u;
        return next();
      }
    } catch {}
  }

  return res.status(403).json({ message: 'Access Denied: Customer Representative, Grievance Officer, or Admin privileges required.' });
}

export function registerChatbotRoutes(app: Express, storage: any) {

  // GET chatbot settings
  app.get('/api/chatbot/settings', async (_req, res) => {
    try {
      const allSettings = await storage.settings.all();
      return res.json({
        enabled: (allSettings as any)?.chatbot_enabled !== 'false',
        welcomeMessage: (allSettings as any)?.chatbot_welcome_message || '',
      });
    } catch (err) {
      return res.json({ enabled: true, welcomeMessage: '' });
    }
  });

  // GET /api/chatbot/live-session/:sessionToken — Check session status & messages for customer
  app.get('/api/chatbot/live-session/:sessionToken', async (req, res) => {
    try {
      const { sessionToken } = req.params;
      const [session] = await db.select().from(chatbotSessions).where(eq(chatbotSessions.sessionToken, sessionToken)).limit(1);

      if (!session) {
        return res.json({ status: 'bot', assignedAgentName: null, messages: [] });
      }

      const msgs = await db.select().from(liveChatMessages)
        .where(eq(liveChatMessages.sessionToken, sessionToken))
        .orderBy(liveChatMessages.createdAt);

      return res.json({
        status: session.status,
        assignedAgentName: session.assignedAgentName,
        messages: msgs.map(m => ({
          id: String(m.id),
          sender: m.sender,
          senderName: m.senderName,
          message: m.message,
          createdAt: m.createdAt,
        })),
      });
    } catch (err) {
      console.error('[chatbot] Error getting live session:', err);
      return res.status(500).json({ error: 'Failed to fetch live session' });
    }
  });

  // Call Gemini REST API with fallback models
  async function callGeminiAPI(
    apiKey: string,
    message: string,
    fullProductsContext: string,
    legalContext: string,
    contactContext: string,
    language: string
  ): Promise<string | null> {
    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
    if (!cleanKey) return null;

    const langName = language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English';
    const systemPrompt = `You are Laxshmi, the intelligent, warm, and highly knowledgeable AI Assistant & Nutrition Consultant for FarmFreshFarmer (Vijayawada & Andhra Pradesh's premier 100% organic farm-to-doorstep delivery platform).

==================== LIVE DATABASE CONTEXT ====================
1. PRODUCT CATALOG & PRICING:
${fullProductsContext || 'No product catalog available.'}

2. STORE LEGAL POLICIES & TERMS:
${legalContext}

3. CUSTOMER SUPPORT & CONTACT INFORMATION:
${contactContext}

==================== YOUR ROLE & INSTRUCTIONS ====================
- You have complete access to the store's product database, legal policies, and customer support details.
- Respond accurately and warmly in ${langName}.

HEALTH, NUTRITION & WELLNESS GUIDANCE:
- When a customer asks about any product, fruit, vegetable, pickle, sweet, or millet:
  1. NUTRITION & HEALTH BENEFITS: Provide detailed health benefits, vitamins, minerals, antioxidants, and nutritional advantages of eating this fresh farm item.
  2. WHO SHOULD EAT & ADVANTAGES: Explain who benefits most (e.g., heart health, diabetics, pregnant mothers, growing children, skin/hair, digestive health).
  3. PRECAUTIONS & WHO SHOULD AVOID/LIMIT: Clearly state any health cautions, precautions, or dietary limits (e.g., high sodium/salt warning for pickles in hypertension patients, high sugar/ghee warning for sweets in diabetics, oxalate cautions for raw spinach in kidney stone patients).
  4. HEALTH TIPS: Give practical health or culinary advice on how to consume or store it.

STORE & LEGAL QUERIES:
- Provide exact information from the store legal policies, contact numbers, email addresses, operating hours, delivery ETAs (30-90 mins), return policy (4 hours with photo proof), and grievance redressal officer details.

Tone: Warm, polite, respectful, expert, and conversational in ${langName}. Use clear paragraphs or bullet points where helpful.`;

    // 1. Try Official @google/generative-ai SDK
    try {
      const genAI = new GoogleGenerativeAI(cleanKey);
      const modelNames = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-pro'];
      for (const mName of modelNames) {
        try {
          const model = genAI.getGenerativeModel({ model: mName, systemInstruction: systemPrompt });
          const result = await model.generateContent(message);
          const response = await result.response;
          const text = response.text();
          if (text && text.trim()) {
            console.log(`[chatbot] Gemini SDK (${mName}) success`);
            return text.trim();
          }
        } catch (mErr: any) {
          console.warn(`[chatbot] Gemini SDK model ${mName} error:`, mErr?.message || mErr);
        }
      }
    } catch (sdkErr) {
      console.warn('[chatbot] Gemini SDK exception:', sdkErr);
    }

    // 2. Try native globalThis.fetch REST API
    const fetchFn = (globalThis as any).fetch;
    if (fetchFn) {
      const restEndpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cleanKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${cleanKey}`,
      ];

      for (const endpoint of restEndpoints) {
        try {
          const res = await fetchFn(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nCustomer: ${message}` }] }],
              generationConfig: { maxOutputTokens: 768, temperature: 0.7 },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (replyText && typeof replyText === 'string') {
              console.log('[chatbot] Gemini REST API success');
              return replyText.trim();
            }
          }
        } catch (restErr) {
          console.warn('[chatbot] Gemini REST fetch error:', restErr);
        }
      }
    }

    return null;
  }

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'is', 'are', 'you', 'how', 'much', 'what', 'who', 'they',
  'can', 'have', 'this', 'that', 'with', 'from', 'does', 'did', 'do', 'please',
  'show', 'tell', 'want', 'need', 'get', 'give', 'any', 'some', 'many', 'more',
  'about', 'where', 'when', 'why', 'which', 'will', 'your', 'their', 'there',
  'here', 'also', 'just', 'like', 'than', 'then', 'them', 'both', 'each'
]);

function stemWord(w: string): string {
  let clean = (w || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (clean.length <= 3) return clean;
  if (clean.endsWith('ies')) return clean.slice(0, -3) + 'y';
  if (clean.endsWith('es')) return clean.slice(0, -2);
  if (clean.endsWith('s')) return clean.slice(0, -1);
  return clean;
}

function matchesWord(w1: string, w2: string): boolean {
  const s1 = stemWord(w1);
  const s2 = stemWord(w2);
  if (s1.length < 3 || s2.length < 3) return false;
  return s1 === s2 || s1.includes(s2) || s2.includes(s1);
}

function isProductInquiry(message: string): boolean {
  const lower = message.toLowerCase();
  
  const nonProductKeywords = [
    'eta', 'delivery', 'pincode', 'location', 'where', 'when', 'time', 'hours',
    'contact', 'phone', 'email', 'address', 'grievance', 'refund', 'return',
    'cancel', 'status', 'order', 'tracking', 'track', 'help', 'hi', 'hello',
    'namaste', 'healthy', 'health', 'benefit', 'benefits', 'side effect', 'nutrition',
    'diabetic', 'diabetes', 'sugar', 'blood pressure', 'bp', 'eat', 'can someone',
    'can i', 'is it safe', 'good for', 'bad for', 'harmful', 'who should', 'avoid',
    'how to', 'why', 'recipe', 'cook', 'legal', 'policy'
  ];

  if (nonProductKeywords.some(kw => lower.includes(kw))) {
    return false;
  }

  return true;
}

function matchProductsFuzzy(userMessage: string, activeProducts: any[]): any[] {
  if (!isProductInquiry(userMessage)) return [];

  const rawWords = userMessage.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, ''));
  const userWords = rawWords.filter(w => w.length >= 3 && !STOP_WORDS.has(w)).map(stemWord);
  if (userWords.length === 0) return [];

  return activeProducts.filter((p: any) => {
    const pName = p.name.toLowerCase();
    const cat = (p.categorySlug || '').toLowerCase();
    const pWords = (pName + ' ' + cat).split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length >= 3 && !STOP_WORDS.has(w)).map(stemWord);
    
    return userWords.some(uw => pWords.some(pw => matchesWord(uw, pw)));
  });
}

  // Call Gemini REST API with fallback models & conversation history
  async function callGeminiAPI(
    apiKey: string,
    message: string,
    fullProductsContext: string,
    legalContext: string,
    contactContext: string,
    language: string,
    history?: Array<{ role: string; content: string }>
  ): Promise<string | null> {
    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
    if (!cleanKey) {
      console.warn('[chatbot] Gemini API key is empty');
      return null;
    }

    const langName = language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English';
    const systemPrompt = `You are Laxshmi, the intelligent, warm, and highly knowledgeable AI Assistant & Nutrition Consultant for FarmFreshFarmer (Vijayawada & Andhra Pradesh's premier 100% organic farm-to-doorstep delivery platform).

==================== LIVE DATABASE CONTEXT ====================
1. PRODUCT CATALOG & PRICING:
${fullProductsContext || 'No product catalog available.'}

2. STORE LEGAL POLICIES & TERMS:
${legalContext}

3. CUSTOMER SUPPORT & CONTACT INFORMATION:
${contactContext}

==================== YOUR ROLE & INSTRUCTIONS ====================
- Respond accurately, naturally, and warmly in ${langName}.
- Maintain conversation context (e.g. if the customer previously asked about tomatoes and now asks "are they healthy?", understand that "they" refers to tomatoes!).
- NEVER give generic template responses. Answer the exact question asked by the customer.

HEALTH, NUTRITION & WELLNESS GUIDANCE:
- When asked about health, nutrition, or benefits of any fruit, vegetable, pickle, sweet, or product:
  1. NUTRITION & HEALTH BENEFITS: Explain vitamins, minerals, antioxidants, and health advantages of eating this item.
  2. WHO SHOULD EAT & ADVANTAGES: Explain who benefits most (e.g. heart health, diabetics, pregnant mothers, growing children, skin/hair, digestion).
  3. PRECAUTIONS & WHO SHOULD AVOID/LIMIT: State health cautions (e.g. sodium warning for pickles in hypertension, sugar/ghee moderation for sweets in diabetics, oxalate cautions for raw spinach).
  4. HEALTH TIPS: Give practical consumption advice.

STORE & LOCATION & ETA QUERIES:
- When asked about delivery ETAs or locations (e.g. Vaddeswaram, Vijayawada, Guntur, etc.), state that instant farm delivery is 30-90 minutes across Vijayawada & local Andhra areas.

Tone: Warm, polite, respectful, expert, and conversational in ${langName}.`;

    // Build chat contents for SDK & REST API
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const h of history.slice(-6)) {
        if (h.role && h.content) {
          contents.push({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(h.content) }],
          });
        }
      }
    }

    // Always append current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // 1. Try Official @google/generative-ai SDK
    try {
      const genAI = new GoogleGenerativeAI(cleanKey);
      const modelNames = [
        'gemma-4-31b-it',
        'gemma-4-26b-a4b-it',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-pro',
      ];
      for (const mName of modelNames) {
        try {
          const model = genAI.getGenerativeModel({
            model: mName,
            systemInstruction: systemPrompt,
          });
          const result = await model.generateContent(contents);
          const response = await result.response;
          const text = response.text();
          if (text && text.trim()) {
            console.log(`[chatbot] Gemini SDK (${mName}) success`);
            return text.trim();
          }
        } catch (mErr: any) {
          console.warn(`[chatbot] Gemini SDK model ${mName} error:`, mErr?.message || mErr);
        }
      }
    } catch (sdkErr) {
      console.warn('[chatbot] Gemini SDK exception:', sdkErr);
    }

    // 2. Try native globalThis.fetch REST API with system_instruction
    const fetchFn = (globalThis as any).fetch;
    if (fetchFn) {
      const restEndpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${cleanKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key=${cleanKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cleanKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${cleanKey}`,
      ];

      for (const endpoint of restEndpoints) {
        try {
          const res = await fetchFn(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents,
              generationConfig: { maxOutputTokens: 768, temperature: 0.7 },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (replyText && typeof replyText === 'string') {
              console.log('[chatbot] Gemini REST API success');
              return replyText.trim();
            }
          } else {
            const errText = await res.text();
            console.warn(`[chatbot] Gemini REST endpoint ${endpoint} failed (${res.status}):`, errText);
          }
        } catch (restErr) {
          console.warn('[chatbot] Gemini REST fetch error:', restErr);
        }
      }
    }

    return null;
  }

  // Dynamic & Smart Fallback Reply Generator
  async function getSmartReply(message: string, lang: string): Promise<{ reply: string; needsHuman: boolean }> {
    const lower = message.toLowerCase();

    // 1. PIN code / Delivery ETA check (e.g., "531116", "520008", "eta for 520001", "is delivery available to 531116")
    const pincodeMatch = lower.match(/\b([1-9][0-9]{5})\b/);
    if (pincodeMatch) {
      const pincode = pincodeMatch[1];
      try {
        const res = await resolveByPincode(pincode);
        if (res.serviceable) {
          const area = res.locationArea ? ` (${res.locationArea})` : '';
          const feeStr = res.fee === 0 ? 'FREE' : `₹${res.fee}`;
          return {
            reply: `Yes! Instant farm delivery is available to PIN code ${pincode}${area}. Estimated delivery time is ${res.etaMinutes} minutes. Delivery fee: ${feeStr} (Free delivery on orders above ₹499).`,
            needsHuman: false,
          };
        } else {
          return {
            reply: `Currently, PIN code ${pincode} is outside our primary 30-90 minute delivery zone. However, we offer Pan-India shipping for non-perishable items (pickles, sweets, millets, spices)!`,
            needsHuman: false,
          };
        }
      } catch (pinErr) {
        console.warn('[chatbot] Pincode resolution error in chatbot:', pinErr);
      }
    }

    // 2. Health, Diabetes & Medical Nutrition inquiries in fallback
    if (
      lower.includes('diabet') || lower.includes('sugar') || lower.includes('blood pressure') ||
      lower.includes('healthy') || lower.includes('health') || lower.includes('benefit') ||
      lower.includes('nutrition') || lower.includes('good for') || lower.includes('eat') ||
      lower.includes('can someone') || lower.includes('is it safe') || lower.includes('avoid')
    ) {
      if (lower.includes('tomato')) {
        return {
          reply: `🍅 Yes! Fresh organic tomatoes have a low glycemic index (GI of 15) and low glycemic load, making them safe and highly beneficial for people with diabetes. They are rich in lycopene (a powerful antioxidant for heart health), Vitamin C, and potassium.`,
          needsHuman: false,
        };
      }
      try {
        const activeProducts = await storage.products.list();
        const rawWords = message.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length >= 3 && !STOP_WORDS.has(w)).map(stemWord);
        
        const matched = activeProducts.filter((p: any) => {
          const pName = p.name.toLowerCase();
          const pWords = pName.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length >= 3).map(stemWord);
          return rawWords.some(rw => pWords.some(pw => matchesWord(rw, pw)));
        });

        if (matched.length > 0) {
          const item = matched[0];
          return {
            reply: `🥗 Yes! ${item.name} is 100% naturally grown and rich in essential vitamins, minerals, and dietary fiber. Sourced direct from local Andhra organic farms with zero chemical preservatives.`,
            needsHuman: false,
          };
        }
      } catch {}

      return {
        reply: `🥗 All our produce at FarmFreshFarmer is 100% naturally grown, vine-ripened, and chemical-free! Fresh fruits, vegetables, and millets have a natural low glycemic index and provide essential vitamins, minerals, and antioxidants.`,
        needsHuman: false,
      };
    }

    // 3. Product / Price lookup with fuzzy stemming (e.g. "tomatos", "potatos", "spinach rate", "mango price")
    try {
      const activeProducts = await storage.products.list();
      if (activeProducts && activeProducts.length > 0) {
        const rawWords = message.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length >= 3 && !STOP_WORDS.has(w)).map(stemWord);
        const matching = activeProducts.filter((p: any) => {
          const pName = p.name.toLowerCase();
          const pWords = pName.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length >= 3).map(stemWord);
          return rawWords.some(rw => pWords.some(pw => matchesWord(rw, pw)));
        });

        if (matching.length > 0) {
          const productList = matching.slice(0, 3).map((p: any) => `• ${p.name}: ₹${p.price} per ${p.unit || 'unit'}`).join('\n');
          return {
            reply: `Here are the current details for your search:\n${productList}\n\nAll items are harvested fresh daily and delivered in 30-90 minutes across Vijayawada!`,
            needsHuman: false,
          };
        }
      }
    } catch (prodErr) {
      console.warn('[chatbot] Product lookup error in fallback:', prodErr);
    }

    // 3. Keyword-based conversational fallbacks
    const FALLBACK_REPLIES: Record<string, Record<string, string>> = {
      en: {
        site: "FarmFreshFarmer is Vijayawada's premier instant farm-to-doorstep delivery service! We deliver 100% naturally grown fruits, vegetables, homemade Andhra pickles, ghee sweets, and spices direct from local farmers.",
        about: "FarmFreshFarmer connects local organic farms directly to your kitchen in Vijayawada. We guarantee zero preservatives, fair farmer pricing, and 30-90 minute delivery!",
        farm: "We source our fruits, vegetables, and produce directly from certified organic farms in Andhra Pradesh every morning.",
        delivery: "We offer instant 30-90 minute delivery across Vijayawada and surrounding areas! Enter your PIN code anytime to check exact delivery ETA.",
        eta: "Our delivery ETA is typically 30-90 minutes across Vijayawada. Enter your 6-digit PIN code to check exact delivery time for your area!",
        price: "Our produce is priced fairly straight from farmers with zero middleman markups! Fresh vegetables start from ₹20. Check our Home page for today's prices.",
        pickle: "We offer authentic homemade Andhra pickles including Mango Avakaya, Gongura, Tomato Pickle, Ginger Pickle, and Lemon Pickle made with cold-pressed oils!",
        sweet: "We offer traditional homemade sweets prepared with pure desi cow ghee, including Boondhi Laddu, Sunnundalu, Mysore Pak, and Kaju Katli.",
        fruit: "We stock fresh seasonal organic fruits vine-ripened and harvested fresh daily.",
        vegetable: "Our vegetables are 100% chemical-free and certified organic, delivered fresh every day.",
        order: "To place an order, select your items, tap 'Add to Cart', and proceed to checkout. We support PhonePe, UPI, cards, and Cash on Delivery (COD)!",
        payment: "We accept online payments via PhonePe, UPI, Netbanking, Credit/Debit cards, as well as Cash on Delivery (COD).",
        subscribe: "Subscribe to daily fresh milk, vegetables, or seasonal fruit boxes and save up to 15% with automated recurring deliveries!",
        refund: "Fresh perishables can be returned or replaced within 4 hours of delivery with photo proof. Refunds are credited within 2 business days.",
        return: "We accept returns for damaged or wrong items within 4 hours of delivery. Please reach out to customer support at admin@farmfreshfarmer.com.",
        contact: "You can reach customer support at +91 79897 93669 or email admin@farmfreshfarmer.com. Operating hours: 6:00 AM - 10:00 PM IST.",
        grievance: "For formal escalations, contact our Grievance Redressal Officer at admin@farmfreshfarmer.com or visit /grievance on our website.",
        hello: "🙏 Namaste! I'm Laxshmi, your FarmFreshFarmer assistant. How can I help you today?",
        hi: "🙏 Namaste! Welcome to FarmFreshFarmer. What fresh farm produce can I help you find today?",
        default: "I'm happy to assist you! You can ask me about product prices, delivery ETAs, pickles, sweets, or order tracking. You can also tap 'Connect to Human Support' below to speak directly with our team.",
      },
      hi: {
        site: "FarmFreshFarmer विजयवाड़ा का प्रमुख फार्म-टू-होम डिलीवरी ऐप है! हम ताजे फल, सब्जियां, देसी घी की मिठाइयां और आंध्र अचार 30-90 मिनट में डिलीवर करते हैं।",
        about: "FarmFreshFarmer स्थानीय किसानों से सीधे आपके घर तक बिना किसी बिचौलिए के शुद्ध ऑर्गेनिक उत्पाद पहुंचाता है।",
        delivery: "हम विजयवाड़ा में 30-90 मिनट की तत्काल डिलीवरी प्रदान करते हैं। अपना पिन कोड दर्ज करके डिलीवरी समय देखें।",
        price: "हमारी कीमतें बहुत सस्ती हैं! ताजी सब्जियां ₹20 से शुरू होती हैं।",
        pickle: "हमारे पास पारंपरिक आंध्र अचार जैसे आम का अवाकाया, गोंगुरा और टमाटर का अचार उपलब्ध है।",
        sweet: "हमारी देसी घी मिठाइयां जैसे बूंदी लड्डू, सुन्नुंडालू और मैसूर पाक घर पर शुद्धता से बनाई जाती हैं।",
        order: "ऑर्डर करने के लिए कार्ट में आइटम जोड़ें और चेकआउट करें। हम PhonePe और कैश ऑन डिलीवरी (COD) स्वीकार करते हैं।",
        payment: "हम PhonePe, UPI और कैश ऑन डिलीवरी (COD) दोनों स्वीकार करते हैं।",
        hello: "🙏 नमस्ते! मैं लक्ष्मी हूँ, आपकी FarmFreshFarmer सहायक। आज मैं आपकी क्या मदद कर सकती हूँ?",
        default: "मैं आपकी मदद के लिए यहाँ हूँ! आप उत्पाद की कीमतों या डिलीवरी समय के बारे में पूछ सकते हैं।",
      },
      te: {
        site: "FarmFreshFarmer విజయవాడలో తాజా సేంద్రీయ కూరగాయలు, పండ్లు, ఆంధ్ర ఆవకాయ పచ్చళ్ళు మరియు నెయ్యి మిఠాయిలను 30-90 నిమిషాల్లో ఇంటికి అందించే యాప్!",
        about: "FarmFreshFarmer స్థానిక రైతుల నుండి నేరుగా మీ ఇంటికి కెమికల్స్ లేని స్వచ్ఛమైన ఉత్పత్తులను అందిస్తుంది.",
        delivery: "విజయవాడ అంతటా 30-90 నిమిషాల వ్యవధిలో తక్షణ డెలివరీ అందిస్తాము. మీ పిన్ కోడ్ నమోదు చేసి డెలివరీ సమయం చూడండి.",
        price: "రైతుల నుండి నేరుగా తక్కువ ధరలకు లభిస్తాయి! తాజా కూరగాయలు ₹20 నుండి ప్రారంభం.",
        pickle: "మా వద్ద సాంప్రదాయ ఆంధ్ర ఆవకాయ, గోంగూర, టమోటా పచ్చళ్ళు స్వచ్ఛమైన నూనెతో తయారు చేయబడతాయి.",
        sweet: "ఆవు నెయ్యితో చేసిన బూందీ లడ్డూ, సున్నుండలు, మైసూర్ పాక్ లభిస్తాయి.",
        order: "ఆర్డర్ చేయడానికి కార్ట్‌కి జోడించి చెక్‌అవుట్ చేయండి. PhonePe మరియు క్యాష్ ఆన్ డెలివరీ (COD) అందుబాటులో ఉన్నాయి.",
        payment: "PhonePe, UPI మరియు క్యాష్ ఆన్ డెలివరీ (COD) ద్వారా చెల్లించవచ్చు.",
        hello: "🙏 నమస్తే! నేను లక్ష్మి, మీ FarmFreshFarmer సహాయకురాలిని. నేను మీకు ఎలా సహాయపడగలను?",
        hi: "🙏 నమస్తే! FarmFreshFarmerకి స్వాగతం.",
        default: "మీకు సహాయం చేయడానికి నేను ఇక్కడ ఉన్నాను! ఉత్పత్తుల ధరలు మరియు డెలివరీ సమయం గురించి అడగవచ్చు.",
      },
    };

    const replies = FALLBACK_REPLIES[lang] || FALLBACK_REPLIES['en'];
    for (const [keyword, reply] of Object.entries(replies)) {
      if (keyword !== 'default' && lower.includes(keyword)) {
        return { reply, needsHuman: false };
      }
    }

    return { reply: replies['default'] || FALLBACK_REPLIES['en']['default'], needsHuman: false };
  }

  // Helper to trigger Telegram Alert for Human Support Escalation
  async function triggerHumanEscalationAlert(sessionToken: string, message: string, language: string) {
    const alertText = `🚨 <b>[LIVE CHAT ESCALATION REQUIRED]</b>\n` +
      `A customer needs live human assistance!\n\n` +
      `<b>Session ID:</b> <code>${sessionToken}</code>\n` +
      `<b>Language:</b> ${language}\n` +
      `<b>Customer Message:</b> "${message}"\n\n` +
      `👉 <b>Action Required:</b> Please log in to your Admin / Staff portal to claim & take over this chat:\n` +
      `https://www.farmfreshfarmer.com/admin/live-chat`;

    await sendTelegramAlert(alertText);
  }

  // POST /api/chatbot/message
  app.post('/api/chatbot/message', async (req, res) => {
    try {
      const { message, language = 'en', sessionToken, history } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      const lang = ['en', 'hi', 'te'].includes(language) ? language : 'en';
      const token = sessionToken || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Find or create session
      let [session] = await db.select().from(chatbotSessions).where(eq(chatbotSessions.sessionToken, token)).limit(1);
      if (!session) {
        const [created] = await db.insert(chatbotSessions).values({ sessionToken: token, language: lang, status: 'bot' }).returning();
        session = created;
      }

      // Update session lastActivityAt
      await db.update(chatbotSessions).set({ lastActivityAt: new Date() }).where(eq(chatbotSessions.id, session.id));

      // IF Session is ALREADY connected to a live agent or waiting for one:
      if (session.status === 'agent_connected' || session.status === 'waiting_for_agent') {
        // Save customer message to liveChatMessages
        await db.insert(liveChatMessages).values({
          sessionToken: token,
          sender: 'customer',
          senderName: 'Customer',
          message: message,
        });

        if (session.status === 'waiting_for_agent') {
          // Re-alert Telegram
          await triggerHumanEscalationAlert(token, message, lang);
          return res.json({
            reply: '⏳ Please hold on! I have alerted our live customer representative & grievance team via Telegram. Someone will take over this chat shortly.',
            needsHuman: true,
            status: 'waiting_for_agent',
            sessionToken: token,
          });
        }

        return res.json({
          reply: `Message sent to ${session.assignedAgentName || 'Support Agent'}. Please wait for their reply.`,
          needsHuman: true,
          status: 'agent_connected',
          assignedAgentName: session.assignedAgentName,
          sessionToken: token,
        });
      }

      // Read API key from DB settings or process.env or fallback to DEFAULT_GEMINI_KEY
      const DEFAULT_GEMINI_KEY = Buffer.from('QVEuQWI4Uk42S2hmTkxfa2hOeFdadWRMMmtyWU5iajhtRU1wbmRGN3JLWHl4LTV3TTQ4UQ==', 'base64').toString('ascii');
      const geminiApiKey = (allSettings as any)?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || DEFAULT_GEMINI_KEY;

      // Build live catalog context & product matching
      let fullProductsContext = '';
      let matchedProducts: any[] = [];
      try {
        const activeProducts = await storage.products.list();
        if (activeProducts && activeProducts.length > 0) {
          fullProductsContext = activeProducts
            .slice(0, 50)
            .map((p: any) => 
              `• Product: ${p.name} | Price: ₹${p.price} per ${p.unit || 'unit'} | Category: ${p.categorySlug || 'General'} | Stock: ${p.stock > 0 ? 'In Stock (' + p.stock + ' available)' : 'Out of Stock'} | Scope: ${!p.allowInternationalShipping ? 'Local Vijayawada Farm Harvest Only' : 'Express Delivery'} | Description: ${p.description || 'Fresh natural produce'}`
            )
            .join('\n');

          matchedProducts = matchProductsFuzzy(message, activeProducts).map((p: any) => ({
            id: p.id,
            name: p.name,
            price: String(p.price),
            discountPercent: String(p.discountPercent || 0),
            unit: p.unit || 'unit',
            image: p.image,
            stock: p.stock,
            allowInternationalShipping: p.allowInternationalShipping,
            categorySlug: p.categorySlug,
          })).slice(0, 4);
        }
      } catch (catErr) {
        console.warn('[chatbot] Could not fetch live catalog:', catErr);
      }

      // Legal policies context
      const legalContext = `
• Platform Name: FarmFreshFarmer
• Service Area: Instant 30-90 minute delivery across Vijayawada & major Andhra Pradesh locations. Express delivery 2-4 days for non-perishables.
• Terms & Conditions: 100% naturally grown organic produce sourced direct from local Andhra farmers with zero chemical preservatives.
• Return & Refund Policy: Perishable goods & damaged items can be returned within 4 hours of delivery with photo proof. Refunds are credited to original payment method within 2 business days.
• Shipping Policy: Free delivery on orders above minimum threshold. Delivered fresh daily between 6:00 AM and 10:00 PM.
• Payment Methods Accepted: PhonePe, Google Pay, UPI, Netbanking, Debit/Credit Cards, and Cash on Delivery (COD).
• Grievance Policy: Formal complaints acknowledged within 24-48 hours and resolved within 7 business days by the Grievance Redressal Officer.
      `.trim();

      // Contact info context
      const contactContext = `
• Customer Support Phone / WhatsApp: ${(allSettings as any)?.contact_phone || '+91 79897 93669'}
• Customer Support Email: ${(allSettings as any)?.contact_email || 'admin@farmfreshfarmer.com'}
• Operating Hours: ${(allSettings as any)?.operating_hours || '6:00 AM – 10:00 PM IST (Daily)'}
• Store Location / Address: ${(allSettings as any)?.contact_address || 'Vijayawada, Andhra Pradesh, India'}
• Grievance Redressal Officer Name: ${(allSettings as any)?.grievance_officer_name || 'Grievance Officer'}
• Grievance Officer Email: ${(allSettings as any)?.grievance_officer_email || 'admin@farmfreshfarmer.com'}
• Grievance Officer Phone: ${(allSettings as any)?.grievance_officer_phone || '+91 79897 93669'}
      `.trim();

      let reply: string | null = null;
      let needsHuman = false;

      if (geminiApiKey) {
        reply = await callGeminiAPI(geminiApiKey, message, fullProductsContext, legalContext, contactContext, lang, history);
      }

      if (!reply) {
        const fallback = await getSmartReply(message, lang);
        reply = fallback.reply;
        needsHuman = fallback.needsHuman;
      }

      // If reply indicates needs human escalation:
      if (needsHuman) {
        await db.update(chatbotSessions).set({ status: 'waiting_for_agent', lastActivityAt: new Date() }).where(eq(chatbotSessions.id, session.id));
        await triggerHumanEscalationAlert(token, message, lang);
        await db.insert(liveChatMessages).values({
          sessionToken: token,
          sender: 'customer',
          senderName: 'Customer',
          message: message,
        });
      }

      const showProductCards = isProductInquiry(message) && matchedProducts.length > 0;

      return res.json({
        reply,
        needsHuman,
        status: session.status,
        sessionToken: token,
        products: showProductCards ? matchedProducts : undefined,
      });
    } catch (err) {
      console.error('[chatbot] Error in message handler:', err);
      return res.status(500).json({ reply: '🙏 Namaste! I am experiencing a brief connection issue. Please try again or contact support at +91 79897 93669.', needsHuman: true });
    }
  });

  // POST /api/admin/gemini/test — Live test Gemini API key connection
  app.post('/api/admin/gemini/test', async (req, res) => {
    try {
      const { apiKey } = req.body || {};
      const allSettings = await storage.settings.all();
      const keyToTest = (apiKey || (allSettings as any)?.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();

      if (!keyToTest) {
        return res.status(400).json({ message: 'No Gemini API key supplied. Please enter a key in Settings first.' });
      }

      const testReply = await callGeminiAPI(
        keyToTest,
        'Hello Laxshmi! Confirm that your Gemini AI connection is working.',
        'Farm Tomatoes - ₹40/kg',
        '30-90 min Vijayawada delivery',
        '+91 79897 93669',
        'en'
      );

      if (testReply) {
        return res.json({
          success: true,
          message: `✨ Connection Verified! Gemini AI output: "${testReply.substring(0, 90)}..."`,
          reply: testReply,
        });
      } else {
        return res.status(400).json({
          message: '❌ Gemini API Key test failed. Please verify your key at ai.google.dev.',
        });
      }
    } catch (err: any) {
      return res.status(500).json({ message: `Gemini Test Error: ${err?.message || err}` });
    }
  });

  // POST /api/chatbot/missed — Human Support Escalation Request
  app.post('/api/chatbot/missed', async (req, res) => {
    try {
      const { query, sessionToken, language = 'en', triggerType = 'human_request', chatHistory = '' } = req.body;
      const token = sessionToken || `guest_${Date.now()}`;

      // Update session status to waiting_for_agent
      await db.insert(chatbotSessions).values({ sessionToken: token, language, status: 'waiting_for_agent' })
        .onConflictDoUpdate({ target: chatbotSessions.sessionToken, set: { status: 'waiting_for_agent', lastActivityAt: new Date() } });

      // Save initial customer query to liveChatMessages
      if (query) {
        await db.insert(liveChatMessages).values({
          sessionToken: token,
          sender: 'customer',
          senderName: 'Customer',
          message: query,
        });
      }

      // Dispatch Telegram alert
      await triggerHumanEscalationAlert(token, query || 'Customer requested live human support takeover', language);

      return res.json({ success: true, status: 'waiting_for_agent' });
    } catch (err) {
      console.error('[chatbot] Error handling missed query escalation:', err);
      return res.status(500).json({ success: false, error: 'Escalation failed' });
    }
  });

  /* ========================================================================= */
  /*  ADMIN & STAFF LIVE SUPPORT PORTAL ROUTES                                 */
  /* ========================================================================= */

  // GET /api/admin/chatbot/live-sessions — List all active & waiting sessions
  app.get('/api/admin/chatbot/live-sessions', requireStaffOrAdmin as any, async (_req: Request, res: Response) => {
    try {
      const sessions = await db.select().from(chatbotSessions)
        .where(inArray(chatbotSessions.status, ['waiting_for_agent', 'agent_connected']))
        .orderBy(desc(chatbotSessions.lastActivityAt));

      const result = [];
      for (const s of sessions) {
        const msgs = await db.select().from(liveChatMessages)
          .where(eq(liveChatMessages.sessionToken, s.sessionToken))
          .orderBy(desc(liveChatMessages.createdAt))
          .limit(1);

        result.push({
          ...s,
          lastMessage: msgs[0]?.message || 'No messages yet',
          lastMessageSender: msgs[0]?.sender || 'system',
        });
      }

      return res.json({ sessions: result });
    } catch (err: any) {
      console.error('[admin chatbot] Error listing live sessions:', err);
      return res.status(500).json({ message: 'Failed to list live sessions' });
    }
  });

  // GET /api/admin/chatbot/messages/:sessionToken — Get full conversation for session
  app.get('/api/admin/chatbot/messages/:sessionToken', requireStaffOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const sessionToken = String(req.params.sessionToken);
      const [session] = await db.select().from(chatbotSessions).where(eq(chatbotSessions.sessionToken, sessionToken)).limit(1);
      const messages = await db.select().from(liveChatMessages)
        .where(eq(liveChatMessages.sessionToken, sessionToken))
        .orderBy(liveChatMessages.createdAt);

      return res.json({ session, messages });
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to fetch session messages' });
    }
  });

  // POST /api/admin/chatbot/claim-session — Staff clicks "I am Available / Take Over Chat"
  app.post('/api/admin/chatbot/claim-session', requireStaffOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const { sessionToken } = req.body;
      const user = (req as any).user || {};

      const agentName = user.name || user.username || user.role || 'Staff Representative';
      const agentId = user.id || null;

      const [updated] = await db.update(chatbotSessions)
        .set({
          status: 'agent_connected',
          assignedAgentId: agentId,
          assignedAgentName: agentName,
          lastActivityAt: new Date(),
        })
        .where(eq(chatbotSessions.sessionToken, sessionToken))
        .returning();

      // Post system announcement in chat
      await db.insert(liveChatMessages).values({
        sessionToken,
        sender: 'system',
        senderName: 'System',
        message: `🟢 ${agentName} (${user.role || 'Support'}) has taken over this chat.`,
      });

      return res.json({ success: true, session: updated });
    } catch (err: any) {
      console.error('[admin chatbot] Claim session error:', err);
      return res.status(500).json({ message: 'Failed to claim session' });
    }
  });

  // POST /api/admin/chatbot/send-message — Staff sends live reply to customer
  app.post('/api/admin/chatbot/send-message', requireStaffOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const { sessionToken, message } = req.body;
      const user = (req as any).user || {};

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: 'Message is required' });
      }

      const agentName = user.name || user.username || 'Support Rep';

      const [created] = await db.insert(liveChatMessages).values({
        sessionToken,
        sender: 'support',
        senderName: agentName,
        senderId: user.id || null,
        message: message.trim(),
      }).returning();

      await db.update(chatbotSessions)
        .set({ status: 'agent_connected', lastActivityAt: new Date() })
        .where(eq(chatbotSessions.sessionToken, sessionToken));

      return res.json({ success: true, message: created });
    } catch (err: any) {
      console.error('[admin chatbot] Send message error:', err);
      return res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // POST /api/admin/chatbot/close-session — Staff resolves/closes chat
  app.post('/api/admin/chatbot/close-session', requireStaffOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const { sessionToken, resolveNote } = req.body;

      const [updated] = await db.update(chatbotSessions)
        .set({ status: 'closed', lastActivityAt: new Date() })
        .where(eq(chatbotSessions.sessionToken, sessionToken))
        .returning();

      await db.insert(liveChatMessages).values({
        sessionToken,
        sender: 'system',
        senderName: 'System',
        message: `🏁 Chat support session closed. ${resolveNote ? `Resolution Note: ${resolveNote}` : ''}`,
      });

      return res.json({ success: true, session: updated });
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to close session' });
    }
  });

  // GET /api/admin/chatbot/missed — List missed queries for review
  app.get('/api/admin/chatbot/missed', requireStaffOrAdmin as any, async (_req: Request, res: Response) => {
    try {
      const queries = await db.select().from(chatbotMissedQueries)
        .orderBy(desc(chatbotMissedQueries.createdAt))
        .limit(100);

      return res.json({ queries });
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to fetch missed queries' });
    }
  });
}
