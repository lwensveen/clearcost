UPDATE "source_registry"
SET
  "download_url_template" = 'https://repository.beacukai.go.id/',
  "notes" = 'Indonesia BTKI repository crawl source used by /internal/cron/id/btki/crawl (stable default start URL).',
  "last_verified_at" = NOW()
WHERE "key" = 'duties.id.btki.portal'
  AND (
    "download_url_template" IS NULL
    OR "download_url_template" = ''
  );
