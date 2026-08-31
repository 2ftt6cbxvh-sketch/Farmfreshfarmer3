import { db } from "../server/db";
import { products } from "../shared/schema";

async function testHealthReply() {
  const activeProducts = await db.select().from(products);
  
  // Let's test the endpoint directly by simulating a POST to /api/chatbot/message
  const res = await fetch("http://localhost:5001/api/chatbot/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "what is ideal for high bp",
      token: "test-session-dev",
      language: "en"
    })
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log("=== CHATBOT RESPONSE ===");
    console.log("Reply:\n", data.reply);
    console.log("Suggested Products:\n", data.suggestedProducts);
  } else {
    console.log("Status:", res.status);
    console.log(await res.text());
  }
}

testHealthReply().catch(console.error).finally(() => process.exit(0));
