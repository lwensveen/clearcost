import type { DutyRateInsert } from '@clearcost/types';
import {
  ERGA_OMNES_ID,
  getLatestVersionId,
  hasCompoundComponent,
  MEASURE_TYPE_PREF_ENDUSE,
  MEASURE_TYPE_PREF_STD,
  parseAdValoremPercent,
  pickStartEnd,
  s3Select,
  TABLE_ID,
  toNumeric3String,
  UkRowSchema,
} from './base.js';
import {
  cell,
  fetchTableCsvStream,
  headerIndex,
  iterateCsvRecords,
} from '../../utils/stream-csv.js';

type FetchPrefOpts = { hs6List?: string[]; partners?: string[] };

/** Sparse row shape we stream (values may be missing/undefined). */
type UkRawRow = Record<string, string | undefined>;

/**
 * Resolve a UK geographical area to a partner code we store:
 *  - ISO2 (e.g., "JP") → "JP"
 *  - numeric EU group (1013) → "EU"
 *  - description contains “European Union”/“EU” → "EU"
 *  - otherwise null (keep non-single-country groupings out of `partner`)
 */
function resolvePartnerIso2OrUnion(geoId?: string, geoDesc?: string): string | null {
  const id = (geoId ?? '').trim();
  if (/^[A-Z]{2}$/i.test(id)) return id.toUpperCase();
  if (id === '1013') return 'EU';

  const desc = (geoDesc ?? '').toLowerCase();
  if (/\beuropean union\b|\b^eu\b/.test(desc)) return 'EU';

  return null;
}

/** Partner filter: accepts numeric geo id, ISO2, or name fragment. */
function matchesPartner(
  rec: { geographical_area__id?: string; geographical_area__description?: string },
  partners: string[]
) {
  if (!partners?.length) return true;
  const id = (rec.geographical_area__id ?? '').trim();
  const desc = (rec.geographical_area__description ?? '').toLowerCase();

  for (const p of partners) {
    const s = p.trim();
    if (!s) continue;
    if (/^\d+$/.test(s)) {
      if (id === s) return true; // numeric geo id (e.g., "1013")
    } else if (/^[A-Z]{2}$/i.test(s)) {
      if (id.toUpperCase() === s.toUpperCase()) return true; // exact ISO2
    } else if (desc.includes(s.toLowerCase())) {
      return true; // fuzzy description match
    }
  }
  return false;
}

/** Try S3-Select for preferential rows (types 142/145, not 1011, with a '%' in duty_rate). */
async function s3SelectPref(versionId: string): Promise<UkRawRow[] | null> {
  const query = `
    SELECT m.commodity__code, m.measure__type__id, m.geographical_area__id,
           m.geographical_area__description, m.duty_rate,
           m.validity_start_date, m.validity_end_date,
           m.measure__generating_regulation__validity_start_date,
           m.measure__generating_regulation__validity_end_date
    FROM S3Object[*].['${TABLE_ID}'][*] m
    WHERE (m.measure__type__id = '${MEASURE_TYPE_PREF_STD}' OR m.measure__type__id = '${MEASURE_TYPE_PREF_ENDUSE}')
      AND m.geographical_area__id <> '${ERGA_OMNES_ID}'
      AND m.duty_rate LIKE '%%%' -- ad-valorem only
  `.trim();
  const rows = await s3Select(versionId, query);
  return rows as UkRawRow[] | null; // DBT returns a plain array; values may be undefined
}

