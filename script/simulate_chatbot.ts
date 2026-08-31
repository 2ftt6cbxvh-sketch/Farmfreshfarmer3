import { storage } from "../server/storage";
import { db } from "../server/db";

async function simulateRequest() {
  const allSettings = await storage.settings.all();
  const geminiApiKey = (allSettings as any)?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const geminiModel = (allSettings as any)?.gemini_model || 'gemini-2.5-flash';
  console.log("geminiApiKey:", geminiApiKey ? `${geminiApiKey.slice(0, 10)}...` : 'NONE');
  console.log("geminiModel:", geminiModel);

  const activeProducts = await storage.products.list();
  console.log("activeProducts:", activeProducts.length);
}

simulateRequest().catch(console.error).finally(() => process.exit(0));
