CREATE TYPE "public"."jurisdiction_kind" AS ENUM('country', 'bloc', 'territory', 'other');--> statement-breakpoint
ALTER TYPE "public"."import_source" ADD VALUE 'CSV' BEFORE 'ECB';--> statement-breakpoint
ALTER TYPE "public"."import_source" ADD VALUE 'SEED' BEFORE 'TARIC';--> statement-breakpoint
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iso2" varchar(2) NOT NULL,
	"iso3" varchar(3),
	"name" text NOT NULL,
	"official_name" text,
	"numeric" varchar(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jurisdictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(8) NOT NULL,
	"name" text NOT NULL,
	"kind" "jurisdiction_kind" DEFAULT 'country' NOT NULL,
	"country_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_program_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"country_id" uuid NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone DEFAULT now(),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" text NOT NULL,
	"kind" varchar(16) DEFAULT 'fta' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_program_members" ADD CONSTRAINT "trade_program_members_program_id_trade_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."trade_programs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trade_program_members" ADD CONSTRAINT "trade_program_members_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_programs" ADD CONSTRAINT "trade_programs_owner_id_jurisdictions_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso2_uq" ON "countries" USING btree ("iso2");--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso3_uq" ON "countries" USING btree ("iso3");--> statement-breakpoint
CREATE INDEX "countries_name_idx" ON "countries" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdictions_code_uq" ON "jurisdictions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "jurisdictions_kind_idx" ON "jurisdictions" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "jurisdictions_country_idx" ON "jurisdictions" USING btree ("country_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_program_members_program_country_from_uq" ON "trade_program_members" USING btree ("program_id","country_id","effective_from");--> statement-breakpoint
CREATE INDEX "trade_program_members_program_idx" ON "trade_program_members" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "trade_program_members_country_idx" ON "trade_program_members" USING btree ("country_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_programs_owner_code_uq" ON "trade_programs" USING btree ("owner_id","code");--> statement-breakpoint
CREATE INDEX "trade_programs_owner_idx" ON "trade_programs" USING btree ("owner_id");