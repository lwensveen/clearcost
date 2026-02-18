import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  db,
  deMinimisTable,
  dutyRatesTable,
  freightRateCardsTable,
  fxRatesTable,
  importsTable,
  surchargesTable,
  vatRulesTable,
} from '@clearcost/db';
import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import type { Command } from '../runtime.js';
import { flagBool, flagCSV, flagStr, parseFlags } from '../utils.js';
import {
  getDatasetFreshnessSnapshot,
  getMvpFreshnessSnapshot,
} from '../../../modules/health/services.js';

type CoverageLane = {
  origin: string;
  dest: string;
  hs6: string;
};

type DutyCoverageRow = {
  dest: string;
  partner: string | null;
  hs6: string;
};

type CoverageCheck = {
  key: string;
  ok: boolean;
  detail: string;
};

const DEFAULT_REQUIRED_DESTINATIONS = ['NL', 'DE'] as const;
const DEFAULT_REQUIRED_LANES = ['US->NL:850440', 'US->DE:850440', 'NL->DE:851830'] as const;
const ASEAN_FTA_REQUIRED_JOBS = [
  'duties:id-fta',
  'duties:my-fta',
  'duties:th-fta',
  'duties:vn-fta',
  'duties:sg-fta',
] as const;
const ASEAN_FTA_FRESHNESS_THRESHOLD_HOURS = 192;

function up2(value: string): string {
  return value.trim().toUpperCase().slice(0, 2);
}

function parseCoverageLaneToken(token: string): CoverageLane | null {
  const trimmed = token.trim().toUpperCase();
  const match = /^([A-Z]{2})->([A-Z]{2}):(\d{6})$/.exec(trimmed);
  if (!match) return null;
  return { origin: match[1]!, dest: match[2]!, hs6: match[3]! };
}

