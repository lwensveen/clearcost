CREATE TYPE "public"."duty_component_type" AS ENUM('advalorem', 'specific', 'minimum', 'maximum', 'other');--> statement-breakpoint
ALTER TYPE "public"."import_source" ADD VALUE 'GROK' BEFORE 'IMF';--> statement-breakpoint
ALTER TYPE "public"."import_source" ADD VALUE 'LLM_CROSSCHECK' BEFORE 'MANIFEST';--> statement-breakpoint
ALTER TYPE "public"."import_source" ADD VALUE 'OPENAI' BEFORE 'SEED';--> statement-breakpoint
ALTER TYPE "public"."duty_source" ADD VALUE 'llm';--> statement-breakpoint
CREATE TABLE "duty_rate_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"duty_rate_id" uuid NOT NULL,
	"component_type" "duty_component_type" NOT NULL,
	"rate_pct" numeric(6, 3),
	"amount" numeric(14, 6),
	"currency" varchar(3),
	"uom" varchar(32),
	"qualifier" varchar(32),
	"formula" jsonb,
	"notes" text,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "duty_rate_components" ADD CONSTRAINT "duty_rate_components_duty_rate_id_duty_rates_id_fk" FOREIGN KEY ("duty_rate_id") REFERENCES "public"."duty_rates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "duty_rate_components_duty_rate_id_idx" ON "duty_rate_components" USING btree ("duty_rate_id");--> statement-breakpoint
CREATE INDEX "duty_rate_components_type_idx" ON "duty_rate_components" USING btree ("component_type");--> statement-breakpoint
CREATE UNIQUE INDEX "duty_rate_components_dedupe_uq" ON "duty_rate_components" USING btree ("duty_rate_id","component_type","rate_pct","amount","currency","uom","qualifier","effective_from");