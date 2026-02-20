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
    'duties.jp.customs.tariff_index',
    'duties',
    'html',
    'https://www.customs.go.jp/english/tariff/',
    NULL,
    'weekly',
    'html',
    'none',
    168,
    'Japan Customs English tariff index page for JP MFN duties importer (duties:jp-mfn).',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
