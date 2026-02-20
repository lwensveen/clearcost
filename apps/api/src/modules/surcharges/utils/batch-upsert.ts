import { db, provenanceTable, surchargesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { sha256Hex } from '../../../lib/provenance.js';
import { resolveSurchargeRateType } from './rate-type.js';

type SurchargeInsertRow = typeof surchargesTable.$inferInsert;
type SurchargeSelectRow = typeof surchargesTable.$inferSelect;

type ProvOpts = {
  importId?: string;
  sourceKey?: string | ((row: SurchargeSelectRow) => string | null | undefined);
  makeSourceRef?: (row: SurchargeSelectRow) => string | undefined;
};

// ---------- helpers: normalize & coerce ----------
const up = (v?: string | null) => (v ? v.trim().toUpperCase() : null);
const low = (v?: string | null) => (v ? v.trim().toLowerCase() : null);

const hs6 = (v?: string | null) => {
  if (!v) return null;
  const s = String(v).replace(/\D+/g, '').slice(0, 6);
  return s.length === 6 ? s : null;
};
const toDbNumeric = (n?: string | number | null) => {
  if (n == null || n === '') return sql`NULL`;
  const num = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(num) ? String(num) : sql`NULL`; // send as text → numeric
};
const toDbNotes = (s?: string | null) => (s && s.trim() ? s.trim() : sql`NULL`);
const toDbText = (s?: string | null) => (s && s.trim() ? s.trim() : sql`NULL`);
const toDbFrom = (d?: Date | null) => (d instanceof Date ? d : undefined);
/** Always open-ended unless you explicitly pass a Date */
const toDbTo = (d?: Date | null) => (d instanceof Date ? d : sql`NULL`);
const hasNumeric = (v?: string | number | null) => {
  if (v == null || v === '') return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n);
};
function parseCurrency(s: string | null | undefined, rowLabel: string, required: boolean) {
  const raw = String(s ?? '')
    .trim()
    .toUpperCase();
  if (raw.length === 0) {
    if (required) {
      throw new Error(`[Surcharges] Currency is required for monetary surcharge row ${rowLabel}.`);
    }
    return undefined;
  }
  if (!/^[A-Z]{3}$/.test(raw)) {
    throw new Error(`[Surcharges] Invalid currency code "${raw}" at ${rowLabel}.`);
  }
  return raw;
}

function isoOrNull(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  const dd = new Date(d);
  return Number.isNaN(+dd) ? null : dd.toISOString();
}

// Defaults that match DB enum labels
const dfltApplyLevel = (s?: string | null) =>
  (low(s) ?? 'entry') as SurchargeInsertRow['applyLevel'];
const dfltValueBasis = (s?: string | null) =>
  (low(s) ?? 'customs') as SurchargeInsertRow['valueBasis'];
const dfltTransport = (s?: string | null) =>
  (up(s) ?? 'ALL') as SurchargeInsertRow['transportMode'];

// -------------------------------------------------
/**
 * Upsert surcharges in batches (default 5k) with strict normalization.
 * Matches the unique index:
 * (dest, origin, hs6, transport_mode, apply_level, surcharge_code, effective_from)
 *
 * Returns { inserted, updated, count }.
 */
