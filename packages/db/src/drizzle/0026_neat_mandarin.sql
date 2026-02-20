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
    'duties.eu.taric.measure',
    'duties',
    'xml',
    NULL,
    NULL,
    'daily',
    'xml',
    'none',
    72,
    'EU TARIC MEASURE.xml source for MFN/FTA importers. Configure download_url_template or keep EU_TARIC_MEASURE_URL fallback.',
    NOW()
  ),
  (
    'duties.eu.taric.component',
    'duties',
    'xml',
    NULL,
    NULL,
    'daily',
    'xml',
    'none',
    72,
    'EU TARIC MEASURE_COMPONENT.xml source for MFN/FTA importers. Configure download_url_template or keep EU_TARIC_COMPONENT_URL fallback.',
    NOW()
  ),
  (
    'duties.eu.taric.duty_expression',
    'duties',
    'xml',
    NULL,
    NULL,
    'daily',
    'xml',
    'none',
    72,
    'Optional DUTY_EXPRESSION source for exact ad-valorem filtering in TARIC importers.',
    NOW()
  ),
  (
    'duties.eu.taric.geo_description',
    'duties',
    'xml',
    NULL,
    NULL,
    'daily',
    'xml',
    'none',
    72,
    'Optional GEOGRAPHICAL_AREA_DESCRIPTION source used to label preferential partner rows.',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
