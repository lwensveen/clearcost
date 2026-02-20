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
    'duties.wits.sdmx.base',
    'duties',
    'api',
    'https://wits.worldbank.org/API/V1/SDMX/V21/rest/data/DF_WITS_Tariff_TRAINS',
    NULL,
    'weekly',
    'json',
    'none',
    168,
    'WITS SDMX base endpoint for generic/ASEAN/JP WITS duty importers.',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
