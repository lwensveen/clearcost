CREATE TYPE "public"."vat_source" AS ENUM('official', 'llm', 'manual');--> statement-breakpoint
ALTER TABLE "vat_overrides" ADD COLUMN "source" "vat_source" DEFAULT 'official' NOT NULL;--> statement-breakpoint
ALTER TABLE "vat_rules" ADD COLUMN "source" "vat_source" DEFAULT 'official' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_vat_overrides_source" ON "vat_overrides" USING btree ("source");--> statement-breakpoint
CREATE INDEX "vat_rules_source_idx" ON "vat_rules" USING btree ("source");
