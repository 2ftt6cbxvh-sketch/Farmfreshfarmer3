import { pool, db } from "../server/db";
import { products } from "../shared/schema";
import { resolveTeluguProductName } from "../shared/telugu-produce-namer";
import { eq } from "drizzle-orm";

async function applyProductionMigration() {
  console.log("Adding column name_te to products table in PostgreSQL...");
  await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS name_te VARCHAR(255)");
  console.log("Column name_te successfully added!");

  const allProducts = await db.select().from(products);
  console.log(`Populating Telugu produce names for ${allProducts.length} products...`);
  for (const p of allProducts) {
    const teName = p.nameTe && p.nameTe.trim() ? p.nameTe.trim() : resolveTeluguProductName(p.name, p.categorySlug);
    await db.update(products).set({ nameTe: teName }).where(eq(products.id, p.id));
    console.log(`✓ [${p.id}] ${p.name} -> ${teName}`);
  }

  console.log("Migration complete!");
}

applyProductionMigration().catch(console.error).finally(() => process.exit(0));
