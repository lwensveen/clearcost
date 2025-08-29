ALTER TABLE "hs_code_aliases" DROP CONSTRAINT "hs_alias_sys_code_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "hs_alias_sys_code_unique" ON "hs_code_aliases" USING btree ("system","code");