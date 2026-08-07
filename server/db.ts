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
  // Neon serverless: keep pool small to avoid connection limits
  max: Number(process.env.PG_POOL_MAX || (/neon\.tech/i.test(connectionString) ? 3 : 10)),
  // Neon serverless: shorter idle timeout
  idleTimeoutMillis: /neon\.tech/i.test(connectionString) ? 10000 : 30000,
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

export async function runAutoMigrations() {
  try {
    // Add max_radius_km column if missing
    await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_radius_km NUMERIC(5,2) NOT NULL DEFAULT 30`);
    console.log('[db] auto-migration: max_radius_km column ensured');
  } catch (e: any) {
    console.warn('[db] auto-migration warning:', e?.message);
  }
  try {
    // Add average_speed_kmph column if missing  
    await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS average_speed_kmph NUMERIC(5,2) NOT NULL DEFAULT 30`);
    console.log('[db] auto-migration: average_speed_kmph column ensured');
  } catch (e: any) {
    console.warn('[db] auto-migration warning:', e?.message);
  }
}
