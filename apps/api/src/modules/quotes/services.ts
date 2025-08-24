import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import {
  categoriesTable,
  db,
  deMinimisTable,
  dutyRatesTable,
  freightRateCardsTable,
  freightRateStepsTable,
  surchargesTable,
  vatRulesTable,
} from '@clearcost/db';
import { QuoteInput } from './schemas.js';

type VatBase = 'CIF' | 'CIF_PLUS_DUTY';

function volumetricKg({ l, w, h }: { l: number; w: number; h: number }) {
  return (l * w * h) / 5000;
}
function volumeM3({ l, w, h }: { l: number; w: number; h: number }) {
  return (l * w * h) / 1_000_000;
}

// MVP FX: 1:1 (replace later with real FX)
async function convertCurrency(amount: number, _from: string, _to: string) {
  return amount;
}

async function resolveHs6(categoryKey: string, userHs6?: string) {
  if (userHs6) return userHs6;
  const row = await db
    .select({ defaultHs6: categoriesTable.defaultHs6 })
    .from(categoriesTable)
    .where(eq(categoriesTable.key, categoryKey))
    .limit(1);
  if (!row[0]) throw new Error('Unknown category');
  return row[0].defaultHs6;
}

async function getActiveDutyRate(dest: string, hs6: string, on: Date) {
  const rows = await db
    .select({
      ratePct: dutyRatesTable.ratePct,
      rule: dutyRatesTable.rule,
      from: dutyRatesTable.effectiveFrom,
    })
    .from(dutyRatesTable)
    .where(
      and(
        eq(dutyRatesTable.dest, dest),
        eq(dutyRatesTable.hs6, hs6),
        lte(dutyRatesTable.effectiveFrom, on),
        or(isNull(dutyRatesTable.effectiveTo), gt(dutyRatesTable.effectiveTo, on))
      )
    )
    .orderBy(desc(dutyRatesTable.effectiveFrom))
    .limit(1);
  return rows[0] ?? null;
}

async function getVat(dest: string) {
  const rows = await db
    .select({ ratePct: vatRulesTable.ratePct, base: vatRulesTable.base })
    .from(vatRulesTable)
    .where(eq(vatRulesTable.dest, dest))
    .limit(1);
  return rows[0] ?? null;
}

async function getDeMinimis(dest: string) {
  const rows = await db
    .select({
      currency: deMinimisTable.currency,
      value: deMinimisTable.value,
      appliesTo: deMinimisTable.appliesTo,
    })
    .from(deMinimisTable)
    .where(eq(deMinimisTable.dest, dest))
    .limit(1);
  return rows[0] ?? null;
}

async function getFreight(opts: {
  origin: string;
  dest: string;
  mode: 'air' | 'sea';
  unit: 'kg' | 'm3';
  qty: number;
  on: Date;
}) {
  const cardRows = await db
    .select({
      id: freightRateCardsTable.id,
      currency: freightRateCardsTable.currency,
    })
    .from(freightRateCardsTable)
    .where(
      and(
        eq(freightRateCardsTable.origin, opts.origin),
        eq(freightRateCardsTable.dest, opts.dest),
        eq(freightRateCardsTable.mode, opts.mode),
        eq(freightRateCardsTable.unit, opts.unit),
        lte(freightRateCardsTable.effectiveFrom, opts.on),
        or(
          isNull(freightRateCardsTable.effectiveTo),
          gt(freightRateCardsTable.effectiveTo, opts.on)
        )
      )
    )
    .orderBy(desc(freightRateCardsTable.effectiveFrom))
    .limit(1);

  const card = cardRows[0];
  if (!card) return null;

  // Find first step where upto_qty >= qty, else largest step
  const stepCandidate = await db
    .select({ uptoQty: freightRateStepsTable.uptoQty, price: freightRateStepsTable.pricePerUnit })
    .from(freightRateStepsTable)
    .where(
      and(
        eq(freightRateStepsTable.cardId, card.id),
        sql`${freightRateStepsTable.uptoQty} >= ${opts.qty}`
      )
    )
    .orderBy(freightRateStepsTable.uptoQty)
    .limit(1);

  const step =
    stepCandidate[0] ??
    (
      await db
        .select({
          uptoQty: freightRateStepsTable.uptoQty,
          price: freightRateStepsTable.pricePerUnit,
        })
        .from(freightRateStepsTable)
        .where(eq(freightRateStepsTable.cardId, card.id))
        .orderBy(desc(freightRateStepsTable.uptoQty))
        .limit(1)
    )[0];

  if (!step) return null;

  const price = Number(step.price) * opts.qty;
  return { currency: card.currency, price };
}

