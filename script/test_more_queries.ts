import express from "express";
import { storage } from "../server/storage";
import { registerChatbotRoutes } from "../server/routes/chatbot";
import http from "http";

async function testMoreQueries() {
  const app = express();
  app.use(express.json());
  registerChatbotRoutes(app, storage);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5098, resolve));

  const queries = [
    "what is ideal for high bp",
    "show me pickles",
    "what sweets do you have",
    "what is fresh today",
  ];

  for (const q of queries) {
    const res = await fetch("http://localhost:5098/api/chatbot/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q, language: "en" }),
    });
    const data = await res.json();
    console.log(`\nQuery: "${q}" -> Status: ${res.status}`);
    console.log(`Products Count: ${data.products?.length || 0}`);
    if (data.products && data.products.length > 0) {
      console.log(`Products:`, data.products.map((p: any) => `${p.name} (${p.nameTe}) - ₹${p.price}`));
    }
  }

  server.close();
}

testMoreQueries().catch(console.error).finally(() => process.exit(0));
