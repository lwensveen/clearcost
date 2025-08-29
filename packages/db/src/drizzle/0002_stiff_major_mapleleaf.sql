DROP INDEX "hs_alias_lookup_idx";--> statement-breakpoint
ALTER TABLE "hs_code_aliases" ADD CONSTRAINT "hs_alias_sys_code_unique" UNIQUE("system","code");