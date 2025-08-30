CREATE TYPE "public"."duty_source" AS ENUM('official', 'wits', 'vendor', 'manual');--> statement-breakpoint
ALTER TABLE "duty_rates" ADD COLUMN "source" "duty_source" DEFAULT 'official' NOT NULL;--> statement-breakpoint
CREATE INDEX "duty_rates_source_idx" ON "duty_rates" USING btree ("source");