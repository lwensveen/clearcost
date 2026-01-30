'use server';

import { BillingCheckoutResponseSchema, BillingPortalResponseSchema } from '@clearcost/types';
import { extractErrorMessage } from '@/lib/errors';
import { requireEnvStrict } from '@/lib/env';

function getApiConfig() {
  const api = requireEnvStrict('CLEARCOST_API_URL');
  const key = requireEnvStrict('CLEARCOST_WEB_SERVER_KEY');
  const base = new URL(api);
  return { api, key, base, allowedHosts: new Set<string>([base.hostname]) };
}

function buildApiUrl(path: string): URL {
  const { base, allowedHosts } = getApiConfig();
  const url = new URL(path, base);
  if (!allowedHosts.has(url.hostname)) throw new Error('Refused external API host');
  return url;
}

async function safeApiError(r: Response, fallback: string): Promise<string> {
  try {
    const data = await r.json();
    const msg = extractErrorMessage(data, '');
    if (msg) return msg.slice(0, 300);
  } catch {
    // ignore JSON parse errors
  }
  try {
    const txt = await r.text();
    if (txt) return txt.slice(0, 300);
  } catch {
    // ignore text read errors
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
  } catch {
    // ignore invalid URLs
  }
  return undefined;
}

async function postJSON(path: string, body: unknown) {
  const url = buildApiUrl(path);
  const { key } = getApiConfig();
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': key, 'content-type': 'application/json' },
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
  const raw = await postJSON('/v1/billing/checkout', {
    plan,
    returnUrl: sanitizeReturnUrl(returnUrl),
  });
  const { url } = BillingCheckoutResponseSchema.parse(raw);
  return url as string;
}

export async function openPortal(returnUrl?: string) {
  const raw = await postJSON('/v1/billing/portal', {
    returnUrl: sanitizeReturnUrl(returnUrl),
  });
  const { url } = BillingPortalResponseSchema.parse(raw);
  return url as string;
}
