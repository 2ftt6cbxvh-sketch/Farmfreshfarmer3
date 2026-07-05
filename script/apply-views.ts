/**
 * Applies the Power BI reporting SQL views to DATABASE_URL, then exits.
 * Usage: npm run db:views
 *
 * Reads reporting/powerbi_views.sql and executes it as a single batch.
 * The SQL is idempotent (CREATE OR REPLACE VIEW ...), so it is safe to
 * re-run any time the views change.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const wantSsl =
    process.env.PGSSL === "true" ||
    /sslmode=require/i.test(connectionString) ||
    /\.rds\.amazonaws\.com/i.test(connectionString);

  const pool = new Pool({
    connectionString,
    ssl: wantSsl ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });

  const here = dirname(fileURLToPath(import.meta.url));
  const sqlPath = resolve(here, "..", "reporting", "powerbi_views.sql");
  const sql = readFileSync(sqlPath, "utf8");

  console.log(`[views] applying reporting views from ${sqlPath} ...`);
  await pool.query(sql);
  console.log("[views] done. Power BI reporting views are up to date.");
  await pool.end();
}

main().catch((err) => {
  console.error("[views] failed:", err);
  process.exit(1);
});
