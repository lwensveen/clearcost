import { db, dutyRatesTable } from '@clearcost/db';
import { z } from 'zod/v4';

export const DutyRow = z.object({
  dest: z.string().length(2),
  hs6: z.string().regex(/^\d{6}$/),
  ratePct: z.coerce.number(),
  rule: z.enum(['mfn', 'fta', 'anti_dumping', 'safeguard']).default('mfn'),
  currency: z.string().length(3).default('USD'),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});
export const DutyRows = z.array(DutyRow);

export type DutyRowInput = z.infer<typeof DutyRow>;

export async function importDutyRates(rows: DutyRowInput[]) {
  const items = rows.map((row) => ({
    ...row,
    dest: row.dest.toUpperCase(),
    currency: row.currency.toUpperCase(),
    effectiveTo: row.effectiveTo ?? null,
  }));

  await db.transaction(async (tx) => {
    for (const rate of items) {
      await tx
        .insert(dutyRatesTable)
        .values({
          dest: rate.dest,
          hs6: rate.hs6,
          ratePct: String(rate.ratePct),
          rule: rate.rule,
          currency: rate.currency,
          effectiveFrom: rate.effectiveFrom,
          effectiveTo: rate.effectiveTo ?? null,
          notes: rate.notes ?? null,
        })
        .onConflictDoUpdate({
          target: [dutyRatesTable.dest, dutyRatesTable.hs6, dutyRatesTable.effectiveFrom],
          set: {
            ratePct: String(rate.ratePct),
            rule: rate.rule,
            currency: rate.currency,
            effectiveTo: rate.effectiveTo ?? null,
            notes: rate.notes ?? null,
            updatedAt: new Date(),
          },
        });
    }
  });

  return { ok: true, count: items.length };
}
