import 'server-only';
import {
  BillingEntitlementsResponseSchema,
  BillingPlanResponseSchema,
  ErrorResponseSchema,
  UsageResponseSchema,
} from '@clearcost/types';
import { UpstreamError, extractErrorMessage } from './errors';
import { requireEnvStrict } from './env';

export type UsageRow = {
  day: string; // YYYY-MM-DD
  route: string; // e.g., /v1/quotes
  method: string; // GET/POST
  count: number;
  sumDurationMs: number;
  sumBytesIn: number;
  sumBytesOut: number;
};

function getAdminEnv() {
  return {
    api: requireEnvStrict('CLEARCOST_API_URL'),
    key: requireEnvStrict('CLEARCOST_ADMIN_API_KEY'),
  };
}

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

async function readError(res: Response): Promise<{ message: string; body?: string }> {
  const text = await res.text();
  if (!text) return { message: 'request failed' };
  try {
    const parsed = ErrorResponseSchema.safeParse(JSON.parse(text));
    if (parsed.success) {
      return { message: extractErrorMessage(parsed.data, 'request failed'), body: text };
    }
  } catch {
    // ignore JSON parse errors
  }
  return { message: extractErrorMessage(text, text), body: text };
}

export async function fetchBillingPlan(): Promise<BillingPlan> {
  const { api, key } = getAdminEnv();
  const r = await fetch(`${api}/v1/billing/plan`, {
    headers: { 'x-api-key': key },
    cache: 'no-store',
  });
  if (!r.ok) {
    const { message, body } = await readError(r);
    throw new UpstreamError(r.status, `${r.status} ${message}`, body);
  }
  const raw = await r.json();
  const j = BillingPlanResponseSchema.parse(raw);
  // normalize date → ISO string for server components
  return {
    ...j,
    currentPeriodEnd: j.currentPeriodEnd ? j.currentPeriodEnd.toISOString() : null,
  };
}

export async function fetchUsageByKey(
  apiKeyId: string,
  from?: string,
  to?: string
): Promise<UsageRow[]> {
  const { api, key } = getAdminEnv();
  const url = `${api}/v1/admin/usage/by-key/${encodeURIComponent(apiKeyId)}${qs({ from, to })}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!r.ok) {
    const { message, body } = await readError(r);
    throw new UpstreamError(r.status, `${r.status} ${message}`, body);
  }
  const raw = await r.json();
  const parsed = UsageResponseSchema.parse(raw);
  return parsed.map((row) => ({
    day:
      row.day instanceof Date
        ? row.day.toISOString().slice(0, 10)
        : String(row.day ?? '').slice(0, 10),
    route: row.route,
    method: row.method,
    count: row.count,
    sumDurationMs: row.sumDurationMs,
    sumBytesIn: row.sumBytesIn,
    sumBytesOut: row.sumBytesOut,
  }));
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

export type Entitlements = {
  plan: string;
  maxManifests: number;
  maxItemsPerManifest: number;
};

export async function fetchEntitlements(): Promise<Entitlements> {
  const { api, key } = getAdminEnv();
  const r = await fetch(`${api}/v1/billing/entitlements`, {
    headers: { 'x-api-key': key },
    cache: 'no-store',
  });
  if (!r.ok) {
    const { message, body } = await readError(r);
    throw new UpstreamError(r.status, `${r.status} ${message}`, body);
  }
  const raw = await r.json();
  return BillingEntitlementsResponseSchema.parse(raw);
}
