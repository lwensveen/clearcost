import Link from 'next/link';
import { listRecent } from '@/lib/quotes';

export default async function QuotesPage() {
  const data = await listRecent(50);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold">Quotes</h1>
        <Link href="//dashboard/quotes/new" className="rounded bg-black px-3 py-2 text-white">
          New quote
        </Link>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">Lane</th>
              <th className="px-3 py-2 text-left">Mode</th>
              <th className="px-3 py-2 text-right">Item</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Duty</th>
              <th className="px-3 py-2 text-right">VAT</th>
              <th className="px-3 py-2 text-right">Fees</th>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r: any) => (
              <tr key={r.idemKey} className="border-t">
                <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">
                  {r.origin} → {r.dest}
                </td>
                <td className="px-3 py-2">{r.mode ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  {r.currency ? `${r.currency} ${r.itemValue?.toFixed?.(2) ?? '—'}` : '—'}
                </td>
                <td className="px-3 py-2 text-right">{r.total.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{r.duty.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{r.vat != null ? r.vat.toFixed(2) : '—'}</td>
                <td className="px-3 py-2 text-right">{r.fees.toFixed(2)}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.idemKey}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`//dashboard/quotes/replay?key=${encodeURIComponent(r.idemKey)}`}
                    className="underline text-blue-600"
                  >
                    Replay
                  </Link>
                </td>
              </tr>
            ))}
            {!data.rows.length && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={10}>
                  No quotes yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        This table shows only <strong>fresh computations</strong> (billable). Replays don’t appear
        here.
      </p>
    </div>
  );
}
