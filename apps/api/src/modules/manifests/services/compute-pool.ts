import {
  db,
  manifestItemQuotesTable,
  manifestItemsTable,
  manifestQuotesTable,
  manifestsTable,
} from '@clearcost/db';
import { getCurrencyForCountry } from '@clearcost/types';
import { eq } from 'drizzle-orm';
import { quoteLandedCost } from '../../quotes/services/quote-landed-cost.js';
import { safeNumeric } from '../../../lib/numeric.js';
import { volumetricKg, volumeM3 } from '../../quotes/utils.js';

/** Simple concurrency limiter (like p-limit) to cap parallel async work. */
function pLimit(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (queue.length > 0 && active < concurrency) {
      active++;
      queue.shift()!();
    }
  };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      };
      queue.push(run);
      next();
    });
}

type AllocationMode = 'chargeable' | 'volumetric' | 'weight';
type ComputePoolOpts = {
  allocation?: AllocationMode; // default: air→chargeable, sea→volumetric
  dryRun?: boolean; // if true, computes but does not insert
};

/**
 * Compute pooled quotes for a manifest by allocating a fixed freight budget across items.
 * - Uses chargeable kg for AIR, m3 for SEA (defaults; override via opts.allocation)
 * - Calls quote engine with `freightInDestOverride` per item
 * - Writes manifest_item_quotes (+ rolled-up manifest_quotes) unless dryRun=true
 */
