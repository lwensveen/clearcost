import { db, provenanceTable, surchargesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { sha256Hex } from '../../../../lib/provenance.js';
import type { SurchargeInsert } from '@clearcost/types';
import type { LlmSurcharge } from './schema.js';

const up2 = (s?: string | null) => (s ? s.trim().toUpperCase() : null);
const onlyHs6 = (v?: string | null) => {
  if (!v) return null;
  const s = String(v).replace(/\D+/g, '').slice(0, 6);
  return s.length === 6 ? s : null;
};
const toDate = (s: string) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const numStr = (v: unknown) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? String(n) : null;
};
const hasNumeric = (v: unknown) => {
  if (v == null || v === '') return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n);
};
function parseCurrency(raw: string | null | undefined, rowLabel: string, required: boolean) {
  const ccy = up2(raw);
  if (!ccy) {
    if (required) {
      throw new Error(
        `[Surcharge LLM import] Currency is required for monetary surcharge row ${rowLabel}.`
      );
    }
    return undefined;
  }
  if (!/^[A-Z]{3}$/.test(ccy)) {
    throw new Error(`[Surcharge LLM import] Invalid currency code "${ccy}" at ${rowLabel}.`);
  }
  return ccy;
}

function coerceTransportMode(v?: string | null): SurchargeInsert['transportMode'] {
  const t = String(v || 'ALL').toUpperCase();
  if (t === 'ALL' || t === 'AIR' || t === 'OCEAN' || t === 'TRUCK' || t === 'RAIL' || t === 'BARGE')
    return t as SurchargeInsert['transportMode'];
  return 'ALL';
}
function coerceApplyLevel(v?: string | null): SurchargeInsert['applyLevel'] {
  const t = String(v || 'entry').toLowerCase();
  if (t === 'entry' || t === 'line' || t === 'shipment' || t === 'program')
    return t as SurchargeInsert['applyLevel'];
  return 'entry';
}
function coerceRateType(v?: string | null): SurchargeInsert['rateType'] {
  const t = String(v || 'ad_valorem').toLowerCase();
  if (t === 'ad_valorem' || t === 'fixed' || t === 'per_unit') {
    return t as SurchargeInsert['rateType'];
  }
  if (t === 'unit') return 'per_unit';
  return 'ad_valorem';
}
function coerceValueBasis(v?: string | null): SurchargeInsert['valueBasis'] {
  const t = String(v || 'customs').toLowerCase();
  if (
    t === 'customs' ||
    t === 'fob' ||
    t === 'cif' ||
    t === 'entered' ||
    t === 'duty' ||
    t === 'other'
  )
    return t as SurchargeInsert['valueBasis'];
  return 'customs';
}
function coerceSurchargeCode(v?: string | null): SurchargeInsert['surchargeCode'] {
  const t = String(v || 'OTHER').toUpperCase();
  return t as SurchargeInsert['surchargeCode'];
}

const keyOf = (p: {
  dest: string;
  origin?: string | null;
  hs6?: string | null;
  transportMode?: string | null;
  applyLevel?: string | null;
  surchargeCode?: string | null;
  effectiveFrom: Date;
}) =>
  [
    p.dest.toUpperCase(),
    (p.origin || '').toUpperCase(),
    p.hs6 || '',
    String(p.transportMode ?? ''),
    String(p.applyLevel ?? ''),
    String(p.surchargeCode ?? ''),
    p.effectiveFrom.toISOString().slice(0, 10),
  ].join('|');

