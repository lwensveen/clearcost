import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  db,
  deMinimisTable,
  dutyRatesTable,
  freightRateCardsTable,
  fxRatesTable,
  importsTable,
  sourceRegistryTable,
  surchargesTable,
  vatRulesTable,
} from '@clearcost/db';
import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
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
  source: string;
  dutyRule: string;
};

type DutyCoverageRequirement = {
  origin: string | null;
  dest: string;
  hs6: string;
  dutyRule: 'mfn' | 'fta';
  expectedSources: ReadonlyArray<'official' | 'wits'>;
};

type DutyDatasetCoverageRequirement = {
  dest: string;
  dutyRule: 'mfn' | 'fta';
  expectedSources: ReadonlyArray<'official' | 'wits'>;
};

type CoverageCheck = {
  key: string;
  ok: boolean;
  detail: string;
};

type SourceRegistryCoverageRow = {
  key: string;
  enabled: boolean;
};

const DEFAULT_REQUIRED_DESTINATIONS = ['NL', 'DE'] as const;
const DEFAULT_REQUIRED_LANES = ['US->NL:850440', 'US->DE:850440', 'NL->DE:851830'] as const;
const ASEAN_FTA_REQUIRED_JOBS = [
  'duties:bn-fta-official',
  'duties:id-fta-official',
  'duties:kh-fta-official',
  'duties:la-fta-official',
  'duties:mm-fta-official',
  'duties:my-fta-excel',
  'duties:ph-fta-official',
  'duties:th-fta-official',
  'duties:vn-fta-official',
  'duties:sg-fta-official',
] as const;
const ASEAN_MFN_REQUIRED_JOBS = [
  'duties:bn-mfn-official',
  'duties:id-mfn',
  'duties:kh-mfn-official',
  'duties:la-mfn-official',
  'duties:mm-mfn-official',
  'duties:my-mfn-excel',
  'duties:ph-mfn-official',
  'duties:th-mfn-official',
  'duties:vn-mfn-official',
  'duties:sg-mfn-official',
] as const;
const ASEAN_MFN_REQUIRED_LANES: ReadonlyArray<DutyCoverageRequirement> = [
  { origin: null, dest: 'BN', hs6: '850440', dutyRule: 'mfn', expectedSources: ['official'] },
  { origin: null, dest: 'ID', hs6: '850440', dutyRule: 'mfn', expectedSources: ['official'] },
  { origin: null, dest: 'KH', hs6: '850440', dutyRule: 'mfn', expectedSources: ['official'] },
  { origin: null, dest: 'LA', hs6: '850440', dutyRule: 'mfn', expectedSources: ['official'] },
  { origin: null, dest: 'MM', hs6: '850440', dutyRule: 'mfn', expectedSources: ['official'] },
  { origin: null, dest: 'MY', hs6: '850440', dutyRule: 'mfn', expectedSources: ['official'] },
  { origin: null, dest: 'PH', hs6: '850440', dutyRule: 'mfn', expectedSources: ['official'] },
  { origin: null, dest: 'TH', hs6: '850440', dutyRule: 'mfn', expectedSources: ['official'] },
  { origin: null, dest: 'VN', hs6: '850440', dutyRule: 'mfn', expectedSources: ['official'] },
  { origin: null, dest: 'SG', hs6: '850440', dutyRule: 'mfn', expectedSources: ['official'] },
] as const;
const ASEAN_FTA_REQUIRED_LANES: ReadonlyArray<DutyCoverageRequirement> = [
  { origin: 'SG', dest: 'BN', hs6: '850440', dutyRule: 'fta', expectedSources: ['official'] },
  { origin: 'SG', dest: 'ID', hs6: '850440', dutyRule: 'fta', expectedSources: ['official'] },
  { origin: 'SG', dest: 'KH', hs6: '850440', dutyRule: 'fta', expectedSources: ['official'] },
  { origin: 'SG', dest: 'LA', hs6: '850440', dutyRule: 'fta', expectedSources: ['official'] },
  { origin: 'SG', dest: 'MM', hs6: '850440', dutyRule: 'fta', expectedSources: ['official'] },
  { origin: 'SG', dest: 'MY', hs6: '850440', dutyRule: 'fta', expectedSources: ['official'] },
  { origin: 'SG', dest: 'PH', hs6: '850440', dutyRule: 'fta', expectedSources: ['official'] },
  { origin: 'SG', dest: 'TH', hs6: '850440', dutyRule: 'fta', expectedSources: ['official'] },
  { origin: 'SG', dest: 'VN', hs6: '850440', dutyRule: 'fta', expectedSources: ['official'] },
  { origin: 'MY', dest: 'SG', hs6: '850440', dutyRule: 'fta', expectedSources: ['official'] },
] as const;
const ASEAN_FTA_FRESHNESS_THRESHOLD_HOURS = 192;
const ASEAN_MFN_FRESHNESS_THRESHOLD_HOURS = 192;
const JP_REQUIRED_JOBS = ['duties:jp-mfn', 'duties:jp-fta-official'] as const;
const CN_REQUIRED_JOBS = ['duties:cn-mfn-official', 'duties:cn-fta-official'] as const;
const UK_REQUIRED_JOBS = ['duties:uk-mfn', 'duties:uk-fta'] as const;
const US_REQUIRED_JOBS = ['duties:us-mfn', 'duties:us-fta'] as const;
const JP_FRESHNESS_THRESHOLD_HOURS = 192;
const CN_FRESHNESS_THRESHOLD_HOURS = 192;
const UK_FRESHNESS_THRESHOLD_HOURS = 192;
const US_FRESHNESS_THRESHOLD_HOURS = 192;
const JP_REQUIRED_DUTY_DATASETS: ReadonlyArray<DutyDatasetCoverageRequirement> = [
  { dest: 'JP', dutyRule: 'mfn', expectedSources: ['official'] },
  { dest: 'JP', dutyRule: 'fta', expectedSources: ['official'] },
] as const;
const CN_REQUIRED_DUTY_DATASETS: ReadonlyArray<DutyDatasetCoverageRequirement> = [
  { dest: 'CN', dutyRule: 'mfn', expectedSources: ['official'] },
  { dest: 'CN', dutyRule: 'fta', expectedSources: ['official'] },
] as const;
const UK_REQUIRED_DUTY_DATASETS: ReadonlyArray<DutyDatasetCoverageRequirement> = [
  { dest: 'GB', dutyRule: 'mfn', expectedSources: ['official'] },
  { dest: 'GB', dutyRule: 'fta', expectedSources: ['official'] },
] as const;
const US_REQUIRED_DUTY_DATASETS: ReadonlyArray<DutyDatasetCoverageRequirement> = [
  { dest: 'US', dutyRule: 'mfn', expectedSources: ['official'] },
  { dest: 'US', dutyRule: 'fta', expectedSources: ['official'] },
] as const;
const OFFICIAL_FX_REQUIRED_SOURCE_KEYS = ['fx.ecb.daily'] as const;
const OFFICIAL_VAT_REQUIRED_SOURCE_KEYS = ['vat.oecd_imf.standard', 'vat.imf.standard'] as const;
const OFFICIAL_DE_MINIMIS_REQUIRED_SOURCE_KEYS = [
  'de-minimis.official.us.section321',
  'de-minimis.official.eu.reg_1186_2009',
  'de-minimis.official.gb.vat_overseas_goods',
  'de-minimis.official.ca.lvs_vat',
  'de-minimis.official.ca.lvs_duty',
] as const;
const OFFICIAL_HS_REQUIRED_SOURCE_KEYS = [
  'hs.asean.ahtn.csv',
  'hs.eu.taric.goods',
  'hs.eu.taric.goods_description',
  'hs.uk.tariff.api_base',
  'hs.us.usitc.base',
  'hs.us.usitc.csv',
  'hs.us.usitc.json',
] as const;
const OFFICIAL_NOTICES_REQUIRED_SOURCE_KEYS = [
  'notices.cn.mof.list',
  'notices.cn.gacc.list',
  'notices.cn.mofcom.list',
] as const;
const OFFICIAL_SURCHARGES_REQUIRED_SOURCE_KEYS = [
  'duties.uk.tariff.api_base',
  'surcharges.eu.taric.measure',
  'surcharges.eu.taric.component',
  'surcharges.eu.taric.geo_description',
  'surcharges.eu.taric.duty_expression',
  'surcharges.us.aphis.aqi_fees',
  'surcharges.us.aphis.aqi_fy25',
  'surcharges.us.fda.vqip_fees',
  'surcharges.us.federal_register.search',
  'surcharges.us.federal_register.documents_api',
  'surcharges.us.statute.hmf',
  'surcharges.us.statute.mpf',
] as const;
const OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS = [
  'duties.eu.taric.daily',
  'duties.eu.taric.mfn',
  'duties.eu.taric.preferential',
  'duties.eu.taric.measure',
  'duties.eu.taric.component',
  'duties.eu.taric.duty_expression',
  'duties.eu.taric.geo_description',
  'duties.bn.official.mfn_excel',
  'duties.bn.official.fta_excel',
  'duties.uk.tariff.api_base',
  'duties.us.usitc.base',
  'duties.us.usitc.csv',
  'duties.us.trade_programs.members_csv',
  'duties.jp.customs.tariff_index',
  'duties.cn.taxbook.pdf',
  'duties.cn.official.fta_excel',
  'duties.id.btki.xlsx',
  'duties.id.btki.portal',
  'duties.id.official.fta_excel',
  'duties.kh.official.mfn_excel',
  'duties.kh.official.fta_excel',
  'duties.la.official.mfn_excel',
  'duties.la.official.fta_excel',
  'duties.mm.official.mfn_excel',
  'duties.mm.official.fta_excel',
  'duties.my.gazette.mfn_pdf',
  'duties.my.official.mfn_excel',
  'duties.my.official.fta_excel',
  'duties.ph.tariff_commission.xlsx',
  'duties.ph.official.fta_excel',
  'duties.sg.official.mfn_excel',
  'duties.sg.official.fta_excel',
  'duties.th.official.mfn_excel',
  'duties.th.official.fta_excel',
  'duties.vn.official.mfn_excel',
  'duties.vn.official.fta_excel',
] as const;
const OPTIONAL_FALLBACK_SOURCE_KEYS = [
  'duties.wits.sdmx.base',
  'hs.wits.sdmx.data_base',
  'de-minimis.trade_gov.api',
  'de-minimis.zonos.docs',
] as const;

