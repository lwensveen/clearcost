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
    'hs.asean.ahtn.csv',
    'hs',
    'csv',
    NULL,
    NULL,
    'weekly',
    'csv',
    'none',
    168,
    'ASEAN AHTN CSV source URL for HS alias importer job hs:ahtn.',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
