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
    'duties.us.trade_programs.members_csv',
    'duties',
    'csv',
    NULL,
    NULL,
    'manual',
    'csv',
    'none',
    720,
    'US trade-program membership CSV source for import:programs:load-members. Configure download_url_template in source_registry or pass --url at runtime.',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
