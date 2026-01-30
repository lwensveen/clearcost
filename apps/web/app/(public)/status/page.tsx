import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { formatError } from '@/lib/errors';

export const metadata: Metadata = {
  title: 'Status — ClearCost',
  description: 'Live service status and uptime information',
};

type Health = {
  ok: boolean;
  service: string;
  time: { server: string; uptimeSec: number; tz: string };
  db: { ok: boolean; latencyMs: number | null };
  fxCache: {
    ok: boolean | null;
    latest: string | null;
    ageHours: number | null;
    maxAgeHours: number;
  };
  version: { commit: string | null; env: string };
  durationMs: number;
};

type Status = 'operational' | 'degraded' | 'outage' | 'maintenance';
type StatusItem = { name: string; status: Status; note?: string };

function Pill({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    operational: 'bg-green-500/15 text-green-500',
    degraded: 'bg-yellow-500/15 text-yellow-500',
    outage: 'bg-red-500/15 text-red-500',
    maintenance: 'bg-blue-500/15 text-blue-500',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}>{status}</span>
  );
}

async function fetchHealth(): Promise<{ health: Health | null; error?: string }> {
  const BASE = process.env.CLEARCOST_API_URL || process.env.NEXT_PUBLIC_CLEARCOST_API_URL || '';
  const url = `${BASE}/healthz`;
  try {
    const r = await fetch(url, { next: { revalidate: 30 }, cache: 'no-store' });
    if (!r.ok) return { health: null, error: `${r.status} ${r.statusText}` };
    const json = (await r.json()) as Health;
    return { health: json };
  } catch (e: unknown) {
    return { health: null, error: formatError(e, 'Fetch failed') };
  }
}

function computeComponents(
  h: Health | null,
  error?: string
): { overall: Status; items: StatusItem[] } {
  if (!h) {
    const items: StatusItem[] = [
      { name: 'API', status: 'outage', note: error ? `Fetch error: ${error}` : 'Unreachable' },
      { name: 'Dashboard', status: 'degraded', note: 'Limited functionality without API' },
      { name: 'Website', status: 'operational', note: 'This page served OK' },
    ];
    return { overall: 'degraded', items };
  }

  let apiStatus: Status = h.ok ? 'operational' : 'outage';
  let apiNote = `DB ${h.db.ok ? 'OK' : 'down'}`;
  if (h.fxCache.ok === false) {
    apiStatus = h.db.ok ? 'degraded' : 'outage';
    const age = h.fxCache.ageHours != null ? `${h.fxCache.ageHours.toFixed(1)}h old` : 'stale';
    apiNote += `; FX ${age} (max ${h.fxCache.maxAgeHours}h)`;
  } else if (h.fxCache.ok === null) {
    apiNote += '; FX unknown';
  } else {
    apiNote += '; FX fresh';
  }

  const items: StatusItem[] = [
    { name: 'API', status: apiStatus, note: apiNote },
    {
      name: 'Dashboard',
      status: apiStatus === 'operational' ? 'operational' : 'degraded',
      note: 'Depends on API',
    },
    { name: 'Website', status: 'operational', note: 'Marketing pages served' },
  ];

  const overall: Status = items.some((c) => c.status === 'outage')
    ? 'outage'
    : items.some((c) => c.status === 'degraded' || c.status === 'maintenance')
      ? 'degraded'
      : 'operational';

  return { overall, items };
}

export default async function StatusPage() {
  const { health, error } = await fetchHealth();
  const { overall, items } = computeComponents(health, error);

  return (
    <>
      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-12 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">
              Status
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {health
                ? `Checked at ${new Date(health.time.server).toLocaleString()} (${health.time.tz})`
                : 'Unable to reach API /healthz'}
            </p>
          </div>
          <Pill status={overall} />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {items.map((c) => (
                <div key={c.name} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{c.name}</div>
                    <Pill status={c.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{c.note || '—'}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-card p-4 text-sm">
                <div className="mb-2 font-medium">API details</div>
                <ul className="space-y-1 text-muted-foreground">
                  <li>
                    DB:{' '}
                    {health
                      ? health.db.ok
                        ? `OK (${health.db.latencyMs ?? '?'} ms)`
                        : 'DOWN'
                      : '—'}
                  </li>
                  <li>
                    FX cache:{' '}
                    {health
                      ? health.fxCache.ok === true
                        ? `fresh (age ${health.fxCache.ageHours?.toFixed(1)}h, max ${health.fxCache.maxAgeHours}h)`
                        : health.fxCache.ok === false
                          ? `stale (age ${health.fxCache.ageHours?.toFixed(1)}h, max ${health.fxCache.maxAgeHours}h)`
                          : 'unknown'
                      : '—'}
                  </li>
                  <li>API latency (server build): {health ? `${health.durationMs} ms` : '—'}</li>
                  <li>Env: {health?.version.env ?? '—'}</li>
                  <li>Commit: {health?.version.commit ?? '—'}</li>
                </ul>
              </div>

              <div className="rounded-lg border bg-card p-4 text-sm">
                <div className="mb-2 font-medium">Notes</div>
                <p className="text-muted-foreground">
                  This page refreshes roughly every 30s. For incident history, link an external
                  status page or publish updates here.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
