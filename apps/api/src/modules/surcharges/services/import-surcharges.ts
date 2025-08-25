import { db, surchargesTable } from '@clearcost/db';
import { z } from 'zod/v4';
import { sql } from 'drizzle-orm';

const SURCHARGE_CODES = [
  'CUSTOMS_PROCESSING',
  'DISBURSEMENT',
  'EXCISE',
  'HANDLING',
  'FUEL',
  'SECURITY',
  'REMOTE',
  'OTHER',
] as const;
type SurchargeCode = (typeof SURCHARGE_CODES)[number];

export const SurchargeRow = z.object({
  dest: z.string().length(2),
  code: z.enum(SURCHARGE_CODES),
  fixedAmt: z.coerce.number().optional(),
  pctAmt: z.coerce.number().optional(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});
export const SurchargeRows = z.array(SurchargeRow);
export type SurchargeRowInput = z.infer<typeof SurchargeRow>;

export async function importSurcharges(rows: SurchargeRowInput[]) {
  const normalized = rows.map((row) => ({
    ...row,
    dest: row.dest.toUpperCase(),
    effectiveTo: row.effectiveTo ?? null,
  }));

  await db.transaction(async (trx) => {
    for (const row of normalized) {
      await trx
        .insert(surchargesTable)
        .values({
          dest: row.dest,
          code: row.code as SurchargeCode,
          fixedAmt: row.fixedAmt != null ? String(row.fixedAmt) : undefined,
          pctAmt: row.pctAmt != null ? String(row.pctAmt) : undefined,
          effectiveFrom: row.effectiveFrom,
          effectiveTo: row.effectiveTo ?? undefined,
          notes: row.notes ?? undefined,
        } as any)
        .onConflictDoUpdate({
          target: [surchargesTable.dest, surchargesTable.code, surchargesTable.effectiveFrom],
          set: {
            fixedAmt: row.fixedAmt != null ? String(row.fixedAmt) : sql`NULL`,
            pctAmt: row.pctAmt != null ? String(row.pctAmt) : sql`NULL`,
            effectiveTo: row.effectiveTo ?? sql`NULL`,
            notes: row.notes ?? sql`NULL`,
            updatedAt: new Date(),
          },
        });
    }
  });

  return { ok: true, count: normalized.length };
}
