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
    'duties.cn.taxbook.pdf',
    'duties',
    'pdf',
    NULL,
    NULL,
    'manual',
    'pdf',
    'none',
    720,
    'China tariff book PDF source for duties:cn-mfn-pdf; URL/path is provided at run time.',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
