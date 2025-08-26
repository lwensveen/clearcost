import { db, vatRulesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { VatRuleInsert, VatRuleInsertSchema } from '@clearcost/types';
import { toDateIfDefined, toDateOrNull, toNumeric3String } from './utils.js';

/**
 * Import VAT rules (canonical shape only).
 * - Upserts on (dest, kind, effective_from).
 * - On conflict: updates rate_pct, base, effective_to, notes, updated_at.
 * - Normalizes: dest/kind uppercased; ratePct → NUMERIC(6,3) string.
 */
export async function importVatRules(rows: VatRuleInsert[]) {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: true, count: 0 };

  const validated = VatRuleInsertSchema.array().parse(rows);

  const normalized: VatRuleInsert[] = validated.map((r) => {
    const kindInput = (r.kind ?? 'STANDARD') as string; // default when omitted in insert schema
    const kind = kindInput.toUpperCase() as VatRuleInsert['kind'];

    return {
      ...r,
      dest: r.dest.toUpperCase(),
      kind,
      ratePct: toNumeric3String(r.ratePct),
      effectiveFrom: toDateIfDefined(r.effectiveFrom),
      effectiveTo: toDateOrNull(r.effectiveTo ?? null),
      notes: r.notes ?? null,
    };
  });

  await db.transaction(async (tx) => {
    await tx
      .insert(vatRulesTable)
      .values(normalized)
      .onConflictDoUpdate({
        target: [vatRulesTable.dest, vatRulesTable.kind, vatRulesTable.effectiveFrom],
        set: {
          ratePct: sql`excluded.rate_pct`,
          base: sql`excluded.base`,
          effectiveTo: sql`excluded.effective_to`,
          notes: sql`excluded.notes`,
          updatedAt: new Date(),
        },
      });
  });

  return { ok: true, count: normalized.length };
}
