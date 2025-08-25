import { db, vatRulesTable } from '@clearcost/db';
import { z } from 'zod/v4';

export const VatRow = z.object({
  dest: z.string().length(2),
  ratePct: z.coerce.number(),
  base: z.enum(['CIF', 'CIF_PLUS_DUTY', 'FOB']).default('CIF_PLUS_DUTY'),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});
export const VatRows = z.array(VatRow);
export type VatRowInput = z.infer<typeof VatRow>;

export async function importVatRules(rows: VatRowInput[]) {
  const items = rows.map((r) => ({
    ...r,
    dest: r.dest.toUpperCase(),
    effectiveTo: r.effectiveTo ?? null,
  }));

  await db.transaction(async (tx) => {
    for (const r of items) {
      await tx
        .insert(vatRulesTable)
        .values({
          dest: r.dest,
          ratePct: String(r.ratePct),
          base: r.base,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo,
          notes: r.notes ?? null,
        })
        .onConflictDoUpdate({
          target: [vatRulesTable.dest, vatRulesTable.effectiveFrom],
          set: {
            ratePct: String(r.ratePct),
            base: r.base,
            effectiveTo: r.effectiveTo,
            notes: r.notes ?? null,
            updatedAt: new Date(),
          },
        });
    }
  });

  return { ok: true, count: items.length };
}