export function evaluateRequiredSourceKeys(
  requiredKeys: ReadonlyArray<string>,
  rows: ReadonlyArray<SourceRegistryCoverageRow>,
  dataset: string = 'duties'
): CoverageCheck[] {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return requiredKeys.map((sourceKey) => {
    const row = byKey.get(sourceKey);
    if (!row) {
      return {
        key: `source_registry.${dataset}.${sourceKey}`,
        ok: false,
        detail: `Missing source_registry row for ${sourceKey}`,
      };
    }
    if (!row.enabled) {
      return {
        key: `source_registry.${dataset}.${sourceKey}`,
        ok: false,
        detail: `source_registry row for ${sourceKey} is disabled`,
      };
    }
    return {
      key: `source_registry.${dataset}.${sourceKey}`,
      ok: true,
      detail: `source_registry row for ${sourceKey} is enabled`,
    };
  });
}

export function evaluateKnownSourceKeys(
  knownKeys: ReadonlyArray<string>,
  rows: ReadonlyArray<SourceRegistryCoverageRow>,
  dataset: string = 'fallback'
): CoverageCheck[] {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return knownKeys.map((sourceKey) => {
    const row = byKey.get(sourceKey);
    if (!row) {
      return {
        key: `source_registry.${dataset}.${sourceKey}`,
        ok: false,
        detail: `Missing source_registry row for ${sourceKey}`,
      };
    }
    return {
      key: `source_registry.${dataset}.${sourceKey}`,
      ok: true,
      detail: `source_registry row for ${sourceKey} is ${row.enabled ? 'enabled' : 'disabled'}`,
    };
  });
}

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

