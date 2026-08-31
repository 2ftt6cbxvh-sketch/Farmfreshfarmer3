import { storage } from "../server/storage";
import { db } from "../server/db";
import { liveChatMessages, chatbotSessions } from "../shared/schema";

async function testHandler() {
  const allSettings = await storage.settings.all();
  console.log("allSettings fetched successfully");
  const products = await storage.products.list();
  console.log("products list fetched:", products.length);
}

testHandler().catch(console.error).finally(() => process.exit(0));
