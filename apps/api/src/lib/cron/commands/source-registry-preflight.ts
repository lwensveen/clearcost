import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { db, sourceRegistryTable } from '@clearcost/db';
import { inArray } from 'drizzle-orm';
import type { Command } from '../runtime.js';
import { flagBool, flagStr, parseFlags } from '../utils.js';
import {
  OFFICIAL_DE_MINIMIS_REQUIRED_SOURCE_KEYS,
  OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS,
  OFFICIAL_FX_REQUIRED_SOURCE_KEYS,
  OFFICIAL_HS_REQUIRED_SOURCE_KEYS,
  OFFICIAL_NOTICES_REQUIRED_SOURCE_KEYS,
  OFFICIAL_SURCHARGES_REQUIRED_SOURCE_KEYS,
  OFFICIAL_VAT_REQUIRED_SOURCE_KEYS,
  OPTIONAL_FALLBACK_SOURCE_KEYS,
} from '../../source-registry/defaults.js';
import {
  evaluateKnownSourceKeys,
  evaluateRequiredSourceKeys,
  summarizeSourceRegistryKeys,
} from './coverage.js';

type SourceRegistryCoverageRow = {
  key: string;
  enabled: boolean;
};

type SourceRegistryPreflightParams = {
  rows: ReadonlyArray<SourceRegistryCoverageRow>;
  requiredDutySourceKeys?: ReadonlyArray<string>;
  requiredFxSourceKeys?: ReadonlyArray<string>;
  requiredVatSourceKeys?: ReadonlyArray<string>;
  requiredDeMinimisSourceKeys?: ReadonlyArray<string>;
  requiredHsSourceKeys?: ReadonlyArray<string>;
  requiredNoticesSourceKeys?: ReadonlyArray<string>;
  requiredSurchargesSourceKeys?: ReadonlyArray<string>;
  fallbackSourceKeys?: ReadonlyArray<string>;
};

type SourceRegistryPreflightResult = {
  checks: ReturnType<typeof evaluateRequiredSourceKeys>;
  gateOk: boolean;
  failedChecks: ReturnType<typeof evaluateRequiredSourceKeys>;
  requiredKeys: string[];
};

function uniqueKeys(values: ReadonlyArray<string>): string[] {
  return [...new Set(values)];
}

export function evaluateSourceRegistryPreflight({
  rows,
  requiredDutySourceKeys = OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS,
  requiredFxSourceKeys = OFFICIAL_FX_REQUIRED_SOURCE_KEYS,
  requiredVatSourceKeys = OFFICIAL_VAT_REQUIRED_SOURCE_KEYS,
  requiredDeMinimisSourceKeys = OFFICIAL_DE_MINIMIS_REQUIRED_SOURCE_KEYS,
  requiredHsSourceKeys = OFFICIAL_HS_REQUIRED_SOURCE_KEYS,
  requiredNoticesSourceKeys = OFFICIAL_NOTICES_REQUIRED_SOURCE_KEYS,
  requiredSurchargesSourceKeys = OFFICIAL_SURCHARGES_REQUIRED_SOURCE_KEYS,
  fallbackSourceKeys = OPTIONAL_FALLBACK_SOURCE_KEYS,
}: SourceRegistryPreflightParams): SourceRegistryPreflightResult {
  const checks = [
    ...evaluateRequiredSourceKeys(requiredDutySourceKeys, rows, 'duties'),
    ...evaluateRequiredSourceKeys(requiredFxSourceKeys, rows, 'fx'),
    ...evaluateRequiredSourceKeys(requiredVatSourceKeys, rows, 'vat'),
    ...evaluateRequiredSourceKeys(requiredDeMinimisSourceKeys, rows, 'de_minimis'),
    ...evaluateRequiredSourceKeys(requiredHsSourceKeys, rows, 'hs'),
    ...evaluateRequiredSourceKeys(requiredNoticesSourceKeys, rows, 'notices'),
    ...evaluateRequiredSourceKeys(requiredSurchargesSourceKeys, rows, 'surcharges'),
    ...evaluateKnownSourceKeys(fallbackSourceKeys, rows, 'fallback'),
  ];

  const failedChecks = checks.filter((check) => !check.ok);
  return {
    checks,
    failedChecks,
    gateOk: failedChecks.length === 0,
    requiredKeys: uniqueKeys([
      ...requiredDutySourceKeys,
      ...requiredFxSourceKeys,
      ...requiredVatSourceKeys,
      ...requiredDeMinimisSourceKeys,
      ...requiredHsSourceKeys,
      ...requiredNoticesSourceKeys,
      ...requiredSurchargesSourceKeys,
      ...fallbackSourceKeys,
    ]),
  };
}

