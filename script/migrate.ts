/**
 * Runs pending Drizzle SQL migrations against DATABASE_URL, then exits.
 * Usage: npm run db:migrate   (after `npm run db:generate` created the SQL)
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

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
  const db = drizzle(pool);

  console.log("[migrate] applying migrations from ./migrations ...");
  await migrate(db, { migrationsFolder: "./migrations" });
  console.log("[migrate] done.");
  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