export async function batchUpsertSurchargesFromStream(
  source: AsyncIterable<SurchargeInsertRow> | SurchargeInsertRow[],
  opts: { batchSize?: number } & ProvOpts = {}
) {
  const batchSize = Math.max(1, opts.batchSize ?? 5000);
  let totalInserted = 0;
  let totalUpdated = 0;
  let buf: SurchargeInsertRow[] = [];

  const isAsyncIterable = (s: any): s is AsyncIterable<SurchargeInsertRow> =>
    s && typeof s[Symbol.asyncIterator] === 'function';

  async function flush() {
    if (buf.length === 0) return;

    // Normalize rows → DB insert shape (no empty strings for numerics/dates).
    const values = buf.map((r) => {
      const rowLabel = `dest=${up(r.dest) ?? String(r.dest)}:code=${String(r.surchargeCode)}`;
      const rateType = resolveSurchargeRateType({
        rawRateType: r.rateType,
        fixedAmt: r.fixedAmt,
        pctAmt: r.pctAmt,
        unitAmt: r.unitAmt,
        rowLabel,
      }) as SurchargeInsertRow['rateType'];
      const requiresCurrency =
        rateType === 'fixed' ||
        rateType === 'per_unit' ||
        hasNumeric(r.fixedAmt) ||
        hasNumeric(r.minAmt) ||
        hasNumeric(r.maxAmt) ||
        hasNumeric(r.unitAmt);
      const currency = parseCurrency(r.currency ?? null, rowLabel, requiresCurrency);

      return {
        dest: up(r.dest)!, // required ISO2 -> UPPER
        origin: up(r.origin ?? null), // optional ISO2 -> UPPER
        hs6: hs6(r.hs6 ?? null),
        surchargeCode: r.surchargeCode, // enum already
        // enums with lowercase labels in DB
        rateType,
        applyLevel: dfltApplyLevel(r.applyLevel),
        valueBasis: dfltValueBasis(r.valueBasis),
        // enum with uppercase labels in DB
        transportMode: dfltTransport(r.transportMode),
        currency,
        fixedAmt: toDbNumeric(r.fixedAmt),
        pctAmt: toDbNumeric(r.pctAmt),
        minAmt: toDbNumeric(r.minAmt),
        maxAmt: toDbNumeric(r.maxAmt),
        unitAmt: toDbNumeric(r.unitAmt),
        unitCode: up(r.unitCode ?? null),
        sourceUrl: toDbText(r.sourceUrl ?? null),
        sourceRef: toDbText(r.sourceRef ?? null),
        notes: toDbNotes(r.notes),
        effectiveFrom: toDbFrom(r.effectiveFrom),
        effectiveTo: toDbTo(r.effectiveTo),
      };
    }) as Array<(typeof surchargesTable)['$inferInsert']>;

    const ret = await db
      .insert(surchargesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [
          surchargesTable.dest,
          surchargesTable.origin,
          surchargesTable.hs6,
          surchargesTable.transportMode,
          surchargesTable.applyLevel,
          surchargesTable.surchargeCode,
          surchargesTable.effectiveFrom,
        ],
        set: {
          // amounts & metadata
          fixedAmt: sql`EXCLUDED.fixed_amt`,
          pctAmt: sql`EXCLUDED.pct_amt`,
          minAmt: sql`EXCLUDED.min_amt`,
          maxAmt: sql`EXCLUDED.max_amt`,
          unitAmt: sql`EXCLUDED.unit_amt`,
          unitCode: sql`EXCLUDED.unit_code`,
          currency: sql`EXCLUDED.currency`,
          rateType: sql`EXCLUDED.rate_type`,
          valueBasis: sql`EXCLUDED.value_basis`,
          sourceUrl: sql`EXCLUDED.source_url`,
          sourceRef: sql`EXCLUDED.source_ref`,
          notes: sql`EXCLUDED.notes`,
          effectiveTo: sql`EXCLUDED.effective_to`,
          updatedAt: sql`now()`,
        },
      })
      .returning({
        id: surchargesTable.id,
        inserted: sql<number>`(xmax = 0)::int`, // 1 if inserted, 0 if updated
        dest: surchargesTable.dest,
        origin: surchargesTable.origin,
        hs6: surchargesTable.hs6,
        surchargeCode: surchargesTable.surchargeCode,
        rateType: surchargesTable.rateType,
        applyLevel: surchargesTable.applyLevel,
        valueBasis: surchargesTable.valueBasis,
        transportMode: surchargesTable.transportMode,
        currency: surchargesTable.currency,
        fixedAmt: surchargesTable.fixedAmt,
        pctAmt: surchargesTable.pctAmt,
        minAmt: surchargesTable.minAmt,
        maxAmt: surchargesTable.maxAmt,
        unitAmt: surchargesTable.unitAmt,
        unitCode: surchargesTable.unitCode,
        effectiveFrom: surchargesTable.effectiveFrom,
        effectiveTo: surchargesTable.effectiveTo,
        notes: surchargesTable.notes,
      });

    // Tally inserted vs updated
    let batchInserted = 0;
    let batchUpdated = 0;
    for (const r of ret) {
      if (r.inserted === 1) batchInserted++;
      else batchUpdated++;
    }
    totalInserted += batchInserted;
    totalUpdated += batchUpdated;

    // Optional provenance (non-fatal if it fails)
    if (opts.importId && ret.length) {
      const provRows = ret.map((row) => ({
        importId: opts.importId!,
        resourceType: 'surcharge' as const,
        resourceId: row.id,
        sourceKey:
          (typeof opts.sourceKey === 'function'
            ? opts.sourceKey(row as unknown as SurchargeSelectRow)
            : opts.sourceKey) ?? null,
        sourceRef: opts.makeSourceRef?.(row as unknown as SurchargeSelectRow),
        rowHash: sha256Hex(
          JSON.stringify({
            dest: row.dest,
            origin: row.origin ?? null,
            hs6: row.hs6 ?? null,
            code: row.surchargeCode,
            rateType: row.rateType,
            applyLevel: row.applyLevel,
            valueBasis: row.valueBasis,
            transportMode: row.transportMode,
            currency: row.currency,
            fixedAmt: row.fixedAmt,
            pctAmt: row.pctAmt,
            minAmt: row.minAmt,
            maxAmt: row.maxAmt,
            unitAmt: row.unitAmt,
            unitCode: row.unitCode ?? null,
            ef: isoOrNull(row.effectiveFrom),
            et: isoOrNull(row.effectiveTo),
            notes: row.notes ?? null,
          })
        ),
      }));

      try {
        await db.insert(provenanceTable).values(provRows);
      } catch (e) {
        if (process.env.DEBUG === '1') {
          console.warn('[Surcharges] provenance insert failed (non-fatal):', (e as Error).message);
        }
      }
    }

    buf = [];
  }

  if (isAsyncIterable(source)) {
    for await (const row of source) {
      buf.push(row);
      if (buf.length >= batchSize) await flush();
    }
  } else {
    for (const row of source) {
      buf.push(row);
      if (buf.length >= batchSize) await flush();
    }
  }
  await flush();

  return {
    ok: true as const,
    inserted: totalInserted,
    updated: totalUpdated,
    count: totalInserted + totalUpdated,
  };
}
