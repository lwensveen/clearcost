ALTER TYPE "public"."import_source" ADD VALUE 'TRADE_GOV' BEFORE 'UK_OPS';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'de_minimis' BEFORE 'duty_rate';--> statement-breakpoint
ALTER TABLE "surcharges" ALTER COLUMN "apply_level" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "surcharges" ALTER COLUMN "apply_level" SET DEFAULT 'entry'::text;--> statement-breakpoint
DROP TYPE "public"."surcharge_apply_level";--> statement-breakpoint
CREATE TYPE "public"."surcharge_apply_level" AS ENUM('arrival', 'entry', 'line', 'program', 'shipment');--> statement-breakpoint
ALTER TABLE "surcharges" ALTER COLUMN "apply_level" SET DEFAULT 'entry'::"public"."surcharge_apply_level";--> statement-breakpoint
ALTER TABLE "surcharges" ALTER COLUMN "apply_level" SET DATA TYPE "public"."surcharge_apply_level" USING "apply_level"::"public"."surcharge_apply_level";--> statement-breakpoint
ALTER TABLE "surcharges" ALTER COLUMN "surcharge_code" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."surcharge_code";--> statement-breakpoint
CREATE TYPE "public"."surcharge_code" AS ENUM('ANTIDUMPING', 'AQI_AIRCRAFT', 'AQI_BARGE', 'AQI_RAILCAR', 'AQI_TRUCK_SINGLE', 'AQI_TRUCK_TRANSPONDER', 'AQI_VESSEL', 'COUNTERVAILING', 'CUSTOMS_PROCESSING', 'DISBURSEMENT', 'EXCISE', 'FDA_FSMA_REINSPECTION_HOURLY_DOM', 'FDA_FSMA_REINSPECTION_HOURLY_FOR', 'FDA_VQIP_APPLICATION_FEE', 'FDA_VQIP_USER_FEE_ANNUAL', 'FUEL', 'HANDLING', 'HMF', 'MPF', 'OTHER', 'REMOTE', 'SECURITY', 'TRADE_REMEDY_232', 'TRADE_REMEDY_301');--> statement-breakpoint
ALTER TABLE "surcharges" ALTER COLUMN "surcharge_code" SET DATA TYPE "public"."surcharge_code" USING "surcharge_code"::"public"."surcharge_code";--> statement-breakpoint
ALTER TABLE "surcharges" ALTER COLUMN "value_basis" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "surcharges" ALTER COLUMN "value_basis" SET DEFAULT 'customs'::text;--> statement-breakpoint
DROP TYPE "public"."surcharge_value_basis";--> statement-breakpoint
CREATE TYPE "public"."surcharge_value_basis" AS ENUM('cif', 'customs', 'duty', 'entered', 'fob', 'other');--> statement-breakpoint
ALTER TABLE "surcharges" ALTER COLUMN "value_basis" SET DEFAULT 'customs'::"public"."surcharge_value_basis";--> statement-breakpoint
ALTER TABLE "surcharges" ALTER COLUMN "value_basis" SET DATA TYPE "public"."surcharge_value_basis" USING "value_basis"::"public"."surcharge_value_basis";--> statement-breakpoint
ALTER TABLE "vat_overrides" ALTER COLUMN "vat_rate_kind" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "vat_overrides" ALTER COLUMN "vat_rate_kind" SET DEFAULT 'STANDARD'::text;--> statement-breakpoint
ALTER TABLE "vat_rules" ALTER COLUMN "vat_rate_kind" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "vat_rules" ALTER COLUMN "vat_rate_kind" SET DEFAULT 'STANDARD'::text;--> statement-breakpoint
DROP TYPE "public"."vat_rate_kind";--> statement-breakpoint
CREATE TYPE "public"."vat_rate_kind" AS ENUM('REDUCED', 'STANDARD', 'SUPER_REDUCED', 'ZERO');--> statement-breakpoint
ALTER TABLE "vat_overrides" ALTER COLUMN "vat_rate_kind" SET DEFAULT 'STANDARD'::"public"."vat_rate_kind";--> statement-breakpoint
ALTER TABLE "vat_overrides" ALTER COLUMN "vat_rate_kind" SET DATA TYPE "public"."vat_rate_kind" USING "vat_rate_kind"::"public"."vat_rate_kind";--> statement-breakpoint
ALTER TABLE "vat_rules" ALTER COLUMN "vat_rate_kind" SET DEFAULT 'STANDARD'::"public"."vat_rate_kind";--> statement-breakpoint
ALTER TABLE "vat_rules" ALTER COLUMN "vat_rate_kind" SET DATA TYPE "public"."vat_rate_kind" USING "vat_rate_kind"::"public"."vat_rate_kind";