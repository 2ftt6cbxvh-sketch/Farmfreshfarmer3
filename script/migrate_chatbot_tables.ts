import { pool } from "../server/db";

async function migrateChatbotTables() {
  console.log("Applying chatbot tables migrations...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_sessions (
      id SERIAL PRIMARY KEY,
      session_token VARCHAR(128) NOT NULL UNIQUE,
      user_id INTEGER,
      language VARCHAR(8) NOT NULL DEFAULT 'en',
      status VARCHAR(32) NOT NULL DEFAULT 'bot',
      assigned_agent_id INTEGER,
      assigned_agent_name TEXT,
      customer_permission_granted BOOLEAN NOT NULL DEFAULT FALSE,
      permission_granted_at TIMESTAMP WITH TIME ZONE,
      permission_requested_at TIMESTAMP WITH TIME ZONE,
      permission_scope VARCHAR(64),
      last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ chatbot_sessions table created/verified");

  await pool.query(`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'bot'`);
  await pool.query(`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS assigned_agent_id INTEGER`);
  await pool.query(`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT`);
  await pool.query(`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`);
  await pool.query(`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS customer_permission_granted BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_granted_at TIMESTAMP WITH TIME ZONE`);
  await pool.query(`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_requested_at TIMESTAMP WITH TIME ZONE`);
  await pool.query(`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_scope VARCHAR(64)`);
  console.log("✓ chatbot_sessions columns added");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_chat_messages (
      id SERIAL PRIMARY KEY,
      session_token VARCHAR(128) NOT NULL,
      sender VARCHAR(16) NOT NULL,
      sender_name TEXT,
      sender_id INTEGER,
      message TEXT NOT NULL,
      message_type VARCHAR(32) NOT NULL DEFAULT 'text',
      metadata JSONB,
      sender_meta JSONB,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ live_chat_messages table created");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_missed_queries (
      id SERIAL PRIMARY KEY,
      query TEXT NOT NULL,
      user_id INTEGER,
      session_token VARCHAR(128),
      customer_name VARCHAR(128),
      customer_phone VARCHAR(32),
      customer_email VARCHAR(255),
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      admin_notes TEXT,
      resolved_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ chatbot_missed_queries table created");
}

migrateChatbotTables().catch(console.error).finally(() => process.exit(0));
