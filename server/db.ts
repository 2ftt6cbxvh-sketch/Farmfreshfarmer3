/**
 * PostgreSQL connection (Drizzle ORM + node-postgres Pool).
 * =========================================================
 * Supports both:
 *   - Neon serverless PostgreSQL (neon.tech) — recommended for Vercel
 *   - Standard PostgreSQL (local / AWS RDS)
 *
 * Example DATABASE_URL values:
 *   Neon:   postgres://user:pass@host.neon.tech/farmfreshfarmer?sslmode=require
 *   Local:  postgres://postgres:postgres@localhost:5432/farmfreshfarmer
 *   AWS RDS: postgres://USER:PASSWORD@your-db.xxxxx.ap-south-1.rds.amazonaws.com:5432/farmfreshfarmer
 *
 * SSL: Neon and RDS require SSL. Auto-detected from connection string.
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Create a .env file (see .env.example) with a PostgreSQL connection string.",
  );
}

// Enable SSL for Neon, RDS, or explicit sslmode=require
const wantSsl =
  process.env.PGSSL === "true" ||
  /sslmode=require/i.test(connectionString) ||
  /\.rds\.amazonaws\.com/i.test(connectionString) ||
  /neon\.tech/i.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: wantSsl ? { rejectUnauthorized: false } : undefined,
  // High-performance connection pool with robust concurrency
  max: Number(process.env.PG_POOL_MAX || (/neon\.tech/i.test(connectionString) ? 15 : 20)),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = drizzle(pool, { schema });

/** Simple connectivity check used by the /health endpoint. */
export async function pingDb(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/** Graceful shutdown — close pool on process exit. */
process.on("SIGTERM", () => pool.end());
process.on("SIGINT", () => pool.end());

let migrationsPromise: Promise<void> | null = null;

/** Run each SQL statement individually so a failure in one never aborts the rest. */
async function runStatement(sql: string, label: string): Promise<void> {
  try {
    await pool.query(sql);
  } catch (e: any) {
    // "already exists" / "does not exist" / "duplicate column" errors are expected — ignore them
    const msg = e?.message || "";
    if (
      !msg.includes("already exists") &&
      !msg.includes("does not exist") &&
      !msg.includes("duplicate column") &&
      !msg.includes("cannot be cast") &&
      !msg.includes("is not null")
    ) {
      console.warn(`[db] migration notice [${label}]:`, msg);
    }
  }
}

export async function runAutoMigrations(): Promise<void> {
  if (migrationsPromise) return migrationsPromise;

  migrationsPromise = (async () => {
    const stmts: [string, string][] = [
      ["ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_radius_km NUMERIC(5,2) NOT NULL DEFAULT 30", "warehouses.max_radius_km"],
      ["ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS average_speed_kmph NUMERIC(5,2) NOT NULL DEFAULT 30", "warehouses.average_speed_kmph"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT", "users.permissions"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN NOT NULL DEFAULT FALSE", "users.is_primary_admin"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_title VARCHAR(128)", "users.custom_title"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(64)", "users.telegram_chat_id"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE", "users.is_verified"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS star_rating INTEGER NOT NULL DEFAULT 5", "users.star_rating"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_rank VARCHAR(64) NOT NULL DEFAULT 'Specialist'", "users.experience_rank"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_stars INTEGER NOT NULL DEFAULT 0", "users.customer_stars"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT", "users.profile_photo"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0", "users.failed_login_attempts"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP WITH TIME ZONE", "users.lockout_until"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_tier INTEGER NOT NULL DEFAULT 0", "users.lockout_tier"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS is_permanently_locked BOOLEAN NOT NULL DEFAULT FALSE", "users.is_permanently_locked"],
      [`CREATE TABLE IF NOT EXISTS star_discount_rules (
          id SERIAL PRIMARY KEY,
          rule_type VARCHAR(16) NOT NULL DEFAULT 'customer',
          star_from INTEGER NOT NULL,
          star_to INTEGER NOT NULL,
          discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
          description TEXT,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`, "create.star_discount_rules"],
      ["ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_partner_id INTEGER", "orders.assigned_partner_id"],
      ["ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE", "orders.assigned_at"],
      ["ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_data JSONB", "orders.invoice_data"],
      [`CREATE TABLE IF NOT EXISTS delivery_partners (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          partner_type VARCHAR(32) NOT NULL DEFAULT 'local_delivery',
          name TEXT NOT NULL,
          id_type VARCHAR(32) NOT NULL DEFAULT 'aadhar',
          id_number VARCHAR(64) NOT NULL,
          driving_license_number VARCHAR(64),
          vehicle_number VARCHAR(64) NOT NULL,
          vehicle_type VARCHAR(32) NOT NULL DEFAULT 'bike',
          vehicle_model VARCHAR(64),
          phone VARCHAR(32) NOT NULL,
          email VARCHAR(255) NOT NULL,
          availability_status VARCHAR(24) NOT NULL DEFAULT 'offline',
          is_blocked_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
          last_available_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`, "create.delivery_partners"],
      ["ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()", "delivery_partners.updated_at"],
      ["ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_in_hero BOOLEAN NOT NULL DEFAULT FALSE", "products.featured_in_hero"],
      ["ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5,2)", "products.gst_percent"],
      ["ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_international_shipping BOOLEAN NOT NULL DEFAULT TRUE", "products.allow_international_shipping"],
      [`CREATE TABLE IF NOT EXISTS employee_perk_settings (
          id SERIAL PRIMARY KEY,
          subadmin_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 15,
          subadmin_max_cap NUMERIC(10,2) NOT NULL DEFAULT 500,
          subadmin_monthly_limit INTEGER NOT NULL DEFAULT 4,
          delivery_partner_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 20,
          delivery_partner_max_cap NUMERIC(10,2) NOT NULL DEFAULT 300,
          delivery_partner_monthly_limit INTEGER NOT NULL DEFAULT 6,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`, "create.employee_perk_settings"],
      [`CREATE TABLE IF NOT EXISTS delivery_fee_rules (
          id SERIAL PRIMARY KEY,
          min_distance_km NUMERIC(8,2) NOT NULL DEFAULT 0,
          max_distance_km NUMERIC(8,2) NOT NULL DEFAULT 30,
          base_fee NUMERIC(10,2) NOT NULL DEFAULT 30.00,
          per_km_fee NUMERIC(8,2) NOT NULL DEFAULT 6.00,
          max_fee_cap NUMERIC(10,2) DEFAULT 150.00,
          free_delivery_above_order_value NUMERIC(10,2) DEFAULT 500.00,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`, "create.delivery_fee_rules"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS customer_permission_granted BOOLEAN NOT NULL DEFAULT FALSE", "chatbot_sessions.customer_permission_granted"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_granted_at TIMESTAMP WITH TIME ZONE", "chatbot_sessions.permission_granted_at"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_requested_at TIMESTAMP WITH TIME ZONE", "chatbot_sessions.permission_requested_at"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_scope VARCHAR(64)", "chatbot_sessions.permission_scope"],
      ["ALTER TABLE live_chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(32) NOT NULL DEFAULT 'text'", "live_chat_messages.message_type"],
      ["ALTER TABLE live_chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB", "live_chat_messages.metadata"],
      ["ALTER TABLE otp_codes ALTER COLUMN user_id DROP NOT NULL", "otp_codes.user_id nullable"],
      ["ALTER TABLE otp_codes ALTER COLUMN phone TYPE VARCHAR(255)", "otp_codes.phone varchar255"],
      // ── ANNOUNCEMENTS TABLE (runs independently — never skipped) ──
      [`CREATE TABLE IF NOT EXISTS announcements (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          category VARCHAR(32) NOT NULL DEFAULT 'advertisement',
          product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          show_popup BOOLEAN NOT NULL DEFAULT TRUE,
          priority INTEGER NOT NULL DEFAULT 0,
          target_audience VARCHAR(32) NOT NULL DEFAULT 'all',
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE
        )`, "create.announcements"],
      ["CREATE INDEX IF NOT EXISTS announcements_category_idx ON announcements(category)", "idx.announcements_category"],
      ["CREATE INDEX IF NOT EXISTS announcements_is_active_idx ON announcements(is_active)", "idx.announcements_is_active"],
    ];

    for (const [sql, label] of stmts) {
      await runStatement(sql, label);
    }

    console.log('[db] auto-migrations completed');
  })();

  return migrationsPromise;
}