function normalizePartner(value: string | null | undefined): string {
  const token = String(value ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(token) ? token : '';
}

function hasOfficialDutyCoverage(rows: DutyCoverageRow[], lane: CoverageLane): boolean {
  return rows.some((row) => {
    if (row.dest.toUpperCase() !== lane.dest) return false;
    if (String(row.hs6).slice(0, 6) !== lane.hs6) return false;
    const partner = normalizePartner(row.partner);
    return partner === '' || partner === lane.origin;
  });
}

function hasFxPair(
  pairs: Array<{ base: string; quote: string }>,
  from: string,
  to: string
): boolean {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  return pairs.some(({ base, quote }) => {
    const b = String(base).toUpperCase();
    const q = String(quote).toUpperCase();
    return (b === f && q === t) || (b === t && q === f);
  });
}

async function getImportJobFreshness(
  job: string,
  now: Date,
  freshnessThresholdHours: number
): Promise<{
  job: string;
  thresholdHours: number;
  lastSuccessAt: Date | null;
  lastAttemptAt: Date | null;
  ageHours: number | null;
  stale: boolean;
}> {
  const [successRow] = await db
    .select({
      latest: sql<Date | null>`MAX(COALESCE(${importsTable.finishedAt}, ${importsTable.startedAt}))`,
    })
    .from(importsTable)
    .where(and(eq(importsTable.job, job), eq(importsTable.importStatus, 'succeeded')));

  const [attemptRow] = await db
    .select({
      latest: sql<Date | null>`MAX(COALESCE(${importsTable.finishedAt}, ${importsTable.startedAt}))`,
    })
    .from(importsTable)
    .where(eq(importsTable.job, job));

  const lastSuccessAt = successRow?.latest ?? null;
  const lastAttemptAt = attemptRow?.latest ?? null;
  const ageHours =
    lastSuccessAt == null ? null : Math.max(0, (now.getTime() - lastSuccessAt.getTime()) / 36e5);
  const stale = lastSuccessAt == null || ageHours == null || ageHours > freshnessThresholdHours;

  return {
    job,
    thresholdHours: freshnessThresholdHours,
    lastSuccessAt,
    lastAttemptAt,
    ageHours,
    stale,
  };
}

export const coverageSnapshot: Command = async (args) => {
  const flags = parseFlags(args);
  const now = new Date();

  const outPath = flagStr(flags, 'out');
  const gateEnabled = !flagBool(flags, 'no-gate');

  const requiredDestinations = (
    flagCSV(flags, 'requiredDests').length ? flagCSV(flags, 'requiredDests') : []
  )
    .map(up2)
    .filter(Boolean);
  const effectiveRequiredDestinations = requiredDestinations.length
    ? requiredDestinations
    : [...DEFAULT_REQUIRED_DESTINATIONS];

  const requiredLaneTokens = flagCSV(flags, 'requiredLanes');
  const parsedRequiredLanes = (
    requiredLaneTokens.length ? requiredLaneTokens : [...DEFAULT_REQUIRED_LANES]
  )
    .map(parseCoverageLaneToken)
    .filter((lane): lane is CoverageLane => lane != null);
  if (requiredLaneTokens.length && parsedRequiredLanes.length !== requiredLaneTokens.length) {
    const invalid = requiredLaneTokens.filter((token) => parseCoverageLaneToken(token) == null);
    throw new Error(
      `Invalid --requiredLanes token(s): ${invalid.join(', ')} (expected ORIGIN->DEST:HS6, e.g. US->NL:850440)`
    );
  }

  const [freshness, mvpFreshness] = await Promise.all([
    getDatasetFreshnessSnapshot(),
    getMvpFreshnessSnapshot(),
  ]);
  const aseanFtaFreshness = await Promise.all(
    ASEAN_FTA_REQUIRED_JOBS.map((job) =>
      getImportJobFreshness(job, now, ASEAN_FTA_FRESHNESS_THRESHOLD_HOURS)
    )
  );

  const [latestFx] = await db
    .select({ latest: fxRatesTable.fxAsOf })
    .from(fxRatesTable)
    .orderBy(desc(fxRatesTable.fxAsOf))
    .limit(1);

  const latestFxAsOf = latestFx?.latest ?? null;
  const fxPairs =
    latestFxAsOf == null
      ? []
      : await db
          .select({
            base: fxRatesTable.base,
            quote: fxRatesTable.quote,
          })
          .from(fxRatesTable)
          .where(eq(fxRatesTable.fxAsOf, latestFxAsOf));

  const vatRows = await db
    .select({ dest: vatRulesTable.dest })
    .from(vatRulesTable)
    .where(
      and(
        eq(vatRulesTable.source, 'official'),
        eq(vatRulesTable.vatRateKind, 'STANDARD'),
        lte(vatRulesTable.effectiveFrom, now),
        or(isNull(vatRulesTable.effectiveTo), gt(vatRulesTable.effectiveTo, now))
      )
    );

  const dutyRows = await db
    .select({
      dest: dutyRatesTable.dest,
      partner: dutyRatesTable.partner,
      hs6: dutyRatesTable.hs6,
    })
    .from(dutyRatesTable)
    .where(
      and(
        eq(dutyRatesTable.source, 'official'),
        lte(dutyRatesTable.effectiveFrom, now),
        or(isNull(dutyRatesTable.effectiveTo), gt(dutyRatesTable.effectiveTo, now))
      )
    );

  const deMinimisRows = await db
    .select({ dest: deMinimisTable.dest })
    .from(deMinimisTable)
    .where(
      and(
        lte(deMinimisTable.effectiveFrom, now),
        or(isNull(deMinimisTable.effectiveTo), gt(deMinimisTable.effectiveTo, now))
      )
    );

  const surchargeRows = await db
    .select({ dest: surchargesTable.dest })
    .from(surchargesTable)
    .where(
      and(
        lte(surchargesTable.effectiveFrom, now),
        or(isNull(surchargesTable.effectiveTo), gt(surchargesTable.effectiveTo, now))
      )
    );

  const freightRows = await db
    .select({
      origin: freightRateCardsTable.origin,
      dest: freightRateCardsTable.dest,
      mode: freightRateCardsTable.freightMode,
    })
    .from(freightRateCardsTable)
    .where(
      and(
        lte(freightRateCardsTable.effectiveFrom, now),
        or(isNull(freightRateCardsTable.effectiveTo), gt(freightRateCardsTable.effectiveTo, now))
      )
    );

  const vatDestinations = [...new Set(vatRows.map((row) => String(row.dest).toUpperCase()))].sort();
  const dutyDestinations = [
    ...new Set(dutyRows.map((row) => String(row.dest).toUpperCase())),
  ].sort();
  const deMinimisDestinations = [
    ...new Set(deMinimisRows.map((row) => String(row.dest).toUpperCase())),
  ].sort();
  const surchargeDestinations = [
    ...new Set(surchargeRows.map((row) => String(row.dest).toUpperCase())),
  ].sort();
  const freightLaneKeys = new Set(
    freightRows.map(
      (row) => `${String(row.origin).toUpperCase()}->${String(row.dest).toUpperCase()}:${row.mode}`
    )
  );

  const fxCurrencySet = new Set<string>();
  for (const pair of fxPairs) {
    fxCurrencySet.add(String(pair.base).toUpperCase());
    fxCurrencySet.add(String(pair.quote).toUpperCase());
  }
  const fxCurrencies = [...fxCurrencySet].sort();

  const checks: CoverageCheck[] = [];

  checks.push({
    key: 'freshness.mvp.fx',
    ok: mvpFreshness.datasets.fx.stale !== true,
    detail:
      mvpFreshness.datasets.fx.stale === true
        ? 'MVP FX dataset is stale'
        : 'MVP FX dataset is fresh',
  });
  checks.push({
    key: 'freshness.mvp.vat',
    ok: mvpFreshness.datasets.vat.stale !== true,
    detail:
      mvpFreshness.datasets.vat.stale === true
        ? 'MVP VAT dataset is stale'
        : 'MVP VAT dataset is fresh',
  });
  checks.push({
    key: 'freshness.mvp.duties',
    ok: mvpFreshness.datasets.duties.stale !== true,
    detail:
      mvpFreshness.datasets.duties.stale === true
        ? 'MVP duties dataset is stale'
        : 'MVP duties dataset is fresh',
  });
  for (const jobFreshness of aseanFtaFreshness) {
    checks.push({
      key: `freshness.asean_fta.${jobFreshness.job}`,
      ok: jobFreshness.stale !== true,
      detail:
        jobFreshness.lastSuccessAt == null
          ? `No successful import run for ${jobFreshness.job}`
          : `${jobFreshness.job} latest success ${jobFreshness.lastSuccessAt.toISOString()} (threshold ${jobFreshness.thresholdHours}h)`,
    });
  }

  checks.push({
    key: 'fx.usd_eur_pair',
    ok: hasFxPair(fxPairs, 'USD', 'EUR'),
    detail: 'Latest FX snapshot must include USD/EUR convertibility',
  });

  for (const dest of effectiveRequiredDestinations) {
    checks.push({
      key: `vat.official.dest.${dest}`,
      ok: vatDestinations.includes(dest),
      detail: `Official STANDARD VAT coverage for destination ${dest}`,
    });
    checks.push({
      key: `de_minimis.dest.${dest}`,
      ok: deMinimisDestinations.includes(dest),
      detail: `Active de-minimis coverage for destination ${dest}`,
    });
  }

  for (const lane of parsedRequiredLanes) {
    checks.push({
      key: `duties.official.lane.${lane.origin}->${lane.dest}:${lane.hs6}`,
      ok: hasOfficialDutyCoverage(dutyRows, lane),
      detail: `Official duty coverage for ${lane.origin}->${lane.dest} HS6 ${lane.hs6}`,
    });
  }

  const failedChecks = checks.filter((check) => !check.ok);
  const gateOk = failedChecks.length === 0;

  const payload = {
    generatedAt: now.toISOString(),
    required: {
      destinations: effectiveRequiredDestinations,
      lanes: parsedRequiredLanes.map((lane) => `${lane.origin}->${lane.dest}:${lane.hs6}`),
    },
    freshness: {
      fx: freshness.datasets.fx,
      vat: freshness.datasets.vat,
      duties: freshness.datasets.duties,
      surcharges: freshness.datasets.surcharges,
      freight: freshness.datasets.freight,
      deMinimis: freshness.datasets['de-minimis'],
      mvp: {
        fx: mvpFreshness.datasets.fx,
        vat: mvpFreshness.datasets.vat,
        duties: mvpFreshness.datasets.duties,
      },
      aseanFta: {
        jobs: aseanFtaFreshness.map((jobFreshness) => ({
          job: jobFreshness.job,
          thresholdHours: jobFreshness.thresholdHours,
          lastSuccessAt: jobFreshness.lastSuccessAt?.toISOString() ?? null,
          lastAttemptAt: jobFreshness.lastAttemptAt?.toISOString() ?? null,
          ageHours: jobFreshness.ageHours,
          stale: jobFreshness.stale,
        })),
      },
    },
    datasets: {
      fx: {
        latestFxAsOf: latestFxAsOf ? latestFxAsOf.toISOString() : null,
        pairCount: fxPairs.length,
        currencies: fxCurrencies,
        hasUsdEurPair: hasFxPair(fxPairs, 'USD', 'EUR'),
      },
      vat: {
        officialStandardRowCount: vatRows.length,
        officialDestinations: vatDestinations,
      },
      duties: {
        officialRowCount: dutyRows.length,
        officialDestinations: dutyDestinations,
      },
      deMinimis: {
        rowCount: deMinimisRows.length,
        destinations: deMinimisDestinations,
      },
      surcharges: {
        rowCount: surchargeRows.length,
        destinations: surchargeDestinations,
      },
      freight: {
        activeCardCount: freightRows.length,
        laneCount: freightLaneKeys.size,
      },
    },
    gate: {
      enabled: gateEnabled,
      ok: gateOk,
      failedChecks,
      checks,
    },
  };

  const json = JSON.stringify(payload, null, 2);
  console.log(json);

  if (outPath) {
    const absOut = resolve(process.cwd(), outPath);
    await mkdir(dirname(absOut), { recursive: true });
    await writeFile(absOut, `${json}\n`, 'utf8');
  }

  if (gateEnabled && !gateOk) {
    throw new Error(
      `[coverage] regression gate failed: ${failedChecks.map((check) => check.key).join(', ')}`
    );
  }
};
