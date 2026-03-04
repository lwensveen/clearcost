ALTER TYPE "public"."resource_type" ADD VALUE IF NOT EXISTS 'fx_rate';--> statement-breakpoint
CREATE TYPE "public"."de_minimis_source" AS ENUM('official', 'fallback', 'llm', 'manual');--> statement-breakpoint
CREATE TYPE "public"."surcharge_source" AS ENUM('official', 'fallback', 'llm', 'manual');--> statement-breakpoint
ALTER TABLE "de_minimis" ADD COLUMN "source" "de_minimis_source" DEFAULT 'official' NOT NULL;--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "source" "surcharge_source" DEFAULT 'official' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_dem_source" ON "de_minimis" USING btree ("source");--> statement-breakpoint
CREATE INDEX "surcharges_source_idx" ON "surcharges" USING btree ("source");