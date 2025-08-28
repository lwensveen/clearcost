import { db, provenanceTable, vatRulesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { VatRuleInsert, VatRuleInsertSchema } from '@clearcost/types';
import { toDateIfDefined, toDateOrNull, toNumeric3String } from './utils.js';
import { sha256Hex } from '../../../lib/provenance.js';

type ImportOpts = {
  importId?: string;
  makeSourceRef?: (row: VatRuleInsert) => string | undefined;
};

/**
 * Import VAT rules (canonical shape only) with optional provenance.
 * - Upserts on (dest, kind, effective_from).
 * - On conflict: updates rate_pct, base, effective_to, notes, updated_at.
 * - Normalizes: dest/kind uppercased; ratePct → NUMERIC(6,3) string.
 */
export async function importVatRules(rows: VatRuleInsert[], opts: ImportOpts = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: true, count: 0 };

  const validated = VatRuleInsertSchema.array().parse(rows);

  const normalized: VatRuleInsert[] = validated.map((r) => {
    const kindInput = (r.vatRateKind ?? 'STANDARD') as string;
    const kind = kindInput.toUpperCase() as VatRuleInsert['vatRateKind'];
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

  // Upsert and capture columns we need for provenance
  const returned = await db
    .insert(vatRulesTable)
    .values(normalized)
    .onConflictDoUpdate({
      target: [vatRulesTable.dest, vatRulesTable.vatRateKind, vatRulesTable.effectiveFrom],
      set: {
        ratePct: sql`excluded.rate_pct`,
        vatRateKind: sql`excluded.vatRateKind`,
        effectiveTo: sql`excluded.effective_to`,
        notes: sql`excluded.notes`,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: vatRulesTable.id,
      dest: vatRulesTable.dest,
      vatRateKind: vatRulesTable.vatRateKind,
      ratePct: vatRulesTable.ratePct,
      vatBase: vatRulesTable.vatBase,
      effectiveFrom: vatRulesTable.effectiveFrom,
      effectiveTo: vatRulesTable.effectiveTo,
      notes: vatRulesTable.notes,
    });

  // Optional provenance write
  if (opts.importId && returned.length) {
    const provRows = returned.map((r) => ({
      importId: opts.importId!,
      resourceType: 'vat_rule' as const,
      resourceId: r.id,
      sourceRef: opts.makeSourceRef?.({
        dest: r.dest,
        vatRateKind: r.vatRateKind,
        ratePct: r.ratePct,
        vatBase: r.vatBase,
        effectiveFrom: r.effectiveFrom!,
        effectiveTo: r.effectiveTo ?? null,
        notes: r.notes ?? null,
      } as VatRuleInsert),
      rowHash: sha256Hex(
        JSON.stringify({
          dest: r.dest,
          vatRateKind: r.vatRateKind,
          ratePct: r.ratePct,
          vatBase: r.vatBase,
          ef: r.effectiveFrom?.toISOString(),
          et: r.effectiveTo ? r.effectiveTo.toISOString() : null,
          notes: r.notes ?? null,
        })
      ),
    }));

    await db.insert(provenanceTable).values(provRows);
  }

  return { ok: true as const, count: returned.length };
}