/** Fallback: stream CSV and filter preferential rows on the fly. */
async function* csvStreamPref(versionId: string): AsyncGenerator<UkRawRow> {
  const stream = await fetchTableCsvStream(versionId);

  // Resolve header indices once
  let isHeader = true;
  let idxCode = -1,
    idxType = -1,
    idxGeoId = -1,
    idxGeoDesc = -1,
    idxDuty = -1,
    idxStart1 = -1,
    idxEnd1 = -1,
    idxStart2 = -1,
    idxEnd2 = -1;

  for await (const record of iterateCsvRecords(stream)) {
    if (isHeader) {
      const { idx } = headerIndex(record);
      idxCode = idx('commodity__code');
      idxType = idx('measure__type__id');
      idxGeoId = idx('geographical_area__id');
      idxGeoDesc = idx('geographical_area__description');
      idxDuty = idx('duty_rate');
      idxStart1 = idx('validity_start_date');
      idxEnd1 = idx('validity_end_date');
      idxStart2 = idx('measure__generating_regulation__validity_start_date');
      idxEnd2 = idx('measure__generating_regulation__validity_end_date');
      isHeader = false;
      continue;
    }

    const measureTypeId = cell(record, idxType);
    const geoId = cell(record, idxGeoId);
    const duty = cell(record, idxDuty);

    const isPref =
      measureTypeId === MEASURE_TYPE_PREF_STD || measureTypeId === MEASURE_TYPE_PREF_ENDUSE;
    if (!isPref) continue;
    if (geoId === ERGA_OMNES_ID) continue;
    if (!/%/.test(duty ?? '')) continue; // keep ad-valorem only

    // Yield a sparse object with optional strings; UkRowSchema has optional fields
    yield {
      commodity__code: cell(record, idxCode),
      measure__type__id: measureTypeId,
      geographical_area__id: geoId,
      geographical_area__description: cell(record, idxGeoDesc),
      duty_rate: duty,
      validity_start_date: cell(record, idxStart1) || undefined,
      validity_end_date: cell(record, idxEnd1) || undefined,
      measure__generating_regulation__validity_start_date: cell(record, idxStart2) || undefined,
      measure__generating_regulation__validity_end_date: cell(record, idxEnd2) || undefined,
    };
  }
}

/** PUBLIC: streaming generator → yields DutyRateInsert for GB preferential lines. */
export async function* streamUkPreferentialDutyRates(
  opts: FetchPrefOpts = {}
): AsyncGenerator<DutyRateInsert> {
  const versionId = await getLatestVersionId();
  const hs6Allow = new Set((opts.hs6List ?? []).map((s) => String(s).slice(0, 6)));

  // Prefer S3-Select; if unavailable, stream CSV.
  const s3Rows = await s3SelectPref(versionId);
  const source: AsyncGenerator<UkRawRow> = s3Rows
    ? (async function* () {
        for (const row of s3Rows) yield row;
      })()
    : csvStreamPref(versionId);

  for await (const raw of source) {
    if (opts.partners && !matchesPartner(raw, opts.partners)) continue;

    // Validate/normalize with zod
    const parsed = UkRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const row = parsed.data;

    // HS10 → HS6 allowlist
    const hs10 = row.commodity__code;
    const hs6 = hs10.slice(0, 6);
    if (hs6Allow.size && !hs6Allow.has(hs6)) continue;

    // % only
    const percent = parseAdValoremPercent(row.duty_rate);
    if (percent == null) continue;

    // Effective dates
    const { start, end } = pickStartEnd(row);
    if (!start) continue;

    // Partner normalization (optional)
    const partnerCode = resolvePartnerIso2OrUnion(
      row.geographical_area__id,
      row.geographical_area__description
    );

    // Notes (compound hint + human partner label)
    const compound = hasCompoundComponent(row.duty_rate);
    const partnerLabel =
      row.geographical_area__description ??
      (row.geographical_area__id ? `geo:${row.geographical_area__id}` : 'partner:unknown');

    yield {
      dest: 'GB',
      partner: partnerCode,
      hs6,
      ratePct: toNumeric3String(percent),
      rule: 'fta',
      effectiveFrom: start,
      effectiveTo: end ?? null,
      notes:
        `${partnerLabel} – UK preferential tariff (type ${row.measure__type__id})` +
        (compound ? '; contains specific/compound components, using % only.' : ''),
    };
  }
}
