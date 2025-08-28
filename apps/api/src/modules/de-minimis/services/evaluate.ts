import { db, deMinimisTable } from '@clearcost/db';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { convertCurrency } from '../../fx/services/convert-currency.js';

export type DeMinimisDecision = {
  duty?: { thresholdDest: number; deMinimisBasis: 'INTRINSIC' | 'CIF'; under: boolean };
  vat?: { thresholdDest: number; deMinimisBasis: 'INTRINSIC' | 'CIF'; under: boolean };
  suppressDuty: boolean;
  suppressVAT: boolean;
};

export async function evaluateDeMinimis(opts: {
  dest: string;
  goodsDest: number; // goods value in destination currency (INTRINSIC)
  freightDest: number; // freight/insurance in destination currency (for CIF, use goods+freight)
  fxAsOf: Date;
}): Promise<DeMinimisDecision> {
  const day = new Date(opts.fxAsOf.toISOString().slice(0, 10));

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
    row?: typeof dutyRow
  ): Promise<{ thr: number; basis: 'INTRINSIC' | 'CIF' } | null> {
    if (!row) return null;
    const thr =
      row.currency === opts.dest
        ? Number(row.value)
        : await convertCurrency(Number(row.value), row.currency, opts.dest, { on: opts.fxAsOf });
    return { thr, basis: (row.deMinimisBasis as 'INTRINSIC' | 'CIF') ?? 'INTRINSIC' };
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
