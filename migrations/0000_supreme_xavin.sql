CREATE TABLE "addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"label" varchar(64) DEFAULT 'Home' NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" varchar(128) DEFAULT 'Visakhapatnam' NOT NULL,
	"state" varchar(128) DEFAULT 'Andhra Pradesh' NOT NULL,
	"pincode" varchar(12) DEFAULT '' NOT NULL,
	"phone" varchar(32),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"diet_tag" varchar(16) DEFAULT 'none' NOT NULL,
	"parent_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"discount_percent" numeric(5, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"min_order" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"has_completed_first_order" boolean DEFAULT false NOT NULL,
	"first_order_id" integer,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "discount_rule_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"target_type" varchar(16) NOT NULL,
	"target_id" integer,
	"target_slug" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "discount_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" varchar(24) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"applies_to" varchar(16) DEFAULT 'all' NOT NULL,
	"max_uses_per_customer" integer DEFAULT 1 NOT NULL,
	"stackable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_usages" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"user_id" integer,
	"order_id" integer,
	"amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"change_qty" integer NOT NULL,
	"reason" varchar(64) DEFAULT 'manual' NOT NULL,
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"note" text,
	"admin_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_discounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"rule_type" varchar(24) NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer,
	"name" text NOT NULL,
	"unit" varchar(64) DEFAULT '' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"qty" integer NOT NULL,
	"line_total" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" varchar(24) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"customer_name" text NOT NULL,
	"phone" varchar(32) NOT NULL,
	"address" text NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"coupon_code" varchar(64),
	"order_type" varchar(24) DEFAULT 'normal' NOT NULL,
	"subscription_id" integer,
	"delivery_day" varchar(12),
	"first_order_discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"referral_discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"referral_reward_applied" numeric(10, 2) DEFAULT '0' NOT NULL,
	"referral_code_used" varchar(32),
	"payment_method" varchar(24) DEFAULT 'COD' NOT NULL,
	"payment_status" varchar(16) DEFAULT 'pending' NOT NULL,
	"status" varchar(24) DEFAULT 'Placed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer,
	"merchant_order_id" varchar(128),
	"event_type" varchar(32) NOT NULL,
	"status" varchar(16),
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"subscription_cycle_id" integer,
	"user_id" integer,
	"provider" varchar(24) DEFAULT 'phonepe' NOT NULL,
	"merchant_order_id" varchar(128) NOT NULL,
	"provider_transaction_id" varchar(128),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(8) DEFAULT 'INR' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"method" varchar(32),
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_merchant_order_id_unique" UNIQUE("merchant_order_id")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category_slug" varchar(128) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"unit" varchar(64) DEFAULT '250 Grams' NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"stock" integer DEFAULT 50 NOT NULL,
	"low_stock_threshold" integer DEFAULT 10 NOT NULL,
	"diet_tag" varchar(16) DEFAULT 'none' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code" varchar(32) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referral_reward_usages" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_user_id" integer NOT NULL,
	"order_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_user_id" integer NOT NULL,
	"referral_id" integer NOT NULL,
	"reward_percent" numeric(5, 2) DEFAULT '5' NOT NULL,
	"amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" varchar(16) DEFAULT 'approved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_user_id" integer NOT NULL,
	"referred_user_id" integer NOT NULL,
	"code" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"qualifying_order_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"converted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"merchant_refund_id" varchar(128) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"reason" text,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_merchant_refund_id_unique" UNIQUE("merchant_refund_id")
);
--> statement-breakpoint
CREATE TABLE "review_moderation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"action" varchar(16) NOT NULL,
	"admin_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"user_name" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"moderation_status" varchar(16) DEFAULT 'approved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_billing_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"order_id" integer,
	"delivery_date" timestamp with time zone NOT NULL,
	"delivery_day" varchar(12) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" varchar(16) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_change_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"from_plan_id" integer,
	"to_plan_id" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plan_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"frequency" varchar(16) DEFAULT 'weekly' NOT NULL,
	"delivery_days" varchar(16) DEFAULT 'both' NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscription_status_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"status" varchar(16) NOT NULL,
	"note" text,
	"actor_type" varchar(12) DEFAULT 'customer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"delivery_days" varchar(16) DEFAULT 'both' NOT NULL,
	"weekly_price" numeric(10, 2) NOT NULL,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"next_billing_date" timestamp with time zone,
	"next_delivery_date" timestamp with time zone,
	"paused_until" timestamp with time zone,
	"skip_next_cycle" boolean DEFAULT false NOT NULL,
	"delivery_address" text,
	"phone" varchar(32),
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"phone" varchar(32),
	"address" text,
	"role" varchar(16) DEFAULT 'customer' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_rule_targets" ADD CONSTRAINT "discount_rule_targets_rule_id_discount_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."discount_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_usages" ADD CONSTRAINT "discount_usages_rule_id_discount_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."discount_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_logs" ADD CONSTRAINT "order_status_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_reward_usages" ADD CONSTRAINT "referral_reward_usages_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_moderation_logs" ADD CONSTRAINT "review_moderation_logs_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_billing_cycles" ADD CONSTRAINT "subscription_billing_cycles_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_change_logs" ADD CONSTRAINT "subscription_change_logs_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plan_items" ADD CONSTRAINT "subscription_plan_items_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_status_logs" ADD CONSTRAINT "subscription_status_logs_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "customer_profiles_user_idx" ON "customer_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "discount_rules_type_idx" ON "discount_rules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "discount_usages_rule_user_idx" ON "discount_usages" USING btree ("rule_id","user_id");--> statement-breakpoint
CREATE INDEX "inv_adj_product_idx" ON "inventory_adjustments" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_discounts_order_idx" ON "order_discounts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_status_logs_order_idx" ON "order_status_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_type_idx" ON "orders" USING btree ("order_type");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_merchant_idx" ON "payments" USING btree ("merchant_order_id");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_slug");--> statement-breakpoint
CREATE INDEX "products_featured_idx" ON "products" USING btree ("featured");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_codes_code_idx" ON "referral_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "referral_reward_usages_user_idx" ON "referral_reward_usages" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "referral_rewards_referrer_idx" ON "referral_rewards" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_referred_idx" ON "referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "reviews_product_idx" ON "reviews" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "reviews_mod_idx" ON "reviews" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "sub_cycles_sub_idx" ON "subscription_billing_cycles" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "sub_cycles_date_idx" ON "subscription_billing_cycles" USING btree ("delivery_date");--> statement-breakpoint
CREATE INDEX "sub_items_sub_idx" ON "subscription_items" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "sub_plan_items_plan_idx" ON "subscription_plan_items" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "sub_status_logs_sub_idx" ON "subscription_status_logs" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "user_subs_user_idx" ON "user_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_subs_status_idx" ON "user_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");