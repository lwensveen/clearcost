import { notFound, redirect } from 'next/navigation';
import {
  cloneManifest,
  computeManifest,
  deleteManifest,
  getHistory,
  getLatestQuote,
  getManifestFull,
  importItemsCsv,
} from '../actions';

type Dims = { l?: number; w?: number; h?: number };
type Item = {
  id?: string;
  reference?: string;
  hs6?: string;
  categoryKey?: string;
  itemValueCurrency?: string;
  itemValueAmount?: number;
  weightKg?: number;
  dimsCm?: Dims;
};

type Manifest = {
  id: string;
  name?: string;
  origin?: string;
  dest?: string;
  shippingMode?: string;
  pricingMode?: string;
  items?: Item[];
};

type HistoryItem = {
  id?: string;
  createdAt?: string | Date;
  idemKey?: string;
  allocation?: string;
  dryRun?: boolean;
};

type LatestSummary = {
  currency?: string;
  freight?: number;
  duty?: number;
  vat?: number;
  fees?: number;
  grandTotal?: number;
  updatedAt?: string | Date;
};

function money(n?: number, c?: string) {
  if (n == null) return '-';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: c || 'USD' }).format(n);
  } catch {
    return `${c ?? 'USD'} ${n.toFixed(2)}`;
  }
}

export default async function ManifestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const data = (await getManifestFull(id).catch(() => null)) as Manifest | null;
  if (!data) notFound();

  const latestRaw = await getLatestQuote(id).catch(() => null);
  const historyRaw = await getHistory(id).catch(() => null);

  const latestSummary: LatestSummary | null = (() => {
    if (!latestRaw || typeof latestRaw !== 'object') return null;
    if ('summary' in latestRaw && latestRaw.summary && typeof latestRaw.summary === 'object') {
      return latestRaw.summary as LatestSummary;
    }
    return latestRaw as LatestSummary;
  })();

  const historyItems: HistoryItem[] = (() => {
    if (!historyRaw) return [];
    if (Array.isArray((historyRaw as any).items)) return (historyRaw as any).items as HistoryItem[];
    if (Array.isArray(historyRaw)) return historyRaw as HistoryItem[];
    return [];
  })();

  async function actionExport() {
    'use server';
    redirect(`/api/clearcost/manifests/${id}/items.csv`);
  }

  async function actionImport(formData: FormData) {
    'use server';
    const mode = (formData.get('mode') as 'append' | 'replace') || 'append';
    const file = formData.get('file') as File | null;
    if (!file) throw new Error('CSV required');
    const text = await file.text();
    await importItemsCsv(id, text, mode, false);
  }

  async function actionCompute(formData: FormData) {
    'use server';
    const allocation =
      (formData.get('allocation') as 'chargeable' | 'volumetric' | 'weight') ?? 'chargeable';
    await computeManifest(id, allocation, false);
  }

  async function actionClone(formData: FormData) {
    'use server';
    const name = String(formData.get('name') || '');
    await cloneManifest(id, name || undefined);
  }

  async function actionDelete() {
    'use server';
    await deleteManifest(id);
  }

  const m = data;
  const items = Array.isArray(m.items) ? m.items : [];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{m.name ?? m.id}</h1>
          <p className="text-sm text-slate-600">
            {(m.origin ?? '—').toString()} → {(m.dest ?? '—').toString()} • mode:{' '}
            {(m.shippingMode ?? '—').toString()} • pricing: {(m.pricingMode ?? '—').toString()}
          </p>
        </div>
        <form action={actionDelete}>
          <button className="text-red-600 border border-red-200 rounded px-3 py-1">Delete</button>
        </form>
      </header>

      {/* Items */}
      <section>
        <h2 className="font-medium mb-2">Items ({items.length})</h2>
        <div className="rounded border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
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
                  <td className="p-3 text-slate-500" colSpan={6}>
                    No items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 mt-3">
          <form action={actionExport}>
            <button className="rounded border px-3 py-1">Export CSV</button>
          </form>

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
            <button className="rounded border px-3 py-1">Import CSV</button>
          </form>
        </div>
      </section>

      {/* Compute */}
      <section className="space-y-2">
        <h2 className="font-medium">Compute</h2>
        <form action={actionCompute} className="flex items-center gap-2">
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
          <button className="rounded bg-black text-white px-3 py-1">Run</button>
        </form>

        {/* Latest summary (if any) */}
        {latestSummary && (
          <div className="rounded border p-3 text-sm">
            <div className="flex justify-between">
              <span>Freight</span>
              <span>{money(latestSummary.freight, latestSummary.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>Duty</span>
              <span>{money(latestSummary.duty, latestSummary.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT</span>
              <span>{money(latestSummary.vat, latestSummary.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>Fees</span>
              <span>{money(latestSummary.fees, latestSummary.currency)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{money(latestSummary.grandTotal, latestSummary.currency)}</span>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Last update:{' '}
              {latestSummary.updatedAt ? new Date(latestSummary.updatedAt).toLocaleString() : '—'}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">History & Clone</h2>
        <div className="rounded border p-3 text-sm">
          <div className="mb-2">Recent compute runs:</div>
          <ul className="list-disc ml-5">
            {historyItems.map((h, i) => (
              <li key={h.id ?? i}>
                {h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'} — key{' '}
                {h.idemKey ?? '—'} — {h.allocation ?? '—'} {h.dryRun ? '(dry)' : ''}
              </li>
            ))}
            {!historyItems.length && <li className="text-slate-500">No history</li>}
          </ul>
        </div>
        <form action={actionClone} className="flex gap-2">
          <input
            className="border rounded p-2 text-sm"
            name="name"
            placeholder="Clone name (optional)"
          />
          <button className="rounded border px-3 py-1">Clone</button>
        </form>
      </section>
    </div>
  );
}
