CREATE TYPE "public"."source_auth_strategy" AS ENUM('none', 'api_key', 'oauth');--> statement-breakpoint
CREATE TYPE "public"."source_dataset" AS ENUM('fx', 'vat', 'duties', 'surcharges', 'hs', 'de_minimis', 'freight', 'notices');--> statement-breakpoint
CREATE TYPE "public"."source_expected_format" AS ENUM('json', 'csv', 'xlsx', 'xml', 'html', 'pdf', 'other');--> statement-breakpoint
CREATE TYPE "public"."source_schedule_hint" AS ENUM('hourly', 'daily', 'weekly', 'manual');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('api', 'csv', 'xlsx', 'xml', 'json', 'html', 'pdf', 'llm', 'manual');--> statement-breakpoint
CREATE TABLE "source_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"dataset" "source_dataset" NOT NULL,
	"source_type" "source_type" NOT NULL,
	"base_url" text,
	"download_url_template" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"schedule_hint" "source_schedule_hint" DEFAULT 'manual' NOT NULL,
	"expected_format" "source_expected_format",
	"auth_strategy" "source_auth_strategy" DEFAULT 'none' NOT NULL,
	"secret_env_var_names" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"parser_version" varchar(32) DEFAULT 'v1' NOT NULL,
	"notes" text,
	"last_verified_at" timestamp with time zone,
	"sla_max_age_hours" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "source_registry_key_uq" ON "source_registry" USING btree ("key");--> statement-breakpoint
CREATE INDEX "source_registry_dataset_idx" ON "source_registry" USING btree ("dataset");--> statement-breakpoint
CREATE INDEX "source_registry_enabled_idx" ON "source_registry" USING btree ("enabled");