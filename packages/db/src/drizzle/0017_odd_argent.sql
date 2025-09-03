ALTER TABLE "api_keys" RENAME COLUMN "token_hash" TO "token_phc";--> statement-breakpoint
DROP INDEX "ux_api_keys_hash";--> statement-breakpoint
CREATE UNIQUE INDEX "ux_api_keys_phc" ON "api_keys" USING btree ("token_phc");--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "salt";