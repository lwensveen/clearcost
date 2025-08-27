import { db, deMinimisTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';

export type DeMinimisRow = {
  dest: string; // ISO-3166-1 alpha-2
  kind: 'DUTY' | 'VAT'; // per-type threshold
  basis: 'INTRINSIC' | 'CIF'; // goods-only vs CIF
  currency: string; // ISO-4217
  value: string | number; // threshold amount in `currency`
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string | null; // YYYY-MM-DD or null
};

export async function importDeMinimis(rows: DeMinimisRow[]) {
  if (!rows?.length) return { ok: true as const, count: 0 };

  let count = 0;
  await db.transaction(async (tx) => {
    for (const r of rows) {
      await tx
        .insert(deMinimisTable)
        .values({
          dest: r.dest.toUpperCase(),
          kind: r.kind,
          basis: r.basis,
          currency: r.currency.toUpperCase(),
          value: String(r.value),
          effectiveFrom: new Date(r.effectiveFrom),
          effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
        })
        .onConflictDoUpdate({
          target: [deMinimisTable.dest, deMinimisTable.kind, deMinimisTable.effectiveFrom],
          set: {
            basis: sql`excluded.basis`,
            currency: sql`excluded.currency`,
            value: sql`excluded.value`,
            effectiveTo: sql`excluded.effective_to`,
            updatedAt: new Date(),
          },
        });
      count++;
    }
  });

  return { ok: true as const, count };
}
