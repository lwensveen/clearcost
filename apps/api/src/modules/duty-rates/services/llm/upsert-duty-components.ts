import { db, dutyRateComponentsTable, dutyRatesTable, provenanceTable } from '@clearcost/db';
import { and, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm/sql';
import { sha256Hex } from '../../../../lib/provenance.js';

export type LlmComponentInput = {
  type: 'advalorem' | 'specific' | 'minimum' | 'maximum' | 'other';
  rate_pct?: number | null;
  amount?: number | null;
  currency?: string | null;
  uom?: string | null;
  qualifier?: string | null;
};

export type LlmDutyRowForComponents = {
  country_code: string;
  partner?: string | null;
  hs6: string;
  duty_rule: string; // e.g. "mfn", "FTA", "anti-dumping"
  effective_from: string; // YYYY-MM-DD
  source_url?: string;
  components: LlmComponentInput[];
};

const up = (s?: string | null) => (s ? s.trim().toUpperCase() : undefined);
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const pctStr = (v?: number | null) =>
  typeof v === 'number' && Number.isFinite(v) ? (Math.round(v * 1000) / 1000).toFixed(3) : null;
const amtStr = (v?: number | null) =>
  typeof v === 'number' && Number.isFinite(v) ? (Math.round(v * 1e6) / 1e6).toFixed(6) : null;

type DutyRuleValue = (typeof dutyRatesTable.$inferSelect)['dutyRule'];
function normalizeDutyRule(v: string): DutyRuleValue {
  const s = v.toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'mfn' || s === 'fta' || s === 'anti_dumping' || s === 'safeguard') {
    return s;
  }
  return 'mfn';
}

export async function upsertDutyRateComponentsForLLM(
  rows: LlmDutyRowForComponents[],
  opts: { importId?: string } = {}
): Promise<{ ok: true; inserted: number; updated: number; count: number }> {
  let inserted = 0;
  let updated = 0;

  for (const r of rows) {
    const dest = up(r.country_code)!;
    const partner = up(r.partner ?? '') ?? ''; // MFN sentinel
    const hs6 = r.hs6;
    const dutyRule: DutyRuleValue = normalizeDutyRule(r.duty_rule);
    const ef = toDate(r.effective_from);

    const [parent] = await db
      .select({ id: dutyRatesTable.id })
      .from(dutyRatesTable)
      .where(
        and(
          eq(dutyRatesTable.dest, dest),
          eq(dutyRatesTable.partner, partner),
          eq(dutyRatesTable.hs6, hs6),
          eq(dutyRatesTable.dutyRule, dutyRule), // <- now exact enum type
          eq(dutyRatesTable.effectiveFrom, ef)
        )
      )
      .limit(1);

    if (!parent?.id || !r.components?.length) continue;

    const values = r.components.map((c) => ({
      dutyRateId: parent.id,
      componentType: c.type,
      ratePct: c.type === 'advalorem' ? pctStr(c.rate_pct) : null,
      amount: c.type === 'advalorem' ? null : amtStr(c.amount),
      currency: up(c.currency ?? undefined),
      uom: c.uom ?? null,
      qualifier: c.qualifier ?? null,
      formula: null,
      notes: null as string | null,
      effectiveFrom: ef,
    }));

    if (!values.length) continue;

    const ret = await db
      .insert(dutyRateComponentsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [
          dutyRateComponentsTable.dutyRateId,
          dutyRateComponentsTable.componentType,
          dutyRateComponentsTable.ratePct,
          dutyRateComponentsTable.amount,
          dutyRateComponentsTable.currency,
          dutyRateComponentsTable.uom,
          dutyRateComponentsTable.qualifier,
          dutyRateComponentsTable.effectiveFrom,
        ],
        set: {
          formula: sql`EXCLUDED.formula`,
          notes: sql`EXCLUDED.notes`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ inserted: sql<number>`(xmax = 0)::int`, id: dutyRateComponentsTable.id });

    // TS2357 fix: use a proper if/else (not a ternary with ++)
    for (const row of ret) {
      if (row.inserted === 1) {
        inserted++;
      } else {
        updated++;
      }
    }

    if (opts.importId && r.source_url && ret.length) {
      try {
        await db.insert(provenanceTable).values(
          ret.map(() => ({
            importId: opts.importId!,
            resourceType: 'duty_rate' as const, // attach provenance to parent duty_rate
            resourceId: parent.id,
            sourceRef: `${r.source_url}#component`,
            rowHash: sha256Hex(
              JSON.stringify({
                dutyRateId: parent.id,
                components: values.map((v) => ({
                  t: v.componentType,
                  rp: v.ratePct,
                  a: v.amount,
                  cur: v.currency,
                  uom: v.uom,
                  q: v.qualifier,
                  ef: ef.toISOString(),
                })),
              })
            ),
          }))
        );
      } catch {
        // non-fatal
      }
    }
  }

  return { ok: true as const, inserted, updated, count: inserted + updated };
}
