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
    'surcharges.eu.taric.measure',
    'surcharges',
    'xml',
    NULL,
    NULL,
    'daily',
    'xml',
    'none',
    72,
    'EU TARIC MEASURE.xml source for EU trade-remedy surcharge importer.',
    NOW()
  ),
  (
    'surcharges.eu.taric.component',
    'surcharges',
    'xml',
    NULL,
    NULL,
    'daily',
    'xml',
    'none',
    72,
    'EU TARIC MEASURE_COMPONENT.xml source for EU trade-remedy surcharge importer.',
    NOW()
  ),
  (
    'surcharges.eu.taric.duty_expression',
    'surcharges',
    'xml',
    NULL,
    NULL,
    'daily',
    'xml',
    'none',
    72,
    'Optional DUTY_EXPRESSION source for exact ad-valorem parsing in EU remedy surcharge importer.',
    NOW()
  ),
  (
    'surcharges.eu.taric.geo_description',
    'surcharges',
    'xml',
    NULL,
    NULL,
    'daily',
    'xml',
    'none',
    72,
    'Optional GEOGRAPHICAL_AREA_DESCRIPTION source for EU remedy surcharge partner labels.',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
