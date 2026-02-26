DO $$
BEGIN
  CREATE TYPE "surcharge_source" AS ENUM ('official', 'fallback', 'llm', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "surcharges"
  ADD COLUMN IF NOT EXISTS "source" "surcharge_source" NOT NULL DEFAULT 'official';

CREATE INDEX IF NOT EXISTS "surcharges_source_idx" ON "surcharges" USING btree ("source");
