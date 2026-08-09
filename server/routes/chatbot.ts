import type { Express } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import fetch from 'node-fetch';

export function registerChatbotRoutes(app: Express, storage: any) {
  // GET settings
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

  // callGeminiAPI function
  async function callGeminiAPI(apiKey: string, message: string, history: string, language: string): Promise<string | null> {
    try {
      const systemPrompt = `You are Laxshmi, an AI assistant for FarmFreshFarmer - a farm-fresh instant delivery platform in Vijayawada, Andhra Pradesh, India. We sell fresh fruits, vegetables, homemade ghee sweets, traditional Andhra pickles, millets, and spices. You help customers with product information, orders, delivery, and policies. Be friendly, helpful and concise. Respond in ${language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English'}.`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\nCustomer: ' + message }] }],
          generationConfig: { maxOutputTokens: 512, temperature: 0.7 }
        })
      });
      
      if (!response.ok) {
        const errText = await response.text();
        console.error('[chatbot] Gemini API error:', response.status, errText);
        return null;
      }
      
      const data = await response.json() as any;
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (err) {
      console.error('[chatbot] Gemini fetch error:', err);
      return null;
    }
  }

  // Fallback replies
  const FALLBACK_REPLIES: Record<string, Record<string, string>> = {
    en: {
      delivery: "We offer instant delivery within Vijayawada. Delivery time is typically 30-90 minutes depending on your location and order size.",
      price: "Our prices are very competitive! Fresh vegetables start from ₹20. Check our products page for current prices.",
      return: "We accept returns/replacements for damaged items within 4 hours of delivery with photo proof. Contact us at admin@farmfreshfarmer.com.",
      pickle: "We have a wide range of traditional Andhra pickles! Check our Pickles category for Avakaya, Gongura, Tomato, and more.",
      sweet: "We have delicious homemade sweets including Boondhi Laddu, Mysore Pak, and traditional Andhra sweets.",
      fruit: "We stock fresh seasonal fruits sourced directly from local farms every morning.",
      vegetable: "Fresh vegetables delivered daily from certified organic farms.",
      order: "You can place an order by adding items to cart and checking out. We accept PhonePe and Cash on Delivery.",
      payment: "We accept PhonePe (online) and Cash on Delivery (COD). All online payments are secure.",
      subscribe: "Our subscription service lets you get regular deliveries of your favourite items at a discount!",
      refund: "Refunds are processed within 2 business days for eligible items. See our Refund Policy for details.",
      contact: "You can reach us at +91 79897 93669 or admin@farmfreshfarmer.com.",
      hello: "Hello! I'm Laxshmi, your FarmFreshFarmer assistant. How can I help you today?",
      hi: "Hi there! I'm Laxshmi. How can I help you with your farm-fresh needs today?",
      default: "I am not sure about that. A human support agent will reach out to you shortly. Sorry for the inconvenience!",
    },
    hi: {
      delivery: "हम विजयवाड़ा में तत्काल डिलीवरी प्रदान करते हैं। डिलीवरी का समय आमतौर पर 30-90 मिनट है।",
      price: "हमारी कीमतें बहुत प्रतिस्पर्धी हैं! ताजी सब्जियां ₹20 से शुरू।",
      pickle: "हमारे पास पारंपरिक आंध्र अचार की एक विस्तृत श्रृंखला है!",
      default: "मुझे इस बारे में निश्चित नहीं हूँ। एक मानव सहायक एजेंट जल्द ही आपसे संपर्क करेगा।",
    },
    te: {
      delivery: "మేము విజయవాడలో తక్షణ డెలివరీ అందిస్తాము. డెలివరీ సమయం సాధారణంగా 30-90 నిమిషాలు.",
      price: "మా ధరలు చాలా పోటీగా ఉంటాయి! తాజా కూరగాయలు ₹20 నుండి మొదలవుతాయి.",
      pickle: "మాకు సాంప్రదాయ ఆంధ్ర ఆచారాలు విస్తృతంగా ఉన్నాయి!",
      default: "దీని గురించి నాకు తెలియదు. ఒక మానవ సహాయ ఏజెంట్ మీతో శీఘ్రంగా సంప్రదిస్తారు.",
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
    
    return { reply: replies['default'] || FALLBACK_REPLIES['en']['default'], needsHuman: true };
  }

  // POST message
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
      
      console.log('[chatbot] Gemini key available:', !!geminiApiKey);
      
      let reply: string | null = null;
      let needsHuman = false;
      
      if (geminiApiKey) {
        reply = await callGeminiAPI(geminiApiKey, message, '', lang);
      }
      
      if (!reply) {
        const fallback = getRuleBasedReply(message, lang);
        reply = fallback.reply;
        needsHuman = fallback.needsHuman;
      }
      
      // Log missed queries if needsHuman
      if (needsHuman) {
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
      console.error('[chatbot] Error:', err);
      return res.status(500).json({ reply: 'Sorry, I am having trouble connecting. Please try again.', needsHuman: true });
    }
  });
}
