import type { DutyRateInsert } from '@clearcost/types';
import {
  ERGA_OMNES_ID,
  hs6 as toHs6,
  MFN_MEASURE_TYPE_ID,
  parseComponents,
  parseDutyExpressions,
  parseMeasures,
  toNumeric3String,
} from './base.js';
import { fetchWitsMfnDutyRates } from '../wits/mfn.js';

type FetchOptions = {
  hs6List?: string[];
  xmlMeasureUrl?: string;
  xmlComponentUrl?: string;
  xmlDutyExprUrl?: string;
  language?: string;
};

function jan1OfLastUtcYear(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
}
function coerceEffectiveFrom(value: Date | null | undefined, fallback: Date): Date {
  return value instanceof Date ? value : fallback;
}
function hasDate(v: unknown): v is Date {
  return v instanceof Date && !isNaN(+v);
}

export async function fetchEuMfnDutyRates(options: FetchOptions = {}): Promise<DutyRateInsert[]> {
  const hs6Allowlist = new Set((options.hs6List ?? []).map(toHs6).filter(Boolean));
  const measureXmlUrl = options.xmlMeasureUrl ?? process.env.EU_TARIC_MEASURE_URL ?? '';
  const componentXmlUrl = options.xmlComponentUrl ?? process.env.EU_TARIC_COMPONENT_URL ?? '';
  const dutyExprXmlUrl = options.xmlDutyExprUrl ?? process.env.EU_TARIC_DUTY_EXPR_URL ?? '';
  const dutyExprLang = (options.language ?? process.env.EU_TARIC_LANGUAGE ?? 'EN').toUpperCase();

  if (measureXmlUrl && componentXmlUrl) {
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

    if (filteredMeasures.size > 0) {
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
          partner: null,
          hs6: toHs6(measure.code10),
          ratePct: toNumeric3String(comp.pct),
          rule: 'mfn',
          effectiveFrom: startDate,
          effectiveTo: endDate,
          notes: comp.compound
            ? 'EU MFN: contains specific/compound components; using ad-valorem only.'
            : 'EU MFN ad-valorem (TARIC).',
        });
      }

      // ✅ TS-safe de-dup: re-narrow effectiveFrom before using it in the key
      const dedup = new Map<string, DutyRateInsert>();
      for (const row of euRows) {
        const from = row.effectiveFrom;
        if (!hasDate(from)) continue; // should never happen given our guard, but keeps TS happy

        const key = `${row.dest}:${row.hs6}:${from.toISOString()}`;
        const prev = dedup.get(key);
        if (!prev || Number(row.ratePct) > Number(prev.ratePct)) {
          dedup.set(key, row);
        }
      }
      return Array.from(dedup.values());
    }
  }

  // Fallback: WITS EUN → normalize to dest='EU'
  const witsRows = await fetchWitsMfnDutyRates({
    dest: 'EUN',
    hs6List: Array.from(hs6Allowlist),
  });

  const fallbackDefaultDate = jan1OfLastUtcYear();

  return witsRows.map((witsRow) => {
    const normalizedHs6 = toHs6(witsRow.hs6);
    const effectiveFrom = coerceEffectiveFrom(witsRow.effectiveFrom, fallbackDefaultDate);

    return {
      dest: 'EU',
      partner: null,
      hs6: normalizedHs6,
      ratePct: toNumeric3String(Number(witsRow.ratePct)),
      rule: 'mfn',
      effectiveFrom,
      effectiveTo: witsRow.effectiveTo ?? null,
      notes: witsRow.notes ?? 'EU MFN ad-valorem (WITS fallback)',
    } as DutyRateInsert;
  });
}
