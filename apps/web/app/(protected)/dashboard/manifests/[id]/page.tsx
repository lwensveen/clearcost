import { notFound, redirect } from 'next/navigation';
import { getManifestFull, getManifestQuotes, getManifestQuotesHistory } from '@/lib/manifests';
import {
  cloneManifestAction,
  computeManifestAction,
  deleteManifestAction,
  importItemsCsvAction,
} from '../actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ManifestItemCoerced, ManifestItemQuoteCoerced } from '@clearcost/types';

function money(n?: number, c?: string) {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: c || 'USD' }).format(n);
  } catch {
    return `${c ?? 'USD'} ${n.toFixed(2)}`;
  }
}

export default async function ManifestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const data = await getManifestFull(id).catch(() => null);
  if (!data) notFound();

  const latest = await getManifestQuotes(id).catch(() => null);
  const history = await getManifestQuotesHistory(id).catch(() => null);

  const m = data;
  const items: ManifestItemCoerced[] = Array.isArray(m.items) ? m.items : [];

  const s = latest?.summary ?? null;

  async function actionImport(formData: FormData) {
    'use server';
    const mode = (formData.get('mode') as 'append' | 'replace') || 'append';
    const file = formData.get('file') as File | null;
    if (!file) throw new Error('CSV required');
    const text = await file.text();
    await importItemsCsvAction(id, text, mode, false);
  }

  async function actionCompute(formData: FormData) {
    'use server';
    const allocation =
      (formData.get('allocation') as 'chargeable' | 'volumetric' | 'weight') ?? 'chargeable';
    await computeManifestAction(id, allocation, false);
  }

  async function actionClone(formData: FormData) {
    'use server';
    const name = String(formData.get('name') || '');
    await cloneManifestAction(id, name || undefined);
  }

  async function actionDelete() {
    'use server';
    await deleteManifestAction(id);
    redirect('/dashboard/manifests');
  }

  // quotes history is an array of item-quote snapshots
  const historyItems: ManifestItemQuoteCoerced[] = Array.isArray(history) ? history : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{m.name ?? m.id}</h1>
          <p className="text-sm text-muted-foreground">
            {(m.origin ?? '—').toString()} → {(m.dest ?? '—').toString()} • mode{' '}
            {(m.shippingMode ?? '—').toString()} • pricing {(m.pricingMode ?? '—').toString()}
          </p>
        </div>
        <form action={actionDelete}>
          <Button variant="destructive">Delete</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Ref</th>
                  <th className="text-left p-2">HS6</th>
                  <th className="text-left p-2">Category</th>
                  <th className="text-left p-2">Value</th>
                  <th className="text-left p-2">Weight(kg)</th>
                  <th className="text-left p-2">Dims (cm)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id ?? idx} className="border-t">
                    <td className="p-2">{it.reference ?? ''}</td>
                    <td className="p-2">{it.hs6 ?? ''}</td>
                    <td className="p-2">{it.categoryKey ?? ''}</td>
                    <td className="p-2">
                      {(it.itemValueCurrency ?? '').toString()} {it.itemValueAmount ?? ''}
                    </td>
                    <td className="p-2">{it.weightKg ?? ''}</td>
                    <td className="p-2">
                      {(it.dimsCm?.l ?? '').toString()}×{(it.dimsCm?.w ?? '').toString()}×
                      {(it.dimsCm?.h ?? '').toString()}
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={6}>
                      No items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <a href={`/api/clearcost/manifests/${encodeURIComponent(m.id)}/items.csv`}>
                Export CSV
              </a>
            </Button>

            <form
              action={actionImport}
              className="flex items-center gap-2"
              encType="multipart/form-data"
            >
              <input type="file" name="file" accept=".csv,text/csv" className="text-sm" required />
              <select name="mode" className="border rounded p-1 text-sm" defaultValue="append">
                <option value="append">Append</option>
                <option value="replace">Replace</option>
              </select>
              <Button variant="outline">Import CSV</Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compute</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={actionCompute} className="flex items-center gap-2 flex-wrap">
            <label className="text-sm">Allocation</label>
            <select
              name="allocation"
              className="border rounded p-1 text-sm"
              defaultValue="chargeable"
            >
              <option value="chargeable">chargeable</option>
              <option value="volumetric">volumetric</option>
              <option value="weight">weight</option>
            </select>
            <Button>Run</Button>
          </form>

          {!!s && (
            <div className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span>Freight</span>
                <span>{money(s.freightTotal, s.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Duty</span>
                <span>{money(s.dutyTotal, s.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT</span>
                <span>{money(s.vatTotal, s.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Fees</span>
                <span>{money(s.feesTotal, s.currency)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{money(s.grandTotal, s.currency)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Last update: {s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '—'}
                {s.fxAsOf ? ` • FX as of ${new Date(s.fxAsOf).toLocaleDateString()}` : ''}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History & Clone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3 text-sm">
            <div className="mb-2">Recent quote history (per item):</div>
            <ul className="list-disc ml-5">
              {historyItems.map((h, i) => (
                <li key={h.id ?? i}>
                  item {h.itemId ?? h.id ?? '—'} — basis{' '}
                  {typeof h.basis === 'number' ? h.basis.toFixed(2) : '—'} — CIF{' '}
                  {h.components?.CIF?.toFixed?.(2) ?? '—'} — FX{' '}
                  {h.fxAsOf ? new Date(h.fxAsOf).toLocaleDateString() : '—'}
                </li>
              ))}
              {!historyItems.length && <li className="text-muted-foreground">No history</li>}
            </ul>
          </div>

          <form action={actionClone} className="flex gap-2">
            <input
              className="border rounded p-2 text-sm"
              name="name"
              placeholder="Clone name (optional)"
            />
            <Button variant="outline">Clone</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
