import { NextResponse } from 'next/server';
import { requireEnvStrict } from '@/lib/env';
import { errorJson } from '@/lib/http';

function getBillingProxyConfig() {
  return {
    api: requireEnvStrict('CLEARCOST_API_URL'),
    key: requireEnvStrict('CLEARCOST_WEB_SERVER_KEY'),
  };
}

export async function GET() {
  const { api, key } = getBillingProxyConfig();
  const r = await fetch(`${api}/v1/billing/entitlements`, {
    headers: { 'x-api-key': key },
    cache: 'no-store',
  });
  const body = await r.text();
  if (!r.ok) return errorJson(body || 'Failed to load entitlements', r.status);
  return new NextResponse(body, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
