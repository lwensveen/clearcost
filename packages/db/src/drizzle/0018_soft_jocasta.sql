DROP INDEX "quote_snapshots_scope_key_uq";--> statement-breakpoint
DROP INDEX "quote_snapshots_created_at_idx";--> statement-breakpoint
ALTER TABLE "quote_snapshots" ALTER COLUMN "scope" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "quote_snapshots" ALTER COLUMN "scope" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "quote_snapshots" ALTER COLUMN "idem_key" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "audit_quotes" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_quotes" ADD COLUMN "api_key_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_snapshots" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_snapshots" ADD COLUMN "api_key_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_quotes" ADD CONSTRAINT "audit_quotes_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_snapshots" ADD CONSTRAINT "quote_snapshots_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_owner_created_idx" ON "audit_quotes" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_apikey_created_idx" ON "audit_quotes" USING btree ("api_key_id","created_at");--> statement-breakpoint
CREATE INDEX "quote_snapshots_scope_key_idx" ON "quote_snapshots" USING btree ("scope","idem_key");--> statement-breakpoint
CREATE INDEX "quote_snapshots_owner_created_idx" ON "quote_snapshots" USING btree ("owner_id","created_at");