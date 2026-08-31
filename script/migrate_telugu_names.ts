import { db, pool } from "../server/db";
import { products } from "../shared/schema";
import { resolveTeluguProductName } from "../shared/telugu-produce-namer";
import { eq } from "drizzle-orm";

async function runMigration() {
  console.log("Adding name_te column to products table if not exists...");
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS name_te VARCHAR(255);
  `);
  console.log("Column name_te verified/added successfully.");

  const all = await db.select().from(products);
  console.log(`Scanning ${all.length} products to assign authentic Telugu names...`);

  let updatedCount = 0;
  for (const p of all) {
    const teluguName = resolveTeluguProductName(p.name, p.categorySlug);
    await db.update(products).set({ nameTe: teluguName }).where(eq(products.id, p.id));
    console.log(`Updated [ID ${p.id}] ${p.name.padEnd(28)} -> ${teluguName}`);
    updatedCount++;
  }

  console.log(`✅ Successfully updated all ${updatedCount} products with authentic Telugu names!`);
}

runMigration().catch(console.error).finally(() => process.exit(0));