async function getSurcharges(dest: string, on: Date) {
  const rows = await db
    .select({
      fixedAmt: surchargesTable.fixedAmt,
      pctAmt: surchargesTable.pctAmt,
    })
    .from(surchargesTable)
    .where(
      and(
        eq(surchargesTable.dest, dest),
        lte(surchargesTable.effectiveFrom, on),
        or(isNull(surchargesTable.effectiveTo), gt(surchargesTable.effectiveTo, on))
      )
    );
  return rows.map((r) => ({
    fixedAmt: r.fixedAmt ? Number(r.fixedAmt) : 0,
    pctAmt: r.pctAmt ? Number(r.pctAmt) : 0,
  }));
}

export async function quoteLandedCost(input: QuoteInput) {
  const now = new Date();

  const hs6 = await resolveHs6(input.categoryKey, input.userHs6);

  // chargeable metrics
  const volKg = volumetricKg(input.dimsCm);
  const chargeableKg = input.mode === 'air' ? Math.max(input.weightKg, volKg) : input.weightKg;
  const qty = input.mode === 'air' ? chargeableKg : volumeM3(input.dimsCm);
  const unit = input.mode === 'air' ? 'kg' : 'm3';

  // freight
  const freightRow = await getFreight({
    origin: input.origin,
    dest: input.dest,
    mode: input.mode,
    unit: unit as 'kg' | 'm3',
    qty,
    on: now,
  });
  const freightInDest = await convertCurrency(
    freightRow?.price ?? 0,
    input.itemValue.currency,
    input.dest
  );

  // value in dest currency
  const itemValDest = await convertCurrency(
    input.itemValue.amount,
    input.itemValue.currency,
    input.dest
  );

  const CIF = itemValDest + freightInDest;

  // de minimis
  const dem = await getDeMinimis(input.dest);
  const underDeMinimis = dem ? CIF <= Number(dem.value) : false;

  // duty
  let duty = 0;
  const dutyRow = await getActiveDutyRate(input.dest, hs6, now);
  if (!(underDeMinimis && (dem?.appliesTo === 'DUTY' || dem?.appliesTo === 'DUTY_VAT'))) {
    const rate = dutyRow ? Number(dutyRow.ratePct) : 0;
    duty = (rate / 100) * CIF; // adjust per-destination rule if you store alternate bases
  }

  // VAT
  let vat = 0;
  const vatRow = await getVat(input.dest);
  if (!(underDeMinimis && dem?.appliesTo === 'DUTY_VAT')) {
    const base: VatBase = (vatRow?.base as VatBase) ?? 'CIF_PLUS_DUTY';
    const vatBase = base === 'CIF_PLUS_DUTY' ? CIF + duty : CIF;
    vat = ((vatRow ? Number(vatRow.ratePct) : 0) / 100) * vatBase;
  }

  // surchargesTable
  const sur = await getSurcharges(input.dest, now);
  const feesFixed = sur.reduce((s, r) => s + r.fixedAmt, 0);
  const feesPct = sur.reduce((s, r) => s + r.pctAmt, 0) * (CIF / 100);
  const fees = feesFixed + feesPct;

  const total = CIF + duty + vat + fees;

  return {
    hs6,
    chargeableKg,
    freight: freightInDest,
    components: { CIF, duty, vat, fees },
    total,
    guaranteedMax: total * 1.02, // ±2% guardrail
    policy: 'We absorb the first 0.5% under-quote; beyond that we true-up post-delivery.',
  };
}
