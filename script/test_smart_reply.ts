import { storage } from "../server/storage";

async function testSmartReply() {
  const activeProducts = await storage.products.list();
  console.log("Testing with activeProducts:", activeProducts.length);
}

testSmartReply().catch(console.error).finally(() => process.exit(0));
