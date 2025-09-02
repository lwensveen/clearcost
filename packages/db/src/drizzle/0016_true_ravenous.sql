CREATE TABLE "billing_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"stripe_customer_id" text,
	"plan" text,
	"status" text,
	"price_id" text,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "manifest_items_by_manifest";--> statement-breakpoint
ALTER TABLE "manifests" ADD COLUMN "name" varchar(200) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_accounts_owner_unique" ON "billing_accounts" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_accounts_customer_unique" ON "billing_accounts" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "manifest_items_by_manifest_idx" ON "manifest_items" USING btree ("manifest_id");--> statement-breakpoint
CREATE INDEX "manifest_items_hs6_idx" ON "manifest_items" USING btree ("user_hs6");--> statement-breakpoint
CREATE INDEX "manifests_owner_created_idx" ON "manifests" USING btree ("owner_id","created_at");