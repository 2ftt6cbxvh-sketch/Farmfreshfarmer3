import express from "express";
import { storage } from "../server/storage";
import { registerChatbotRoutes } from "../server/routes/chatbot";
import request from "supertest";

async function testChatbotEndpoint() {
  const app = express();
  app.use(express.json());
  registerChatbotRoutes(app, storage);

  console.log("Testing POST /api/chatbot/message with message: 'what items do you have for diabetes'");
  const res = await request(app)
    .post("/api/chatbot/message")
    .send({ message: "what items do you have for diabetes", language: "en" });

  console.log("Status:", res.status);
  console.log("Body:", JSON.stringify(res.body, null, 2));
}

testChatbotEndpoint().catch(console.error).finally(() => process.exit(0));
