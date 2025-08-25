import { QuoteInput } from '../schemas.js';
import { db, merchantProfilesTable, taxRegistrationsTable } from '@clearcost/db';
import { and, eq } from 'drizzle-orm';
import { EU_ISO2, volumeM3, volumetricKg } from '../utils.js';
import { resolveHs6 } from '../../hs-codes/services/resolve-hs6.js';
import { convertCurrency } from '../../fx/services/convert-currency.js';
import { getDeMinimis } from '../../de-minimis/services/get-de-minimis.js';
import { getActiveDutyRate } from '../../duty-rates/services/get-active-duty-rate.js';
import { getSurcharges } from '../../surcharges/services/get-surcharges.js';
import { getFreight } from '../../freight/services/get-freight.js';
import { getVat } from '../../vat/services/get-vat.js';

type Unit = 'kg' | 'm3';
const BASE_CCY = process.env.CURRENCY_BASE ?? 'USD';

const roundMoney = (n: number, ccy: string) => {
  const dp = ccy === 'JPY' ? 0 : 2;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

export async function quoteLandedCost(input: QuoteInput & { merchantId?: string }) {
  const now = new Date();

  const [profile, regs] = await Promise.all([
    input.merchantId
      ? db
          .select()
          .from(merchantProfilesTable)
          .where(eq(merchantProfilesTable.ownerId, input.merchantId))
          .limit(1)
          .then((r) => r[0])
      : Promise.resolve(undefined),
    input.merchantId
      ? db
          .select()
          .from(taxRegistrationsTable)
          .where(
            and(
              eq(taxRegistrationsTable.ownerId, input.merchantId),
              eq(taxRegistrationsTable.isActive, true)
            )
          )
      : Promise.resolve([] as Array<{ jurisdiction: string; scheme: string }>),
  ]);

  const wantsCheckoutVAT =
    (profile?.collectVatAtCheckout ?? 'auto') !== 'never' &&
    EU_ISO2.has(input.dest) &&
    regs.some((r) => r.jurisdiction === 'EU' && r.scheme?.toUpperCase() === 'IOSS');

  const hs6 = await resolveHs6(input.categoryKey, input.userHs6);

  const volKg = volumetricKg(input.dimsCm);
  const chargeableKg = input.mode === 'air' ? Math.max(input.weightKg, volKg) : input.weightKg;
  const qty = input.mode === 'air' ? chargeableKg : volumeM3(input.dimsCm);
  const unit: Unit = input.mode === 'air' ? 'kg' : 'm3';

  const freightRow = await getFreight({
    origin: input.origin,
    dest: input.dest,
    mode: input.mode,
    unit,
    qty,
    on: now,
  });

  const freightInDest = await convertCurrency(freightRow?.price ?? 0, BASE_CCY, input.dest);

  const itemValDest = await convertCurrency(
    input.itemValue.amount,
    input.itemValue.currency,
    input.dest
  );
  const CIF = itemValDest + freightInDest;

  const dem = await getDeMinimis(input.dest);
  const demValueDest = dem
    ? dem.currency === input.dest
      ? Number(dem.value)
      : await convertCurrency(Number(dem.value), dem.currency, input.dest)
    : null;
  const underDeMinimis = demValueDest != null ? CIF <= demValueDest : false;

  const dutyRow = await getActiveDutyRate(input.dest, hs6, now);
  const vatRow = await getVat(input.dest, now);

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
    const checkoutRate = (vatRow ? Number(vatRow.ratePct) : 0) / 100;
    const chargeShippingAtCheckout = profile?.chargeShippingAtCheckout ?? false;
    const checkoutVatBase = itemValDest + (chargeShippingAtCheckout ? freightInDest : 0);
    checkoutVAT = checkoutRate * checkoutVatBase;
  } else {
    if (!(underDeMinimis && dem?.appliesTo === 'DUTY_VAT')) {
      const base = (vatRow?.base as 'CIF' | 'CIF_PLUS_DUTY') ?? 'CIF_PLUS_DUTY';
      const vatBase = base === 'CIF_PLUS_DUTY' ? CIF + duty : CIF;
      vat = ((vatRow ? Number(vatRow.ratePct) : 0) / 100) * vatBase;
    }
  }

  const sur = await getSurcharges(input.dest, now);
  const feesFixed = sur.reduce((s, r) => s + (r.fixedAmt ?? 0), 0);
  const feesPct = sur.reduce((s, r) => s + (r.pctAmt ?? 0), 0) * (CIF / 100);
  const fees = feesFixed + feesPct;

  const incoterm = (profile?.defaultIncoterm ?? 'DAP').toUpperCase() as 'DDP' | 'DAP';

  const currency = input.dest;
  const components = {
    CIF: roundMoney(CIF, currency),
    duty: roundMoney(duty, currency),
    vat: roundMoney(vat, currency),
    fees: roundMoney(fees, currency),
    ...(checkoutVAT ? { checkoutVAT: roundMoney(checkoutVAT, currency) } : {}),
  };
  const total = roundMoney(
    components.CIF +
      components.duty +
      components.vat +
      components.fees +
      (components.checkoutVAT ?? 0),
    currency
  );

  return {
    hs6,
    currency,
    chargeableKg,
    freight: components.CIF - itemValDest,
    components,
    total,
    guaranteedMax: roundMoney(total * 1.02, currency),
    policy: iossEligible
      ? 'IOSS: VAT collected at checkout; no import VAT due.'
      : 'Standard import tax rules apply.',
    incoterm,
  };
}
