import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Status — ClearCost',
  description: 'Live service status and uptime information',
};

type StatusItem = { name: string; status: 'operational' | 'degraded' | 'outage' | 'maintenance' };

function Pill({ status }: { status: StatusItem['status'] }) {
  const map: Record<StatusItem['status'], string> = {
    operational: 'bg-green-500/15 text-green-500',
    degraded: 'bg-yellow-500/15 text-yellow-500',
    outage: 'bg-red-500/15 text-red-500',
    maintenance: 'bg-blue-500/15 text-blue-500',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}>{status}</span>
  );
}

export default async function StatusPage() {
  const components: StatusItem[] = [
    { name: 'API', status: 'operational' },
    { name: 'Dashboard', status: 'operational' },
    { name: 'Website', status: 'operational' },
  ];

  const overall: StatusItem['status'] = components.some((c) => c.status === 'outage')
    ? 'outage'
    : components.some((c) => c.status === 'degraded' || c.status === 'maintenance')
      ? 'degraded'
      : 'operational';

  return (
    <>
      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-12 flex items-center justify-between">
          <h1 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">Status</h1>
          <Pill status={overall} />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {components.map((c) => (
                <div key={c.name} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{c.name}</div>
                    <Pill status={c.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">All systems operational.</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              For incidents and history, publish updates here or link to your external status page.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
