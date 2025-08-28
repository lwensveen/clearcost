import { db, dutyRatesTable } from '@clearcost/db';
import { DutyRateInsert } from '@clearcost/types';

export async function importDutyRates(rows: DutyRateInsert[]) {
  if (!rows.length) return { ok: true, count: 0 };

  const values = rows.map((r) => ({
    ...r,
    dest: r.dest.toUpperCase(),
    partner: r.partner ? r.partner.toUpperCase() : null,
    effectiveTo: r.effectiveTo ?? null,
  }));

  await db.transaction(async (tx) => {
    for (const v of values) {
      await tx
        .insert(dutyRatesTable)
        .values(v)
        .onConflictDoUpdate({
          target: [
            dutyRatesTable.dest,
            dutyRatesTable.partner,
            dutyRatesTable.hs6,
            dutyRatesTable.effectiveFrom,
          ],
          set: {
            ratePct: v.ratePct,
            dutyRule: v.dutyRule,
            currency: v.currency,
            effectiveTo: v.effectiveTo,
            notes: v.notes ?? null,
            updatedAt: new Date(),
          },
        });
    }
  });

  return { ok: true, count: values.length };
}
