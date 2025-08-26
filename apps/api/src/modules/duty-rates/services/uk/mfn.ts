import type { DutyRateInsert } from '@clearcost/types';
import {
  ERGA_OMNES_ID,
  getLatestVersionId,
  hasCompoundComponent,
  MEASURE_TYPE_MFN,
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

type FetchOpts = { hs6List?: string[] };

/** Row shape we yield from CSV/S3: headers → string values (some optional). */
type UkRawRow = Record<string, string | undefined>;

/** S3-Select JSON slice for MFN rows (type 103, ERGA OMNES 1011). */
async function s3SelectMfn(versionId: string): Promise<UkRawRow[] | null> {
  const query = `
    SELECT m.commodity__code, m.measure__type__id, m.geographical_area__id,
           m.geographical_area__description, m.duty_rate,
           m.validity_start_date, m.validity_end_date,
           m.measure__generating_regulation__validity_start_date,
           m.measure__generating_regulation__validity_end_date
    FROM S3Object[*].['${TABLE_ID}'][*] m
    WHERE m.measure__type__id = '${MEASURE_TYPE_MFN}'
      AND m.geographical_area__id = '${ERGA_OMNES_ID}'
  `.trim();
  // s3Select returns a plain array of objects; values may be missing → `undefined`
  const rows = await s3Select(versionId, query);
  return rows as UkRawRow[] | null;
}

/** Fallback: stream CSV and filter MFN rows on the fly. */
async function* csvStreamMfn(versionId: string): AsyncGenerator<UkRawRow> {
  const stream = await fetchTableCsvStream(versionId);

  // Resolve column indices from header row once
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

    // Keep only MFN + ERGA OMNES
    if (measureTypeId !== MEASURE_TYPE_MFN || geoId !== ERGA_OMNES_ID) continue;

    // Yield a sparse object with optional strings; aligns with UkRowSchema (optional fields)
    yield {
      commodity__code: cell(record, idxCode),
      measure__type__id: measureTypeId,
      geographical_area__id: geoId,
      geographical_area__description: cell(record, idxGeoDesc),
      duty_rate: cell(record, idxDuty),
      validity_start_date: cell(record, idxStart1) || undefined,
      validity_end_date: cell(record, idxEnd1) || undefined,
      measure__generating_regulation__validity_start_date: cell(record, idxStart2) || undefined,
      measure__generating_regulation__validity_end_date: cell(record, idxEnd2) || undefined,
    };
  }
}

/** PUBLIC: streaming generator → yields DutyRateInsert for GB MFN (partner = null). */
export async function* streamUkMfnDutyRates(opts: FetchOpts = {}): AsyncGenerator<DutyRateInsert> {
  const versionId = await getLatestVersionId();
  const hs6Allow = new Set((opts.hs6List ?? []).map((s) => String(s).slice(0, 6)));

  // Prefer S3-Select; if unavailable, stream CSV.
  const s3Rows = await s3SelectMfn(versionId);

  // Unify both branches as an AsyncGenerator<UkRawRow>
  const source: AsyncGenerator<UkRawRow> = s3Rows
    ? (async function* () {
        for (const row of s3Rows) yield row;
      })()
    : csvStreamMfn(versionId);

  for await (const raw of source) {
    // Validate/normalize with zod
    const parsed = UkRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const row = parsed.data;

    // HS10 → HS6
    const hs10 = row.commodity__code;
    const hs6 = hs10.slice(0, 6);
    if (hs6Allow.size && !hs6Allow.has(hs6)) continue;

    // Keep only ad-valorem (%)
    const percent = parseAdValoremPercent(row.duty_rate);
    if (percent == null) continue;

    // Effective dates
    const { start, end } = pickStartEnd(row);
    if (!start) continue;

    const compound = hasCompoundComponent(row.duty_rate);
    const notes = compound
      ? 'UK MFN duty contains additional specific/compound components; using ad-valorem only.'
      : 'UK MFN ad-valorem (ERGA OMNES).';

    yield {
      dest: 'GB',
      partner: null,
      hs6,
      ratePct: toNumeric3String(percent),
      rule: 'mfn',
      effectiveFrom: start,
      effectiveTo: end ?? null,
      notes,
    };
  }
}
