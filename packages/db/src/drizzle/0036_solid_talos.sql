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
    'vat.imf.standard',
    'vat',
    'xlsx',
    'https://www.imf.org',
    'https://www.imf.org/external/np/fad/tpaf/files/vat_substandard_rates.xlsx',
    'weekly',
    'xlsx',
    'none',
    168,
    'IMF VAT workbook used as secondary fill source by vat:auto importer.',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