function formatDutyCoverageRequirementLane(req: DutyCoverageRequirement): string {
  const origin = req.origin ? req.origin.toUpperCase() : 'WLD';
  return `${origin}->${req.dest.toUpperCase()}:${req.hs6}`;
}

function hasDutyCoverageForRequirement(
  rows: DutyCoverageRow[],
  requirement: DutyCoverageRequirement
): boolean {
  const dest = requirement.dest.toUpperCase();
  const hs6 = requirement.hs6;
  const dutyRule = requirement.dutyRule.toLowerCase();
  const partner = requirement.origin == null ? '' : requirement.origin.toUpperCase();
  const expectedSources = new Set(requirement.expectedSources.map((s) => s.toLowerCase()));

  return rows.some((row) => {
    if (row.dest.toUpperCase() !== dest) return false;
    if (String(row.hs6).slice(0, 6) !== hs6) return false;
    if (String(row.dutyRule).toLowerCase() !== dutyRule) return false;
    if (normalizePartner(row.partner) !== partner) return false;
    return expectedSources.has(String(row.source).toLowerCase());
  });
}

function formatDutyDatasetCoverageRequirement(req: DutyDatasetCoverageRequirement): string {
  return `${req.dest.toUpperCase()}:${req.dutyRule}`;
}

function hasDutyDatasetCoverage(
  rows: DutyCoverageRow[],
  requirement: DutyDatasetCoverageRequirement
): boolean {
  const dest = requirement.dest.toUpperCase();
  const dutyRule = requirement.dutyRule.toLowerCase();
  const expectedSources = new Set(requirement.expectedSources.map((s) => s.toLowerCase()));

  return rows.some((row) => {
    if (row.dest.toUpperCase() !== dest) return false;
    if (String(row.dutyRule).toLowerCase() !== dutyRule) return false;
    return expectedSources.has(String(row.source).toLowerCase());
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
  const aseanMfnFreshness = await Promise.all(
    ASEAN_MFN_REQUIRED_JOBS.map((job) =>
      getImportJobFreshness(job, now, ASEAN_MFN_FRESHNESS_THRESHOLD_HOURS)
    )
  );
  const jpFreshness = await Promise.all(
    JP_REQUIRED_JOBS.map((job) => getImportJobFreshness(job, now, JP_FRESHNESS_THRESHOLD_HOURS))
  );
  const cnFreshness = await Promise.all(
    CN_REQUIRED_JOBS.map((job) => getImportJobFreshness(job, now, CN_FRESHNESS_THRESHOLD_HOURS))
  );
  const ukFreshness = await Promise.all(
    UK_REQUIRED_JOBS.map((job) => getImportJobFreshness(job, now, UK_FRESHNESS_THRESHOLD_HOURS))
  );
  const usFreshness = await Promise.all(
    US_REQUIRED_JOBS.map((job) => getImportJobFreshness(job, now, US_FRESHNESS_THRESHOLD_HOURS))
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
      source: dutyRatesTable.source,
      dutyRule: dutyRatesTable.dutyRule,
    })
    .from(dutyRatesTable)
    .where(
      and(
        lte(dutyRatesTable.effectiveFrom, now),
        or(isNull(dutyRatesTable.effectiveTo), gt(dutyRatesTable.effectiveTo, now))
      )
    );
  const officialDutyRows = dutyRows.filter((row) => row.source === 'official');
  const dutySourceRegistryRows = await db
    .select({
      key: sourceRegistryTable.key,
      enabled: sourceRegistryTable.enabled,
    })
    .from(sourceRegistryTable)
    .where(
      inArray(sourceRegistryTable.key, [
        ...OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS,
        ...OFFICIAL_FX_REQUIRED_SOURCE_KEYS,
        ...OFFICIAL_VAT_REQUIRED_SOURCE_KEYS,
        ...OFFICIAL_DE_MINIMIS_REQUIRED_SOURCE_KEYS,
        ...OFFICIAL_HS_REQUIRED_SOURCE_KEYS,
        ...OFFICIAL_NOTICES_REQUIRED_SOURCE_KEYS,
        ...OFFICIAL_SURCHARGES_REQUIRED_SOURCE_KEYS,
        ...OPTIONAL_FALLBACK_SOURCE_KEYS,
      ])
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
    ...new Set(officialDutyRows.map((row) => String(row.dest).toUpperCase())),
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
  for (const jobFreshness of aseanMfnFreshness) {
    checks.push({
      key: `freshness.asean_mfn.${jobFreshness.job}`,
      ok: jobFreshness.stale !== true,
      detail:
        jobFreshness.lastSuccessAt == null
          ? `No successful import run for ${jobFreshness.job}`
          : `${jobFreshness.job} latest success ${jobFreshness.lastSuccessAt.toISOString()} (threshold ${jobFreshness.thresholdHours}h)`,
    });
  }
  for (const jobFreshness of jpFreshness) {
    checks.push({
      key: `freshness.jp.${jobFreshness.job}`,
      ok: jobFreshness.stale !== true,
      detail:
        jobFreshness.lastSuccessAt == null
          ? `No successful import run for ${jobFreshness.job}`
          : `${jobFreshness.job} latest success ${jobFreshness.lastSuccessAt.toISOString()} (threshold ${jobFreshness.thresholdHours}h)`,
    });
  }
  for (const jobFreshness of cnFreshness) {
    checks.push({
      key: `freshness.cn.${jobFreshness.job}`,
      ok: jobFreshness.stale !== true,
      detail:
        jobFreshness.lastSuccessAt == null
          ? `No successful import run for ${jobFreshness.job}`
          : `${jobFreshness.job} latest success ${jobFreshness.lastSuccessAt.toISOString()} (threshold ${jobFreshness.thresholdHours}h)`,
    });
  }
  for (const jobFreshness of ukFreshness) {
    checks.push({
      key: `freshness.uk.${jobFreshness.job}`,
      ok: jobFreshness.stale !== true,
      detail:
        jobFreshness.lastSuccessAt == null
          ? `No successful import run for ${jobFreshness.job}`
          : `${jobFreshness.job} latest success ${jobFreshness.lastSuccessAt.toISOString()} (threshold ${jobFreshness.thresholdHours}h)`,
    });
  }
  for (const jobFreshness of usFreshness) {
    checks.push({
      key: `freshness.us.${jobFreshness.job}`,
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
      ok: hasOfficialDutyCoverage(officialDutyRows, lane),
      detail: `Official duty coverage for ${lane.origin}->${lane.dest} HS6 ${lane.hs6}`,
    });
  }
  for (const requirement of ASEAN_MFN_REQUIRED_LANES) {
    const lane = formatDutyCoverageRequirementLane(requirement);
    checks.push({
      key: `duties.asean_mfn.lane.${lane}`,
      ok: hasDutyCoverageForRequirement(dutyRows, requirement),
      detail: `ASEAN MFN coverage for ${lane} (${requirement.expectedSources.join('/')}, rule=${requirement.dutyRule})`,
    });
  }
  for (const requirement of ASEAN_FTA_REQUIRED_LANES) {
    const lane = formatDutyCoverageRequirementLane(requirement);
    checks.push({
      key: `duties.asean_fta.lane.${lane}`,
      ok: hasDutyCoverageForRequirement(dutyRows, requirement),
      detail: `ASEAN FTA coverage for ${lane} (${requirement.expectedSources.join('/')}, rule=${requirement.dutyRule})`,
    });
  }
  for (const requirement of JP_REQUIRED_DUTY_DATASETS) {
    const dataset = formatDutyDatasetCoverageRequirement(requirement);
    checks.push({
      key: `duties.jp.dataset.${dataset}`,
      ok: hasDutyDatasetCoverage(dutyRows, requirement),
      detail: `JP ${requirement.dutyRule.toUpperCase()} official coverage (${requirement.expectedSources.join('/')})`,
    });
  }
  for (const requirement of CN_REQUIRED_DUTY_DATASETS) {
    const dataset = formatDutyDatasetCoverageRequirement(requirement);
    checks.push({
      key: `duties.cn.dataset.${dataset}`,
      ok: hasDutyDatasetCoverage(dutyRows, requirement),
      detail: `CN ${requirement.dutyRule.toUpperCase()} official coverage (${requirement.expectedSources.join('/')})`,
    });
  }
  for (const requirement of UK_REQUIRED_DUTY_DATASETS) {
    const dataset = formatDutyDatasetCoverageRequirement(requirement);
    checks.push({
      key: `duties.uk.dataset.${dataset}`,
      ok: hasDutyDatasetCoverage(dutyRows, requirement),
      detail: `UK ${requirement.dutyRule.toUpperCase()} official coverage (${requirement.expectedSources.join('/')})`,
    });
  }
  for (const requirement of US_REQUIRED_DUTY_DATASETS) {
    const dataset = formatDutyDatasetCoverageRequirement(requirement);
    checks.push({
      key: `duties.us.dataset.${dataset}`,
      ok: hasDutyDatasetCoverage(dutyRows, requirement),
      detail: `US ${requirement.dutyRule.toUpperCase()} official coverage (${requirement.expectedSources.join('/')})`,
    });
  }
  checks.push(
    ...evaluateRequiredSourceKeys(OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS, dutySourceRegistryRows)
  );
  checks.push(
    ...evaluateRequiredSourceKeys(OFFICIAL_FX_REQUIRED_SOURCE_KEYS, dutySourceRegistryRows, 'fx')
  );
  checks.push(
    ...evaluateRequiredSourceKeys(OFFICIAL_VAT_REQUIRED_SOURCE_KEYS, dutySourceRegistryRows, 'vat')
  );
  checks.push(
    ...evaluateRequiredSourceKeys(
      OFFICIAL_DE_MINIMIS_REQUIRED_SOURCE_KEYS,
      dutySourceRegistryRows,
      'de_minimis'
    )
  );
  checks.push(
    ...evaluateRequiredSourceKeys(OFFICIAL_HS_REQUIRED_SOURCE_KEYS, dutySourceRegistryRows, 'hs')
  );
  checks.push(
    ...evaluateRequiredSourceKeys(
      OFFICIAL_NOTICES_REQUIRED_SOURCE_KEYS,
      dutySourceRegistryRows,
      'notices'
    )
  );
  checks.push(
    ...evaluateRequiredSourceKeys(
      OFFICIAL_SURCHARGES_REQUIRED_SOURCE_KEYS,
      dutySourceRegistryRows,
      'surcharges'
    )
  );
  checks.push(
    ...evaluateKnownSourceKeys(OPTIONAL_FALLBACK_SOURCE_KEYS, dutySourceRegistryRows, 'fallback')
  );

  const failedChecks = checks.filter((check) => !check.ok);
  const gateOk = failedChecks.length === 0;

  const payload = {
    generatedAt: now.toISOString(),
    required: {
      destinations: effectiveRequiredDestinations,
      lanes: parsedRequiredLanes.map((lane) => `${lane.origin}->${lane.dest}:${lane.hs6}`),
      aseanMfnSampleLanes: ASEAN_MFN_REQUIRED_LANES.map((req) =>
        formatDutyCoverageRequirementLane(req)
      ),
      aseanFtaSampleLanes: ASEAN_FTA_REQUIRED_LANES.map((req) =>
        formatDutyCoverageRequirementLane(req)
      ),
      jpDutyDatasets: JP_REQUIRED_DUTY_DATASETS.map((req) =>
        formatDutyDatasetCoverageRequirement(req)
      ),
      cnDutyDatasets: CN_REQUIRED_DUTY_DATASETS.map((req) =>
        formatDutyDatasetCoverageRequirement(req)
      ),
      ukDutyDatasets: UK_REQUIRED_DUTY_DATASETS.map((req) =>
        formatDutyDatasetCoverageRequirement(req)
      ),
      usDutyDatasets: US_REQUIRED_DUTY_DATASETS.map((req) =>
        formatDutyDatasetCoverageRequirement(req)
      ),
      officialDutySourceKeys: [...OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS],
      officialFxSourceKeys: [...OFFICIAL_FX_REQUIRED_SOURCE_KEYS],
      officialVatSourceKeys: [...OFFICIAL_VAT_REQUIRED_SOURCE_KEYS],
      officialDeMinimisSourceKeys: [...OFFICIAL_DE_MINIMIS_REQUIRED_SOURCE_KEYS],
      officialHsSourceKeys: [...OFFICIAL_HS_REQUIRED_SOURCE_KEYS],
      officialNoticesSourceKeys: [...OFFICIAL_NOTICES_REQUIRED_SOURCE_KEYS],
      officialSurchargesSourceKeys: [...OFFICIAL_SURCHARGES_REQUIRED_SOURCE_KEYS],
      optionalFallbackSourceKeys: [...OPTIONAL_FALLBACK_SOURCE_KEYS],
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
      aseanMfn: {
        jobs: aseanMfnFreshness.map((jobFreshness) => ({
          job: jobFreshness.job,
          thresholdHours: jobFreshness.thresholdHours,
          lastSuccessAt: jobFreshness.lastSuccessAt?.toISOString() ?? null,
          lastAttemptAt: jobFreshness.lastAttemptAt?.toISOString() ?? null,
          ageHours: jobFreshness.ageHours,
          stale: jobFreshness.stale,
        })),
      },
      jp: {
        jobs: jpFreshness.map((jobFreshness) => ({
          job: jobFreshness.job,
          thresholdHours: jobFreshness.thresholdHours,
          lastSuccessAt: jobFreshness.lastSuccessAt?.toISOString() ?? null,
          lastAttemptAt: jobFreshness.lastAttemptAt?.toISOString() ?? null,
          ageHours: jobFreshness.ageHours,
          stale: jobFreshness.stale,
        })),
      },
      cn: {
        jobs: cnFreshness.map((jobFreshness) => ({
          job: jobFreshness.job,
          thresholdHours: jobFreshness.thresholdHours,
          lastSuccessAt: jobFreshness.lastSuccessAt?.toISOString() ?? null,
          lastAttemptAt: jobFreshness.lastAttemptAt?.toISOString() ?? null,
          ageHours: jobFreshness.ageHours,
          stale: jobFreshness.stale,
        })),
      },
      uk: {
        jobs: ukFreshness.map((jobFreshness) => ({
          job: jobFreshness.job,
          thresholdHours: jobFreshness.thresholdHours,
          lastSuccessAt: jobFreshness.lastSuccessAt?.toISOString() ?? null,
          lastAttemptAt: jobFreshness.lastAttemptAt?.toISOString() ?? null,
          ageHours: jobFreshness.ageHours,
          stale: jobFreshness.stale,
        })),
      },
      us: {
        jobs: usFreshness.map((jobFreshness) => ({
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
        officialRowCount: officialDutyRows.length,
        officialDestinations: dutyDestinations,
        sourceRegistry: {
          requiredKeyCount: OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS.length,
          presentKeyCount: dutySourceRegistryRows.length,
          enabledKeyCount: dutySourceRegistryRows.filter((row) => row.enabled).length,
          missingKeys: OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS.filter(
            (sourceKey) => !dutySourceRegistryRows.some((row) => row.key === sourceKey)
          ),
          disabledKeys: dutySourceRegistryRows
            .filter((row) => !row.enabled)
            .map((row) => row.key)
            .sort(),
        },
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
