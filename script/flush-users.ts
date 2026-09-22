/**
 * Database Flush Script: Purge all subadmins, users, and customer data
 * Leaves ONLY the Super Admin account intact.
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { users } from "@shared/schema";

async function flushUsersAndSubadmins() {
  console.log("=================================================");
  console.log("  FarmFreshFarmer DB Purge: Users & Subadmins    ");
  console.log("=================================================");

  // 1. Locate Super Admin
  const adminRows = await db.execute(sql`
    SELECT id, email, role, is_primary_admin
    FROM users
    WHERE LOWER(email) = 'admin@farmfreshfarmer.com'
       OR is_primary_admin = true
       OR id = 1
    ORDER BY id ASC
    LIMIT 1
  `);

  if (adminRows.rows.length === 0) {
    throw new Error("ABORTED: Super Admin account not found in database! Purge cancelled to prevent locking out system.");
  }

  const superAdmin = adminRows.rows[0];
  const superAdminId = Number(superAdmin.id);
  console.log(`[flush] Identified Super Admin: ID=${superAdminId}, Email=${superAdmin.email}, Role=${superAdmin.role}`);

  // 2. Identify users to be purged
  const nonAdminRows = await db.execute(sql`
    SELECT id, email, role, name
    FROM users
    WHERE id != ${superAdminId}
  `);

  console.log(`[flush] Found ${nonAdminRows.rows.length} non-admin user/subadmin accounts to purge:`);
  for (const u of nonAdminRows.rows) {
    console.log(`  - ID: ${u.id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`);
  }

  // 3. Clear dependent child tables in reverse dependency order
  const tablesToClean = [
    // Customer logs & sessions
    { name: "customer_location_logs", query: sql`DELETE FROM customer_location_logs` },
    { name: "live_chat_messages", query: sql`DELETE FROM live_chat_messages` },
    { name: "chatbot_missed_queries", query: sql`DELETE FROM chatbot_missed_queries` },
    { name: "otp_codes", query: sql`DELETE FROM otp_codes` },

    // Order items, status logs, order discounts
    { name: "order_items", query: sql`
      DELETE FROM order_items 
      WHERE order_id IN (SELECT id FROM orders WHERE user_id != ${superAdminId} OR user_id IS NULL)
    ` },
    { name: "order_status_logs", query: sql`
      DELETE FROM order_status_logs 
      WHERE order_id IN (SELECT id FROM orders WHERE user_id != ${superAdminId} OR user_id IS NULL)
    ` },
    { name: "order_discounts", query: sql`
      DELETE FROM order_discounts 
      WHERE order_id IN (SELECT id FROM orders WHERE user_id != ${superAdminId} OR user_id IS NULL)
    ` },
    { name: "refunds", query: sql`
      DELETE FROM refunds 
      WHERE payment_id IN (SELECT id FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id != ${superAdminId} OR user_id IS NULL))
    ` },
    { name: "payment_events", query: sql`
      DELETE FROM payment_events 
      WHERE payment_id IN (SELECT id FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id != ${superAdminId} OR user_id IS NULL))
    ` },
    { name: "payments", query: sql`
      DELETE FROM payments 
      WHERE order_id IN (SELECT id FROM orders WHERE user_id != ${superAdminId} OR user_id IS NULL)
    ` },
    { name: "orders", query: sql`DELETE FROM orders WHERE user_id != ${superAdminId} OR user_id IS NULL` },

    // Cart and items
    { name: "cart_items", query: sql`
      DELETE FROM cart_items 
      WHERE cart_id IN (SELECT id FROM carts WHERE user_id != ${superAdminId} OR user_id IS NULL)
    ` },
    { name: "carts", query: sql`DELETE FROM carts WHERE user_id != ${superAdminId} OR user_id IS NULL` },

    // Reviews & moderations
    { name: "review_moderation_logs", query: sql`DELETE FROM review_moderation_logs` },
    { name: "reviews", query: sql`DELETE FROM reviews WHERE user_id != ${superAdminId}` },

    // Subscriptions
    { name: "subscription_billing_cycles", query: sql`DELETE FROM subscription_billing_cycles` },
    { name: "subscription_change_logs", query: sql`DELETE FROM subscription_change_logs` },
    { name: "subscription_status_logs", query: sql`DELETE FROM subscription_status_logs` },
    { name: "subscription_items", query: sql`DELETE FROM subscription_items` },
    { name: "user_subscriptions", query: sql`DELETE FROM user_subscriptions WHERE user_id != ${superAdminId}` },

    // Referrals
    { name: "referral_reward_usages", query: sql`DELETE FROM referral_reward_usages` },
    { name: "referral_rewards", query: sql`DELETE FROM referral_rewards` },
    { name: "referrals", query: sql`DELETE FROM referrals` },
    { name: "referral_codes", query: sql`DELETE FROM referral_codes WHERE user_id != ${superAdminId}` },

    // Discounts
    { name: "discount_usages", query: sql`DELETE FROM discount_usages WHERE user_id != ${superAdminId}` },

    // Delivery partners
    { name: "delivery_partners", query: sql`DELETE FROM delivery_partners WHERE user_id != ${superAdminId}` },

    // Auth & session artifacts for deleted users
    { name: "customer_profiles", query: sql`DELETE FROM customer_profiles WHERE user_id != ${superAdminId}` },
    { name: "addresses", query: sql`DELETE FROM addresses WHERE user_id != ${superAdminId}` },
    { name: "refresh_tokens", query: sql`DELETE FROM refresh_tokens WHERE user_id != ${superAdminId}` },
    { name: "oauth_accounts", query: sql`DELETE FROM oauth_accounts WHERE user_id != ${superAdminId}` },
    { name: "device_fingerprints", query: sql`DELETE FROM device_fingerprints WHERE user_id != ${superAdminId}` },
    { name: "webauthn_credentials", query: sql`DELETE FROM webauthn_credentials WHERE user_id != ${superAdminId}` },
    { name: "security_audit_logs", query: sql`DELETE FROM security_audit_logs WHERE user_id != ${superAdminId}` },
  ];

  for (const item of tablesToClean) {
    try {
      const res: any = await db.execute(item.query);
      console.log(`[flush] Table '${item.name}' cleaned (${res?.rowCount ?? 0} rows purged).`);
    } catch (err: any) {
      console.warn(`[flush] Notice on table '${item.name}':`, err?.message || err);
    }
  }

  // 4. Detach / reset references on metadata tables
  try {
    await db.execute(sql`UPDATE categories SET submitted_by = ${superAdminId} WHERE submitted_by IS NOT NULL AND submitted_by != ${superAdminId}`);
    await db.execute(sql`UPDATE products SET submitted_by = ${superAdminId} WHERE submitted_by IS NOT NULL AND submitted_by != ${superAdminId}`);
    await db.execute(sql`UPDATE coupons SET restricted_user_id = NULL WHERE restricted_user_id IS NOT NULL AND restricted_user_id != ${superAdminId}`);
    await db.execute(sql`UPDATE email_campaigns SET target_user_id = NULL WHERE target_user_id IS NOT NULL AND target_user_id != ${superAdminId}`);
    await db.execute(sql`UPDATE email_campaigns SET created_by_id = ${superAdminId} WHERE created_by_id IS NOT NULL AND created_by_id != ${superAdminId}`);
    console.log("[flush] Foreign references in products, categories, coupons, campaigns sanitized.");
  } catch (err: any) {
    console.warn("[flush] Reference update notice:", err?.message || err);
  }

  // 5. Delete all non-superadmin users
  const deleteResult: any = await db.execute(sql`
    DELETE FROM users
    WHERE id != ${superAdminId}
  `);
  console.log(`[flush] Users table purged: ${deleteResult?.rowCount ?? 0} user(s) removed.`);

  // 6. Ensure Super Admin account is perfectly active, unlocked, and primary
  await db.execute(sql`
    UPDATE users
    SET role = 'superadmin',
        is_primary_admin = true,
        status = 'active',
        is_permanently_locked = false,
        failed_login_attempts = 0,
        lockout_tier = 0,
        lockout_until = NULL,
        recovery_pending = false,
        updated_at = NOW()
    WHERE id = ${superAdminId}
  `);
  console.log(`[flush] Super Admin (ID: ${superAdminId}) verified active and unlocked.`);

  // 7. Verify final count
  const remainingUsers = await db.execute(sql`SELECT id, email, role, is_primary_admin, name FROM users`);
  console.log("\n=================================================");
  console.log(`  Purge Complete! Remaining Users in Database: ${remainingUsers.rows.length} `);
  console.log("=================================================");
  console.log(JSON.stringify(remainingUsers.rows, null, 2));

  process.exit(0);
}

flushUsersAndSubadmins().catch((err) => {
  console.error("[flush] Fatal error during purge:", err);
  process.exit(1);
});
