DO $$
BEGIN
  CREATE TYPE "de_minimis_source" AS ENUM ('official', 'fallback', 'llm', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "de_minimis"
  ADD COLUMN IF NOT EXISTS "source" "de_minimis_source" NOT NULL DEFAULT 'official';

CREATE INDEX IF NOT EXISTS "idx_dem_source" ON "de_minimis" USING btree ("source");
