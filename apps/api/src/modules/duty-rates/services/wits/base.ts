import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import type { DutyRateInsert } from '@clearcost/types';
import { DEBUG } from '../../utils/utils.js';
import { httpFetch } from '../../../../lib/http.js';

countries.registerLocale(en);

export const SDMX_BASE =
  'https://wits.worldbank.org/API/V1/SDMX/V21/rest/data/DF_WITS_Tariff_TRAINS';

// 6 consecutive digits anywhere in a token (fallback extractor)
const HS6_SUB = /\d{6}/;

/** Format to 3 decimals, never "-0.000" */
export function toNumeric3String(n: number): string {
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid duty %: ${n}`);
  const s = n.toFixed(3);
  return Number(s) === 0 ? '0.000' : s;
}

export function jan1(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

/**
 * Map ISO2 (e.g. "US") or special union/world code to WITS SDMX numeric token.
 * - EU aggregate → "918"
 * - World → "000"
 */
export function toNumericReporterOrUnion(a2OrUnion: string): { token: string; display: string } {
  const s = String(a2OrUnion || '').toUpperCase();
  if (!s) throw new Error('empty reporter/partner');

  // EU aggregate in WITS is UN M49: 918
  if (s === 'EU' || s === 'EUN' || s === 'EU27' || s === 'EU28' || s === 'EUU') {
    return { token: '918', display: 'EU' };
  }

  // World aggregate
  if (s === 'WLD' || s === 'WORLD' || s === '000' || s === 'ALL') {
    return { token: '000', display: 'WLD' };
  }

  const a3 = countries.alpha2ToAlpha3(s);
  if (!a3) throw new Error(`unknown ISO2: ${s}`);

  const numeric =
    countries.alpha3ToNumeric?.(a3) ?? (countries.getNumericCodes?.()[a3] as string | undefined);

  if (!numeric) throw new Error(`no numeric code for ${s}/${a3}`);
  return { token: numeric, display: s };
}

/** SDMX JSON (subset we use). */
type SdmxAttribute = { id: string; values: Array<{ id: string; name?: string }> };
export type SdmxJson = {
  dataSets: Array<{
    series?: Record<string, { observations: Record<string, number[]>; attributes?: number[] }>;
  }>;
  structure: {
    dimensions: {
      series: Array<{ id: string; values: Array<{ id: string; name?: string }> }>;
      observation: Array<{ id: string; values: Array<{ id: string; name?: string }> }>;
    };
    attributes?: {
      series?: SdmxAttribute[];
      observation?: SdmxAttribute[];
    };
  };
};

export function findSeriesDimIndex(struct: SdmxJson['structure'], candidates: string[]): number {
  const ser = struct.dimensions.series;
  const ids = ser.map((d) => d.id);
  // 1) exact (case-insensitive)
  for (const c of candidates) {
    const i = ser.findIndex((d) => d.id.toUpperCase() === c.toUpperCase());
    if (i >= 0) return i;
  }
  // 2) includes (case-insensitive)
  for (const c of candidates) {
    const i = ser.findIndex((d) => d.id.toUpperCase().includes(c.toUpperCase()));
    if (i >= 0) return i;
  }
  throw new Error(
    `SDMX: missing series dim among [${candidates.join(', ')}]; have [${ids.join(', ')}]`
  );
}

/** Build & fetch SDMX for (reporter, partner) within a year range (NUMERIC tokens). */
export async function fetchSdmx(
  reporterToken: string,
  partnerToken: string,
  startYear: number,
  endYear: number
): Promise<SdmxJson | null> {
  const qs = `startperiod=${startYear}&endperiod=${endYear}&detail=DataOnly`;

  const variants = [
    // reported first (MFN, or PRF if it exists)
    `${SDMX_BASE}/.${reporterToken}.${partnerToken}..reported/?${qs}`,
    // fallback: aveestimated (often needed for bilateral PRF)
    `${SDMX_BASE}/.${reporterToken}.${partnerToken}..aveestimated/?${qs}`,
  ];

  for (const url of variants) {
    if (DEBUG) console.log('[wits] GET', url);
    const r = await httpFetch(url, {
      headers: {
        'user-agent': 'clearcost-importer',
        accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd',
      },
    });
    if (!r.ok) {
      if (DEBUG) console.log(' [wits] HTTP', r.status, r.statusText);
      continue; // try next variant
    }
    try {
      const json = (await r.json()) as SdmxJson;
      const seriesCount = json?.dataSets?.[0]?.series
        ? Object.keys(json.dataSets[0].series).length
        : 0;
      if (DEBUG) console.log(' [wits] OK -> series count:', seriesCount);
      if (seriesCount === 0) continue; // empty → try next
      return json;
    } catch (e) {
      if (DEBUG) console.log(' [wits] JSON parse error:', (e as Error).message);
    }
  }
  return null;
}

/** small helpers */
const hs6FromRawValue = (raw: { id?: string; name?: string } | null): string | null => {
  if (!raw) return null;
  if (raw.id && /^\d{6}$/.test(raw.id)) return raw.id;
  if (raw.id && /^\d{8,}$/.test(raw.id)) return raw.id.slice(0, 6);
  const m = `${raw.id ?? ''} ${raw.name ?? ''}`.match(HS6_SUB);
  return m ? m[0] : null;
};
const hs6FromToken = (tok?: string): string | null => {
  if (!tok) return null;
  if (/^\d{6}$/.test(tok)) return tok;
  if (/^\d{8,}$/.test(tok)) return tok.slice(0, 6);
  const m = tok.match(HS6_SUB);
  return m ? m[0] : null;
};

/**
 * Flatten a WITS SDMX series into DutyRateInsert rows.
 * - MFN vs PRF: decided by caller via partner (000 vs real partner). We also peek at TARIFFTYPE
 *   series attribute if present, but many extracts omit it — we won't drop rows just because it's missing.
 * - HS6 extraction: **auto-map series key position to the PRODUCT dimension** by probing.
 */
export function flattenWitsSeries(
  json: SdmxJson,
  reporterA2: string,
  year: number,
  dutyTypeWanted: 'mfn' | 'prf' | 'ahs' | 'bnd',
  partnerIso2OrUnion: string | null
): DutyRateInsert[] {
  const dataSet = json.dataSets?.[0];
  if (!dataSet || !dataSet.series) return [];

  const serDims = json.structure.dimensions.series;
  const dimCount = serDims.length;

  // ---- Attribute wiring (series) ----
  const seriesAttrs = json.structure.attributes?.series ?? [];
  const tariffTypeAttrIdx = seriesAttrs.findIndex((a) => a.id.toUpperCase().includes('TARIFFTYPE'));

  const getSeriesValueRaw = (
    dimIndex: number,
    valueIndex: number
  ): { id?: string; name?: string } | null => {
    const dim = serDims[dimIndex];
    const vals = dim?.values;
    if (!vals || valueIndex < 0 || valueIndex >= vals.length) return null;
    return vals[valueIndex] ?? null;
  };

  const readSeriesAttrId = (attrs: number[] | undefined, attrIdx: number): string | null => {
    if (!attrs || attrIdx < 0) return null;
    const valIndex = attrs[attrIdx];
    if (valIndex == null || valIndex < 0) return null;
    const attr = seriesAttrs[attrIdx];
    const val = attr?.values?.[valIndex];
    return (val?.id ?? val?.name ?? null) as string | null;
  };

  const getObsYear = (timePos: number): number | null => {
    const timeDim = json.structure.dimensions.observation?.[0];
    const vals = timeDim?.values;
    if (!vals || timePos < 0 || timePos >= vals.length) return null;
    const y = Number(vals[timePos]?.id);
    return Number.isFinite(y) ? y : null;
  };

  // Debug: show a few raw series keys and the declared dimension ids
  if (process.env.WITS_LOG === '1') {
    const keys = Object.keys(dataSet.series).slice(0, 5);
    console.log('[wits] seriesKey samples:', keys);
    console.log(
      '[wits] series dim ids:',
      serDims.map((d) => d.id)
    );
  }

  // --------------------------------------------------------------------
  // PREPASS: discover which series-key *position* (p) maps to which *dimension index* (j)
  // for PRODUCT by maximizing unique HS6 counts.
  // --------------------------------------------------------------------
  type SeriesEntry = [string, { observations: Record<string, number[]>; attributes?: number[] }];
  const entries = Object.entries(dataSet.series) as SeriesEntry[];
  const SAMPLE = entries.length;

  type Score = { unique: Set<string>; valid: number };
  const byPosLiteral: Score[] = Array.from({ length: dimCount }, () => ({
    unique: new Set<string>(),
    valid: 0,
  }));
  const byPosDim: (Score[] | undefined)[] = Array.from({ length: dimCount }, () =>
    Array.from({ length: dimCount }, () => ({ unique: new Set<string>(), valid: 0 }))
  );

  for (let k = 0; k < SAMPLE; k++) {
    const entry = entries[k];
    if (!entry) continue;
    const [seriesKey] = entry;
    const toks = seriesKey.split(':');
    const limit = Math.min(dimCount, toks.length);

    for (let p = 0; p < limit; p++) {
      const tok = toks[p];

      // literal: token as HS code
      const hLit = hs6FromToken(tok);
      if (hLit) {
        const slot = byPosLiteral[p];
        if (slot) {
          slot.valid++;
          slot.unique.add(hLit);
        }
      }

      // index → try each dimension's value list
      if (tok != null && /^\d+$/.test(tok)) {
        const idx = Number(tok);
        const row = byPosDim[p];
        if (!row) continue;
        for (let j = 0; j < dimCount; j++) {
          const cell = row[j];
          if (!cell) continue;
          const raw = getSeriesValueRaw(j, idx);
          const h = hs6FromRawValue(raw);
          if (h) {
            cell.valid++;
            cell.unique.add(h);
          }
        }
      }
    }
  }

  // choose best (p*, j*)
  let bestP = 0;
  let bestJ = 0;
  let bestScore = -1;

  const prefersProduct = (id: string) => /PROD|HS/i.test(id);

  for (let p = 0; p < dimCount; p++) {
    const row = byPosDim[p];
    if (!row) continue;
    for (let j = 0; j < dimCount; j++) {
      const cell = row[j];
      const score = cell ? cell.unique.size : 0;
      const id = serDims[j]?.id ?? '';
      const bias = prefersProduct(id) ? 0.5 : 0; // mild bias toward product-ish names
      const total = score + bias;
      if (total > bestScore) {
        bestScore = total;
        bestP = p;
        bestJ = j;
      }
    }
  }

  // fall back to literal if mapping didn’t produce anything
  let literalOnly = false;
  if (bestScore <= 0) {
    let bestL = 0;
    let bestLScore = -1;
    for (let p = 0; p < dimCount; p++) {
      const slot = byPosLiteral[p];
      const sc = slot ? slot.unique.size : 0;
      if (sc > bestLScore) {
        bestLScore = sc;
        bestL = p;
      }
    }
    bestP = bestL;
    bestJ = -1;
    literalOnly = true;
  }

  if (DEBUG) {
    const posSummary = Array.from({ length: dimCount }, (_, p) => {
      const slot = byPosLiteral[p];
      const literalU = slot ? slot.unique.size : 0;
      const row = byPosDim[p] ?? [];
      const dimU = row.map((s, j) => `${serDims[j]?.id}:${s ? s.unique.size : 0}`).join(', ');
      return `p${p}{lit=${literalU}; dim=[${dimU}]}`;
    }).join(' | ');
    console.log('[wits] autodetect scores:', posSummary);
    console.log(
      '[wits] product mapping -> pos=',
      bestP,
      'dimIdx=',
      bestJ,
      'dimId=',
      bestJ >= 0 ? serDims[bestJ]?.id : '(literal)',
      'mode=',
      literalOnly ? 'literal' : 'index->dim'
    );
  }

  // --------------------------
  // MAIN: build output rows
  // --------------------------
  const out: DutyRateInsert[] = [];
  const ruleValue: DutyRateInsert['dutyRule'] = dutyTypeWanted === 'prf' ? 'fta' : 'mfn';

  let kept = 0,
    dropNoHS6 = 0,
    dropBadVal = 0,
    dropTariffType = 0;

  for (const [seriesKey, seriesData] of entries) {
    const toks = seriesKey.split(':');
    const prodTok = toks[bestP];
    if (prodTok == null) {
      dropNoHS6++;
      continue;
    }

    // Resolve HS6 via detected mapping
    let hs6: string | null = null;
    if (literalOnly) {
      hs6 = hs6FromToken(prodTok);
    } else {
      if (/^\d+$/.test(prodTok)) {
        hs6 = hs6FromRawValue(getSeriesValueRaw(bestJ, Number(prodTok)));
      } else {
        // defensive: literal fallback
        hs6 = hs6FromToken(prodTok);
      }
    }
    if (!hs6) {
      dropNoHS6++;
      continue;
    }

    // TARIFFTYPE (MFN vs PREF) from series attributes if present (polite filter)
    const tt = readSeriesAttrId(seriesData.attributes, tariffTypeAttrIdx)?.toUpperCase() ?? null;
    if (tt) {
      const want = dutyTypeWanted === 'prf' ? 'PREF' : 'MFN';
      if (tt !== want) {
        dropTariffType++;
        continue;
      }
    }

    // single-year window → read the only observation for that year
    for (const [obsKey, values] of Object.entries(seriesData.observations)) {
      const obsYear = getObsYear(parseInt(obsKey, 10));
      if (obsYear !== year) continue;

      const val = Number(values?.[0]); // OBS_VALUE
      if (!Number.isFinite(val) || val < 0) {
        dropBadVal++;
        continue;
      }

      out.push({
        dest: reporterA2,
        partner: dutyTypeWanted === 'mfn' ? '' : (partnerIso2OrUnion ?? ''),
        hs6,
        ratePct: toNumeric3String(val),
        dutyRule: ruleValue,
        currency: 'USD',
        effectiveFrom: jan1(year),
        effectiveTo: null,
        notes:
          dutyTypeWanted === 'prf'
            ? 'importSource: WITS/UNCTAD TRAINS (Preferential)'
            : 'importSource: WITS/UNCTAD TRAINS (MFN)',
      });
      kept++;
    }
  }

  if (DEBUG) {
    const uniqHs6 = new Set(out.map((r) => r.hs6)).size;
    console.log(
      `[wits] flatten summary kept=${kept} hs6Unique=${uniqHs6} drop(noHS6)=${dropNoHS6} drop(badVal)=${dropBadVal} drop(tariffType)=${dropTariffType}`
    );
  }

  return out;
}
