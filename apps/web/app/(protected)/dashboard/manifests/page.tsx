import Link from 'next/link';
import { listManifests } from '@/lib/manifests';
import { createManifestAction } from './actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function fmtDate(d?: string | Date) {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString();
}

export default async function ManifestsPage() {
  const data = await listManifests();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Manifests</h1>
          <p className="text-sm text-muted-foreground">
            Bulk-quote shipments. Upload items by CSV or create a shell and add later.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="//dashboard/manifests/new">Quick CSV</Link>
          </Button>
          <Button asChild>
            <Link href="//dashboard/manifests/new">New manifest</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Manifests</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Origin</th>
                <th className="px-3 py-2 text-left font-medium">Dest</th>
                <th className="px-3 py-2 text-left font-medium">Mode</th>
                <th className="px-3 py-2 text-left font-medium">Created</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((m) => {
                const origin = m.origin ?? '—';
                const dest = m.dest ?? '—';
                return (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link
                        className="text-blue-600 hover:underline"
                        href={`//dashboard/manifests/${m.id}`}
                      >
                        {m.name ?? m.id}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{origin}</td>
                    <td className="px-3 py-2">{dest}</td>
                    <td className="px-3 py-2">
                      {m.shippingMode ? <Badge variant="secondary">{m.shippingMode}</Badge> : '—'}
                    </td>
                    <td className="px-3 py-2">{fmtDate(m.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`//dashboard/manifests/${m.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {data.rows.length === 0 && (
                <tr>
                  <td className="px-3 py-10 text-center text-muted-foreground" colSpan={6}>
                    No manifests yet. Create one below to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {data.nextCursor && (
            <p className="mt-3 text-xs text-muted-foreground">
              More available… <code className="font-mono">{data.nextCursor}</code>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create manifest</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createManifestAction} className="grid max-w-xl grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Name</span>
              <input
                className="w-full rounded-md border bg-background p-2"
                name="name"
                placeholder="Name (e.g. EU Launch)"
              />
            </label>
            <div />
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Origin</span>
              <input
                className="w-full rounded-md border bg-background p-2"
                name="origin"
                defaultValue="US"
                placeholder="Origin ISO"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Destination</span>
              <input
                className="w-full rounded-md border bg-background p-2"
                name="dest"
                defaultValue="DE"
                placeholder="Dest ISO"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Mode</span>
              <select
                className="w-full rounded-md border bg-background p-2"
                name="shippingMode"
                defaultValue="air"
              >
                <option value="air">air</option>
                <option value="sea">sea</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Pricing</span>
              <select
                className="w-full rounded-md border bg-background p-2"
                name="pricingMode"
                defaultValue="auto"
              >
                <option value="auto">auto</option>
                <option value="fixed">fixed</option>
              </select>
            </label>
            <div className="col-span-2">
              <button className="rounded bg-black px-3 py-2 text-white" type="submit">
                Create
              </button>
              <span className="ml-3 text-xs text-muted-foreground">
                You can add items via CSV after creating.
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
