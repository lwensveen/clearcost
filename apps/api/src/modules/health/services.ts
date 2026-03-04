import { db, sourceRegistryTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { HealthSchema, type Health } from '@clearcost/types';

const FX_MAX_AGE_HOURS = Number(process.env.FX_MAX_AGE_HOURS ?? 48);

type DatasetFreshnessKey =
  | 'duties'
  | 'vat'
  | 'de-minimis'
  | 'surcharges'
  | 'hs-aliases'
  | 'freight'
  | 'fx'
  | 'notices';

type DatasetFreshnessRule = {
  scheduled: boolean;
  freshnessThresholdHours: number | null;
  jobPrefixes: string[];
};

const DATASET_FRESHNESS_RULES: Record<DatasetFreshnessKey, DatasetFreshnessRule> = {
  duties: { scheduled: true, freshnessThresholdHours: 192, jobPrefixes: ['duties:'] },
  vat: { scheduled: true, freshnessThresholdHours: 48, jobPrefixes: ['vat:'] },
  'de-minimis': { scheduled: true, freshnessThresholdHours: 48, jobPrefixes: ['de-minimis:'] },
  surcharges: { scheduled: true, freshnessThresholdHours: 192, jobPrefixes: ['surcharges:'] },
  'hs-aliases': { scheduled: true, freshnessThresholdHours: 192, jobPrefixes: ['hs:'] },
  freight: { scheduled: false, freshnessThresholdHours: null, jobPrefixes: ['freight:'] },
  fx: { scheduled: true, freshnessThresholdHours: 30, jobPrefixes: ['fx:'] },
  notices: {
    scheduled: true,
    freshnessThresholdHours: 48,
    jobPrefixes: ['notices:', 'crawl:notices'],
  },
};

function toDateOrNull(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const d = new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

type ImportFreshnessStats = {
  lastSuccessAt: Date | null;
  lastAttemptAt: Date | null;
  source: string | null;
};

async function getImportFreshnessStats(jobPrefixes: string[]): Promise<ImportFreshnessStats> {
  if (jobPrefixes.length === 0) {
    return { lastSuccessAt: null, lastAttemptAt: null, source: null };
  }

  const likeClauses = jobPrefixes.map((prefix) => sql`job LIKE ${`${prefix}%`}`);
  const whereJobs = sql.join(likeClauses, sql` OR `);
  const attemptAtExpr = sql`COALESCE(finished_at, started_at)`;

  const res = await db.execute(sql`
    SELECT
      MAX(
        CASE
          WHEN import_status = 'succeeded' THEN ${attemptAtExpr}
          ELSE NULL
        END
      ) AS last_success_at,
      MAX(${attemptAtExpr}) AS last_attempt_at,
      (
        SELECT i2.import_source::text
        FROM imports i2
        WHERE (${whereJobs})
          AND i2.import_status = 'succeeded'
        ORDER BY COALESCE(i2.finished_at, i2.started_at) DESC NULLS LAST
        LIMIT 1
      ) AS source
    FROM imports
    WHERE (${whereJobs})
  `);

  const row =
    (res as any)?.rows?.[0] ??
    (Array.isArray(res) ? (res as Array<Record<string, unknown>>)[0] : null) ??
    null;

  return {
    lastSuccessAt: toDateOrNull(row?.last_success_at ?? null),
    lastAttemptAt: toDateOrNull(row?.last_attempt_at ?? null),
    source: typeof row?.source === 'string' ? row.source : null,
  };
}

async function getImportFreshnessStatsForExactJobs(jobs: string[]): Promise<ImportFreshnessStats> {
  if (jobs.length === 0) {
    return { lastSuccessAt: null, lastAttemptAt: null, source: null };
  }

  const exactClauses = jobs.map((job) => sql`job = ${job}`);
  const whereJobs = sql.join(exactClauses, sql` OR `);
  const attemptAtExpr = sql`COALESCE(finished_at, started_at)`;

  const res = await db.execute(sql`
    SELECT
      MAX(
        CASE
          WHEN import_status = 'succeeded' THEN ${attemptAtExpr}
          ELSE NULL
        END
      ) AS last_success_at,
      MAX(${attemptAtExpr}) AS last_attempt_at,
      (
        SELECT i2.import_source::text
        FROM imports i2
        WHERE (${whereJobs})
          AND i2.import_status = 'succeeded'
        ORDER BY COALESCE(i2.finished_at, i2.started_at) DESC NULLS LAST
        LIMIT 1
      ) AS source
    FROM imports
    WHERE (${whereJobs})
  `);

  const row =
    (res as any)?.rows?.[0] ??
    (Array.isArray(res) ? (res as Array<Record<string, unknown>>)[0] : null) ??
    null;

  return {
    lastSuccessAt: toDateOrNull(row?.last_success_at ?? null),
    lastAttemptAt: toDateOrNull(row?.last_attempt_at ?? null),
    source: typeof row?.source === 'string' ? row.source : null,
  };
}

export async function getDatasetFreshnessSnapshot() {
  const now = new Date();
  const datasets: Record<
    DatasetFreshnessKey,
    {
      scheduled: boolean;
      thresholdHours: number | null;
      freshnessThresholdHours: number | null;
      lastSuccessAt: Date | null;
      lastAttemptAt: Date | null;
      source: string | null;
      latestRunAt: Date | null;
      ageHours: number | null;
      stale: boolean | null;
    }
  > = {
    duties: {
      scheduled: true,
      thresholdHours: 192,
      freshnessThresholdHours: 192,
      lastSuccessAt: null,
      lastAttemptAt: null,
      source: null,
      latestRunAt: null,
      ageHours: null,
      stale: true,
    },
    vat: {
      scheduled: true,
      thresholdHours: 48,
      freshnessThresholdHours: 48,
      lastSuccessAt: null,
      lastAttemptAt: null,
      source: null,
      latestRunAt: null,
      ageHours: null,
      stale: true,
    },
    'de-minimis': {
      scheduled: true,
      thresholdHours: 48,
      freshnessThresholdHours: 48,
      lastSuccessAt: null,
      lastAttemptAt: null,
      source: null,
      latestRunAt: null,
      ageHours: null,
      stale: true,
    },
    surcharges: {
      scheduled: true,
      thresholdHours: 192,
      freshnessThresholdHours: 192,
      lastSuccessAt: null,
      lastAttemptAt: null,
      source: null,
      latestRunAt: null,
      ageHours: null,
      stale: true,
    },
    'hs-aliases': {
      scheduled: true,
      thresholdHours: 192,
      freshnessThresholdHours: 192,
      lastSuccessAt: null,
      lastAttemptAt: null,
      source: null,
      latestRunAt: null,
      ageHours: null,
      stale: true,
    },
    freight: {
      scheduled: false,
      thresholdHours: null,
      freshnessThresholdHours: null,
      lastSuccessAt: null,
      lastAttemptAt: null,
      source: null,
      latestRunAt: null,
      ageHours: null,
      stale: null,
    },
    fx: {
      scheduled: true,
      thresholdHours: 30,
      freshnessThresholdHours: 30,
      lastSuccessAt: null,
      lastAttemptAt: null,
      source: null,
      latestRunAt: null,
      ageHours: null,
      stale: true,
    },
    notices: {
      scheduled: true,
      thresholdHours: 48,
      freshnessThresholdHours: 48,
      lastSuccessAt: null,
      lastAttemptAt: null,
      source: null,
      latestRunAt: null,
      ageHours: null,
      stale: true,
    },
  };

  for (const [dataset, rule] of Object.entries(DATASET_FRESHNESS_RULES) as Array<
    [DatasetFreshnessKey, DatasetFreshnessRule]
  >) {
    const { lastSuccessAt, lastAttemptAt, source } = await getImportFreshnessStats(
      rule.jobPrefixes
    );
    const latestRunAt = lastSuccessAt;
    const ageHours =
      latestRunAt == null ? null : Math.max(0, (now.getTime() - latestRunAt.getTime()) / 36e5);
    const stale =
      rule.freshnessThresholdHours == null
        ? null
        : latestRunAt == null
          ? true
          : ageHours! > rule.freshnessThresholdHours;

    datasets[dataset] = {
      scheduled: rule.scheduled,
      thresholdHours: rule.freshnessThresholdHours,
      freshnessThresholdHours: rule.freshnessThresholdHours,
      lastSuccessAt,
      lastAttemptAt,
      source,
      latestRunAt,
      ageHours,
      stale,
    };
  }

  return { now, datasets };
}

type MvpDatasetFreshnessKey = 'fx' | 'vat' | 'duties';

type MvpDatasetFreshnessRule = {
  scheduled: boolean;
  freshnessThresholdHours: number;
  jobs: string[];
};

const MVP_DATASET_FRESHNESS_RULES: Record<MvpDatasetFreshnessKey, MvpDatasetFreshnessRule> = {
  // MVP relies on ECB-based daily FX in the quote path.
  fx: { scheduled: true, freshnessThresholdHours: 30, jobs: ['fx:daily'] },
  // MVP VAT data should come from the official auto VAT import.
  vat: { scheduled: true, freshnessThresholdHours: 48, jobs: ['vat:auto'] },
  // MVP EU lane uses EU MFN duties; eu-daily is accepted as equivalent official coverage.
  duties: {
    scheduled: true,
    freshnessThresholdHours: 192,
    jobs: ['duties:eu-mfn-official', 'duties:eu-daily-official'],
  },
};

export async function getMvpFreshnessSnapshot() {
  const now = new Date();
  const datasets: Record<
    MvpDatasetFreshnessKey,
    {
      scheduled: boolean;
      thresholdHours: number;
      freshnessThresholdHours: number;
      lastSuccessAt: Date | null;
      lastAttemptAt: Date | null;
      source: string | null;
      latestRunAt: Date | null;
      ageHours: number | null;
      stale: boolean;
    }
  > = {
    fx: {
      scheduled: true,
      thresholdHours: 30,
      freshnessThresholdHours: 30,
      lastSuccessAt: null,
      lastAttemptAt: null,
      source: null,
      latestRunAt: null,
      ageHours: null,
      stale: true,
    },
    vat: {
      scheduled: true,
      thresholdHours: 48,
      freshnessThresholdHours: 48,
      lastSuccessAt: null,
      lastAttemptAt: null,
      source: null,
      latestRunAt: null,
      ageHours: null,
      stale: true,
    },
    duties: {
      scheduled: true,
      thresholdHours: 192,
      freshnessThresholdHours: 192,
      lastSuccessAt: null,
      lastAttemptAt: null,
      source: null,
      latestRunAt: null,
      ageHours: null,
      stale: true,
    },
  };

  for (const [dataset, rule] of Object.entries(MVP_DATASET_FRESHNESS_RULES) as Array<
    [MvpDatasetFreshnessKey, MvpDatasetFreshnessRule]
  >) {
    const { lastSuccessAt, lastAttemptAt, source } = await getImportFreshnessStatsForExactJobs(
      rule.jobs
    );
    const latestRunAt = lastSuccessAt;
    const ageHours =
      latestRunAt == null ? null : Math.max(0, (now.getTime() - latestRunAt.getTime()) / 36e5);
    const stale = latestRunAt == null ? true : ageHours! > rule.freshnessThresholdHours;

    datasets[dataset] = {
      scheduled: rule.scheduled,
      thresholdHours: rule.freshnessThresholdHours,
      freshnessThresholdHours: rule.freshnessThresholdHours,
      lastSuccessAt,
      lastAttemptAt,
      source,
      latestRunAt,
      ageHours,
      stale,
    };
  }

  return { now, datasets };
}

export async function getSourceRegistrySnapshot() {
  const now = new Date();

  type SourceRow = {
    key: string;
    dataset: string;
    source_type: string;
    enabled: boolean;
    schedule_hint: string;
    sla_max_age_hours: number | null;
    last_verified_at: Date | string | null;
    last_import_id: string | null;
    last_import_status: string | null;
    last_import_job: string | null;
    last_import_at: Date | string | null;
    last_import_inserted: number | null;
    last_import_error: string | null;
  };

  const { rows } = await db.execute<SourceRow>(sql`
    SELECT
      sr.key,
      sr.dataset,
      sr.source_type,
      sr.enabled,
      sr.schedule_hint,
      sr.sla_max_age_hours,
      sr.last_verified_at,
      i.id            AS last_import_id,
      i.import_status AS last_import_status,
      i.job           AS last_import_job,
      COALESCE(i.finished_at, i.started_at) AS last_import_at,
      i.inserted      AS last_import_inserted,
      i.error         AS last_import_error
    FROM ${sourceRegistryTable} sr
    LEFT JOIN LATERAL (
      SELECT *
      FROM imports
      WHERE source_key = sr.key
        AND import_status = 'succeeded'
      ORDER BY COALESCE(finished_at, started_at) DESC NULLS LAST
      LIMIT 1
    ) i ON true
    ORDER BY sr.key
  `);

  const sources = rows.map((r) => {
    const slaMaxAgeHours = r.sla_max_age_hours != null ? Number(r.sla_max_age_hours) : null;
    const lastImportAt = toDateOrNull(r.last_import_at);

    const ageHours =
      lastImportAt == null ? null : Math.max(0, (now.getTime() - lastImportAt.getTime()) / 36e5);

    const stale =
      slaMaxAgeHours == null ? null : lastImportAt == null ? true : ageHours! > slaMaxAgeHours;

    return {
      key: r.key,
      dataset: r.dataset,
      sourceType: r.source_type,
      enabled: r.enabled,
      scheduleHint: r.schedule_hint,
      slaMaxAgeHours,
      lastVerifiedAt: toDateOrNull(r.last_verified_at),
      lastImport: r.last_import_id
        ? {
            id: r.last_import_id,
            status: r.last_import_status!,
            job: r.last_import_job!,
            at: lastImportAt,
            inserted: r.last_import_inserted != null ? Number(r.last_import_inserted) : null,
            error: r.last_import_error ?? null,
          }
        : null,
      ageHours: ageHours != null ? Math.round(ageHours * 100) / 100 : null,
      stale,
    };
  });

  return { now, sources };
}

export { HealthSchema };

export async function checkHealth(opts: { publicView?: boolean } = {}): Promise<Health> {
  const publicView = opts.publicView ?? false;
  const startedAt = Date.now();

  let dbOk = false;
  let dbLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    await db.execute(sql`select 1`);
    dbOk = true;
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbOk = false;
    dbLatencyMs = null;
  }

  let fxOk: boolean | null = null;
  let fxLatest: string | null = null;
  let fxAgeHours: number | null = null;
  try {
    const r: any = await db.execute(sql`SELECT MAX(as_of) AS latest FROM fx_rates`);
    const latest = r?.rows?.[0]?.latest ?? r?.[0]?.latest ?? null;
    if (latest) {
      const dt = new Date(latest);
      fxLatest = dt.toISOString();
      fxAgeHours = Math.max(0, (Date.now() - dt.getTime()) / 36e5);
      fxOk = fxAgeHours <= FX_MAX_AGE_HOURS;
    } else {
      fxOk = false;
    }
  } catch {
    fxOk = null;
  }

  const ok = dbOk && (fxOk === null || fxOk);

  const dbLatencyPublic = publicView ? null : dbLatencyMs;
  const fxLatestPublic = publicView ? null : fxLatest;
  const fxAgeHoursPublic = publicView ? null : fxAgeHours;
  const commitPublic = publicView
    ? null
    : process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA;
  const envPublic = publicView ? 'public' : process.env.NODE_ENV || 'development';

  return {
    ok,
    service: 'clearcost-api',
    time: {
      server: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    },
    db: { ok: dbOk, latencyMs: dbLatencyPublic },
    fxCache: {
      ok: fxOk,
      latest: fxLatestPublic,
      ageHours: fxAgeHoursPublic,
      maxAgeHours: FX_MAX_AGE_HOURS,
    },
    version: {
      commit: commitPublic ?? null,
      env: envPublic,
    },
    durationMs: Date.now() - startedAt,
  };
}
