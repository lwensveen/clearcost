import { db, deMinimisTable } from '@clearcost/db';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { convertCurrency } from '../../fx/services/convert-currency.js';

export type DeMinimisDecision = {
  duty?: { thresholdDest: number; deMinimisBasis: 'INTRINSIC' | 'CIF'; under: boolean };
  vat?: { thresholdDest: number; deMinimisBasis: 'INTRINSIC' | 'CIF'; under: boolean };
  suppressDuty: boolean;
  suppressVAT: boolean;
};

const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

export async function evaluateDeMinimis(opts: {
  dest: string; // ISO country (for table filter)
  destCurrency?: string; // ISO-4217 for destination currency (NEW, optional)
  goodsDest: number; // goods value in destination currency (intrinsic)
  freightDest: number; // freight/insurance in destination currency (for CIF add to goods)
  fxAsOf: Date; // FX date for converting thresholds -> destCurrency
}): Promise<DeMinimisDecision> {
  const day = toMidnightUTC(opts.fxAsOf);
  const destCurrency = (opts.destCurrency ?? opts.dest).toUpperCase(); // fallback to old behavior

  const rows = await db
    .select()
    .from(deMinimisTable)
    .where(
      and(
        eq(deMinimisTable.dest, opts.dest.toUpperCase()),
        lte(deMinimisTable.effectiveFrom, day),
        or(isNull(deMinimisTable.effectiveTo), gte(deMinimisTable.effectiveTo, day))
      )
    )
    .orderBy(desc(deMinimisTable.effectiveFrom));

  const dutyRow = rows.find((r) => r.deMinimisKind === 'DUTY');
  const vatRow = rows.find((r) => r.deMinimisKind === 'VAT');

  async function toDest(
    row?: (typeof rows)[number]
  ): Promise<{ thr: number; basis: 'INTRINSIC' | 'CIF' } | null> {
    if (!row) return null;

    const rowCurrency = String(row.currency).toUpperCase();
    const rawVal = Number(row.value); // DB numeric -> string; coerce to number
    if (!Number.isFinite(rawVal)) return null;

    let thr = rawVal;
    if (rowCurrency !== destCurrency) {
      try {
        thr = await convertCurrency(rawVal, rowCurrency, destCurrency, { on: day });
      } catch {
        // If FX fails, treat as no threshold (can't reliably compare)
        return null;
      }
    }

    const basis = (row.deMinimisBasis as 'INTRINSIC' | 'CIF') ?? 'INTRINSIC';
    return { thr, basis };
  }

  const [duty, vat] = await Promise.all([toDest(dutyRow), toDest(vatRow)]);

  const valueFor = (basis: 'INTRINSIC' | 'CIF') =>
    basis === 'CIF' ? opts.goodsDest + opts.freightDest : opts.goodsDest;

  const dutyUnder = duty ? valueFor(duty.basis) <= duty.thr : false;
  const vatUnder = vat ? valueFor(vat.basis) <= vat.thr : false;

  return {
    duty: duty
      ? { thresholdDest: duty.thr, deMinimisBasis: duty.basis, under: dutyUnder }
      : undefined,
    vat: vat ? { thresholdDest: vat.thr, deMinimisBasis: vat.basis, under: vatUnder } : undefined,
    suppressDuty: dutyUnder,
    suppressVAT: vatUnder,
  };
}