export const sourceRegistryPreflight: Command = async (args) => {
  const flags = parseFlags(args);
  const outPath = flagStr(flags, 'out');
  const gateEnabled = !flagBool(flags, 'no-gate');
  const now = new Date();

  const requiredSourceKeys = uniqueKeys([
    ...OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS,
    ...OFFICIAL_FX_REQUIRED_SOURCE_KEYS,
    ...OFFICIAL_VAT_REQUIRED_SOURCE_KEYS,
    ...OFFICIAL_DE_MINIMIS_REQUIRED_SOURCE_KEYS,
    ...OFFICIAL_HS_REQUIRED_SOURCE_KEYS,
    ...OFFICIAL_NOTICES_REQUIRED_SOURCE_KEYS,
    ...OFFICIAL_SURCHARGES_REQUIRED_SOURCE_KEYS,
    ...OPTIONAL_FALLBACK_SOURCE_KEYS,
  ]);

  const sourceRegistryRows = await db
    .select({
      key: sourceRegistryTable.key,
      enabled: sourceRegistryTable.enabled,
    })
    .from(sourceRegistryTable)
    .where(inArray(sourceRegistryTable.key, requiredSourceKeys));

  const { checks, failedChecks, gateOk } = evaluateSourceRegistryPreflight({
    rows: sourceRegistryRows,
  });

  const payload = {
    generatedAt: now.toISOString(),
    required: {
      officialDutySourceKeys: [...OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS],
      officialFxSourceKeys: [...OFFICIAL_FX_REQUIRED_SOURCE_KEYS],
      officialVatSourceKeys: [...OFFICIAL_VAT_REQUIRED_SOURCE_KEYS],
      officialDeMinimisSourceKeys: [...OFFICIAL_DE_MINIMIS_REQUIRED_SOURCE_KEYS],
      officialHsSourceKeys: [...OFFICIAL_HS_REQUIRED_SOURCE_KEYS],
      officialNoticesSourceKeys: [...OFFICIAL_NOTICES_REQUIRED_SOURCE_KEYS],
      officialSurchargesSourceKeys: [...OFFICIAL_SURCHARGES_REQUIRED_SOURCE_KEYS],
      optionalFallbackSourceKeys: [...OPTIONAL_FALLBACK_SOURCE_KEYS],
    },
    sourceRegistry: {
      officialDuty: summarizeSourceRegistryKeys(
        OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS,
        sourceRegistryRows
      ),
      officialFx: summarizeSourceRegistryKeys(OFFICIAL_FX_REQUIRED_SOURCE_KEYS, sourceRegistryRows),
      officialVat: summarizeSourceRegistryKeys(
        OFFICIAL_VAT_REQUIRED_SOURCE_KEYS,
        sourceRegistryRows
      ),
      officialDeMinimis: summarizeSourceRegistryKeys(
        OFFICIAL_DE_MINIMIS_REQUIRED_SOURCE_KEYS,
        sourceRegistryRows
      ),
      officialHs: summarizeSourceRegistryKeys(OFFICIAL_HS_REQUIRED_SOURCE_KEYS, sourceRegistryRows),
      officialNotices: summarizeSourceRegistryKeys(
        OFFICIAL_NOTICES_REQUIRED_SOURCE_KEYS,
        sourceRegistryRows
      ),
      officialSurcharges: summarizeSourceRegistryKeys(
        OFFICIAL_SURCHARGES_REQUIRED_SOURCE_KEYS,
        sourceRegistryRows
      ),
      fallback: summarizeSourceRegistryKeys(OPTIONAL_FALLBACK_SOURCE_KEYS, sourceRegistryRows),
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
      `[source-registry] preflight gate failed: ${failedChecks.map((check) => check.key).join(', ')}`
    );
  }
};
