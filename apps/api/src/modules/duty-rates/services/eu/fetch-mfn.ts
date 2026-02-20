import type { DutyRateInsert } from '@clearcost/types';
import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';
import {
  ERGA_OMNES_ID,
  hs6 as toHs6,
  MFN_MEASURE_TYPE_ID,
  parseComponents,
  parseDutyExpressions,
  parseMeasures,
  toNumeric3String,
} from './base.js';

type FetchOptions = {
  hs6List?: string[];
  xmlMeasureUrl?: string;
  xmlComponentUrl?: string;
  xmlDutyExprUrl?: string;
  language?: string;
};

function hasDate(v: unknown): v is Date {
  return v instanceof Date && !isNaN(+v);
}

async function resolveRequiredTaricUrl(
  override: string | undefined,
  sourceKey: string,
  fallbackEnv: string | undefined
): Promise<string> {
  if (override !== undefined) return override;
  return await resolveSourceDownloadUrl({
    sourceKey,
    fallbackUrl: fallbackEnv ?? '',
  });
}

async function resolveOptionalTaricUrl(
  override: string | undefined,
  sourceKey: string,
  fallbackEnv: string | undefined
): Promise<string> {
  if (override !== undefined) return override;
  try {
    return await resolveSourceDownloadUrl({
      sourceKey,
      fallbackUrl: fallbackEnv ?? '',
    });
  } catch {
    return '';
  }
}

export async function fetchEuMfnDutyRates(options: FetchOptions = {}): Promise<DutyRateInsert[]> {
  const hs6Allowlist = new Set((options.hs6List ?? []).map(toHs6).filter(Boolean));
  const [measureXmlUrl, componentXmlUrl, dutyExprXmlUrl] = await Promise.all([
    resolveRequiredTaricUrl(
      options.xmlMeasureUrl,
      'duties.eu.taric.measure',
      process.env.EU_TARIC_MEASURE_URL
    ),
    resolveRequiredTaricUrl(
      options.xmlComponentUrl,
      'duties.eu.taric.component',
      process.env.EU_TARIC_COMPONENT_URL
    ),
    resolveOptionalTaricUrl(
      options.xmlDutyExprUrl,
      'duties.eu.taric.duty_expression',
      process.env.EU_TARIC_DUTY_EXPR_URL
    ),
  ]);
  const dutyExprLang = (options.language ?? process.env.EU_TARIC_LANGUAGE ?? 'EN').toUpperCase();

  if (!measureXmlUrl || !componentXmlUrl) {
    throw new Error(
      '[EU Duties] TARIC MFN requires EU_TARIC_MEASURE_URL and EU_TARIC_COMPONENT_URL (or xmlMeasureUrl/xmlComponentUrl overrides).'
    );
  }

  let adValoremExprIds: Set<string> | undefined;
  if (dutyExprXmlUrl) {
    try {
      adValoremExprIds = await parseDutyExpressions(dutyExprXmlUrl, dutyExprLang);
    } catch {
      /* non-fatal */
    }
  }

  const filteredMeasures = await parseMeasures(
    measureXmlUrl,
    (measure) =>
      measure.measureTypeId === MFN_MEASURE_TYPE_ID &&
      measure.geoId === ERGA_OMNES_ID &&
      (!hs6Allowlist.size || hs6Allowlist.has(toHs6(measure.code10)))
  );

  if (filteredMeasures.size === 0) return [];

  const componentsByMeasureId = await parseComponents(
    componentXmlUrl,
    new Set(filteredMeasures.keys()),
    adValoremExprIds
  );

  const euRows: DutyRateInsert[] = [];
  for (const [measureId, measure] of filteredMeasures.entries()) {
    const comp = componentsByMeasureId.get(measureId);
    if (!comp || comp.pct == null) continue;

    const startDate = measure.start ? new Date(`${measure.start}T00:00:00Z`) : undefined;
    if (!startDate) continue;
    const endDate = measure.end ? new Date(`${measure.end}T00:00:00Z`) : null;

    euRows.push({
      dest: 'EU',
      partner: '',
      hs6: toHs6(measure.code10),
      ratePct: toNumeric3String(comp.pct),
      dutyRule: 'mfn',
      effectiveFrom: startDate,
      effectiveTo: endDate,
      notes: comp.compound
        ? 'EU MFN: contains specific/compound components; using ad-valorem only.'
        : 'EU MFN ad-valorem (TARIC).',
    });
  }

  // TS-safe de-dup: re-narrow effectiveFrom before using it in the key
  const dedup = new Map<string, DutyRateInsert>();
  for (const row of euRows) {
    const from = row.effectiveFrom;
    if (!hasDate(from)) continue;

    const key = `${row.dest}:${row.hs6}:${from.toISOString()}`;
    const prev = dedup.get(key);
    if (!prev || Number(row.ratePct) > Number(prev.ratePct)) {
      dedup.set(key, row);
    }
  }
  return Array.from(dedup.values());
}
