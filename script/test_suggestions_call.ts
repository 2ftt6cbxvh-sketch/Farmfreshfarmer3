import { storage } from "../server/storage";
import { resolveSmartProductSuggestions } from "../server/routes/chatbot";

async function testSuggestions() {
  const products = await storage.products.list();
  console.log("Products count:", products.length);
  try {
    const suggestions = resolveSmartProductSuggestions("what items do you have for diabetes", "For diabetes, we recommend foxtail millet and spinach", products);
    console.log("Suggestions returned successfully:", suggestions.length);
    console.log("Items:", suggestions.map((s: any) => s.name));
  } catch (err: any) {
    console.error("Error in resolveSmartProductSuggestions:", err);
  }
}

testSuggestions().catch(console.error).finally(() => process.exit(0));
