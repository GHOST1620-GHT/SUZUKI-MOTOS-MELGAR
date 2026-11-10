CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"document_type" text DEFAULT 'CC' NOT NULL,
	"document" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"birth_date" timestamp with time zone,
	"city" text DEFAULT 'Melgar',
	"address" text,
	"notes" text,
	"password_hash" text,
	"portal_activated_at" timestamp with time zone,
	"accepts_marketing" boolean DEFAULT true NOT NULL,
	"points_balance" integer DEFAULT 0 NOT NULL,
	"lifetime_points" integer DEFAULT 0 NOT NULL,
	"lifetime_spend" double precision DEFAULT 0 NOT NULL,
	"level_id" text,
	"referral_code" text NOT NULL,
	"referred_by_id" text,
	"last_visit_at" timestamp with time zone,
	"last_birthday_bonus_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_document_unique" UNIQUE("document"),
	CONSTRAINT "customers_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"total_rows" integer NOT NULL,
	"imported" integer NOT NULL,
	"skipped" integer NOT NULL,
	"new_customers" integer DEFAULT 0 NOT NULL,
	"log" text DEFAULT '' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"min_points" integer NOT NULL,
	"multiplier" double precision DEFAULT 1 NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"benefits" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "levels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "motorcycles" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"brand" text DEFAULT 'Suzuki' NOT NULL,
	"model" text NOT NULL,
	"year" integer,
	"plate" text,
	"vin" text,
	"color" text,
	"purchase_date" timestamp with time zone,
	"current_km" integer DEFAULT 0 NOT NULL,
	"last_service_date" timestamp with time zone,
	"last_service_km" integer,
	"service_interval_km" integer DEFAULT 3000 NOT NULL,
	"service_interval_days" integer DEFAULT 120 NOT NULL,
	"avg_km_per_month" integer DEFAULT 800 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "motorcycles_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"type" text NOT NULL,
	"points" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" text NOT NULL,
	"purchase_id" text,
	"redemption_id" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"motorcycle_id" text,
	"invoice_number" text,
	"category" text NOT NULL,
	"amount" double precision NOT NULL,
	"points_earned" integer NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"notes" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"customer_id" text NOT NULL,
	"reward_id" text NOT NULL,
	"points" integer NOT NULL,
	"status" text DEFAULT 'PENDIENTE' NOT NULL,
	"channel" text DEFAULT 'PORTAL' NOT NULL,
	"notes" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"handled_by_id" text,
	CONSTRAINT "redemptions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"interest" text,
	"status" text DEFAULT 'PENDIENTE' NOT NULL,
	"referred_customer_id" text,
	"bonus_points" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"converted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reminder_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"motorcycle_id" text,
	"kind" text NOT NULL,
	"channel" text DEFAULT 'WHATSAPP' NOT NULL,
	"message" text NOT NULL,
	"sent_by_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'ACCESORIO' NOT NULL,
	"points_cost" integer NOT NULL,
	"stock" integer,
	"emoji" text DEFAULT '🎁' NOT NULL,
	"image_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"min_level_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_records" (
	"id" text PRIMARY KEY NOT NULL,
	"motorcycle_id" text NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"km" integer NOT NULL,
	"type" text NOT NULL,
	"notes" text,
	"created_by_id" text,
	"purchase_id" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'ASESOR' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motorcycles" ADD CONSTRAINT "motorcycles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_movements" ADD CONSTRAINT "point_movements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_movements" ADD CONSTRAINT "point_movements_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_movements" ADD CONSTRAINT "point_movements_redemption_id_redemptions_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."redemptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_movements" ADD CONSTRAINT "point_movements_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_motorcycle_id_motorcycles_id_fk" FOREIGN KEY ("motorcycle_id") REFERENCES "public"."motorcycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_handled_by_id_users_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_customers_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_customer_id_customers_id_fk" FOREIGN KEY ("referred_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_motorcycle_id_motorcycles_id_fk" FOREIGN KEY ("motorcycle_id") REFERENCES "public"."motorcycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_min_level_id_levels_id_fk" FOREIGN KEY ("min_level_id") REFERENCES "public"."levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_motorcycle_id_motorcycles_id_fk" FOREIGN KEY ("motorcycle_id") REFERENCES "public"."motorcycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_last_name_idx" ON "customers" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "movements_customer_idx" ON "point_movements" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "movements_date_idx" ON "point_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "purchases_date_idx" ON "purchases" USING btree ("date");--> statement-breakpoint
CREATE INDEX "purchases_customer_idx" ON "purchases" USING btree ("customer_id");