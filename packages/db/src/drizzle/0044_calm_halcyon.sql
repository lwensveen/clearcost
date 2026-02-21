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
    'duties.cn.official.fta_excel',
    'duties',
    'xlsx',
    NULL,
    NULL,
    'manual',
    'xlsx',
    'none',
    720,
    'China preferential duty official Excel source for duties:cn-fta-official. Configure download_url_template in source_registry or set CN_FTA_OFFICIAL_EXCEL_URL.',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
