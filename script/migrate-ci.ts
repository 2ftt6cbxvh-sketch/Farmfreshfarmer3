import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrateCi() {
  console.log("[migrate-ci] Running schema migration...");

  // Add columns to products if missing
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) NOT NULL DEFAULT 'approved'`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS submitted_by INTEGER`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS approval_note TEXT`);
  console.log("[migrate-ci] products table updated");

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

  // Create chatbot_sessions table
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
  console.log("[migrate-ci] chatbot_sessions table ready");

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

  console.log("[migrate-ci] All migrations completed successfully!");
  process.exit(0);
}

migrateCi().catch((err) => {
  console.error("[migrate-ci] Migration failed:", err);
  process.exit(1);
});
