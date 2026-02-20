INSERT INTO "source_registry" (
  "key",
  "dataset",
  "source_type",
  "base_url",
  "download_url_template",
  "schedule_hint",
  "expected_format",
  "auth_strategy",
  "sla_max_age_hours",
  "notes",
  "last_verified_at"
)
VALUES
  (
    'hs.uk.tariff.api_base',
    'hs',
    'api',
    'https://data.api.trade.gov.uk',
    NULL,
    'weekly',
    'json',
    'none',
    168,
    'UK tariff data API base URL for UK HS10 alias importer (hs:uk10).',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