export async function importSurchargesFromLLM(
  rows: LlmSurcharge[],
  opts: {
    importId?: string;
    getSourceRef?: (row: LlmSurcharge) => string | undefined;
  } = {}
): Promise<{ ok: true; inserted: number; updated: number; count: number }> {
  if (!rows?.length) {
    throw new Error('[Surcharge LLM import] source produced 0 rows.');
  }

  const values: SurchargeInsert[] = [];
  const srcByKey = new Map<string, string | undefined>();

  for (const r of rows) {
    const rateType = coerceRateType(r.rate_type);
    const rowLabel = `dest=${up2(r.country_code) ?? String(r.country_code)}:code=${String(r.surcharge_code)}:rateType=${String(rateType)}`;
    const requiresCurrency =
      rateType === 'fixed' ||
      rateType === 'per_unit' ||
      hasNumeric(r.fixed_amount) ||
      hasNumeric(r.min_amount) ||
      hasNumeric(r.max_amount) ||
      hasNumeric(r.unit_amount);
    const currency = parseCurrency(r.currency ?? null, rowLabel, requiresCurrency);
    const v: SurchargeInsert = {
      dest: up2(r.country_code)!,
      origin: up2(r.origin_code ?? null) ?? null,
      hs6: onlyHs6(r.hs6 ?? null),

      surchargeCode: coerceSurchargeCode(r.surcharge_code),
      rateType,
      applyLevel: coerceApplyLevel(r.apply_level),
      valueBasis: coerceValueBasis(r.value_basis),
      transportMode: coerceTransportMode(r.transport_mode),

      currency,
      // map correct LLM field names → DB numeric strings
      fixedAmt: numStr(r.fixed_amount) ?? null,
      pctAmt: numStr(r.pct_decimal) ?? null, // 0..1 decimal
      minAmt: numStr(r.min_amount) ?? null,
      maxAmt: numStr(r.max_amount) ?? null,
      unitAmt: numStr(r.unit_amount) ?? null,
      unitCode: up2(r.unit_code ?? null),

      sourceUrl: r.source_url || null,
      sourceRef: null, // keep column empty; provenance carries the external URL
      notes: r.notes ?? null,

      effectiveFrom: toDate(r.effective_from),
      effectiveTo: r.effective_to ? toDate(r.effective_to) : null,
    };

    values.push(v);

    srcByKey.set(
      keyOf({
        dest: v.dest,
        origin: v.origin ?? null,
        hs6: v.hs6 ?? null,
        transportMode: v.transportMode,
        applyLevel: v.applyLevel,
        surchargeCode: v.surchargeCode,
        effectiveFrom: v.effectiveFrom as Date,
      }),
      opts.getSourceRef?.(r)
    );
  }

  const ret = await db
    .insert(surchargesTable)
    .values(values)
    .onConflictDoUpdate({
      target: [
        surchargesTable.dest,
        surchargesTable.origin,
        surchargesTable.hs6,
        surchargesTable.transportMode,
        surchargesTable.applyLevel,
        surchargesTable.surchargeCode,
        surchargesTable.effectiveFrom,
      ],
      set: {
        fixedAmt: sql`EXCLUDED.fixed_amt`,
        pctAmt: sql`EXCLUDED.pct_amt`,
        minAmt: sql`EXCLUDED.min_amt`,
        maxAmt: sql`EXCLUDED.max_amt`,
        unitAmt: sql`EXCLUDED.unit_amt`,
        unitCode: sql`EXCLUDED.unit_code`,
        currency: sql`EXCLUDED.currency`,
        rateType: sql`EXCLUDED.rate_type`,
        valueBasis: sql`EXCLUDED.value_basis`,
        sourceUrl: sql`EXCLUDED.source_url`,
        sourceRef: sql`EXCLUDED.source_ref`,
        notes: sql`EXCLUDED.notes`,
        effectiveTo: sql`EXCLUDED.effective_to`,
        updatedAt: sql`now()`,
      },
    })
    .returning({
      id: surchargesTable.id,
      inserted: sql<number>`(xmax = 0)::int`,
      dest: surchargesTable.dest,
      origin: surchargesTable.origin,
      hs6: surchargesTable.hs6,
      surchargeCode: surchargesTable.surchargeCode,
      rateType: surchargesTable.rateType,
      applyLevel: surchargesTable.applyLevel,
      valueBasis: surchargesTable.valueBasis,
      transportMode: surchargesTable.transportMode,
      currency: surchargesTable.currency,
      fixedAmt: surchargesTable.fixedAmt,
      pctAmt: surchargesTable.pctAmt,
      minAmt: surchargesTable.minAmt,
      maxAmt: surchargesTable.maxAmt,
      unitAmt: surchargesTable.unitAmt,
      unitCode: surchargesTable.unitCode,
      effectiveFrom: surchargesTable.effectiveFrom,
      effectiveTo: surchargesTable.effectiveTo,
      notes: surchargesTable.notes,
    });

  let inserted = 0;
  let updated = 0;

  if (opts.importId && ret.length) {
    const provRows = ret.map((row) => {
      if (row.inserted === 1) inserted++;
      else updated++;

      const k = keyOf({
        dest: row.dest,
        origin: row.origin ?? null,
        hs6: row.hs6 ?? null,
        transportMode: String(row.transportMode),
        applyLevel: String(row.applyLevel),
        surchargeCode: String(row.surchargeCode),
        effectiveFrom: row.effectiveFrom as Date,
      });
      const sourceRef = srcByKey.get(k);

      return {
        importId: opts.importId!,
        resourceType: 'surcharge' as const,
        resourceId: row.id,
        sourceRef: sourceRef ? sourceRef.slice(0, 255) : undefined,
        rowHash: sha256Hex(
          JSON.stringify({
            dest: row.dest,
            origin: row.origin ?? null,
            hs6: row.hs6 ?? null,
            code: row.surchargeCode,
            rateType: row.rateType,
            applyLevel: row.applyLevel,
            valueBasis: row.valueBasis,
            transportMode: row.transportMode,
            currency: row.currency,
            fixedAmt: row.fixedAmt,
            pctAmt: row.pctAmt,
            minAmt: row.minAmt,
            maxAmt: row.maxAmt,
            unitAmt: row.unitAmt,
            unitCode: row.unitCode ?? null,
            ef: iso(row.effectiveFrom),
            et: iso(row.effectiveTo),
            notes: row.notes ?? null,
          })
        ),
      };
    });

    try {
      await db.insert(provenanceTable).values(provRows);
    } catch {
      // non-fatal
    }
  } else {
    for (const r of ret) {
      if (r.inserted === 1) {
        inserted++;
      } else updated++;
    }
  }

  return { ok: true as const, inserted, updated, count: inserted + updated };
}
