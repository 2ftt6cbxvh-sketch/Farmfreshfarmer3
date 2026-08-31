import { storage } from "../server/storage";
import { db } from "../server/db";
import { resolveTeluguProductName } from "../shared/telugu-produce-namer";

async function debugChatbotHandler() {
  try {
    const message = "what items do you have for diabetes";
    const lang = "en";
    const allSettings = await storage.settings.all();
    console.log("1. allSettings fetched");

    const [activeProducts, categoriesList] = await Promise.all([
      storage.products.list(),
      Promise.resolve(storage.categories ? await (storage.categories as any).list().catch(() => []) : []),
    ]);
    console.log("2. activeProducts fetched:", activeProducts.length);

    // Test resolveSmartProductSuggestions directly
    const { resolveSmartProductSuggestions } = await import("../server/routes/chatbot");
  } catch (err: any) {
    console.error("DEBUG ERROR STACK:", err.stack || err);
  }
}

debugChatbotHandler().finally(() => process.exit(0));
