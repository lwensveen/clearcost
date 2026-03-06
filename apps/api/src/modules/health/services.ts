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
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

type ImportFreshnessRow = {
  last_success_at: Date | string | null;
  last_attempt_at: Date | string | null;
  source: string | null;
};

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

  const { rows } = await db.execute<ImportFreshnessRow>(sql`
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

  const row = rows[0] ?? null;

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

  const { rows } = await db.execute<ImportFreshnessRow>(sql`
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

  const row = rows[0] ?? null;

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

  // Fetch freshness stats for all datasets in parallel — each is an independent DB query.
  const entries = Object.entries(DATASET_FRESHNESS_RULES) as Array<
    [DatasetFreshnessKey, DatasetFreshnessRule]
  >;
  const results = await Promise.all(
    entries.map(([, rule]) => getImportFreshnessStats(rule.jobPrefixes))
  );

  for (let i = 0; i < entries.length; i++) {
    const [dataset, rule] = entries[i]!;
    const { lastSuccessAt, lastAttemptAt, source } = results[i]!;
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

  // Fetch freshness stats for all MVP datasets in parallel — each is an independent DB query.
  const mvpEntries = Object.entries(MVP_DATASET_FRESHNESS_RULES) as Array<
    [MvpDatasetFreshnessKey, MvpDatasetFreshnessRule]
  >;
  const mvpResults = await Promise.all(
    mvpEntries.map(([, rule]) => getImportFreshnessStatsForExactJobs(rule.jobs))
  );

  for (let i = 0; i < mvpEntries.length; i++) {
    const [dataset, rule] = mvpEntries[i]!;
    const { lastSuccessAt, lastAttemptAt, source } = mvpResults[i]!;
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

  // Run DB ping and FX freshness check in parallel — they are independent.
  const [dbResult, fxResult] = await Promise.all([
    (async () => {
      try {
        const t0 = Date.now();
        await db.execute(sql`select 1`);
        return { ok: true, latencyMs: Date.now() - t0 };
      } catch {
        return { ok: false, latencyMs: null };
      }
    })(),
    (async () => {
      try {
        const { rows } = await db.execute<{ latest: string | null }>(
          sql`SELECT MAX(as_of) AS latest FROM fx_rates`
        );
        const latest = rows[0]?.latest ?? null;
        if (latest) {
          const dt = new Date(latest);
          const ageHours = Math.max(0, (Date.now() - dt.getTime()) / 36e5);
          return { ok: ageHours <= FX_MAX_AGE_HOURS, latest: dt.toISOString(), ageHours };
        }
        return { ok: false, latest: null, ageHours: null };
      } catch {
        return { ok: null, latest: null, ageHours: null };
      }
    })(),
  ]);

  const dbOk = dbResult.ok;
  const dbLatencyMs = dbResult.latencyMs;
  const fxOk = fxResult.ok;
  const fxLatest = fxResult.latest;
  const fxAgeHours = fxResult.ageHours;

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
      // Redact uptime and timezone in public view to avoid leaking server metadata.
      uptimeSec: publicView ? null : Math.floor(process.uptime()),
      tz: publicView ? null : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
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
