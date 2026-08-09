import type { Express } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { sendTelegramAlert } from '../services/telegram';

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

  // Call Gemini REST API with fallback models
  async function callGeminiAPI(apiKey: string, message: string, catalogContext: string, language: string): Promise<string | null> {
    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
    if (!cleanKey) return null;

    const langName = language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English';
    const systemPrompt = `You are Laxshmi, the friendly AI assistant for FarmFreshFarmer (instant organic farm-to-doorstep delivery platform operating in Vijayawada, Andhra Pradesh, India).
We sell fresh fruits, vine-ripened organic vegetables, homemade ghee sweets, authentic Andhra pickles (Avakaya, Gongura, etc.), millets, and spices.
Current Catalog & Prices: ${catalogContext || 'Fresh Farm Produce, Andhra Pickles, Ghee Sweets'}

Rules:
1. Be extremely helpful, warm, polite, and concise (max 3-4 sentences).
2. Answer customer questions about products, prices, delivery (30-90 mins in Vijayawada), returns (within 4 hours), and payment options (PhonePe, COD).
3. Always respond strictly in ${langName}. Use natural conversational tone.
4. If asked about buying or ordering, encourage adding items to cart.`;

    const modelEndpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cleanKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${cleanKey}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${cleanKey}`,
    ];

    const fetchFn = (globalThis as any).fetch;
    if (!fetchFn) {
      console.error('[chatbot] global fetch not available');
      return null;
    }

    for (const endpoint of modelEndpoints) {
      try {
        const response = await fetchFn(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nCustomer Question: ${message}` }],
              },
            ],
            generationConfig: {
              maxOutputTokens: 512,
              temperature: 0.7,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText && typeof replyText === 'string') {
            return replyText.trim();
          }
        } else {
          const errText = await response.text();
          console.warn(`[chatbot] Gemini endpoint ${endpoint.split('?')[0]} failed (${response.status}):`, errText);
        }
      } catch (err) {
        console.warn(`[chatbot] Gemini fetch exception:`, err);
      }
    }

    return null;
  }

  // Expanded Rule-Based Fallback
  const FALLBACK_REPLIES: Record<string, Record<string, string>> = {
    en: {
      site: "FarmFreshFarmer is Vijayawada's premier instant farm-to-doorstep delivery app! We deliver 100% naturally grown fruits, vegetables, homemade Andhra pickles, ghee sweets, and spices direct from local farmers.",
      about: "FarmFreshFarmer connects local organic farms directly to your kitchen in Vijayawada. We ensure zero preservatives, fair prices for farmers, and instant 30-90 minute delivery!",
      farm: "We source our fruits, vegetables, and ingredients directly from certified organic farms in Andhra Pradesh every morning.",
      delivery: "We offer instant delivery across Vijayawada! Delivery typically takes 30-90 minutes depending on your delivery location.",
      price: "Our produce is priced fairly straight from farmers with no middleman markups! Fresh vegetables start from ₹20. Check our home page for daily deals.",
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
      default: "I'm happy to assist you! For specific product inquiries, delivery status, or custom orders, you can also tap 'Connect to Human Support' below to speak directly with our Vijayawada team.",
    },
    hi: {
      site: "FarmFreshFarmer विजयवाड़ा का प्रमुख फार्म-टू-होम डिलीवरी ऐप है! हम ताजे फल, सब्जियां, देसी घी की मिठाइयां और आंध्र अचार 30-90 मिनट में डिलीवर करते हैं।",
      about: "FarmFreshFarmer स्थानीय किसानों से सीधे आपके घर तक बिना किसी बिचौलिए के शुद्ध ऑर्गेनिक उत्पाद पहुंचाता है।",
      delivery: "हम विजयवाड़ा में 30-90 मिनट की तत्काल डिलीवरी प्रदान करते हैं।",
      price: "हमारी कीमतें बहुत सस्ती हैं! ताजी सब्जियां ₹20 से शुरू होती हैं।",
      pickle: "हमारे पास पारंपरिक आंध्र अचार जैसे आम का अवाकाया, गोंगुरा और टमाटर का अचार उपलब्ध है।",
      sweet: "हमारी देसी घी मिठाइयां जैसे बूंदी लड्डू, सुन्नुंडालू और मैसूर पाक घर पर शुद्धता से बनाई जाती हैं।",
      order: "ऑर्डर करने के लिए कार्ट में आइटम जोड़ें और चेकआउट करें। हम PhonePe और कैश ऑन डिलीवरी (COD) स्वीकार करते हैं।",
      payment: "हम PhonePe, UPI और कैश ऑन डिलीवरी (COD) दोनों स्वीकार करते हैं।",
      hello: "🙏 नमस्ते! मैं लक्ष्मी हूँ, आपकी FarmFreshFarmer सहायक। आज मैं आपकी क्या मदद कर सकती हूँ?",
      hi: "🙏 नमस्ते! FarmFreshFarmer में आपका स्वागत है।",
      default: "मैं आपकी मदद के लिए यहाँ हूँ! आप मानव सहायता बटन पर क्लिक करके सीधे हमारी सहायता टीम से भी बात कर सकते हैं।",
    },
    te: {
      site: "FarmFreshFarmer విజయవాడలో తాజా సేంద్రీయ కూరగాయలు, పండ్లు, ఆంధ్ర ఆవకాయ పచ్చళ్ళు మరియు నెయ్యి మిఠాయిలను 30-90 నిమిషాల్లో ఇంటికి అందించే యాప్!",
      about: "FarmFreshFarmer స్థానిక రైతుల నుండి నేరుగా మీ ఇంటికి కెమికల్స్ లేని స్వచ్ఛమైన ఉత్పత్తులను అందిస్తుంది.",
      delivery: "విజయవాడ అంతటా 30-90 నిమిషాల వ్యవధిలో తక్షణ డెలివరీ అందిస్తాము.",
      price: "రైతుల నుండి నేరుగా తక్కువ ధరలకు లభిస్తాయి! తాజా కూరగాయలు ₹20 నుండి ప్రారంభం.",
      pickle: "మా వద్ద సాంప్రదాయ ఆంధ్ర ఆవకాయ, గోంగూర, టమోటా పచ్చళ్ళు స్వచ్ఛమైన నూనెతో తయారు చేయబడతాయి.",
      sweet: "ఆవు నెయ్యితో చేసిన బూందీ లడ్డూ, సున్నుండలు, మైసూర్ పాక్ లభిస్తాయి.",
      order: "ఆర్డర్ చేయడానికి కార్ట్‌కి జోడించి చెక్‌అవుట్ చేయండి. PhonePe మరియు క్యాష్ ఆన్ డెలివరీ (COD) అందుబాటులో ఉన్నాయి.",
      payment: "PhonePe, UPI మరియు క్యాష్ ఆన్ డెలివరీ (COD) ద్వారా చెల్లించవచ్చు.",
      hello: "🙏 నమస్తే! నేను లక్ష్మి, మీ FarmFreshFarmer సహాయకురాలిని. నేను మీకు ఎలా సహాయపడగలను?",
      hi: "🙏 నమస్తే! FarmFreshFarmerకి స్వాగతం.",
      default: "మీకు సహాయం చేయడానికి నేను ఇక్కడ ఉన్నాను! మరింత సహాయం కోసం కింద ఉన్న మానవ సహాయ బటన్‌ను నొక్కండి.",
    },
  };

  function getRuleBasedReply(message: string, lang: string): { reply: string; needsHuman: boolean } {
    const lower = message.toLowerCase();
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
            .slice(0, 30)
            .map((p: any) => `${p.name} (₹${p.price})`)
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
        console.log('[chatbot] Gemini returned null or failed. Using intelligent fallback.');
        const fallback = getRuleBasedReply(message, lang);
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
