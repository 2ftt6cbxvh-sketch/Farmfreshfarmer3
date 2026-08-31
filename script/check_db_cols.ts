import { pool } from "../server/db";

async function checkDb() {
  const res = await pool.query("SELECT current_database(), current_user, inet_server_addr()");
  console.log("Connected DB details:", res.rows[0]);
  
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products'");
  console.log("Columns on products table:", cols.rows.map(r => r.column_name));
}

checkDb().catch(console.error).finally(() => process.exit(0));
