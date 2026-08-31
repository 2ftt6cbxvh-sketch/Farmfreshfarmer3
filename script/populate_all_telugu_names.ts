import { pool } from "../server/db";
import { resolveTeluguProductName } from "../shared/telugu-produce-namer";

async function populateAllTeluguProductNames() {
  console.log("Fetching all products from PostgreSQL database...");
  const res = await pool.query("SELECT id, name, category_slug, name_te FROM products ORDER BY id ASC");
  console.log(`Found ${res.rows.length} total products.`);

  let updatedCount = 0;
  for (const row of res.rows) {
    const teluguName = resolveTeluguProductName(row.name, row.category_slug);
    console.log(`[#${row.id}] "${row.name}" (${row.category_slug}) -> "${teluguName}" (Current: "${row.name_te || 'NULL'}")`);

    await pool.query("UPDATE products SET name_te = $1 WHERE id = $2", [teluguName, row.id]);
    updatedCount++;
  }

  console.log(`\n✅ Successfully updated all ${updatedCount} products with authentic Telugu names in Telugu script!`);
}

populateAllTeluguProductNames()
  .catch(console.error)
  .finally(() => process.exit(0));
