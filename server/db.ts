/**
 * PostgreSQL connection (Drizzle ORM + node-postgres Pool).
 * =========================================================
 * Uses DATABASE_URL from the environment (local Postgres or AWS RDS).
 *
 * Example DATABASE_URL values:
 *   Local:  postgres://postgres:postgres@localhost:5432/farmfreshfarmer
 *   AWS RDS: postgres://USER:PASSWORD@your-db.xxxxx.ap-south-1.rds.amazonaws.com:5432/farmfreshfarmer
 *
 * SSL: RDS requires SSL. Set PGSSL=true (or DATABASE_URL with sslmode=require)
 * and we enable a relaxed SSL mode suitable for RDS's default certs.
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

// Enable SSL when talking to RDS / any managed Postgres.
// PGSSL=true forces it; otherwise auto-enable when the host is an AWS RDS endpoint.
const wantSsl =
  process.env.PGSSL === "true" ||
  /sslmode=require/i.test(connectionString) ||
  /\.rds\.amazonaws\.com/i.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: wantSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PG_POOL_MAX || 10),
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
