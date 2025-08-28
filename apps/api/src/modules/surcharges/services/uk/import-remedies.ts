import type { SurchargeInsert } from '@clearcost/types';
import {
  ERGA_OMNES_ID,
  getLatestVersionId,
  hasCompoundComponent,
  parseAdValoremPercent,
  pickStartEnd,
  s3Select,
  TABLE_ID,
  UkRowSchema,
} from '../../../duty-rates/services/uk/base.js';
import {
  cell,
  fetchTableCsvStream,
  headerIndex,
  iterateCsvRecords,
} from '../../../duty-rates/utils/stream-csv.js';
import { batchUpsertSurchargesFromStream } from '../../utils/batch-upsert.js'; // ✅ provenance helper

function resolveOriginIso2OrUnion(geoId?: string, geoDesc?: string): string | null {
  const id = (geoId ?? '').trim();
  if (/^[A-Z]{2}$/i.test(id)) return id.toUpperCase();
  if (id === '1013') return 'EU';
  const desc = (geoDesc ?? '').toLowerCase();
  if (/\beuropean union\b|\b^eu\b/.test(desc)) return 'EU';
  return null;
}

type ImportOpts = {
  /** Explicit UK measure type ids to treat as remedies, e.g. ["552","551","695"]. */
  measureTypeIds?: string[];
  /** Optional HS6 allowlist. */
  hs6List?: string[];
  /** Provenance import run id (from tasks plugin). */
  importId?: string;
  /** Upsert batch size (default 5000). */
  batchSize?: number;
};

async function* sourceUkRemedyRows(versionId: string, typeIds: string[]) {
  if (typeIds.length) {
    const ors = typeIds.map((t) => `m.measure__type__id = '${t}'`).join(' OR ');
    const q = `
      SELECT m.commodity__code, m.measure__type__id, m.geographical_area__id,
             m.geographical_area__description, m.duty_rate,
             m.validity_start_date, m.validity_end_date,
             m.measure__generating_regulation__validity_start_date,
             m.measure__generating_regulation__validity_end_date
      FROM S3Object[*].['${TABLE_ID}'][*] m
      WHERE (${ors})
        AND m.geographical_area__id <> '${ERGA_OMNES_ID}'
    `.trim();

    const s3 = await s3Select(versionId, q).catch(() => null);
    if (s3) {
      for (const r of s3) yield r;
      return;
    }
  }

  const stream = await fetchTableCsvStream(versionId);
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

  for await (const rec of iterateCsvRecords(stream)) {
    if (isHeader) {
      const { idx } = headerIndex(rec);
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

    const typeId = cell(rec, idxType);
    if (typeIds.length && !typeIds.includes(typeId)) continue;
    if (cell(rec, idxGeoId) === ERGA_OMNES_ID) continue;

    yield {
      commodity__code: cell(rec, idxCode),
      measure__type__id: typeId,
      geographical_area__id: cell(rec, idxGeoId),
      geographical_area__description: cell(rec, idxGeoDesc),
      duty_rate: cell(rec, idxDuty),
      validity_start_date: cell(rec, idxStart1) || undefined,
      validity_end_date: cell(rec, idxEnd1) || undefined,
      measure__generating_regulation__validity_start_date: cell(rec, idxStart2) || undefined,
      measure__generating_regulation__validity_end_date: cell(rec, idxEnd2) || undefined,
    };
  }
}

/**
 * Import UK trade remedies as surcharges (ad-valorem only) with provenance.
 */
export async function importUkTradeRemediesAsSurcharges(
  opts: ImportOpts = {}
): Promise<{ ok: true; count: number }> {
  const versionId = await getLatestVersionId();
  const hs6Allow = new Set((opts.hs6List ?? []).map((s) => String(s).slice(0, 6)));
  const envTypes = (process.env.UK_REMEDY_MEASURE_TYPES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const typeIds = opts.measureTypeIds?.length ? opts.measureTypeIds : envTypes;

  const out: SurchargeInsert[] = [];

  for await (const raw of sourceUkRemedyRows(versionId, typeIds)) {
    const parsed = UkRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const row = parsed.data;

    const code10 = row.commodity__code;
    const code6 = code10.slice(0, 6);
    if (hs6Allow.size && !hs6Allow.has(code6)) continue;

    const pct = parseAdValoremPercent(row.duty_rate);
    if (pct == null) continue; // % only

    const { start, end } = pickStartEnd(row);
    if (!start) continue;

    const origin = resolveOriginIso2OrUnion(
      row.geographical_area__id,
      row.geographical_area__description
    );

    const isCompound = hasCompoundComponent(row.duty_rate);
    const partnerLabel =
      row.geographical_area__description ??
      (row.geographical_area__id ? `geo:${row.geographical_area__id}` : 'partner:unknown');

    const surchargeCode = /countervail|subsid/i.test(partnerLabel)
      ? 'COUNTERVAILING'
      : 'ANTIDUMPING';

    out.push({
      dest: 'GB',
      origin,
      hs6: code6,
      surchargeCode: surchargeCode,
      pctAmt: pct.toFixed(3),
      fixedAmt: null,
      effectiveFrom: start,
      effectiveTo: end ?? null,
      notes:
        `${partnerLabel} – UK trade remedy (type ${row.measure__type__id})` +
        (isCompound ? '; contains specific/compound components, using % only.' : ''),
    });
  }

  if (!out.length) return { ok: true as const, count: 0 };

  // Provenance-enabled upsert
  const res = await batchUpsertSurchargesFromStream(out, {
    batchSize: opts.batchSize ?? 5000,
    importId: opts.importId,
    makeSourceRef: (r) => {
      const origin = r.origin ?? 'group';
      const typeMatch = r.notes?.match(/type\s+(\d{3})/i);
      const typeId = typeMatch?.[1] ?? 'remedy';
      const ymd = r.effectiveFrom instanceof Date ? r.effectiveFrom.toISOString().slice(0, 10) : '';
      return `uk:tt:remedy:type=${typeId}:origin=${origin}:hs6=${r.hs6}:ef=${ymd}`;
    },
  });

  return { ok: true as const, count: res.count ?? 0 };
}
