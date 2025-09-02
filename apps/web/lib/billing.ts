export type UsageRow = {
  id?: string;
  apiKeyId?: string;
  day: string; // YYYY-MM-DD
  route: string; // e.g., /v1/quotes
  method: string; // GET/POST
  count: number;
  sumDurationMs: number;
  sumBytesIn: number;
  sumBytesOut: number;
};

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_ADMIN_API_KEY!;

function qs(params: Record<string, string | undefined>) {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && s.set(k, v));
  const str = s.toString();
  return str ? `?${str}` : '';
}

export type BillingPlan = {
  plan: string; // 'free' | 'starter' | 'growth' | 'scale' | ...
  status: string | null; // 'active' | 'trialing' | 'past_due' | ...
  priceId?: string | null;
  currentPeriodEnd?: string | null; // ISO when serialized across fetch
};

export async function fetchBillingPlan(): Promise<BillingPlan> {
  const r = await fetch(`${API}/v1/billing/plan`, {
    headers: { 'x-api-key': KEY },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`plan ${r.status}`);
  const j = await r.json();
  // normalize date → ISO string for server components
  return {
    ...j,
    currentPeriodEnd: j.currentPeriodEnd ? new Date(j.currentPeriodEnd).toISOString() : null,
  };
}

export async function fetchUsageByKey(
  apiKeyId: string,
  from?: string,
  to?: string
): Promise<UsageRow[]> {
  if (!API || !KEY) throw new Error('Missing CLEARCOST_API_URL or CLEARCOST_ADMIN_API_KEY');
  const url = `${API}/v1/usage/by-key/${encodeURIComponent(apiKeyId)}${qs({ from, to })}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export function aggregate(rows: UsageRow[]) {
  const totalReqs = rows.reduce((s, r) => s + Number(r.count), 0);
  const totalMs = rows.reduce((s, r) => s + Number(r.sumDurationMs), 0);
  const avgMs = totalReqs ? totalMs / totalReqs : 0;
  const bytesIn = rows.reduce((s, r) => s + Number(r.sumBytesIn), 0);
  const bytesOut = rows.reduce((s, r) => s + Number(r.sumBytesOut), 0);

  const map = new Map<
    string,
    { route: string; method: string; count: number; sumDurationMs: number }
  >();
  for (const r of rows) {
    const k = `${r.route} ${r.method}`;
    const prev = map.get(k) ?? { route: r.route, method: r.method, count: 0, sumDurationMs: 0 };
    prev.count += Number(r.count);
    prev.sumDurationMs += Number(r.sumDurationMs);
    map.set(k, prev);
  }
  const byRoute = Array.from(map.values()).sort((a, b) => b.count - a.count);

  return { totalReqs, totalMs, avgMs, bytesIn, bytesOut, byRoute };
}

export function rowsToCSV(rows: UsageRow[]) {
  const header = ['day', 'route', 'method', 'count', 'sumDurationMs', 'sumBytesIn', 'sumBytesOut'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.day,
        JSON.stringify(r.route),
        r.method,
        r.count,
        r.sumDurationMs,
        r.sumBytesIn,
        r.sumBytesOut,
      ].join(',')
    );
  }
  return lines.join('\n');
}

export async function fetchEntitlements() {
  const r = await fetch(`${process.env.CLEARCOST_API_URL}/v1/billing/entitlements`, {
    headers: { 'x-api-key': process.env.CLEARCOST_WEB_SERVER_KEY! },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`entitlements ${r.status}`);
  return r.json() as Promise<{ plan: string; maxManifests: number; maxItemsPerManifest: number }>;
}
