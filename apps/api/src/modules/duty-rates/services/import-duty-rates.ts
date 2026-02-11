import { db, dutyRatesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import type { DutyRateInsert } from '@clearcost/types';
import { resolveDutyRateCurrency } from '../utils/currency.js';

export async function importDutyRates(rows: DutyRateInsert[]) {
  if (!rows.length) {
    throw new Error('[Duty import] source produced 0 rows.');
  }

  const values = rows.map((r) => ({
    id: r.id,
    dest: r.dest.toUpperCase(),
    partner: (r.partner ?? '').toUpperCase(),
    hs6: r.hs6.slice(0, 6),
    ratePct: r.ratePct,
    dutyRule: r.dutyRule ?? 'mfn',
    currency: resolveDutyRateCurrency(r.dest, r.currency ?? null),
    effectiveFrom: r.effectiveFrom ?? new Date(),
    effectiveTo: r.effectiveTo ?? null,
    notes: r.notes ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  const ret = await db
    .insert(dutyRatesTable)
    .values(values)
    .onConflictDoUpdate({
      target: [
        dutyRatesTable.dest,
        dutyRatesTable.partner,
        dutyRatesTable.hs6,
        dutyRatesTable.dutyRule,
        dutyRatesTable.effectiveFrom,
      ],
      set: {
        ratePct: sql`EXCLUDED.rate_pct`,
        currency: sql`EXCLUDED.currency`,
        effectiveTo: sql`EXCLUDED.effective_to`,
        notes: sql`EXCLUDED.notes`,
        updatedAt: sql`now()`,
      },
      setWhere: sql`
        ${dutyRatesTable.ratePct} IS DISTINCT FROM EXCLUDED.rate_pct
        OR ${dutyRatesTable.currency} IS DISTINCT FROM EXCLUDED.currency
        OR ${dutyRatesTable.effectiveTo} IS DISTINCT FROM EXCLUDED.effective_to
        OR ${dutyRatesTable.notes} IS DISTINCT FROM EXCLUDED.notes
      `,
    })
    .returning({ id: dutyRatesTable.id });

  return { ok: true as const, count: ret.length };
}
