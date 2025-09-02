import { fetchManifestFull, fetchManifestQuote } from '@/lib/cc';
import { ComputeButton } from '@/components/manifest/ComputeButton';
import { ImportCsvForm } from '@/components/manifest/ImportCsvForm';
import { ReplaceItemsPanel } from '@/components/manifest/ReplaceItemsPanel';
import { fetchBillingPlan } from '@/lib/billing';

type Props = { params: Promise<{ id: string }> };

export const revalidate = 0;

export default async function ManifestDetailPage({ params }: Props) {
  const { id } = await params;
  const [full, quote, plan] = await Promise.all([
    fetchManifestFull(id),
    fetchManifestQuote(id),
    fetchBillingPlan(),
  ]);
  const items = full?.items ?? [];
  const s = quote?.summary;

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manifest {full?.manifest?.name ?? id}</h1>

        <div className="flex gap-2">
          <a className="px-3 py-2 rounded border text-sm" href={`/api/cc/manifest/${id}/items-csv`}>
            Export CSV
          </a>
          <ComputeButton id={id} plan={plan?.plan} />
        </div>
      </div>

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
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="text-left p-2 border-r">Reference</th>
                <th className="text-left p-2 border-r">HS6</th>
                <th className="text-right p-2 border-r">Value</th>
                <th className="text-right p-2 border-r">Weight (kg)</th>
                <th className="text-left p-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any) => (
                <tr key={it.id} className="odd:bg-white even:bg-neutral-50">
                  <td className="p-2 border-r">{it.reference ?? ''}</td>
                  <td className="p-2 border-r">{it.hs6 ?? ''}</td>
                  <td className="p-2 border-r text-right">
                    {it.itemValueAmount} {it.itemValueCurrency}
                  </td>
                  <td className="p-2 border-r text-right">{it.weightKg}</td>
                  <td className="p-2">{it.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <section className="space-y-2">
            <ReplaceItemsPanel id={id} items={items} />
          </section>
        </div>
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
