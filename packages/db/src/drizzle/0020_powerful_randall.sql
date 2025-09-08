ALTER TYPE "public"."duty_rule" ADD VALUE 'quota';--> statement-breakpoint
ALTER TYPE "public"."duty_rule" ADD VALUE 'provisional';--> statement-breakpoint
ALTER TYPE "public"."import_source" ADD VALUE 'CN_TAXBOOK' BEFORE 'CSV';--> statement-breakpoint
ALTER TYPE "public"."import_source" ADD VALUE 'ID_BTKI' BEFORE 'IMF';--> statement-breakpoint
ALTER TYPE "public"."import_source" ADD VALUE 'JP_CUSTOMS' BEFORE 'LLM_CROSSCHECK';--> statement-breakpoint
ALTER TYPE "public"."import_source" ADD VALUE 'MY_GAZETTE' BEFORE 'OECD';--> statement-breakpoint
ALTER TYPE "public"."import_source" ADD VALUE 'PH_TARIFF_COMMISSION' BEFORE 'SEED';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'duty_rate_component' BEFORE 'freight_card';--> statement-breakpoint
ALTER TABLE "duty_rate_components" ALTER COLUMN "effective_to" DROP NOT NULL;