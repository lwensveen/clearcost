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
    'hs.wits.sdmx.data_base',
    'hs',
    'api',
    'https://wits.worldbank.org/API/V1/SDMX/V21/rest/data/DF_WITS_Tariff_TRAINS',
    NULL,
    'weekly',
    'json',
    'none',
    168,
    'WITS SDMX data base endpoint for HS6 importer.',
    NOW()
  ),
  (
    'hs.wits.sdmx.datastructure',
    'hs',
    'json',
    NULL,
    'https://wits.worldbank.org/API/V1/SDMX/V21/rest/datastructure/WBG_WITS/TARIFF_TRAINS/',
    'weekly',
    'json',
    'none',
    168,
    'WITS SDMX datastructure endpoint for HS6 importer fallback parsing.',
    NOW()
  ),
  (
    'hs.wits.products.all',
    'hs',
    'xml',
    NULL,
    'https://wits.worldbank.org/API/V1/wits/datasource/trn/product/all',
    'weekly',
    'xml',
    'none',
    168,
    'WITS product/all XML fallback endpoint for HS6 importer.',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
