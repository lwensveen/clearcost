ALTER TABLE "hs_code_aliases" DROP CONSTRAINT "hs_alias_hs6_digits";--> statement-breakpoint
ALTER TABLE "hs_code_aliases" ALTER COLUMN "hs6" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hs_code_aliases" ADD COLUMN "chapter" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "hs_code_aliases" ADD COLUMN "heading4" varchar(4) NOT NULL;--> statement-breakpoint
ALTER TABLE "hs_code_aliases" ADD COLUMN "is_special" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "hs_alias_chapter_idx" ON "hs_code_aliases" USING btree ("chapter");--> statement-breakpoint
CREATE INDEX "hs_alias_heading4_idx" ON "hs_code_aliases" USING btree ("heading4");--> statement-breakpoint
CREATE INDEX "hs_alias_is_special_idx" ON "hs_code_aliases" USING btree ("is_special");--> statement-breakpoint
ALTER TABLE "hs_code_aliases" ADD CONSTRAINT "hs_alias_heading4_digits" CHECK ("hs_code_aliases"."heading4" ~ '^[0-9]{4}$');--> statement-breakpoint
ALTER TABLE "hs_code_aliases" ADD CONSTRAINT "hs_alias_chapter_range" CHECK ("hs_code_aliases"."chapter" BETWEEN 1 AND 99);--> statement-breakpoint
ALTER TABLE "hs_code_aliases" ADD CONSTRAINT "hs_alias_is_special_rule" CHECK ("hs_code_aliases"."is_special" = ("hs_code_aliases"."chapter" >= 98));--> statement-breakpoint
ALTER TABLE "hs_code_aliases" ADD CONSTRAINT "hs_alias_hs6_rule" CHECK ((
        ("hs_code_aliases"."chapter" >= 98 AND "hs_code_aliases"."hs6" IS NULL) OR
        ("hs_code_aliases"."chapter" BETWEEN 1 AND 97 AND "hs_code_aliases"."hs6" IS NOT NULL)
      ));