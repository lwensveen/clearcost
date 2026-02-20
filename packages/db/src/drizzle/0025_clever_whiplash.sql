ALTER TABLE "imports" ADD COLUMN "source_key" varchar(128);--> statement-breakpoint
ALTER TABLE "provenance" ADD COLUMN "source_key" varchar(128);--> statement-breakpoint
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
    'fx.ecb.daily',
    'fx',
    'xml',
    'https://www.ecb.europa.eu',
    'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
    'daily',
    'xml',
    'none',
    36,
    'ECB reference rates feed used by /internal/cron/fx/daily.',
    NOW()
  ),
  (
    'vat.oecd_imf.standard',
    'vat',
    'xlsx',
    'https://www.oecd.org',
    'https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/consumption-tax-trends/vat-gst-rates-ctt-trends.xlsx',
    'weekly',
    'xlsx',
    'none',
    168,
    'Primary OECD VAT workbook with IMF fallback in importer logic.',
    NOW()
  ),
  (
    'duties.eu.taric.mfn',
    'duties',
    'xml',
    'https://ec.europa.eu/taxation_customs/dds2/taric',
    NULL,
    'daily',
    'xml',
    'none',
    72,
    'EU TARIC MFN XML import via /internal/cron/import/duties/eu-mfn.',
    NOW()
  ),
  (
    'duties.eu.taric.preferential',
    'duties',
    'xml',
    'https://ec.europa.eu/taxation_customs/dds2/taric',
    NULL,
    'daily',
    'xml',
    'none',
    72,
    'EU TARIC preferential XML import via /internal/cron/import/duties/eu-fta.',
    NOW()
  ),
  (
    'duties.eu.taric.daily',
    'duties',
    'html',
    'https://ec.europa.eu/taxation_customs/dds2/taric',
    'https://ec.europa.eu/taxation_customs/dds2/taric/daily_publications.jsp?Lang=en',
    'daily',
    'html',
    'none',
    72,
    'EU TARIC daily publication page used to discover ZIP payloads.',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
