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
    'hs.eu.taric.goods',
    'hs',
    'xml',
    NULL,
    NULL,
    'weekly',
    'xml',
    'none',
    168,
    'EU TARIC GOODS_NOMENCLATURE source for HS6/CN8/TARIC10 alias importers.',
    NOW()
  ),
  (
    'hs.eu.taric.goods_description',
    'hs',
    'xml',
    NULL,
    NULL,
    'weekly',
    'xml',
    'none',
    168,
    'EU TARIC GOODS_NOMENCLATURE_DESCRIPTION source for HS6/CN8/TARIC10 alias importers.',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
