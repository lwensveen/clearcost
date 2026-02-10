import type { VatRuleInsert } from '@clearcost/types';
import { importVatRules } from '../import-vat.js';
import { toNumeric3String } from '../utils.js';
import type { LlmVat } from './schema.js';

const toDate = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
const up2 = (s?: string | null) => (s ? s.trim().toUpperCase() : undefined);

const keyOf = (r: {
  dest: string;
  vatRateKind?: VatRuleInsert['vatRateKind'] | string | null | undefined;
  effectiveFrom?: Date | null | undefined;
}) => {
  const kind = String(r.vatRateKind ?? 'STANDARD');
  const ef = (r.effectiveFrom ?? new Date(0)).toISOString().slice(0, 10);
  return `${r.dest}|${kind}|${ef}`;
};

export async function importVatFromLLM(
  rows: LlmVat[],
  opts: { importId?: string } = {}
): Promise<{ ok: true; count: number }> {
  if (!rows?.length) {
    throw new Error('[VAT LLM import] source produced 0 rows.');
  }

  const mapped: VatRuleInsert[] = rows.map((r) => ({
    dest: (up2(r.country_code) ?? '') as string,
    vatRateKind: (up2(r.vat_rate_kind) ?? 'STANDARD') as VatRuleInsert['vatRateKind'],
    vatBase: (up2(r.vat_base) ?? 'CUSTOMS') as VatRuleInsert['vatBase'],
    ratePct: toNumeric3String(r.rate_pct),
    effectiveFrom: toDate(r.effective_from),
    effectiveTo: r.effective_to ? toDate(r.effective_to) : null,
    notes: r.notes ?? null,
  }));

  // Build provenance map using the same composite key
  const srcByKey = new Map<string, string | undefined>();
  for (let i = 0; i < rows.length; i++) {
    const src = rows[i]!;
    const m = mapped[i]!;
    srcByKey.set(
      keyOf({
        dest: m.dest,
        vatRateKind: m.vatRateKind,
        effectiveFrom: m.effectiveFrom!,
      }),
      src.source_url
    );
  }

  const res = await importVatRules(mapped, {
    importId: opts.importId,
    makeSourceRef: (row) => srcByKey.get(keyOf(row)),
  });

  return { ok: true as const, count: res.count };
}
