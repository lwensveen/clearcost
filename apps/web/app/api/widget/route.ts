import { NextRequest, NextResponse } from 'next/server';
import { requireEnvStrict } from '@/lib/env';
import { errorJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

function reqIdem(req: NextRequest) {
  const h = req.headers.get('idempotency-key') || '';
  return typeof h === 'string' && h.length > 0 ? h : undefined;
}

export async function POST(req: NextRequest) {
  const widgetProxyEnabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_PUBLIC_WIDGET_PROXY === '1';
  if (!widgetProxyEnabled) {
    return errorJson('Widget proxy is disabled', 403);
  }

  let API: string;
  let KEY: string;
  try {
    API = requireEnvStrict('CLEARCOST_API_URL');
    KEY = requireEnvStrict('CLEARCOST_WEB_SERVER_KEY');
  } catch {
    return errorJson('Server misconfigured', 500);
  }

  // Fixed path (no user-controlled segments)
  const url = `${API.replace(/\/$/, '')}/v1/quotes`;

  const body = await req.text(); // pass-through
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': KEY,
      'content-type': 'application/json',
      // forward idempotency if provided
      ...(reqIdem(req) ? { 'idempotency-key': reqIdem(req)! } : {}),
    },
    body,
    cache: 'no-store',
    redirect: 'manual',
  });

  // mirror body + content-type + rate-limit headers
  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'ratelimit-limit': res.headers.get('ratelimit-limit') ?? '',
      'ratelimit-remaining': res.headers.get('ratelimit-remaining') ?? '',
      'ratelimit-reset': res.headers.get('ratelimit-reset') ?? '',
    },
  });
}
