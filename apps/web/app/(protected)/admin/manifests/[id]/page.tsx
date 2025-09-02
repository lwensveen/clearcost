import { fetchManifestFull, fetchManifestQuote } from '@/lib/manifest';
import { ComputeButton } from '@/components/manifest/ComputeButton';
import { ImportCsvForm } from '@/components/manifest/ImportCsvForm';
import { ReplaceItemsPanel } from '@/components/manifest/ReplaceItemsPanel';
import { fetchBillingPlan } from '@/lib/billing';
import { ComputeQuotaHint } from '@/components/manifest/ComputeQuotaHint';
import { ManifestHeaderActions } from '@/components/manifest/ManifestHeaderActions';
import { FixedPricingInline } from '@/components/manifest/FixedPricingInline';
import { InlineItemsTable } from '@/components/manifest/InlineItemsTable';

type Props = { params: Promise<{ id: string }> };
export const revalidate = 0;

export default async function ManifestDetailPage({ params }: Props) {
  const { id } = await params;
  const [full, quote, plan] = await Promise.all([
    fetchManifestFull(id),
    fetchManifestQuote(id),
    fetchBillingPlan(),
  ]);

  const m = full?.manifest;
  const items = full?.items ?? [];
  const s = quote?.summary;

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{m?.name ?? `Manifest ${id}`}</h1>

        <div className="flex items-center gap-3">
          <a className="px-3 py-2 rounded border text-sm" href={`/api/cc/manifest/${id}/items-csv`}>
            Export CSV
          </a>
          <ComputeQuotaHint />
          <ComputeButton id={id} plan={plan?.plan} />
          <ManifestHeaderActions id={id} currentName={m?.name} />
        </div>
      </div>

      {m?.pricingMode === 'fixed' && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Fixed freight</h2>
          <FixedPricingInline
            id={id}
            fixedFreightTotal={m.fixedFreightTotal as any}
            fixedFreightCurrency={m.fixedFreightCurrency as any}
          />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Summary</h2>
        {!s ? (
          <p className="text-neutral-500">No quote yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 border rounded">
              <div className="text-xs text-neutral-500">Items</div>
              <div className="font-semibold">{s.itemsCount}</div>
            </div>
            <div className="p-3 border rounded">
              <div className="text-xs text-neutral-500">Freight</div>
              <div className="font-semibold">
                {s.freight.toFixed(2)} {s.currency ?? ''}
              </div>
            </div>
            <div className="p-3 border rounded">
              <div className="text-xs text-neutral-500">Duty</div>
              <div className="font-semibold">
                {s.duty.toFixed(2)} {s.currency ?? ''}
              </div>
            </div>
            <div className="p-3 border rounded">
              <div className="text-xs text-neutral-500">VAT</div>
              <div className="font-semibold">
                {s.vat.toFixed(2)} {s.currency ?? ''}
              </div>
            </div>
            <div className="p-3 border rounded">
              <div className="text-xs text-neutral-500">Fees</div>
              <div className="font-semibold">
                {s.fees.toFixed(2)} {s.currency ?? ''}
              </div>
            </div>
            <div className="p-3 border rounded">
              <div className="text-xs text-neutral-500">Total</div>
              <div className="font-semibold">
                {s.grandTotal.toFixed(2)} {s.currency ?? ''}
              </div>
            </div>
          </div>
        )}
        {s?.updatedAt && (
          <div className="text-xs text-neutral-500">
            Updated {new Date(s.updatedAt).toLocaleString()}
            {s.fxAsOf ? ` • FX as of ${new Date(s.fxAsOf).toLocaleDateString()}` : ''}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Items ({items.length})</h2>
        <InlineItemsTable manifestId={id} items={items as any} />
        <section className="space-y-2 mt-4">
          <ReplaceItemsPanel id={id} items={items} />
        </section>
      </section>

      <section className="space-y-2">
        <ImportCsvForm id={id} />
      </section>

      {quote?.items?.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Allocations</h2>
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="text-left p-2 border-r">Item</th>
                  <th className="text-right p-2 border-r">Basis</th>
                  <th className="text-right p-2 border-r">Freight</th>
                  <th className="text-right p-2 border-r">Duty</th>
                  <th className="text-right p-2 border-r">VAT</th>
                  <th className="text-right p-2">Fees</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((q) => (
                  <tr key={q.id} className="odd:bg-white even:bg-neutral-50">
                    <td className="p-2 border-r">{q.id}</td>
                    <td className="p-2 border-r text-right">{q.basis.toFixed(2)}</td>
                    <td className="p-2 border-r text-right">{q.components.CIF.toFixed(2)}</td>
                    <td className="p-2 border-r text-right">{q.components.duty.toFixed(2)}</td>
                    <td className="p-2 border-r text-right">{q.components.vat.toFixed(2)}</td>
                    <td className="p-2 text-right">{q.components.fees.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
