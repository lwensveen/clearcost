import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import type { DutyRateInsert } from '@clearcost/types';

countries.registerLocale(en);

export const SDMX_BASE =
  'https://wits.worldbank.org/API/V1/SDMX/V21/rest/data/DF_WITS_Tariff_TRAINS';

const ISO3 = /^[A-Z]{3}$/;
const HS6 = /^\d{6}$/;

export function toNumeric3String(n: number): string {
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid duty %: ${n}`);
  const s = n.toFixed(3);
  return Number(s) === 0 ? '0.000' : s;
}

export function toAlpha3Lower(a2: string): string {
  const a3 = countries.alpha2ToAlpha3(a2.toUpperCase());
  if (!a3 || !ISO3.test(a3)) throw new Error(`unknown ISO2 country: ${a2}`);
  return a3.toLowerCase(); // SDMX path wants lower-case 3-letter
}

export function jan1(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

/** Map ISO2 or special union code to WITS reporter token and display label. */
export function toWitsReporter(dest: string): { reporter: string; displayDest: string } {
  const up = String(dest || '').toUpperCase();
  // WITS uses "eun" for EU aggregate reporter
  if (up === 'EU' || up === 'EUN' || up === 'EUU' || up === 'EU27' || up === 'EU28') {
    return { reporter: 'eun', displayDest: 'EU' };
  }
  return { reporter: toAlpha3Lower(up), displayDest: up };
}

/** SDMX JSON (subset we need). */
export type SdmxJson = {
  dataSets: Array<{
    series: Record<
      string,
      {
        observations: Record<string, number[]>;
        attributes?: number[];
      }
    >;
  }>;
  structure: {
    dimensions: {
      series: Array<{ id: string; values: Array<{ id: string; name?: string }> }>;
      observation: Array<{ id: string; values: Array<{ id: string; name?: string }> }>;
    };
  };
};

/** Find a series-dimension index by id contains any candidate token (case-insensitive). */
export function findSeriesDimIndex(struct: SdmxJson['structure'], candidates: string[]): number {
  const ser = struct.dimensions.series;
  const idx = ser.findIndex((d) =>
    candidates.some((c) => d.id.toUpperCase().includes(c.toUpperCase()))
  );
  if (idx < 0) {
    throw new Error(`SDMX: missing series dim among [${candidates.join(', ')}]`);
  }
  return idx;
}

/** Fetch SDMX JSON for (reporter, partner) and a year range. */
export async function fetchSdmx(
  reporterToken: string,
  partnerToken: string,
  startYear: number,
  endYear: number
): Promise<SdmxJson | null> {
  const path = `A.${reporterToken}.${partnerToken}.ALL.reported`;
  const url = `${SDMX_BASE}/${path}?startPeriod=${startYear}&endPeriod=${endYear}&detail=DataOnly&format=JSON`;
  const r = await fetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!r.ok) return null;
  return (await r.json()) as SdmxJson;
}

/**
 * Flatten a WITS SDMX series into DutyRateInsert rows.
 * - Only DATATYPE=reported (ad-valorem)
 * - Only requested DUTYTYPE (mfn/prf/ahs/bnd)
 * - Partner is null for MFN; for PRF pass the partner ISO2/union (e.g., "EU")
 */
export function flattenWitsSeries(
  json: SdmxJson,
  reporterA2: string,
  year: number,
  dutyTypeWanted: 'mfn' | 'prf' | 'ahs' | 'bnd',
  partnerIso2OrUnion: string | null
): DutyRateInsert[] {
  const dataSet = json.dataSets?.[0];
  if (!dataSet) return [];

  const productDim = findSeriesDimIndex(json.structure, ['PRODUCT', 'PRODUCTCODE']);
  const datatypeDim = findSeriesDimIndex(json.structure, ['DATATYPE', 'TYPE']);
  const dutytypeDim = findSeriesDimIndex(json.structure, ['DUTYTYPE', 'TARIFFTYPE', 'DUTY']);

  const getSeriesValueId = (dimIndex: number, valueIndex: number): string | null => {
    const dim = json.structure.dimensions.series[dimIndex];
    const vals = dim?.values;
    if (!vals || !Number.isInteger(valueIndex) || valueIndex < 0 || valueIndex >= vals.length)
      return null;
    const id = vals[valueIndex]?.id;
    return typeof id === 'string' && id ? id : null;
  };

  const getObsYear = (timePos: number): number | null => {
    const timeDim = json.structure.dimensions.observation?.[0];
    const vals = timeDim?.values;
    if (!vals || !Number.isInteger(timePos) || timePos < 0 || timePos >= vals.length) return null;
    const y = Number(vals[timePos]?.id);
    return Number.isFinite(y) ? y : null;
  };

  const coordAt = (coord: number[], dim: number): number =>
    Number.isInteger(dim) && dim >= 0 ? (coord[dim] ?? -1) : -1;

  const out: DutyRateInsert[] = [];
  const ruleValue: DutyRateInsert['rule'] = dutyTypeWanted === 'prf' ? 'fta' : 'mfn';

  for (const [seriesKey, seriesData] of Object.entries(dataSet.series)) {
    const coord = seriesKey.split(':').map((t) => parseInt(t, 10));

    const productId = getSeriesValueId(productDim, coordAt(coord, productDim));
    const datatypeId = getSeriesValueId(datatypeDim, coordAt(coord, datatypeDim))?.toLowerCase();
    const dutytypeId = getSeriesValueId(dutytypeDim, coordAt(coord, dutytypeDim))?.toLowerCase();

    if (!productId || !HS6.test(productId)) continue;
    if (datatypeId !== 'reported') continue;
    if (dutytypeId !== dutyTypeWanted) continue;

    for (const [obsKey, values] of Object.entries(seriesData.observations)) {
      const obsYear = getObsYear(parseInt(obsKey, 10));
      if (obsYear !== year) continue;

      const val = Number(values?.[0]); // OBS_VALUE
      if (!Number.isFinite(val) || val < 0) continue;

      out.push({
        dest: reporterA2,
        partner: partnerIso2OrUnion ?? null,
        hs6: productId,
        ratePct: toNumeric3String(val),
        rule: ruleValue,
        currency: 'USD',
        effectiveFrom: jan1(year),
        effectiveTo: null,
        notes:
          dutyTypeWanted === 'prf'
            ? 'source: WITS/UNCTAD TRAINS (Preferential-PRF, SimpleAverage, reported)'
            : 'source: WITS/UNCTAD TRAINS (SimpleAverage, reported)',
      });
    }
  }

  return out;
}
