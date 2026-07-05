/**
 * Idempotent seed runner (shared by `npm run db:seed` and server startup).
 * =========================================================================
 * Seeds categories, products, admin user, sample coupon, discount rules,
 * default settings, and the default subscription plan. Safe to re-run:
 * every block only inserts rows that don't already exist.
 *
 * On production (AWS RDS) you typically run `npm run db:migrate` then
 * `npm run db:seed` once. `ensureSeeded()` is also called on server start so
 * a fresh database is immediately usable, but it is a no-op once seeded.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  users, categories, products, coupons, discountRules, settings,
  subscriptionPlans, subscriptionPlanItems, referralCodes, customerProfiles,
} from "@shared/schema";
import {
  ADMIN_EMAIL, ADMIN_DEFAULT_PASSWORD, CATEGORY_SEED, PRODUCT_SEED,
  DISCOUNT_RULE_SEED, SETTINGS_SEED, SAMPLE_COUPON, SUBSCRIPTION_PLAN_SEED,
} from "./seed-data";
import { generateReferralCode } from "./lib/referral-code";

let seededThisProcess = false;

export async function ensureSeeded(opts?: { log?: boolean }): Promise<void> {
  if (seededThisProcess) return;
  const log = (...a: any[]) => opts?.log && console.log(...a);

  // Categories
  const existingCats = await db.select().from(categories);
  if (existingCats.length === 0) {
    await db.insert(categories).values(
      CATEGORY_SEED.map((c, idx) => ({
        name: c.name, slug: c.slug, dietTag: c.dietTag,
        description: c.description ?? "", image: c.image ?? "", sortOrder: idx,
      })),
    );
    log(`[seed] inserted ${CATEGORY_SEED.length} categories`);
  }

  // Products
  const existingProducts = await db.select().from(products);
  if (existingProducts.length === 0) {
    await db.insert(products).values(
      PRODUCT_SEED.map((p) => ({
        name: p.name, description: p.description, categorySlug: p.categorySlug,
        price: String(p.price), discountPercent: String(p.discountPercent ?? 0),
        unit: p.unit, image: p.image, stock: 50, lowStockThreshold: 10,
        dietTag: p.dietTag, featured: !!p.featured, active: true,
      })),
    );
    log(`[seed] inserted ${PRODUCT_SEED.length} products`);
  }

  // Admin user (+ profile + referral code)
  const admin = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL));
  if (admin.length === 0) {
    const hash = bcrypt.hashSync(ADMIN_DEFAULT_PASSWORD, 10);
    const [created] = await db.insert(users).values({
      name: "Store Admin", email: ADMIN_EMAIL, username: "admin",
      password: hash, role: "admin",
    }).returning();
    await db.insert(referralCodes).values({ userId: created.id, code: generateReferralCode() });
    await db.insert(customerProfiles).values({ userId: created.id }).onConflictDoNothing();
    log(`[seed] created admin user ${ADMIN_EMAIL} (password: ${ADMIN_DEFAULT_PASSWORD})`);
  }

  // Sample coupon
  const existingCoupons = await db.select().from(coupons);
  if (existingCoupons.length === 0) {
    await db.insert(coupons).values({
      code: SAMPLE_COUPON.code, discountPercent: String(SAMPLE_COUPON.discountPercent),
      active: true, minOrder: String(SAMPLE_COUPON.minOrder),
    });
    log(`[seed] created sample coupon ${SAMPLE_COUPON.code}`);
  }

  // Discount rules
  const existingRules = await db.select().from(discountRules);
  if (existingRules.length === 0) {
    await db.insert(discountRules).values(
      DISCOUNT_RULE_SEED.map((r) => ({
        name: r.name, type: r.type, discountPercent: String(r.discountPercent),
        appliesTo: r.appliesTo, maxUsesPerCustomer: r.maxUsesPerCustomer, active: true,
      })),
    );
    log(`[seed] inserted ${DISCOUNT_RULE_SEED.length} discount rules`);
  }

  // Settings
  for (const s of SETTINGS_SEED) {
    const existing = await db.select().from(settings).where(eq(settings.key, s.key));
    if (existing.length === 0) await db.insert(settings).values({ key: s.key, value: s.value });
  }
  log(`[seed] ensured ${SETTINGS_SEED.length} settings`);

  // Default subscription plan + items
  const existingPlans = await db.select().from(subscriptionPlans);
  if (existingPlans.length === 0) {
    const [plan] = await db.insert(subscriptionPlans).values({
      name: SUBSCRIPTION_PLAN_SEED.name, slug: SUBSCRIPTION_PLAN_SEED.slug,
      description: SUBSCRIPTION_PLAN_SEED.description, price: String(SUBSCRIPTION_PLAN_SEED.price),
      deliveryDays: SUBSCRIPTION_PLAN_SEED.deliveryDays, active: true,
    }).returning();
    const allProducts = await db.select().from(products);
    const byName = new Map(allProducts.map((p) => [p.name, p.id]));
    const items = SUBSCRIPTION_PLAN_SEED.items
      .map((it) => ({ planId: plan.id, productId: byName.get(it.productName), qty: it.qty }))
      .filter((it): it is { planId: number; productId: number; qty: number } => !!it.productId);
    if (items.length) await db.insert(subscriptionPlanItems).values(items);
    log(`[seed] created subscription plan "${plan.name}" with ${items.length} items`);
  }

  seededThisProcess = true;
}
