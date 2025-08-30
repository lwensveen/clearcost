CREATE TYPE "public"."surcharge_apply_level" AS ENUM('entry', 'line', 'shipment', 'program');--> statement-breakpoint
CREATE TYPE "public"."surcharge_rate_type" AS ENUM('ad_valorem', 'fixed', 'per_unit');--> statement-breakpoint
CREATE TYPE "public"."surcharge_value_basis" AS ENUM('customs', 'fob', 'cif', 'entered', 'duty');--> statement-breakpoint
CREATE TYPE "public"."transport_mode" AS ENUM('ALL', 'AIR', 'OCEAN', 'TRUCK', 'RAIL', 'BARGE');--> statement-breakpoint
ALTER TYPE "public"."surcharge_code" ADD VALUE 'AQI_VESSEL';--> statement-breakpoint
ALTER TYPE "public"."surcharge_code" ADD VALUE 'AQI_AIRCRAFT';--> statement-breakpoint
ALTER TYPE "public"."surcharge_code" ADD VALUE 'AQI_RAILCAR';--> statement-breakpoint
ALTER TYPE "public"."surcharge_code" ADD VALUE 'AQI_TRUCK_SINGLE';--> statement-breakpoint
ALTER TYPE "public"."surcharge_code" ADD VALUE 'AQI_TRUCK_TRANSPONDER';--> statement-breakpoint
ALTER TYPE "public"."surcharge_code" ADD VALUE 'AQI_BARGE';--> statement-breakpoint
ALTER TYPE "public"."surcharge_code" ADD VALUE 'FDA_VQIP_USER_FEE_ANNUAL';--> statement-breakpoint
ALTER TYPE "public"."surcharge_code" ADD VALUE 'FDA_VQIP_APPLICATION_FEE';--> statement-breakpoint
ALTER TYPE "public"."surcharge_code" ADD VALUE 'FDA_FSMA_REINSPECTION_HOURLY_DOM';--> statement-breakpoint
ALTER TYPE "public"."surcharge_code" ADD VALUE 'FDA_FSMA_REINSPECTION_HOURLY_FOR';--> statement-breakpoint
DROP INDEX "surcharges_dest_code_from_idx";--> statement-breakpoint
DROP INDEX "surcharges_scope_code_from_uq";--> statement-breakpoint
DROP INDEX "surcharges_lookup_idx";--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "rate_type" "surcharge_rate_type" DEFAULT 'ad_valorem' NOT NULL;--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "apply_level" "surcharge_apply_level" DEFAULT 'entry' NOT NULL;--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "value_basis" "surcharge_value_basis" DEFAULT 'customs' NOT NULL;--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "transport_mode" "transport_mode" DEFAULT 'ALL' NOT NULL;--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "min_amt" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "max_amt" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "unit_amt" numeric(12, 6);--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "unit_code" varchar(16);--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "surcharges" ADD COLUMN "source_ref" text;--> statement-breakpoint
CREATE UNIQUE INDEX "surcharges_scope_code_from_uq" ON "surcharges" USING btree ("dest","origin","hs6","transport_mode","apply_level","surcharge_code","effective_from");--> statement-breakpoint
CREATE INDEX "surcharges_lookup_idx" ON "surcharges" USING btree ("dest","origin","hs6","transport_mode","apply_level","surcharge_code","effective_from","effective_to");