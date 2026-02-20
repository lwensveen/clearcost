import { DeMinimisInsert } from '@clearcost/types';
import { db, deMinimisTable, provenanceTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { sha256Hex } from '../../../lib/provenance.js';

type DeMinimisBasis = 'INTRINSIC' | 'CIF';

type ProvOpts = {
  importId?: string;
  sourceKey?:
    | string
    | ((row: (typeof deMinimisTable)['$inferSelect']) => string | null | undefined);
  makeSourceRef?: (row: (typeof deMinimisTable)['$inferSelect']) => string | undefined;
};

const up = (v?: string | null) => (v ? v.trim().toUpperCase() : null);

const toDbNumeric = (n: unknown): string | null => {
  if (n == null || n === '') return null;
  const num = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(num) ? String(num) : null; // pass as text -> numeric
};

const toDate = (d: unknown): Date =>
  d instanceof Date ? d : new Date(`${String(d ?? '').slice(0, 10)}T00:00:00Z`);

// For inserts, provide real Date or null (not SQL NULL)
const toDbFrom = (d: unknown, rowLabel: string): Date => {
  const out = toDate(d);
  if (Number.isNaN(out.getTime())) {
    throw new Error(`[DeMinimis] Invalid effectiveFrom at ${rowLabel}.`);
  }
  return out;
};
const toDbTo = (d: unknown, rowLabel: string): Date | null => {
  if (!d) return null;
  const out = toDate(d);
  if (Number.isNaN(out.getTime())) {
    throw new Error(`[DeMinimis] Invalid effectiveTo at ${rowLabel}.`);
  }
  return out;
};

const isoOrNull = (d: Date | string | null | undefined) =>
  !d
    ? null
    : d instanceof Date
      ? d.toISOString()
      : new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toISOString();

function normalizeBasis(
  basis: string | null | undefined,
  rowLabel: string
): (typeof deMinimisTable)['$inferInsert']['deMinimisBasis'] {
  const normalized = up(basis);
  if (normalized === 'INTRINSIC' || normalized === 'CIF') {
    return normalized as DeMinimisBasis;
  }
  throw new Error(`[DeMinimis] Invalid deMinimisBasis at ${rowLabel}. Expected INTRINSIC or CIF.`);
}

function normalizeInsertRow(
  row: DeMinimisInsert,
  index: number
): (typeof deMinimisTable)['$inferInsert'] {
  const rowLabel = `row ${index + 1}`;
  const dest = up(row.dest);
  if (!dest || !/^[A-Z]{2}$/.test(dest)) {
    throw new Error(`[DeMinimis] Invalid destination country code at ${rowLabel}.`);
  }

  const kind = row.deMinimisKind;
  if (kind !== 'DUTY' && kind !== 'VAT') {
    throw new Error(`[DeMinimis] Invalid deMinimisKind at ${rowLabel}.`);
  }

  const currency = up(row.currency);
  if (!currency || !/^[A-Z]{3}$/.test(currency)) {
    throw new Error(`[DeMinimis] Invalid currency code at ${rowLabel}.`);
  }

  const value = toDbNumeric(row.value);
  if (value == null) {
    throw new Error(`[DeMinimis] Invalid threshold value at ${rowLabel}.`);
  }

  return {
    dest,
    deMinimisKind: kind,
    deMinimisBasis: normalizeBasis(row.deMinimisBasis, rowLabel),
    currency,
    value,
    effectiveFrom: toDbFrom(row.effectiveFrom, rowLabel),
    effectiveTo: toDbTo(row.effectiveTo ?? null, rowLabel),
  };
}

/**
 * Upsert de-minimis thresholds using your canonical insert type.
 * Uniqueness: (dest, de_minimis_kind, effective_from)
 */
export async function importDeMinimis(
  source: DeMinimisInsert[] | AsyncIterable<DeMinimisInsert>,
  opts: ProvOpts = {}
): Promise<{ ok: true; inserted: number; updated: number; count: number }> {
  let buf: DeMinimisInsert[] = [];
  let inserted = 0;
  let updated = 0;
  let sourceRows = 0;

  const isAsync = (s: any): s is AsyncIterable<DeMinimisInsert> =>
    s && typeof s[Symbol.asyncIterator] === 'function';

  async function flush() {
    if (!buf.length) return;

    const values = buf.map(normalizeInsertRow);

    const ret = await db
      .insert(deMinimisTable)
      .values(values)
      .onConflictDoUpdate({
        target: [deMinimisTable.dest, deMinimisTable.deMinimisKind, deMinimisTable.effectiveFrom],
        set: {
          deMinimisBasis: sql`EXCLUDED.de_minimis_basis`,
          currency: sql`EXCLUDED.currency`,
          value: sql`EXCLUDED.value`,
          effectiveTo: sql`EXCLUDED.effective_to`,
          updatedAt: sql`now()`,
        },
      })
      .returning({
        id: deMinimisTable.id,
        inserted: sql<number>`(xmax = 0)::int`,
        dest: deMinimisTable.dest,
        deMinimisKind: deMinimisTable.deMinimisKind,
        deMinimisBasis: deMinimisTable.deMinimisBasis,
        currency: deMinimisTable.currency,
        value: deMinimisTable.value,
        effectiveFrom: deMinimisTable.effectiveFrom,
        effectiveTo: deMinimisTable.effectiveTo,
        createdAt: deMinimisTable.createdAt,
        updatedAt: deMinimisTable.updatedAt,
      });

    for (const r of ret) {
      if (r.inserted === 1) {
        inserted++;
      } else updated++;
    }

    if (opts.importId && ret.length) {
      const provRows = ret.map((row) => ({
        sourceKey:
          (typeof opts.sourceKey === 'function' ? opts.sourceKey(row) : opts.sourceKey) ?? null,
        importId: opts.importId!,
        resourceType: 'de_minimis' as const,
        resourceId: row.id,
        sourceRef:
          opts.makeSourceRef?.(row) ??
          `de-minimis:dest=${row.dest}:kind=${row.deMinimisKind}:basis=${row.deMinimisBasis}:ef=${String(
            isoOrNull(row.effectiveFrom)
          ).slice(0, 10)}`,
        rowHash: sha256Hex(
          JSON.stringify({
            dest: row.dest,
            kind: row.deMinimisKind,
            basis: row.deMinimisBasis,
            currency: row.currency,
            value: row.value,
            ef: isoOrNull(row.effectiveFrom),
            et: isoOrNull(row.effectiveTo),
          })
        ),
      }));
      try {
        await db.insert(provenanceTable).values(provRows);
      } catch (e) {
        if (process.env.DEBUG === '1') {
          console.warn('[DeMinimis] provenance insert failed (non-fatal):', (e as Error).message);
        }
      }
    }

    buf = [];
  }

  if (isAsync(source)) {
    for await (const row of source) {
      buf.push(row);
      sourceRows++;
      if (buf.length >= 5000) await flush();
    }
  } else {
    for (const row of source) {
      buf.push(row);
      sourceRows++;
      if (buf.length >= 5000) await flush();
    }
  }
  if (sourceRows === 0) {
    throw new Error('[DeMinimis] source produced 0 rows.');
  }
  await flush();

  return { ok: true as const, inserted, updated, count: inserted + updated };
}
