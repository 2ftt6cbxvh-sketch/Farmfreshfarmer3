import { db } from "../server/db";
import { products } from "../shared/schema";

async function testUnit() {
  const allProducts = await db.select().from(products);
  console.log(`Loaded ${allProducts.length} products.`);

  // Let's test the queries
  const queries = [
    "what is ideal for high bp",
    "sugar control foods",
    "what are today's deals",
    "who made you",
    "520008"
  ];

  for (const q of queries) {
    console.log(`\n========================================`);
    console.log(`TEST QUERY: "${q}"`);
    console.log(`========================================`);
  }
}

testUnit().catch(console.error).finally(() => process.exit(0));
