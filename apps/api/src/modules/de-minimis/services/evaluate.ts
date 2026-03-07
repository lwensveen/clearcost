import { db, deMinimisTable } from '@clearcost/db';
import { getCurrencyForCountry, normalizeCountryIso2 } from '@clearcost/types';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { convertCurrency } from '../../fx/services/convert-currency.js';

export type DeMinimisDecision = {
  duty?: { thresholdDest: number; deMinimisBasis: 'INTRINSIC' | 'CIF'; under: boolean };
  vat?: { thresholdDest: number; deMinimisBasis: 'INTRINSIC' | 'CIF'; under: boolean };
  suppressDuty: boolean;
  suppressVAT: boolean;
};

const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));
const SOURCE_PRIORITY = ['official', 'manual', 'fallback', 'llm'] as const;
type DeMinimisSource = (typeof SOURCE_PRIORITY)[number];

function sourcePriority(source: string | null | undefined): number {
  const normalized = String(source ?? '')
    .trim()
    .toLowerCase() as DeMinimisSource;
  const idx = SOURCE_PRIORITY.indexOf(normalized);
  return idx === -1 ? SOURCE_PRIORITY.length : idx;
}

function pickPreferredThresholdRow(
  rows: Array<(typeof deMinimisTable)['$inferSelect']>,
  kind: 'DUTY' | 'VAT'
): (typeof deMinimisTable)['$inferSelect'] | undefined {
  const candidates = rows.filter((row) => row.deMinimisKind === kind);
  if (candidates.length <= 1) return candidates[0];

  candidates.sort((a, b) => {
    const rankDelta = sourcePriority(a.source) - sourcePriority(b.source);
    if (rankDelta !== 0) return rankDelta;
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
  });
  return candidates[0];
}

function resolveDestinationCurrency(destCountryIso2: string, explicitCurrency?: string): string {
  const explicit = explicitCurrency?.trim().toUpperCase();
  if (explicit) {
    if (!/^[A-Z]{3}$/.test(explicit)) {
      throw Object.assign(new Error(`Invalid destination currency code: ${explicit}`), {
        statusCode: 400,
        code: 'DEST_CURRENCY_INVALID',
      });
    }
    return explicit;
  }

  const countryIso2 = normalizeCountryIso2(destCountryIso2) ?? destCountryIso2.toUpperCase();
  const mapped = getCurrencyForCountry(countryIso2);
  if (mapped) return mapped;

  throw Object.assign(
    new Error(`No ISO-4217 currency mapping configured for destination country ${countryIso2}`),
    {
      statusCode: 400,
      code: 'DEST_CURRENCY_UNMAPPED',
    }
  );
}

export async function evaluateDeMinimis(opts: {
  dest: string; // ISO country (for table filter)
  destCurrency?: string; // ISO-4217 for destination currency (NEW, optional)
  goodsDest: number; // goods value in destination currency (intrinsic)
  freightDest: number; // freight/insurance in destination currency (for CIF add to goods)
  fxAsOf: Date; // FX date for converting thresholds -> destCurrency
  officialOnly?: boolean; // restrict threshold selection to official rows
}): Promise<DeMinimisDecision> {
  const day = toMidnightUTC(opts.fxAsOf);
  const destCountryIso2 = normalizeCountryIso2(opts.dest) ?? opts.dest.toUpperCase();
  const destCurrency = resolveDestinationCurrency(destCountryIso2, opts.destCurrency);

  const rows = await db
    .select()
    .from(deMinimisTable)
    .where(
      and(
        eq(deMinimisTable.dest, destCountryIso2),
        opts.officialOnly ? eq(deMinimisTable.source, 'official') : undefined,
        lte(deMinimisTable.effectiveFrom, day),
        or(isNull(deMinimisTable.effectiveTo), gte(deMinimisTable.effectiveTo, day))
      )
    )
    .orderBy(desc(deMinimisTable.effectiveFrom));

  const candidateRows = opts.officialOnly ? rows.filter((row) => row.source === 'official') : rows;
  const dutyRow = pickPreferredThresholdRow(candidateRows, 'DUTY');
  const vatRow = pickPreferredThresholdRow(candidateRows, 'VAT');

  async function toDest(
    row?: (typeof rows)[number]
  ): Promise<{ thr: number; basis: 'INTRINSIC' | 'CIF' } | null> {
    if (!row) return null;

    const rowCurrency = String(row.currency).toUpperCase();
    const rawVal = Number(row.value); // DB numeric -> string; coerce to number
    if (!Number.isFinite(rawVal)) {
      throw new Error(`Invalid de minimis threshold value for ${destCountryIso2} (${rowCurrency})`);
    }

    let thr = rawVal;
    if (rowCurrency !== destCurrency) {
      try {
        thr = await convertCurrency(rawVal, rowCurrency, destCurrency, { on: day, strict: true });
      } catch (error: unknown) {
        throw Object.assign(
          new Error(
            `Unable to convert de minimis threshold ${rowCurrency}->${destCurrency} for ${destCountryIso2}`
          ),
          {
            statusCode: 500,
            code: 'DE_MINIMIS_FX_UNAVAILABLE',
            cause: error,
          }
        );
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
