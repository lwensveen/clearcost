DROP INDEX "surcharges_dest_code_from_uq";--> statement-breakpoint
ALTER TABLE "surcharges" ALTER COLUMN "pct_amt" SET DATA TYPE numeric(10, 6);--> statement-breakpoint
CREATE INDEX "surcharges_dest_code_from_idx" ON "surcharges" USING btree ("dest","surcharge_code","effective_from");