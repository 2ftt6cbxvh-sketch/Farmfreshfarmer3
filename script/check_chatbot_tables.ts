import { pool } from "../server/db";

async function checkChatbotTables() {
  const csCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chatbot_sessions'");
  console.log("chatbot_sessions columns:", csCols.rows.map(r => r.column_name));

  const lcmCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'live_chat_messages'");
  console.log("live_chat_messages columns:", lcmCols.rows.map(r => r.column_name));
}

checkChatbotTables().catch(console.error).finally(() => process.exit(0));
