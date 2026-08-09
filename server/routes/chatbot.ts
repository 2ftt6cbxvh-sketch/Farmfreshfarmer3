import type { Express } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { sendTelegramAlert } from '../services/telegram';
import { resolveByPincode } from '../services/delivery';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

  // Gemini AI Call with SDK + Native fetch fallback
  async function callGeminiAI(apiKey: string, message: string, catalogContext: string, language: string): Promise<string | null> {
    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
    if (!cleanKey) return null;

    const langName = language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English';
    const systemPrompt = `You are Laxshmi, the friendly AI assistant for FarmFreshFarmer (instant organic farm-to-doorstep delivery platform operating in Vijayawada & Andhra Pradesh, India).
We sell 100% naturally grown fresh organic fruits, vegetables, homemade ghee sweets, authentic Andhra pickles (Avakaya, Gongura, Tomato), millets, and spices.
Current Catalog & Live Prices: ${catalogContext || 'Farm Tomatoes (₹40/kg), Lady Finger (₹50/500g), Fresh Carrots (₹45/500g), Green Spinach (₹25/bunch)'}

Rules:
1. Be extremely helpful, warm, polite, and concise (max 2-3 sentences).
2. Answer customer questions about products, exact prices, delivery ETAs (typically 30-90 mins), return policy (within 4 hours for perishables), and payments (PhonePe, Cards, COD).
3. If asked about a PIN code or location delivery, explain that we deliver across Vijayawada & major Andhra cities in 30-90 mins.
4. Respond strictly in ${langName}. Use a natural conversational tone.`;

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

    // 2. Try native globalThis.fetch REST API (No node-fetch CJS import)
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
              generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
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

    // 2. Product / Price lookup (e.g. "how much is tomato", "price of lady finger", "spinach rate", "mango price")
    try {
      const activeProducts = await storage.products.list();
      if (activeProducts && activeProducts.length > 0) {
        // Search for matching product in user query
        const matching = activeProducts.filter((p: any) => {
          const pName = p.name.toLowerCase();
          const tokens = pName.split(/\s+/).filter((t: string) => t.length > 2);
          return tokens.some((t: string) => lower.includes(t)) || lower.includes(pName);
        });

        if (matching.length > 0) {
          const productList = matching.slice(0, 3).map((p: any) => `• ${p.name}: ₹${p.price} per ${p.unit || 'unit'}`).join('\n');
          return {
            reply: `Here are the current prices for your search:\n${productList}\n\nAll items are harvested fresh daily and delivered in 30-90 minutes!`,
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
        eta: "हमारी डिलीवरी का समय आमतौर पर 30-90 मिनट है।",
        price: "हमारी कीमतें बहुत सस्ती हैं! ताजी सब्जियां ₹20 से शुरू होती हैं।",
        pickle: "हमारे पास पारंपरिक आंध्र अचार जैसे आम का अवाकाया, गोंगुरा और टमाटर का अचार उपलब्ध है।",
        sweet: "हमारी देसी घी मिठाइयां जैसे बूंदी लड्डू, सुन्नुंडालू और मैसूर पाक घर पर शुद्धता से बनाई जाती हैं।",
        order: "ऑर्डर करने के लिए कार्ट में आइटम जोड़ें और चेकआउट करें। हम PhonePe और कैश ऑन डिलीवरी (COD) स्वीकार करते हैं।",
        payment: "हम PhonePe, UPI और कैश ऑन डिलीवरी (COD) दोनों स्वीकार करते हैं।",
        hello: "🙏 नमस्ते! मैं लक्ष्मी हूँ, आपकी FarmFreshFarmer सहायक। आज मैं आपकी क्या मदद कर सकती हूँ?",
        hi: "🙏 नमस्ते! FarmFreshFarmer में आपका स्वागत है।",
        default: "मैं आपकी मदद के लिए यहाँ हूँ! आप उत्पाद की कीमतों या डिलीवरी समय के बारे में पूछ सकते हैं।",
      },
      te: {
        site: "FarmFreshFarmer విజయవాడలో తాజా సేంద్రీయ కూరగాయలు, పండ్లు, ఆంధ్ర ఆవకాయ పచ్చళ్ళు మరియు నెయ్యి మిఠాయిలను 30-90 నిమిషాల్లో ఇంటికి అందించే యాప్!",
        about: "FarmFreshFarmer స్థానిక రైతుల నుండి నేరుగా మీ ఇంటికి కెమికల్స్ లేని స్వచ్ఛమైన ఉత్పత్తులను అందిస్తుంది.",
        delivery: "విజయవాడ అంతటా 30-90 నిమిషాల వ్యవధిలో తక్షణ డెలివరీ అందిస్తాము. మీ పిన్ కోడ్ నమోదు చేసి డెలివరీ సమయం చూడండి.",
        eta: "మా డెలివరీ సమయం సాధారణంగా 30-90 నిమిషాలు.",
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

  // POST /api/chatbot/message
  app.post('/api/chatbot/message', async (req, res) => {
    try {
      const { message, language = 'en', sessionToken } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      const lang = ['en', 'hi', 'te'].includes(language) ? language : 'en';

      // Read API key from DB settings
      const allSettings = await storage.settings.all();
      const geminiApiKey = (allSettings as any)?.gemini_api_key || process.env.GEMINI_API_KEY || '';

      console.log('[chatbot] Processing query. Gemini API key configured:', !!geminiApiKey);

      // Build live catalog context
      let catalogContext = '';
      try {
        const activeProducts = await storage.products.list();
        if (activeProducts && activeProducts.length > 0) {
          catalogContext = activeProducts
            .slice(0, 35)
            .map((p: any) => `${p.name} (₹${p.price}/${p.unit || 'unit'})`)
            .join(', ');
        }
      } catch (catErr) {
        console.warn('[chatbot] Could not fetch live catalog for prompt context:', catErr);
      }

      let reply: string | null = null;
      let needsHuman = false;

      if (geminiApiKey) {
        reply = await callGeminiAPI(geminiApiKey, message, catalogContext, lang);
      }

      if (!reply) {
        console.log('[chatbot] Gemini SDK/REST returned null or failed. Generating smart fallback reply.');
        const fallback = await getSmartReply(message, lang);
        reply = fallback.reply;
        needsHuman = fallback.needsHuman;
      }

      // Log query to missed queries if needsHuman or no Gemini
      if (needsHuman || !geminiApiKey) {
        try {
          await db.execute(sql`
            INSERT INTO chatbot_missed_queries (session_token, query, language, trigger_type, resolved, telegram_alert_sent)
            VALUES (${sessionToken || 'anonymous'}, ${message}, ${lang}, ${'no_match'}, ${false}, ${false})
          `);
        } catch (dbErr) {
          console.error('[chatbot] Failed to log missed query:', dbErr);
        }
      }

      return res.json({ reply, needsHuman, sessionToken });
    } catch (err) {
      console.error('[chatbot] Error in message handler:', err);
      return res.status(500).json({ reply: '🙏 Namaste! I am experiencing a brief connection issue. Please ask again or contact support at +91 79897 93669.', needsHuman: true });
    }
  });

  // POST /api/chatbot/missed — Human Support Escalation & Telegram Alert
  app.post('/api/chatbot/missed', async (req, res) => {
    try {
      const { query, sessionToken, language = 'en', triggerType = 'human_request', chatHistory = '' } = req.body;

      // Log to database
      try {
        await db.execute(sql`
          INSERT INTO chatbot_missed_queries (session_token, query, language, trigger_type, resolved, telegram_alert_sent)
          VALUES (${sessionToken || 'anonymous'}, ${query || 'Human Escalation Requested'}, ${language}, ${triggerType}, ${false}, ${true})
        `);
      } catch (logErr) {
        console.error('[chatbot] DB log error on missed query:', logErr);
      }

      // Dispatch Telegram alert
      const alertMessage = `🤖 <b>[Laxshmi AI — Support Request]</b>\n` +
        `<b>Session:</b> <code>${sessionToken || 'Unknown'}</code>\n` +
        `<b>Language:</b> ${language}\n` +
        `<b>Request:</b> ${query || 'Customer requested human callback'}\n\n` +
        `<b>Recent Conversation:</b>\n<pre>${(chatHistory || '').slice(-600)}</pre>`;

      const sent = await sendTelegramAlert(alertMessage);

      return res.json({ success: true, telegramAlertSent: sent });
    } catch (err) {
      console.error('[chatbot] Error handling missed query escalation:', err);
      return res.status(500).json({ success: false, error: 'Escalation failed' });
    }
  });
}
