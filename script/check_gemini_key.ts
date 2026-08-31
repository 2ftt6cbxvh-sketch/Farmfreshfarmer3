import { db } from "../server/db";
import { settings } from "../shared/schema";

async function checkApiKey() {
  const all = await db.select().from(settings);
  console.log("All settings keys in DB:", all.map(s => s.key));
  const geminiSetting = all.find(s => s.key === "gemini_api_key");
  console.log("gemini_api_key in DB:", geminiSetting ? `${geminiSetting.value.slice(0, 10)}... (length: ${geminiSetting.value.length})` : "NONE");
  console.log("process.env.GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.slice(0, 10)}...` : "NONE");
}

checkApiKey().catch(console.error).finally(() => process.exit(0));
