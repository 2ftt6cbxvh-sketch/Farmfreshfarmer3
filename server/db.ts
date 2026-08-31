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
      ["ALTER TABLE products ADD COLUMN IF NOT EXISTS name_te VARCHAR(255)", "products.name_te"],
      ["ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_radius_km NUMERIC(5,2) NOT NULL DEFAULT 30", "warehouses.max_radius_km"],
      ["ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS average_speed_kmph NUMERIC(5,2) NOT NULL DEFAULT 30", "warehouses.average_speed_kmph"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT", "users.permissions"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN NOT NULL DEFAULT FALSE", "users.is_primary_admin"],
      ["CREATE UNIQUE INDEX IF NOT EXISTS single_primary_admin_idx ON users (is_primary_admin) WHERE is_primary_admin = TRUE", "idx.single_primary_admin"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_title VARCHAR(128)", "users.custom_title"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(64)", "users.telegram_chat_id"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE", "users.is_verified"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE", "users.is_email_verified"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE", "users.is_phone_verified"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS star_rating INTEGER NOT NULL DEFAULT 5", "users.star_rating"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_rank VARCHAR(64) NOT NULL DEFAULT 'Specialist'", "users.experience_rank"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_stars INTEGER NOT NULL DEFAULT 0", "users.customer_stars"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT", "users.profile_photo"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0", "users.failed_login_attempts"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP WITH TIME ZONE", "users.lockout_until"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_tier INTEGER NOT NULL DEFAULT 0", "users.lockout_tier"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS is_permanently_locked BOOLEAN NOT NULL DEFAULT FALSE", "users.is_permanently_locked"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_method VARCHAR(32) NOT NULL DEFAULT 'both'", "users.two_fa_method"],
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT", "users.totp_secret"],
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
      ["ALTER TABLE products ADD COLUMN IF NOT EXISTS name_te VARCHAR(255)", "products.name_te"],
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
      [`CREATE TABLE IF NOT EXISTS chatbot_sessions (
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
        )`, "create.chatbot_sessions"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'bot'", "chatbot_sessions.status"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS assigned_agent_id INTEGER", "chatbot_sessions.assigned_agent_id"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT", "chatbot_sessions.assigned_agent_name"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()", "chatbot_sessions.last_activity_at"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS customer_permission_granted BOOLEAN NOT NULL DEFAULT FALSE", "chatbot_sessions.customer_permission_granted"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_granted_at TIMESTAMP WITH TIME ZONE", "chatbot_sessions.permission_granted_at"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_requested_at TIMESTAMP WITH TIME ZONE", "chatbot_sessions.permission_requested_at"],
      ["ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS permission_scope VARCHAR(64)", "chatbot_sessions.permission_scope"],
      [`CREATE TABLE IF NOT EXISTS live_chat_messages (
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
        )`, "create.live_chat_messages"],
      ["ALTER TABLE live_chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(32) NOT NULL DEFAULT 'text'", "live_chat_messages.message_type"],
      ["ALTER TABLE live_chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB", "live_chat_messages.metadata"],
      ["ALTER TABLE live_chat_messages ADD COLUMN IF NOT EXISTS sender_meta JSONB", "live_chat_messages.sender_meta"],
      [`CREATE TABLE IF NOT EXISTS chatbot_missed_queries (
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
        )`, "create.chatbot_missed_queries"],
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
      // ── WEBAUTHN & SECURITY HARDENING MIGRATIONS ──
      ["ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_pending BOOLEAN NOT NULL DEFAULT FALSE", "users.recovery_pending"],
      ["ALTER TABLE security_audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(64)", "security_audit_logs.request_id"],
      ["ALTER TABLE security_audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(16) NOT NULL DEFAULT 'info'", "security_audit_logs.severity"],
      ["ALTER TABLE security_audit_logs ADD COLUMN IF NOT EXISTS previous_hash TEXT", "security_audit_logs.previous_hash"],
      ["ALTER TABLE security_audit_logs ADD COLUMN IF NOT EXISTS event_hash TEXT", "security_audit_logs.event_hash"],
      ["ALTER TABLE security_audit_logs ADD COLUMN IF NOT EXISTS target_id INTEGER", "security_audit_logs.target_id"],
      ["ALTER TABLE security_audit_logs ADD COLUMN IF NOT EXISTS target_type VARCHAR(64)", "security_audit_logs.target_type"],
      ["ALTER TABLE security_audit_logs ADD COLUMN IF NOT EXISTS session_family_id VARCHAR(64)", "security_audit_logs.session_family_id"],
      [`CREATE TABLE IF NOT EXISTS webauthn_credentials (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          credential_id TEXT NOT NULL UNIQUE,
          public_key TEXT NOT NULL,
          counter INTEGER NOT NULL DEFAULT 0,
          device_type VARCHAR(32) NOT NULL DEFAULT 'platform',
          backed_up BOOLEAN NOT NULL DEFAULT FALSE,
          transports TEXT,
          nickname VARCHAR(128) NOT NULL DEFAULT 'Passkey',
          last_used_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`, "create.webauthn_credentials"],
      ["CREATE UNIQUE INDEX IF NOT EXISTS webauthn_creds_cred_idx ON webauthn_credentials(credential_id)", "idx.webauthn_creds_cred"],
      ["CREATE INDEX IF NOT EXISTS webauthn_creds_user_idx ON webauthn_credentials(user_id)", "idx.webauthn_creds_user"],
      // ── 1-TIME COUPONS & EMAIL CAMPAIGNS MIGRATIONS ──
      ["ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1", "coupons.max_uses"],
      ["ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0", "coupons.used_count"],
      ["ALTER TABLE coupons ADD COLUMN IF NOT EXISTS restricted_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE", "coupons.restricted_user_id"],
      ["ALTER TABLE coupons ADD COLUMN IF NOT EXISTS restricted_email VARCHAR(255)", "coupons.restricted_email"],
      ["ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_one_time BOOLEAN NOT NULL DEFAULT FALSE", "coupons.is_one_time"],
      ["ALTER TABLE coupons ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE", "coupons.expires_at"],
      ["ALTER TABLE coupons ADD COLUMN IF NOT EXISTS campaign_category VARCHAR(64) DEFAULT 'standard'", "coupons.campaign_category"],
      [`CREATE TABLE IF NOT EXISTS email_campaigns (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          subject TEXT NOT NULL,
          category VARCHAR(32) NOT NULL DEFAULT 'promotional',
          target_type VARCHAR(32) NOT NULL DEFAULT 'all',
          target_segment TEXT,
          target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          target_email VARCHAR(255),
          content_html TEXT NOT NULL,
          coupon_code VARCHAR(64),
          total_recipients INTEGER DEFAULT 0,
          sent_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          status VARCHAR(32) DEFAULT 'completed',
          created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`, "create.email_campaigns"],
      ["CREATE INDEX IF NOT EXISTS email_campaigns_created_at_idx ON email_campaigns(created_at)", "idx.email_campaigns_created_at"],
      [`CREATE TABLE IF NOT EXISTS maintenance_state (
          id SERIAL PRIMARY KEY,
          active BOOLEAN NOT NULL DEFAULT FALSE,
          headline VARCHAR(255) NOT NULL DEFAULT 'Scheduled Maintenance Underway',
          message TEXT NOT NULL DEFAULT 'We are currently optimizing our farm-fresh catalog and ultrafast delivery infrastructure. We will be back shortly!',
          estimated_end TIMESTAMP WITH TIME ZONE,
          estimated_minutes INTEGER DEFAULT 30,
          allow_admin_bypass BOOLEAN NOT NULL DEFAULT TRUE,
          activated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          activated_at TIMESTAMP WITH TIME ZONE,
          deactivated_at TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`, "create.maintenance_state"],
      ["ALTER TABLE maintenance_state ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT 30", "maintenance_state.estimated_minutes"],
      ["ALTER TABLE maintenance_state ADD COLUMN IF NOT EXISTS allow_admin_bypass BOOLEAN NOT NULL DEFAULT TRUE", "maintenance_state.allow_admin_bypass"],
      [`CREATE TABLE IF NOT EXISTS guest_behavior_sessions (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(128) NOT NULL UNIQUE,
          behavior_profile TEXT,
          ip_hash VARCHAR(64),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        )`, "create.guest_behavior_sessions"],
      ["CREATE INDEX IF NOT EXISTS guest_behavior_session_idx ON guest_behavior_sessions (session_id)", "idx.guest_behavior_session_idx"],
      ["CREATE INDEX IF NOT EXISTS guest_behavior_updated_idx ON guest_behavior_sessions (updated_at)", "idx.guest_behavior_updated_idx"],
    ];

    for (const [sql, label] of stmts) {
      await runStatement(sql, label);
    }

    // ── AUTO-POPULATE TELUGU PRODUCT NAMES FOR ALL PRODUCTS ──
    try {
      const { resolveTeluguProductName } = await import("@shared/telugu-produce-namer");
      const prods = await pool.query("SELECT id, name, category_slug, name_te FROM products");
      let syncCount = 0;
      for (const p of prods.rows) {
        const te = resolveTeluguProductName(p.name, p.category_slug);
        if (te && te !== p.name_te) {
          await pool.query("UPDATE products SET name_te = $1 WHERE id = $2", [te, p.id]);
          syncCount++;
        }
      }
      if (syncCount > 0) {
        console.log(`[db] Successfully updated Telugu names for ${syncCount} products!`);
      }
    } catch (teluguPopulateErr: any) {
      console.warn('[db] Telugu auto-populate warning:', teluguPopulateErr?.message);
    }

    console.log('[db] auto-migrations completed');
  })();

  return migrationsPromise;
}

