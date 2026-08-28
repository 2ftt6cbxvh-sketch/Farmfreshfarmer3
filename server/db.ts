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

export async function runAutoMigrations(): Promise<void> {
  if (migrationsPromise) return migrationsPromise;

  migrationsPromise = (async () => {
    try {
      // Execute all essential schema validations in a single batch query for ultra-fast startup
      await pool.query(`
        ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_radius_km NUMERIC(5,2) NOT NULL DEFAULT 30;
        ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS average_speed_kmph NUMERIC(5,2) NOT NULL DEFAULT 30;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_title VARCHAR(128);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(64);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS star_rating INTEGER NOT NULL DEFAULT 5;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_rank VARCHAR(64) NOT NULL DEFAULT 'Specialist';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_stars INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP WITH TIME ZONE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_tier INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_permanently_locked BOOLEAN NOT NULL DEFAULT FALSE;
        CREATE TABLE IF NOT EXISTS star_discount_rules (
          id SERIAL PRIMARY KEY,
          rule_type VARCHAR(16) NOT NULL DEFAULT 'customer',
          star_from INTEGER NOT NULL,
          star_to INTEGER NOT NULL,
          discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
          description TEXT,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_partner_id INTEGER;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_data JSONB;
        CREATE TABLE IF NOT EXISTS delivery_partners (
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
        );
        ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
        ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_in_hero BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5,2);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_international_shipping BOOLEAN NOT NULL DEFAULT TRUE;
        CREATE TABLE IF NOT EXISTS employee_perk_settings (
          id SERIAL PRIMARY KEY,
          subadmin_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 15,
          subadmin_max_cap NUMERIC(10,2) NOT NULL DEFAULT 500,
          subadmin_monthly_limit INTEGER NOT NULL DEFAULT 4,
          delivery_partner_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 20,
          delivery_partner_max_cap NUMERIC(10,2) NOT NULL DEFAULT 300,
          delivery_partner_monthly_limit INTEGER NOT NULL DEFAULT 6,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS delivery_fee_rules (
          id SERIAL PRIMARY KEY,
          min_distance_km NUMERIC(8,2) NOT NULL DEFAULT 0,
          max_distance_km NUMERIC(8,2) NOT NULL DEFAULT 30,
          base_fee NUMERIC(10,2) NOT NULL DEFAULT 30.00,
          per_km_fee NUMERIC(8,2) NOT NULL DEFAULT 6.00,
          max_fee_cap NUMERIC(10,2) DEFAULT 150.00,
          free_delivery_above_order_value NUMERIC(10,2) DEFAULT 500.00,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS customer_permission_granted BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_granted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_requested_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_scope VARCHAR(64);
        ALTER TABLE live_chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(32) NOT NULL DEFAULT 'text';
        ALTER TABLE live_chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB;
      `);
      console.log('[db] auto-migrations completed in single batch');
    } catch (e: any) {
      console.warn('[db] auto-migration notice:', e?.message);
    }
  })();

  return migrationsPromise;
}
