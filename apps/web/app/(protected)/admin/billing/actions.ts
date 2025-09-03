'use server';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

const API_BASE = new URL(API);
const ALLOWED_HOSTS = new Set<string>([API_BASE.hostname]);

function buildApiUrl(path: string): URL {
  const url = new URL(path, API_BASE);
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('Refused external API host');
  return url;
}

async function safeApiError(r: Response, fallback: string): Promise<string> {
  try {
    const data = await r.json();
    const msg = (data && (data.error || data.message)) || '';
    if (typeof msg === 'string' && msg) return msg.slice(0, 300);
  } catch {
    /* empty */
  }
  try {
    const txt = await r.text();
    if (txt) return txt.slice(0, 300);
  } catch {
    /* empty */
  }
  return fallback;
}

function sanitizeReturnUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if ((u.protocol === 'https:' || u.protocol === 'http:') && !(u.username || u.password)) {
      return u.toString();
    }
  } catch {}
  return undefined;
}

async function postJSON(path: string, body: unknown) {
  const url = buildApiUrl(path);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await safeApiError(r, `${r.status}`));
  return r.json();
}

type Plan = 'starter' | 'growth' | 'scale';
const ALLOWED_PLANS = new Set<Plan>(['starter', 'growth', 'scale']);

export async function createCheckout(plan: Plan, returnUrl?: string) {
  if (!ALLOWED_PLANS.has(plan)) throw new Error('Invalid plan');
  const { url } = await postJSON('/v1/billing/checkout', {
    plan,
    returnUrl: sanitizeReturnUrl(returnUrl),
  });
  return url as string;
}

export async function openPortal(returnUrl?: string) {
  const { url } = await postJSON('/v1/billing/portal', {
    returnUrl: sanitizeReturnUrl(returnUrl),
  });
  return url as string;
}
