import type { DutyRateInsert } from '@clearcost/types';
import {
  ERGA_OMNES_ID,
  hs6 as toHs6,
  parseComponents,
  parseDutyExpressions,
  parseGeoAreaDescriptions,
  parseMeasures,
  PREF_MEASURE_TYPE_IDS,
  toNumeric3String,
} from './base.js';

type FetchPreferentialOptions = {
  hs6List?: string[];
  /** Optional allowlist of TARIC geo IDs (e.g., 'JP', 'TR', '1013', 'SPGA'…). */
  partnerGeoIds?: string[];
  /** TARIC XML endpoints (can also be provided via env). */
  xmlMeasureUrl?: string;
  xmlComponentUrl?: string;
  xmlGeoDescUrl?: string;
  /** Optional: DUTY_EXPRESSION.xml(.gz) for exact ad-valorem expressions. */
  xmlDutyExprUrl?: string;
  /** Label language in geo/expr files; defaults to EN. */
  language?: string;
};

/** Narrowing helper to keep TS happy when using Date methods. */
function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(+value);
}

/**
 * Best-effort resolver: map a TARIC geographical area to a partner code we store.
 * - If `geoId` is ISO2 → use it uppercased.
 * - If it’s a known group (e.g., 1013 EU) → map to a synthetic partner code ('EU').
 * - Else try to infer from the human label for common cases; otherwise return null.
 */
function resolvePartnerFromGeo(geoId: string, geoName?: string): string | null {
  if (/^[A-Z]{2}$/i.test(geoId)) return geoId.toUpperCase();
  if (geoId === '1013') return 'EU'; // European Union group
  const label = (geoName ?? '').toLowerCase();
  if (/\beuropean union\b|\b^eu\b/.test(label)) return 'EU';
  return null;
}

/**
 * Fetch EU preferential (FTA) ad-valorem duty rates from TARIC.
 * - Filters to preferential measure types, excludes ERGA OMNES (MFN).
 * - Keeps only % ad-valorem lines (via component parsing; optionally exact via DUTY_EXPRESSION).
 * - Produces DutyRateInsert rows with optional `partner` (ISO2 or synthetic like 'EU').
 */
export async function fetchEuPreferentialDutyRates(
  options: FetchPreferentialOptions = {}
): Promise<DutyRateInsert[]> {
  // Normalize inputs / defaults
  const hs6Allowlist = new Set((options.hs6List ?? []).map(toHs6).filter(Boolean));
  const partnerGeoAllowlist = new Set((options.partnerGeoIds ?? []).filter(Boolean));

  const measureXmlUrl = options.xmlMeasureUrl ?? process.env.EU_TARIC_MEASURE_URL ?? '';
  const componentXmlUrl = options.xmlComponentUrl ?? process.env.EU_TARIC_COMPONENT_URL ?? '';
  const geoDescXmlUrl = options.xmlGeoDescUrl ?? process.env.EU_TARIC_GEO_DESC_URL ?? '';
  const dutyExprXmlUrl = options.xmlDutyExprUrl ?? process.env.EU_TARIC_DUTY_EXPR_URL ?? '';
  const uiLanguage = (options.language ?? process.env.EU_TARIC_LANGUAGE ?? 'EN').toUpperCase();

  if (!measureXmlUrl || !componentXmlUrl) return [];

  // Optional: map of geo area → human label (for notes)
  let geoDisplayNameById = new Map<string, string>();
  if (geoDescXmlUrl) {
    try {
      geoDisplayNameById = await parseGeoAreaDescriptions(geoDescXmlUrl, uiLanguage);
    } catch {
      /* non-fatal: fall back to raw ids in notes */
    }
  }

  // Optional: exact ad-valorem duty expression allowlist
  let adValoremExprIds: Set<string> | undefined;
  if (dutyExprXmlUrl) {
    try {
      adValoremExprIds = await parseDutyExpressions(dutyExprXmlUrl, uiLanguage);
    } catch {
      /* non-fatal: component-level heuristic remains in effect */
    }
  }

  // 1) Pull preferential measures (exclude ERGA OMNES; apply HS6 & partner filters)
  const measures = await parseMeasures(measureXmlUrl, (measure) => {
    if (!PREF_MEASURE_TYPE_IDS.has(measure.measureTypeId)) return false;
    if (measure.geoId === ERGA_OMNES_ID) return false; // not preferential
    if (partnerGeoAllowlist.size && !partnerGeoAllowlist.has(measure.geoId)) return false;

    const code6 = toHs6(measure.code10);
    return !hs6Allowlist.size || hs6Allowlist.has(code6);
  });
  if (measures.size === 0) return [];

  // 2) Parse components and retain only ad-valorem (%). If `adValoremExprIds` provided,
  //    the parser can use it to be exact; otherwise heuristics apply.
  const componentsByMeasureId = await parseComponents(
    componentXmlUrl,
    new Set(measures.keys()),
    adValoremExprIds
  );

  // 3) Build rows
  const candidateRows: DutyRateInsert[] = [];
  for (const [measureId, measureRow] of measures.entries()) {
    const component = componentsByMeasureId.get(measureId);
    if (!component || component.pct == null) continue; // not ad-valorem

    const startDate = measureRow.start ? new Date(`${measureRow.start}T00:00:00Z`) : undefined;
    if (!startDate) continue; // must have a start (versioning)
    const endDate = measureRow.end ? new Date(`${measureRow.end}T00:00:00Z`) : null;

    const geoLabel = geoDisplayNameById.get(measureRow.geoId);
    const partnerCode = resolvePartnerFromGeo(measureRow.geoId, geoLabel);
    const partnerLabelForNotes = geoLabel ?? `geo:${measureRow.geoId}`;

    candidateRows.push({
      dest: 'EU',
      partner: partnerCode ?? null,
      hs6: toHs6(measureRow.code10),
      ratePct: toNumeric3String(component.pct),
      dutyRule: 'fta',
      effectiveFrom: startDate,
      effectiveTo: endDate,
      notes:
        `${partnerLabelForNotes} – EU preferential (type ${measureRow.measureTypeId})` +
        (component.compound ? '; contains specific/compound components, using % only.' : ''),
    });
  }

  // 4) De-duplicate while preserving partner distinctions:
  //    keep highest rate for identical (dest, partner, hs6, effectiveFrom).
  const bestByKey = new Map<string, DutyRateInsert>();
  for (const row of candidateRows) {
    const from = row.effectiveFrom;
    if (!isValidDate(from)) continue; // defensive; satisfies TS

    const key = `${row.dest}:${row.partner ?? ''}:${row.hs6}:${from.toISOString()}`;
    const prev = bestByKey.get(key);
    if (!prev || Number(row.ratePct) > Number(prev.ratePct)) {
      bestByKey.set(key, row);
    }
  }

  return Array.from(bestByKey.values());
}
