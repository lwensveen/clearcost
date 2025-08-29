DROP INDEX "duty_rates_dest_partner_hs6_from_uq";--> statement-breakpoint
DROP INDEX "duty_rates_dest_hs6_from_uq";--> statement-breakpoint
ALTER TABLE "duty_rates" ALTER COLUMN "partner" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "duty_rates" ALTER COLUMN "partner" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "duty_rates_dest_partner_hs6_rule_from_uq" ON "duty_rates" USING btree ("dest","partner","hs6","duty_rule","effective_from");