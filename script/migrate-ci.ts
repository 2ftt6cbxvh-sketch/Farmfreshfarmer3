import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrateCi() {
  console.log("[migrate-ci] Running schema migration...");

  // Add columns to products if missing
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) NOT NULL DEFAULT 'approved'`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS submitted_by INTEGER`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS approval_note TEXT`);
  console.log("[migrate-ci] products table updated");

  // Add columns to users table if missing
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_title VARCHAR(128)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(64)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS star_rating INTEGER NOT NULL DEFAULT 5`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_rank VARCHAR(64) NOT NULL DEFAULT 'Specialist'`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_stars INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`);
  console.log("[migrate-ci] users table updated");

  // Add columns to categories if missing
  await db.execute(sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) NOT NULL DEFAULT 'approved'`);
  await db.execute(sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS submitted_by INTEGER`);
  await db.execute(sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS approval_note TEXT`);
  console.log("[migrate-ci] categories table updated");

  // Create product_approval_history table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS product_approval_history (
      id SERIAL PRIMARY KEY,
      entity_type VARCHAR(32) NOT NULL,
      entity_id INTEGER NOT NULL,
      entity_name TEXT NOT NULL,
      action VARCHAR(32) NOT NULL,
      processed_by INTEGER,
      processor_name TEXT,
      note TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[migrate-ci] product_approval_history table ready");

  // Create chatbot_sessions table & add columns
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chatbot_sessions (
      id SERIAL PRIMARY KEY,
      session_token TEXT NOT NULL UNIQUE,
      user_id INTEGER,
      language VARCHAR(8) NOT NULL DEFAULT 'en',
      message_count INTEGER NOT NULL DEFAULT 0,
      last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'bot'`);
  await db.execute(sql`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS assigned_agent_id INTEGER`);
  await db.execute(sql`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT`);
  await db.execute(sql`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`);
  console.log("[migrate-ci] chatbot_sessions table ready");

  // Create live_chat_messages table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS live_chat_messages (
      id SERIAL PRIMARY KEY,
      session_token VARCHAR(128) NOT NULL,
      sender VARCHAR(16) NOT NULL,
      sender_name TEXT,
      sender_id INTEGER,
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[migrate-ci] live_chat_messages table ready");

  // Create chatbot_missed_queries table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chatbot_missed_queries (
      id SERIAL PRIMARY KEY,
      session_token TEXT NOT NULL,
      user_id INTEGER,
      query TEXT NOT NULL,
      language VARCHAR(8) NOT NULL DEFAULT 'en',
      trigger_type VARCHAR(32),
      resolved BOOLEAN NOT NULL DEFAULT FALSE,
      telegram_alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[migrate-ci] chatbot_missed_queries table ready");

  // Create chatbot_product_suggestions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chatbot_product_suggestions (
      id SERIAL PRIMARY KEY,
      product_name TEXT NOT NULL,
      mention_count INTEGER NOT NULL DEFAULT 1,
      last_mentioned TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[migrate-ci] chatbot_product_suggestions table ready");

  // Create or migrate customer_profiles table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS customer_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      has_completed_first_order BOOLEAN NOT NULL DEFAULT FALSE,
      first_order_id INTEGER,
      total_orders INTEGER NOT NULL DEFAULT 0,
      total_spent NUMERIC(10, 2) NOT NULL DEFAULT '0.00',
      notes TEXT,
      behavior_profile TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS behavior_profile TEXT`);
  await db.execute(sql`ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS has_completed_first_order BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.execute(sql`ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS total_orders INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10, 2) NOT NULL DEFAULT '0.00'`);
  console.log("[migrate-ci] customer_profiles table ready");

  // Create guest_behavior_sessions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS guest_behavior_sessions (
      id SERIAL PRIMARY KEY,
      guest_id VARCHAR(64) NOT NULL UNIQUE,
      search_queries TEXT,
      viewed_categories TEXT,
      ai_health_queries TEXT,
      last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[migrate-ci] guest_behavior_sessions table ready");

  // Create unmet_demand_events table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS unmet_demand_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      guest_id VARCHAR(64),
      query_term TEXT NOT NULL,
      source VARCHAR(32) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[migrate-ci] unmet_demand_events table ready");

  console.log("[migrate-ci] All migrations completed successfully!");
  process.exit(0);
}

migrateCi().catch((err) => {
  console.error("[migrate-ci] Migration failed:", err);
  process.exit(1);
});