export async function computePool(manifestId: string, opts: ComputePoolOpts = {}) {
  const manifest = await db.query.manifestsTable.findFirst({
    where: eq(manifestsTable.id, manifestId),
  });
  if (!manifest) throw new Error('Manifest not found');

  const { origin, dest, shippingMode } = manifest;
  const currency = getCurrencyForCountry(dest);
  if (!currency) {
    throw new Error(`No ISO-4217 currency mapping configured for destination country ${dest}`);
  }
  const fixedFreightTotal = Number(manifest.fixedFreightTotal ?? 0);
  if (!Number.isFinite(fixedFreightTotal) || fixedFreightTotal < 0) {
    throw new Error('Manifest.fixedFreightTotal required for pooled compute');
  }

  const items = await db
    .select()
    .from(manifestItemsTable)
    .where(eq(manifestItemsTable.manifestId, manifestId))
    .limit(5000);

  if (items.length === 0) {
    return { ok: true as const, manifestId, insertedItems: 0, insertedRollup: 0, totals: null };
  }

  const allocation: AllocationMode =
    opts.allocation ??
    (shippingMode === 'air' ? 'chargeable' : shippingMode === 'sea' ? 'volumetric' : 'weight');

  const enriched = items.map((it) => {
    const dims = it.dimsCm ?? { l: 0, w: 0, h: 0 };
    const wKg = safeNumeric(it.weightKg);
    const quantityRaw = Number(it.quantity ?? NaN);
    const litersRaw = Number(it.liters ?? NaN);
    const volKg = volumetricKg(dims);
    const chgKg = shippingMode === 'air' ? Math.max(wKg, volKg) : wKg;
    const m3 = volumeM3(dims);

    const basis = allocation === 'chargeable' ? chgKg : allocation === 'volumetric' ? m3 : wKg;

    return {
      ...it,
      dims,
      weightKgNum: wKg,
      quantityNum: Number.isFinite(quantityRaw) && quantityRaw >= 0 ? quantityRaw : undefined,
      litersNum: Number.isFinite(litersRaw) && litersRaw >= 0 ? litersRaw : undefined,
      chargeableKg: chgKg,
      m3,
      basis,
    };
  });

  const totalBasis = enriched.reduce((s, r) => s + (Number.isFinite(r.basis) ? r.basis : 0), 0);
  if (!Number.isFinite(totalBasis) || totalBasis <= 0) {
    throw new Error('Allocation basis total is zero; check item weights/dimensions');
  }

  const shares: number[] = [];
  let running = 0;
  for (let i = 0; i < enriched.length; i++) {
    const isLast = i === enriched.length - 1;
    const raw = (enriched[i]!.basis / totalBasis) * fixedFreightTotal;
    const share = isLast
      ? Number((fixedFreightTotal - running).toFixed(2))
      : Number(raw.toFixed(2));
    shares.push(share);
    running += share;
  }

  const now = new Date();
  const limit = pLimit(5); // 5 concurrent quote computations

  const itemResults = await Promise.all(
    enriched.map((it, i) =>
      limit(async () => {
        const freightShare = shares[i]!;

        const res = await quoteLandedCost(
          {
            origin,
            dest,
            mode: shippingMode,
            itemValue: {
              amount: safeNumeric(it.itemValueAmount),
              currency: String(it.itemValueCurrency ?? 'USD'),
            },
            dimsCm: {
              l: Number(it.dims.l ?? 0),
              w: Number(it.dims.w ?? 0),
              h: Number(it.dims.h ?? 0),
            },
            weightKg: it.weightKgNum,
            quantity: it.quantityNum,
            liters: it.litersNum,
            categoryKey: String(it.categoryKey ?? ''),
            hs6: it.hs6 ? String(it.hs6) : undefined,
          },
          { freightInDestOverride: freightShare, fxAsOf: now }
        );

        const q = res.quote;

        return {
          itemId: it.id,
          hs6: q.hs6,
          chargeableKg: q.chargeableKg,
          freightShare,
          components: q.components,
          total: q.total,
          guaranteedMax: q.guaranteedMax,
          currency,
        };
      })
    )
  );

  let insertedItemRows = 0;
  let insertedRollupRows = 0;

  if (!opts.dryRun) {
    await db.transaction(async (tx) => {
      await tx
        .delete(manifestItemQuotesTable)
        .where(eq(manifestItemQuotesTable.manifestId, manifestId));

      const insertRows = itemResults.map((r) => ({
        manifestId,
        itemId: r.itemId,
        currency,
        hs6: r.hs6,
        basis: String(enriched.find((x) => x.id === r.itemId)!.basis),
        chargeableKg: String(r.chargeableKg),
        freightShare: String(r.freightShare),
        components: r.components,
        total: String(r.total),
        guaranteedMax: String(r.guaranteedMax),
        // incoterm defaults to DAP per schema
      }));
      if (insertRows.length) {
        await tx.insert(manifestItemQuotesTable).values(insertRows);
      }
      insertedItemRows = insertRows.length;

      const itemsCount = itemResults.length;
      const freightTotal = itemResults.reduce((s, r) => s + r.freightShare, 0);
      const dutyTotal = itemResults.reduce((s, r) => s + (r.components.duty ?? 0), 0);
      const vatTotal = itemResults.reduce((s, r) => s + (r.components.vat ?? 0), 0);
      const feesTotal = itemResults.reduce((s, r) => s + (r.components.fees ?? 0), 0);
      const checkoutVatTotal = itemResults.reduce((s, r) => s + (r.components.checkoutVAT ?? 0), 0);
      const grandTotal = itemResults.reduce((s, r) => s + r.total, 0);

      await tx.insert(manifestQuotesTable).values({
        manifestId,
        currency,
        itemsCount: String(itemsCount), // <-- numeric fields as strings
        freightTotal: String(freightTotal),
        dutyTotal: String(dutyTotal),
        vatTotal: String(vatTotal),
        feesTotal: String(feesTotal),
        checkoutVatTotal: checkoutVatTotal ? String(checkoutVatTotal) : null,
        grandTotal: String(grandTotal),
      });
      insertedRollupRows++;
    });
  }

  const summary = {
    itemsCount: itemResults.length,
    freightTotal: Number(fixedFreightTotal.toFixed(2)),
    dutyTotal: Number(itemResults.reduce((s, r) => s + (r.components.duty ?? 0), 0).toFixed(2)),
    vatTotal: Number(itemResults.reduce((s, r) => s + (r.components.vat ?? 0), 0).toFixed(2)),
    feesTotal: Number(itemResults.reduce((s, r) => s + (r.components.fees ?? 0), 0).toFixed(2)),
    checkoutVatTotal: Number(
      itemResults.reduce((s, r) => s + (r.components.checkoutVAT ?? 0), 0).toFixed(2)
    ),
    grandTotal: Number(itemResults.reduce((s, r) => s + r.total, 0).toFixed(2)),
    currency,
  };

  return {
    ok: true as const,
    manifestId,
    allocation,
    insertedItems: insertedItemRows,
    insertedRollup: insertedRollupRows,
    totals: summary,
    items: opts.dryRun ? itemResults : undefined,
  };
}
