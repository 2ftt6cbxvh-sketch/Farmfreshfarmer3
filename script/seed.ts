/**
 * Idempotent database seeder CLI.
 * Usage: npm run db:seed   (run once after `npm run db:migrate`)
 *
 * Seeds: 9 categories, 29 products, admin user, FRESH10 coupon,
 * default discount rules, default settings, and one subscription plan.
 * Safe to re-run: only inserts rows that don't already exist.
 */
import "dotenv/config";
import { pool } from "../server/db";
import { ensureSeeded } from "../server/seed-runner";

async function main() {
  console.log("[seed] starting ...");
  await ensureSeeded({ log: true });
  console.log("[seed] done.");
  await pool.end();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
