import { NextResponse } from 'next/server';
import { requireEnvStrict } from '@/lib/env';
import { errorJson } from '@/lib/http';
import { requireSession } from '@/lib/route-auth';

function getBillingProxyConfig() {
  return {
    api: requireEnvStrict('CLEARCOST_API_URL'),
    key: requireEnvStrict('CLEARCOST_WEB_SERVER_KEY'),
  };
}

export async function GET(req: Request) {
  const authResult = await requireSession(req);
  if (!authResult.ok) return authResult.response;

  const { api, key } = getBillingProxyConfig();
  const r = await fetch(`${api}/v1/billing/plan`, {
    headers: { 'x-api-key': key },
    cache: 'no-store',
  });
  const body = await r.text().catch(() => '');
  if (!r.ok) {
    return errorJson(body || 'Failed to load plan', r.status);
  }
  return new NextResponse(body, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
