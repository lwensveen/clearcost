import { auth } from '@/auth';
import { aggregate, fetchUsageByKey } from '@/lib/billing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listKeys } from '@/lib/api-keys';

export default async function UsagePage() {
  const session = await auth();
  const ownerId = session?.user?.id as string | undefined;
  if (!ownerId) return <div className="text-sm text-muted-foreground">Sign in to continue.</div>;

  const keys = await listKeys(ownerId);
  const rows = (
    await Promise.all(
      keys.map((k) =>
        fetchUsageByKey(
          k.id,
          new Date().toISOString().slice(0, 10).replace(/-\d+$/, '-01'),
          new Date().toISOString().slice(0, 10)
        )
      )
    )
  ).flat();

  const { totalReqs, avgMs, bytesIn, bytesOut, byRoute } = aggregate(rows);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">This month across your keys.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Total Requests" value={totalReqs.toLocaleString()} />
        <Stat title="Avg Latency" value={`${Math.round(avgMs)} ms`} />
        <Stat title="Ingress" value={`${(bytesIn / 1024).toFixed(1)} KB`} />
        <Stat title="Egress" value={`${(bytesOut / 1024).toFixed(1)} KB`} />
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>By endpoint</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Route</th>
                  <th className="p-2">Method</th>
                  <th className="p-2 text-right">Requests</th>
                  <th className="p-2 text-right">Avg ms</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byRoute.map((r) => (
                  <tr key={`${r.route}:${r.method}`}>
                    <td className="p-2">{r.route}</td>
                    <td className="p-2">{r.method}</td>
                    <td className="p-2 text-right">{r.count.toLocaleString()}</td>
                    <td className="p-2 text-right">{Math.round(r.sumDurationMs / r.count)} ms</td>
                  </tr>
                ))}
                {!byRoute.length && (
                  <tr>
                    <td className="p-2 text-sm text-muted-foreground" colSpan={4}>
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
