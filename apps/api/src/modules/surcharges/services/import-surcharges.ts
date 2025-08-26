import { db, surchargesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { type SurchargeInsert, SurchargeInsertSchema } from '@clearcost/types';

function normIso2(v?: string | null) {
  return v ? v.trim().toUpperCase() : null;
}
function normHs6(v?: string | null) {
  if (!v) return null;
  const s = String(v).replace(/\D+/g, '').slice(0, 6);
  return s.length === 6 ? s : null;
}
function toDbNumeric(n?: string | number | null) {
  if (n == null || n === '') return undefined;
  const num = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(num) ? String(num) : undefined;
}

/**
 * Upsert surcharges using table-derived schema/types.
 * Accepts “insert-shape” rows (SurchargeInsert). Columns with DB defaults (e.g. effectiveFrom)
 * may be omitted; we pass through when provided.
 */
export async function importSurcharges(rows: SurchargeInsert[]) {
  const normalized = rows
    .map((raw) => {
      const parsed = SurchargeInsertSchema.safeParse(raw);
      if (!parsed.success) return null;

      const r = parsed.data;

      return {
        dest: normIso2(r.dest)!,
        origin: normIso2(r.origin ?? null),
        hs6: normHs6(r.hs6 ?? null),
        code: r.code,
        fixedAmt: toDbNumeric(r.fixedAmt as any),
        pctAmt: toDbNumeric(r.pctAmt as any),
        effectiveFrom: r.effectiveFrom ?? undefined,
        effectiveTo: r.effectiveTo ?? undefined,
        notes: r.notes ?? undefined,
      } as const;
    })
    .filter(Boolean) as Array<{
    dest: string;
    origin: string | null;
    hs6: string | null;
    code: (typeof surchargesTable.$inferInsert)['code'];
    fixedAmt?: string;
    pctAmt?: string;
    effectiveFrom?: Date;
    effectiveTo?: Date;
    notes?: string;
  }>;

  if (normalized.length === 0) return { ok: true as const, count: 0 };

  await db.transaction(async (trx) => {
    for (const r of normalized) {
      await trx
        .insert(surchargesTable)
        .values({
          dest: r.dest,
          origin: r.origin ?? null,
          hs6: r.hs6 ?? null,
          code: r.code,
          fixedAmt: r.fixedAmt,
          pctAmt: r.pctAmt,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo,
          notes: r.notes,
        } as (typeof surchargesTable)['$inferInsert'])
        .onConflictDoUpdate({
          target: [
            surchargesTable.dest,
            surchargesTable.origin,
            surchargesTable.hs6,
            surchargesTable.code,
            surchargesTable.effectiveFrom,
          ],
          set: {
            fixedAmt: r.fixedAmt ?? sql`NULL`,
            pctAmt: r.pctAmt ?? sql`NULL`,
            effectiveTo: r.effectiveTo ?? sql`NULL`,
            notes: r.notes ?? sql`NULL`,
            updatedAt: new Date(),
          },
        });
    }
  });

  return { ok: true as const, count: normalized.length };
}
