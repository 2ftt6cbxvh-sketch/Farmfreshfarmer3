import express from "express";
import { storage } from "../server/storage";
import { registerChatbotRoutes } from "../server/routes/chatbot";
import http from "http";

async function testChatbotEndpoint() {
  const app = express();
  app.use(express.json());
  registerChatbotRoutes(app, storage);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5099, resolve));

  console.log("Testing POST http://localhost:5099/api/chatbot/message");
  const res = await fetch("http://localhost:5099/api/chatbot/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "what items do you have for diabetes", language: "en" }),
  });

  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Data:", JSON.stringify(data, null, 2));

  server.close();
}

testChatbotEndpoint().catch(console.error).finally(() => process.exit(0));
