import { db, provenanceTable, vatRulesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import type { VatRuleInsert } from '@clearcost/types';
import { VatRuleInsertSchema } from '@clearcost/types';
import { toDateIfDefined, toDateOrNull, toNumeric3String } from './utils.js';
import { sha256Hex } from '../../../lib/provenance.js';

type ImportOpts = {
  importId?: string;
  makeSourceRef?: (row: VatRuleInsert) => string | undefined;
  /**
   * Provenance classification for imported VAT rows.
   * - official: authoritative source imports
   * - llm: model-generated/cross-check rows
   * - manual: operator-provided/admin imports
   */
  source?: 'official' | 'llm' | 'manual';
};

/**
 * Import VAT rules (canonical shape) with optional provenance.
 * - Accepts { kind, base } or { vatRateKind, vatBase }.
 * - Upsert key: (dest, vat_rate_kind, effective_from).
 * - On conflict: updates rate_pct, vat_base, effective_to, notes, updated_at.
 */
export async function importVatRules(rows: VatRuleInsert[] | Array<any>, opts: ImportOpts = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('[VAT import] source produced 0 rows.');
  }

  const importSource = opts.source ?? 'official';

  // Normalize inputs to DB column names
  const mapped = rows.map((r: any) => {
    const dest = String(r.dest ?? '').toUpperCase();
    const vatRateKind = String(r.vatRateKind ?? r.kind ?? 'STANDARD').toUpperCase();
    const vatBase = String(r.vatBase ?? r.base ?? 'CIF_PLUS_DUTY');
    const ratePct = toNumeric3String(r.ratePct);
    const effectiveFrom = toDateIfDefined(r.effectiveFrom);
    const effectiveTo = toDateOrNull(r.effectiveTo ?? null);
    const notes = r.notes ?? null;
    const source =
      String(r.source ?? importSource)
        .trim()
        .toLowerCase() || importSource;

    return { dest, vatRateKind, source, ratePct, vatBase, effectiveFrom, effectiveTo, notes };
  });

  // Validate after mapping
  const validated = VatRuleInsertSchema.array().parse(mapped);

  // Upsert with correct EXCLUDED references (raw snake_case)
  const returned = await db
    .insert(vatRulesTable)
    .values(validated)
    .onConflictDoUpdate({
      target: [vatRulesTable.dest, vatRulesTable.vatRateKind, vatRulesTable.effectiveFrom],
      set: {
        source: sql`excluded.source`,
        ratePct: sql`excluded.rate_pct`,
        vatBase: sql`excluded.vat_base`,
        effectiveTo: sql`excluded.effective_to`,
        notes: sql`excluded.notes`,
        updatedAt: sql`now()`,
      },
      // Never let LLM upserts overwrite an existing official row.
      ...(importSource === 'llm' ? { setWhere: sql`${vatRulesTable.source} <> 'official'` } : {}),
    })
    .returning({
      id: vatRulesTable.id,
      dest: vatRulesTable.dest,
      vatRateKind: vatRulesTable.vatRateKind,
      source: vatRulesTable.source,
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
        source: r.source as VatRuleInsert['source'],
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
