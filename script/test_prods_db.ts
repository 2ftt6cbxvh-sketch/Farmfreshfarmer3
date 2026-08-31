import { storage } from "../server/storage";
import { apiCache } from "../server/services/cache";

async function testFetch() {
  const allProds = await storage.products.list({ includeInactive: true });
  console.log("All products with includeInactive=true:", allProds.length);

  const approvedProds = await storage.products.list({});
  console.log("Approved products (includeInactive=false):", approvedProds.length);

  for (const p of allProds.slice(0, 5)) {
    console.log(`- ID: ${p.id}, Name: ${p.name}, NameTe: ${p.nameTe}, Active: ${p.active}, Approval: ${p.approvalStatus}, Category: ${p.categorySlug}`);
  }

  const nonVegPickles = await storage.products.list({ category: "pickles-non-veg" });
  console.log("pickles-non-veg count:", nonVegPickles.length);
}

testFetch().catch(console.error).finally(() => process.exit(0));
