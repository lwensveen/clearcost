import { QuoteInput } from '../schemas.js';
import { db, merchantProfilesTable, taxRegistrationsTable } from '@clearcost/db';
import { and, eq } from 'drizzle-orm';
import { EU_ISO2, volumeM3, volumetricKg } from '../utils.js';
import { getFreight } from './get-freight.js';
import { resolveHs6 } from './resolve-hs6.js';
import { convertCurrency } from './convert-currency.js';
import { getDeMinimis } from './get-de-minimis.js';
import { getActiveDutyRate } from './get-active-duty-rate.js';
import { getVat } from './get-vat.js';
import { getSurcharges } from './get-surcharges.js';

export async function quoteLandedCost(input: QuoteInput & { merchantId?: string }) {
  const now = new Date();

  const merchantId = input.merchantId;
  const profile = merchantId
    ? (
        await db
          .select()
          .from(merchantProfilesTable)
          .where(eq(merchantProfilesTable.ownerId, merchantId))
          .limit(1)
      )[0]
    : undefined;

  const regs = merchantId
    ? await db
        .select()
        .from(taxRegistrationsTable)
        .where(
          and(
            eq(taxRegistrationsTable.ownerId, merchantId),
            eq(taxRegistrationsTable.isActive as any, 'true')
          )
        )
    : [];

  const wantsCheckoutVAT =
    (profile?.collectVatAtCheckout ?? 'auto') !== 'never' &&
    EU_ISO2.has(input.dest) &&
    regs.some((r) => r.jurisdiction === 'EU' && r.scheme.toUpperCase() === 'IOSS');

  const hs6 = await resolveHs6(input.categoryKey, input.userHs6);

  const volKg = volumetricKg(input.dimsCm);
  const chargeableKg = input.mode === 'air' ? Math.max(input.weightKg, volKg) : input.weightKg;
  const qty = input.mode === 'air' ? chargeableKg : volumeM3(input.dimsCm);
  const unit = input.mode === 'air' ? 'kg' : 'm3';

  const freightRow = await getFreight({
    origin: input.origin,
    dest: input.dest,
    mode: input.mode,
    unit: unit as any,
    qty,
    on: now,
  });
  const freightInDest = await convertCurrency(
    freightRow?.price ?? 0,
    input.itemValue.currency,
    input.dest
  );

  const itemValDest = await convertCurrency(
    input.itemValue.amount,
    input.itemValue.currency,
    input.dest
  );
  const CIF = itemValDest + freightInDest;

  const dem = await getDeMinimis(input.dest);
  const underDeMinimis = dem ? CIF <= Number(dem.value) : false;

  const dutyRow = await getActiveDutyRate(input.dest, hs6, now);
  const vatRow = await getVat(input.dest);

  let duty = 0;
  if (!(underDeMinimis && (dem?.appliesTo === 'DUTY' || dem?.appliesTo === 'DUTY_VAT'))) {
    const rate = dutyRow ? Number(dutyRow.ratePct) : 0;
    duty = (rate / 100) * CIF;
  }

  const itemValEUR = await convertCurrency(itemValDest, input.dest, 'EUR');
  const iossEligible = wantsCheckoutVAT && itemValEUR <= 150;

  let vat = 0;
  let checkoutVAT = 0;

  if (iossEligible) {
    const checkoutVatRate = (vatRow ? Number(vatRow.ratePct) : 0) / 100;
    checkoutVAT = checkoutVatRate * itemValDest;
    vat = 0;
  } else {
    if (!(underDeMinimis && dem?.appliesTo === 'DUTY_VAT')) {
      const base = (vatRow?.base as 'CIF' | 'CIF_PLUS_DUTY') ?? 'CIF_PLUS_DUTY';
      const vatBase = base === 'CIF_PLUS_DUTY' ? CIF + duty : CIF;
      vat = ((vatRow ? Number(vatRow.ratePct) : 0) / 100) * vatBase;
    }
  }

  const sur = await getSurcharges(input.dest, now);
  const feesFixed = sur.reduce((s, r) => s + r.fixedAmt, 0);
  const feesPct = sur.reduce((s, r) => s + r.pctAmt, 0) * (CIF / 100);
  const fees = feesFixed + feesPct;

  const incoterm = (profile?.defaultIncoterm ?? 'DAP').toUpperCase() as 'DDP' | 'DAP';

  const total = CIF + duty + vat + fees + checkoutVAT;

  return {
    hs6,
    chargeableKg,
    freight: freightInDest,
    components: { CIF, duty, vat, fees, ...(checkoutVAT ? { checkoutVAT } : {}) },
    total,
    guaranteedMax: total * 1.02,
    policy: iossEligible
      ? 'IOSS: VAT collected at checkout; no import VAT due.'
      : 'Standard import tax rules apply.',
    incoterm,
  };
}
