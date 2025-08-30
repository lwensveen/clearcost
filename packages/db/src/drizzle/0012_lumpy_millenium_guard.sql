ALTER TYPE "public"."import_source" ADD VALUE 'APHIS' BEFORE 'API';--> statement-breakpoint
ALTER TYPE "public"."import_source" ADD VALUE 'FDA' BEFORE 'FILE';--> statement-breakpoint
ALTER TYPE "public"."surcharge_apply_level" ADD VALUE 'arrival';--> statement-breakpoint
ALTER TYPE "public"."surcharge_value_basis" ADD VALUE 'other';