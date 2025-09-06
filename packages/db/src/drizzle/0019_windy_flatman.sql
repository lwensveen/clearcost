CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "org_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"billing_email" varchar(320),
	"default_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"tax_id" varchar(64),
	"address" jsonb,
	"webhook_url" text,
	"webhook_secret" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_org_settings_currency_upper" CHECK (upper("org_settings"."default_currency") = "org_settings"."default_currency")
);
--> statement-breakpoint
ALTER TABLE "org_memberships" ALTER COLUMN "role" SET DEFAULT 'member'::"public"."org_role";--> statement-breakpoint
ALTER TABLE "org_memberships" ALTER COLUMN "role" SET DATA TYPE "public"."org_role" USING "role"::"public"."org_role";--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_org_settings_org" ON "org_settings" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_org_memberships_org_user" ON "org_memberships" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "ix_org_memberships_user" ON "org_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_org_memberships_org" ON "org_memberships" USING btree ("org_id");