CREATE TYPE "public"."duty_rule" AS ENUM('mfn', 'fta', 'anti_dumping', 'safeguard');--> statement-breakpoint
CREATE TYPE "public"."freight_mode" AS ENUM('air', 'sea', 'express');--> statement-breakpoint
CREATE TYPE "public"."freight_unit" AS ENUM('kg', 'm3');--> statement-breakpoint
CREATE TYPE "public"."import_source" AS ENUM('AHTN', 'API', 'BASELINE', 'ECB', 'FILE', 'IMF', 'MANIFEST', 'MANUAL', 'OECD', 'OECD/IMF', 'OFFICIAL', 'TARIC', 'UK_OPS', 'UK_TT', 'US', 'USITC_HTS', 'WITS', 'ZONOS');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."incoterm" AS ENUM('DAP', 'DDP');--> statement-breakpoint
CREATE TYPE "public"."pricing_mode" AS ENUM('cards', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('duty_rate', 'freight_card', 'hs_code', 'hs_code_alias', 'surcharge', 'vat_rule');--> statement-breakpoint
CREATE TYPE "public"."shipping_mode" AS ENUM('air', 'sea');--> statement-breakpoint
CREATE TYPE "public"."surcharge_code" AS ENUM('ANTIDUMPING', 'COUNTERVAILING', 'CUSTOMS_PROCESSING', 'DISBURSEMENT', 'EXCISE', 'FUEL', 'HANDLING', 'HMF', 'MPF', 'OTHER', 'REMOTE', 'SECURITY', 'TRADE_REMEDY_232', 'TRADE_REMEDY_301');--> statement-breakpoint
CREATE TYPE "public"."vat_base" AS ENUM('CIF', 'CIF_PLUS_DUTY', 'FOB');--> statement-breakpoint
CREATE TYPE "public"."vat_rate_kind" AS ENUM('STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO');--> statement-breakpoint
CREATE TYPE "public"."hs_alias_system" AS ENUM('CN8', 'TARIC10', 'HTS10', 'UK10', 'AHTN8');--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"day" date NOT NULL,
	"route" text NOT NULL,
	"method" varchar(8) NOT NULL,
	"count" bigint DEFAULT 0 NOT NULL,
	"sum_duration_ms" bigint DEFAULT 0 NOT NULL,
	"sum_bytes_in" bigint DEFAULT 0 NOT NULL,
	"sum_bytes_out" bigint DEFAULT 0 NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lane_origin" varchar(2) NOT NULL,
	"lane_dest" varchar(2) NOT NULL,
	"hs6" varchar(6) NOT NULL,
	"item_value" numeric(14, 2) NOT NULL,
	"item_currency" varchar(3) NOT NULL,
	"dims_cm" jsonb NOT NULL,
	"weight_kg" numeric(10, 3) NOT NULL,
	"chargeable_kg" numeric(10, 3),
	"freight" numeric(14, 2),
	"duty_quoted" numeric(14, 2),
	"vat_quoted" numeric(14, 2),
	"fees_quoted" numeric(14, 2),
	"total_quoted" numeric(14, 2),
	"duty_actual" numeric(14, 2),
	"vat_actual" numeric(14, 2),
	"fees_actual" numeric(14, 2),
	"total_actual" numeric(14, 2),
	"low_confidence" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_id" text NOT NULL,
	"prefix" text DEFAULT 'live' NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"salt" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"allowed_cidrs" text[] DEFAULT '{}'::text[] NOT NULL,
	"allowed_origins" text[] DEFAULT '{}'::text[] NOT NULL,
	"rate_limit_per_min" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "org_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passkey_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"impersonated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"default_hs6" varchar(6) NOT NULL,
	"title" varchar(256) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "de_minimis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest" text NOT NULL,
	"de_minimis_kind" text NOT NULL,
	"de_minimis_basis" text DEFAULT 'INTRINSIC' NOT NULL,
	"currency" text NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duty_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest" varchar(2) NOT NULL,
	"partner" varchar(2),
	"hs6" varchar(6) NOT NULL,
	"rate_pct" numeric(6, 3) NOT NULL,
	"duty_rule" "duty_rule" DEFAULT 'mfn' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freight_rate_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin" varchar(3) NOT NULL,
	"dest" varchar(3) NOT NULL,
	"freight_mode" "freight_mode" NOT NULL,
	"freight_unit" "freight_unit" NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"min_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
	"price_rounding" numeric(12, 2),
	"volumetric_divisor" integer,
	"carrier" varchar(64),
	"service" varchar(64),
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freight_rate_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"upto_qty" numeric(12, 3) NOT NULL,
	"price_per_unit" numeric(12, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base" varchar(3) NOT NULL,
	"quote" varchar(3) NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"fx_as_of" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" varchar(32) DEFAULT 'ecb' NOT NULL,
	"source_ref" varchar(128),
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_base_not_quote" CHECK ("fx_rates"."base" <> "fx_rates"."quote")
);
--> statement-breakpoint
CREATE TABLE "hs_code_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hs6" varchar(6) NOT NULL,
	"system" "hs_alias_system" NOT NULL,
	"code" varchar(14) NOT NULL,
	"title" text NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hs_alias_hs6_digits" CHECK ("hs_code_aliases"."hs6" ~ '^[0-9]{6}$'),
	CONSTRAINT "hs_alias_code_digits" CHECK ("hs_code_aliases"."code" ~ '^[0-9]{8,10}$')
);
--> statement-breakpoint
CREATE TABLE "hs_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hs6" varchar(6) NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hs_codes_hs6_unique" UNIQUE("hs6"),
	CONSTRAINT "hs6_is_digits" CHECK ("hs_codes"."hs6" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response" jsonb DEFAULT 'null'::jsonb,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_source" "import_source" NOT NULL,
	"job" varchar(64) NOT NULL,
	"version" varchar(32),
	"source_url" text,
	"params" text,
	"file_hash" varchar(64),
	"file_bytes" bigint,
	"import_status" "import_status" DEFAULT 'running' NOT NULL,
	"inserted" integer DEFAULT 0,
	"updated" integer DEFAULT 0,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manifest_item_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manifest_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"hs6" char(6) NOT NULL,
	"currency" char(3) NOT NULL,
	"basis" numeric(16, 6) NOT NULL,
	"chargeable_kg" numeric(16, 6),
	"freight_share" numeric(16, 6) NOT NULL,
	"components" jsonb NOT NULL,
	"total" numeric(16, 6) NOT NULL,
	"guaranteed_max" numeric(16, 6) NOT NULL,
	"incoterm" "incoterm" DEFAULT 'DAP' NOT NULL,
	"fx_as_of" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manifest_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manifest_id" uuid NOT NULL,
	"item_value_amount" numeric(16, 4) NOT NULL,
	"item_value_currency" char(3) NOT NULL,
	"dims_cm" jsonb NOT NULL,
	"weight_kg" numeric(12, 3) NOT NULL,
	"user_hs6" char(6),
	"category_key" varchar(256),
	"reference" varchar(256),
	"notes" varchar(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manifest_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manifest_id" uuid NOT NULL,
	"currency" char(3) NOT NULL,
	"items_count" numeric(12, 0) NOT NULL,
	"freight_total" numeric(18, 6) NOT NULL,
	"duty_total" numeric(18, 6) NOT NULL,
	"vat_total" numeric(18, 6) NOT NULL,
	"fees_total" numeric(18, 6) NOT NULL,
	"checkout_vat_total" numeric(18, 6),
	"grand_total" numeric(18, 6) NOT NULL,
	"fx_as_of" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manifest_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"idem_key" text NOT NULL,
	"manifest_id" uuid NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb NOT NULL,
	"allocation" text DEFAULT 'chargeable' NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"data_runs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"origin" char(2) NOT NULL,
	"dest" char(2) NOT NULL,
	"shipping_mode" "shipping_mode" NOT NULL,
	"pricing_mode" "pricing_mode" NOT NULL,
	"fixed_freight_total" numeric(16, 4),
	"fixed_freight_currency" char(3),
	"reference" varchar(256),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"default_incoterm" varchar(3) DEFAULT 'DAP' NOT NULL,
	"default_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"charge_shipping_at_checkout" boolean DEFAULT false NOT NULL,
	"collect_vat_checkout" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"resource_type" "resource_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"source_ref" text,
	"source_hash" varchar(64),
	"row_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text DEFAULT 'quotes' NOT NULL,
	"idem_key" text NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb NOT NULL,
	"fx_as_of" timestamp with time zone DEFAULT now() NOT NULL,
	"data_runs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surcharges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest" varchar(2) NOT NULL,
	"origin" varchar(2),
	"hs6" varchar(6),
	"surcharge_code" "surcharge_code" NOT NULL,
	"fixed_amt" numeric(12, 2),
	"pct_amt" numeric(6, 3),
	"notes" text,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"jurisdiction" varchar(2) NOT NULL,
	"scheme" varchar(8) NOT NULL,
	"registration_number" text NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"username" text,
	"display_username" text,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vat_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest" varchar(2) NOT NULL,
	"vat_rate_kind" "vat_rate_kind" DEFAULT 'STANDARD' NOT NULL,
	"hs6" varchar(6) NOT NULL,
	"rate_pct" numeric(6, 3) NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vat_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest" varchar(2) NOT NULL,
	"vat_rate_kind" "vat_rate_kind" DEFAULT 'STANDARD' NOT NULL,
	"rate_pct" numeric(6, 3) NOT NULL,
	"vat_base" "vat_base" DEFAULT 'CIF_PLUS_DUTY' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_status" integer,
	"response_body" text,
	"delivered_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"url" text NOT NULL,
	"secret_enc" text NOT NULL,
	"secret_iv" text NOT NULL,
	"secret_tag" text NOT NULL,
	"events" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_owner_id_orgs_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_by_users_id_fk" FOREIGN KEY ("impersonated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_rate_steps" ADD CONSTRAINT "freight_rate_steps_card_id_freight_rate_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."freight_rate_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hs_code_aliases" ADD CONSTRAINT "hs_code_aliases_hs6_hs_codes_hs6_fk" FOREIGN KEY ("hs6") REFERENCES "public"."hs_codes"("hs6") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "manifest_item_quotes" ADD CONSTRAINT "manifest_item_quotes_manifest_id_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."manifests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifest_item_quotes" ADD CONSTRAINT "manifest_item_quotes_item_id_manifest_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."manifest_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifest_items" ADD CONSTRAINT "manifest_items_manifest_id_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."manifests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifest_quotes" ADD CONSTRAINT "manifest_quotes_manifest_id_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."manifests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifest_snapshots" ADD CONSTRAINT "manifest_snapshots_manifest_id_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."manifests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_owner_id_orgs_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_owner_id_orgs_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "provenance" ADD CONSTRAINT "provenance_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_owner_id_orgs_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_owner_id_orgs_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_usage_day_key_route_method" ON "api_usage" USING btree ("api_key_id","day","route","method");--> statement-breakpoint
CREATE INDEX "idx_usage_day" ON "api_usage" USING btree ("day");--> statement-breakpoint
CREATE INDEX "idx_usage_key" ON "api_usage" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "audit_lane_hs_idx" ON "audit_quotes" USING btree ("lane_origin","lane_dest","hs6");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_quotes" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_api_keys_keyid" ON "api_keys" USING btree ("key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_api_keys_hash" ON "api_keys" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_api_keys_owner_active" ON "api_keys" USING btree ("owner_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_orgs_external" ON "orgs" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "categories_default_hs6_idx" ON "categories" USING btree ("default_hs6");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_dem_dest_kind_from" ON "de_minimis" USING btree ("dest","de_minimis_kind","effective_from");--> statement-breakpoint
CREATE INDEX "idx_dem_dest_kind_window" ON "de_minimis" USING btree ("dest","de_minimis_kind","effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "duty_rates_dest_partner_hs6_from_uq" ON "duty_rates" USING btree ("dest","partner","hs6","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "duty_rates_dest_hs6_from_uq" ON "duty_rates" USING btree ("dest","hs6","effective_from");--> statement-breakpoint
CREATE INDEX "duty_rates_dest_hs6_idx" ON "duty_rates" USING btree ("dest","hs6");--> statement-breakpoint
CREATE UNIQUE INDEX "freight_cards_lane_uq" ON "freight_rate_cards" USING btree ("origin","dest","freight_mode","freight_unit","effective_from");--> statement-breakpoint
CREATE INDEX "freight_cards_lane_idx" ON "freight_rate_cards" USING btree ("origin","dest","freight_mode","freight_unit");--> statement-breakpoint
CREATE INDEX "freight_cards_carrier_idx" ON "freight_rate_cards" USING btree ("carrier");--> statement-breakpoint
CREATE INDEX "freight_cards_service_idx" ON "freight_rate_cards" USING btree ("service");--> statement-breakpoint
CREATE UNIQUE INDEX "freight_steps_card_upto_uq" ON "freight_rate_steps" USING btree ("card_id","upto_qty");--> statement-breakpoint
CREATE INDEX "freight_steps_card_idx" ON "freight_rate_steps" USING btree ("card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_fx_provider_pair_asof" ON "fx_rates" USING btree ("provider","base","quote","fx_as_of");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_fx_pair_asof" ON "fx_rates" USING btree ("base","quote","fx_as_of");--> statement-breakpoint
CREATE INDEX "idx_fx_asof" ON "fx_rates" USING btree ("fx_as_of");--> statement-breakpoint
CREATE INDEX "hs_alias_lookup_idx" ON "hs_code_aliases" USING btree ("system","code");--> statement-breakpoint
CREATE INDEX "hs_alias_hs6_idx" ON "hs_code_aliases" USING btree ("hs6");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_idem_scope_key" ON "idempotency_keys" USING btree ("scope","key");--> statement-breakpoint
CREATE INDEX "idx_idem_status_created" ON "idempotency_keys" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "manifest_item_quotes_by_item" ON "manifest_item_quotes" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "manifest_item_quotes_by_manifest" ON "manifest_item_quotes" USING btree ("manifest_id");--> statement-breakpoint
CREATE INDEX "manifest_items_by_manifest" ON "manifest_items" USING btree ("manifest_id");--> statement-breakpoint
CREATE INDEX "manifest_quotes_by_manifest" ON "manifest_quotes" USING btree ("manifest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_manifest_snapshots_scope_key" ON "manifest_snapshots" USING btree ("scope","idem_key");--> statement-breakpoint
CREATE INDEX "idx_manifest_snapshots_manifest" ON "manifest_snapshots" USING btree ("manifest_id");--> statement-breakpoint
CREATE INDEX "idx_manifest_snapshots_created" ON "manifest_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "manifests_by_lane" ON "manifests" USING btree ("origin","dest","shipping_mode");--> statement-breakpoint
CREATE INDEX "prov_resource_idx" ON "provenance" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "prov_import_idx" ON "provenance" USING btree ("import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_snapshots_scope_key_uq" ON "quote_snapshots" USING btree ("scope","idem_key");--> statement-breakpoint
CREATE INDEX "quote_snapshots_created_at_idx" ON "quote_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "surcharges_scope_code_from_uq" ON "surcharges" USING btree ("dest","origin","hs6","surcharge_code","effective_from");--> statement-breakpoint
CREATE INDEX "surcharges_lookup_idx" ON "surcharges" USING btree ("dest","origin","hs6","surcharge_code","effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "surcharges_dest_code_from_uq" ON "surcharges" USING btree ("dest","surcharge_code","effective_from");--> statement-breakpoint
CREATE INDEX "surcharges_dest_code_idx" ON "surcharges" USING btree ("dest","surcharge_code");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_vat_overrides_dest_hs6_from" ON "vat_overrides" USING btree ("dest","hs6","effective_from");--> statement-breakpoint
CREATE INDEX "idx_vat_overrides_dest_hs6" ON "vat_overrides" USING btree ("dest","hs6");--> statement-breakpoint
CREATE UNIQUE INDEX "vat_rules_dest_kind_from_uq" ON "vat_rules" USING btree ("dest","vat_rate_kind","effective_from");--> statement-breakpoint
CREATE INDEX "vat_rules_dest_kind_idx" ON "vat_rules" USING btree ("dest","vat_rate_kind");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_endpoint" ON "webhook_deliveries" USING btree ("endpoint_id","status");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_next" ON "webhook_deliveries" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_owner_active" ON "webhook_endpoints" USING btree ("owner_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_webhook_url" ON "webhook_endpoints" USING btree ("url");