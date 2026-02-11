import { db, surchargesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { type SurchargeInsert, SurchargeInsertSchema } from '@clearcost/types';
import { resolveSurchargeRateType } from '../utils/rate-type.js';

function normIso2(v?: string | null) {
  return v ? v.trim().toUpperCase() : null;
}
function normHs6(v?: string | null) {
  if (!v) return null;
  const s = String(v).replace(/\D+/g, '').slice(0, 6);
  return s.length === 6 ? s : null;
}
function hasNumeric(v?: string | number | null) {
  if (v == null || v === '') return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n);
}
function parseCurrency(
  raw: string | null | undefined,
  rowLabel: string,
  required: boolean
): string | undefined {
  const ccy = raw?.trim().toUpperCase();
  if (!ccy) {
    if (required) {
      throw new Error(
        `[Surcharge import] Currency is required for monetary surcharge row ${rowLabel}.`
      );
    }
    return undefined;
  }
  if (!/^[A-Z]{3}$/.test(ccy)) {
    throw new Error(`[Surcharge import] Invalid currency code "${ccy}" at ${rowLabel}.`);
  }
  return ccy;
}
function toDbNumeric(n?: string | number | null) {
  if (n == null || n === '') return undefined; // omit ⇒ DB default/NULL
  const num = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(num) ? String(num) : undefined; // send as text; PG casts to numeric
}

/**
 * Upsert surcharges using table-derived schema/types.
 * Accepts “insert-shape” rows (SurchargeInsert). Columns with DB defaults (e.g. effectiveFrom)
 * may be omitted; we pass through when provided.
 *
 * NOTE: Ensure SurchargeInsert(+Schema) include the new fields used below.
 */
export async function importSurcharges(rows: SurchargeInsert[]) {
  const normalized = rows
    .map((raw) => {
      const parsed = SurchargeInsertSchema.safeParse(raw);
      if (!parsed.success) return null;
      const r = parsed.data;
      const rowLabel = `dest=${normIso2(r.dest) ?? String(r.dest)}:code=${String(r.surchargeCode)}`;
      const rateType = resolveSurchargeRateType({
        rawRateType: r.rateType,
        fixedAmt: r.fixedAmt,
        pctAmt: r.pctAmt,
        unitAmt: r.unitAmt,
        rowLabel,
      });
      const requiresCurrency =
        rateType === 'fixed' ||
        rateType === 'per_unit' ||
        hasNumeric(r.fixedAmt) ||
        hasNumeric(r.minAmt) ||
        hasNumeric(r.maxAmt) ||
        hasNumeric(r.unitAmt);
      const currency = parseCurrency(r.currency ?? null, rowLabel, requiresCurrency);

      return {
        dest: normIso2(r.dest)!,
        origin: normIso2(r.origin ?? null),
        hs6: normHs6(r.hs6 ?? null),
        surchargeCode: r.surchargeCode, // enum
        rateType,
        applyLevel: r.applyLevel ?? 'entry',
        valueBasis: r.valueBasis ?? 'customs',
        transportMode: r.transportMode ?? 'ALL',
        currency,
        fixedAmt: toDbNumeric(r.fixedAmt),
        pctAmt: toDbNumeric(r.pctAmt),
        minAmt: toDbNumeric(r.minAmt),
        maxAmt: toDbNumeric(r.maxAmt),
        unitAmt: toDbNumeric(r.unitAmt),
        unitCode: r.unitCode ? String(r.unitCode).trim().toUpperCase() : undefined,
        sourceUrl: r.sourceUrl ?? undefined,
        sourceRef: r.sourceRef ?? undefined,
        notes: r.notes ?? undefined,
        effectiveFrom: r.effectiveFrom ?? undefined,
        effectiveTo: r.effectiveTo ?? undefined,
      } as const;
    })
    .filter(Boolean) as Array<(typeof surchargesTable)['$inferInsert']>;

  if (normalized.length === 0) {
    throw new Error('[Surcharge import] source produced 0 valid rows after normalization.');
  }

  await db.transaction(async (trx) => {
    for (const v of normalized) {
      await trx
        .insert(surchargesTable)
        .values(v)
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
            rateType: sql`EXCLUDED.rate_type`,
            valueBasis: sql`EXCLUDED.value_basis`,
            currency: sql`EXCLUDED.currency`,
            fixedAmt: sql`EXCLUDED.fixed_amt`,
            pctAmt: sql`EXCLUDED.pct_amt`,
            minAmt: sql`EXCLUDED.min_amt`,
            maxAmt: sql`EXCLUDED.max_amt`,
            unitAmt: sql`EXCLUDED.unit_amt`,
            unitCode: sql`EXCLUDED.unit_code`,
            sourceUrl: sql`EXCLUDED.source_url`,
            sourceRef: sql`EXCLUDED.source_ref`,
            notes: sql`EXCLUDED.notes`,
            effectiveTo: sql`EXCLUDED.effective_to`,
            updatedAt: sql`now()`,
          },
        });
    }
  });

  return { ok: true as const, count: normalized.length };
}
